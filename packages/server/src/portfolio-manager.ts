import { v4 as uuidv4, v5 as uuidv5, validate as isUuid } from 'uuid';
import { eq, and, sql } from 'drizzle-orm';
import type { Portfolio, Trade, Order, SupportedSymbol } from '@orderbook/shared';
import { SUPPORTED_SYMBOLS } from '@orderbook/shared';
import {
  db as defaultDb,
  portfolios,
  securitiesHoldings,
  orders,
  trades as tradesTable,
  users,
  type Database,
} from './db/index.js';
import {
  LedgerService,
  ledgerService as defaultLedgerService,
} from './services/ledger.js';

const STARTING_USD = 10_000;
const STARTING_STOCKS = 100;
const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/** Deterministically maps any arbitrary string ID to a valid RFC4122 UUID */
export function toValidUuid(id: string): string {
  if (isUuid(id)) return id;
  return uuidv5(id, UUID_NAMESPACE);
}

/** Error thrown when a trader has insufficient cash for execution or order placement */
export class InsufficientFundsError extends Error {
  constructor(
    message: string,
    public userId: string = '',
    public required: number = 0,
    public available: number = 0
  ) {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}

/** Error thrown when a seller has insufficient custody of securities for delivery */
export class InsufficientCustodyError extends Error {
  constructor(
    message: string,
    public userId: string = '',
    public symbol: string = '',
    public required: number = 0,
    public available: number = 0
  ) {
    super(message);
    this.name = 'InsufficientCustodyError';
  }
}

/** Error thrown when row lock acquisition fails or required database entities are missing */
export class SettlementLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettlementLockError';
  }
}

export interface SettleTradesParams {
  trades: Trade[];
  takerOrder?: Order;
  symbolId?: string;
  isolationLevel?: 'repeatable read' | 'read committed' | 'serializable';
}

export interface SettlementResult {
  success: boolean;
  transactionId: string;
  tradeCount: number;
  totalVolume: number;
  totalCash: number;
  trades: Array<{
    tradeId: string;
    buyOrderId: string;
    sellOrderId: string;
    buyerId: string;
    sellerId: string;
    symbolId: string;
    price: number;
    quantity: number;
  }>;
  ledgerEntriesCount: number;
  timestamp: number;
}

/**
 * Executes a function with automatic retry logic upon PostgreSQL serialization failures (code 40001).
 * Essential for REPEATABLE READ transaction execution under concurrent crossed order load.
 */
export async function withRepeatableReadRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 10
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isSerializationFailure =
        err?.code === '40001' ||
        (err?.message &&
          (err.message.includes('could not serialize access') ||
            err.message.includes('serialization failure')));

      if (isSerializationFailure && attempt <= maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 15;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * PortfolioManager — Multi-Counterparty Atomic Trade Settlement Engine (NR-01 / S2-05)
 *
 * Replaces RAM Map with transactional PostgreSQL queries while maintaining backward
 * compatibility with in-memory tests and benchmarks.
 *
 * Core Guarantees:
 *   1. Atomic Multi-Counterparty Settlement: Sweeping k sellers commits across 1 + k accounts in 1 TX.
 *   2. REPEATABLE READ Isolation: Prevents dirty reads, non-repeatable reads, and phantom reads.
 *   3. Pessimistic Row Locking (`SELECT ... FOR UPDATE`): Eliminates race conditions.
 *   4. Deterministic Sorted Lock Ordering: Locks acquired by UUID ascending; eliminates circular wait deadlocks.
 *   5. Double-Entry Balance Invariant: Every execution balance shift is journals in ledger_entries.
 *   6. Clean Rollback: Any balance or custody check failure aborts the entire transaction with 0 state change.
 */
export class PortfolioManager {
  private db: Database;
  private ledgerService: LedgerService;
  private inMemoryPortfolios = new Map<string, Portfolio>();

  constructor(
    dbClient: Database = defaultDb,
    ledger?: LedgerService
  ) {
    this.db = dbClient;
    this.ledgerService =
      ledger || (dbClient === defaultDb ? defaultLedgerService : new LedgerService(dbClient));
  }

  // ─────────────────────────────────────────────────────────────
  // 1. IN-MEMORY SYNCHRONOUS COMPATIBILITY METHODS
  // ─────────────────────────────────────────────────────────────

  /** Create portfolio for a new user in memory (idempotent synchronous helper). */
  initializeUser(userId: string): Portfolio {
    if (this.inMemoryPortfolios.has(userId)) {
      return this.inMemoryPortfolios.get(userId)!;
    }
    const portfolio: Portfolio = {
      usd: STARTING_USD,
      stocks: STARTING_STOCKS,
      cashBalance: STARTING_USD,
      lockedCash: 0,
      holdings: {},
    };
    for (const sym of SUPPORTED_SYMBOLS) {
      portfolio.holdings![sym] = { quantity: STARTING_STOCKS, lockedQuantity: 0 };
    }
    this.inMemoryPortfolios.set(userId, portfolio);
    return portfolio;
  }

  getPortfolio(userId: string): Portfolio | null {
    return this.inMemoryPortfolios.get(userId) || null;
  }

  deposit(userId: string, funds: { usd?: number; stocks?: number }): Portfolio {
    const p = this.initializeUser(userId);
    if (funds.usd !== undefined) {
      p.usd += funds.usd;
      p.cashBalance = (p.cashBalance ?? 0) + funds.usd;
    }
    if (funds.stocks !== undefined) {
      p.stocks += funds.stocks;
    }
    return p;
  }

  /** Synchronous pre-trade check: can the user afford this order? */
  canAfford(
    userId: string,
    side: 'buy' | 'sell',
    price: number,
    quantity: number
  ): boolean {
    const p = this.inMemoryPortfolios.get(userId);
    if (!p) return false;

    if (side === 'buy') {
      return p.usd >= price * quantity;
    } else {
      return p.stocks >= quantity;
    }
  }

  /** Synchronous in-memory trade execution fallback */
  executeTrade(trade: Trade): void {
    const buyer = this.inMemoryPortfolios.get(trade.buyerId);
    if (buyer) {
      buyer.usd -= trade.price * trade.quantity;
      buyer.stocks += trade.quantity;
    }

    const seller = this.inMemoryPortfolios.get(trade.sellerId);
    if (seller) {
      seller.usd += trade.price * trade.quantity;
      seller.stocks -= trade.quantity;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. TRANSACTIONAL DATABASE METHODS (S2-05)
  // ─────────────────────────────────────────────────────────────

  /**
   * Initializes or fetches a user, their portfolio, and equity holdings in PostgreSQL.
   */
  async initializeUserInDb(
    rawUserId: string,
    initialCash: number = STARTING_USD,
    initialHoldings: number = STARTING_STOCKS
  ): Promise<Portfolio> {
    const uuid = toValidUuid(rawUserId);

    // 1. Ensure user row exists
    await this.db
      .insert(users)
      .values({
        userId: uuid,
        username: rawUserId.slice(0, 50),
        email: `${rawUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}@glassbox.internal`,
        role: 'STUDENT',
      })
      .onConflictDoNothing();

    // 2. Ensure portfolio row exists
    await this.db
      .insert(portfolios)
      .values({
        userId: uuid,
        cashBalance: initialCash.toFixed(2),
        lockedCash: '0.00',
      })
      .onConflictDoNothing();

    // 3. Ensure holdings exist for all supported symbols
    for (const sym of SUPPORTED_SYMBOLS) {
      await this.db
        .insert(securitiesHoldings)
        .values({
          userId: uuid,
          symbolId: sym,
          quantity: initialHoldings,
          lockedQuantity: 0,
        })
        .onConflictDoNothing();
    }

    return await this.getPortfolioFromDb(rawUserId);
  }

  /**
   * Retrieves user portfolio and securities holdings directly from PostgreSQL.
   */
  async getPortfolioFromDb(
    rawUserId: string,
    symbolId: string = 'TCS'
  ): Promise<Portfolio> {
    const uuid = toValidUuid(rawUserId);

    const portfolioRows = await this.db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, uuid))
      .limit(1);

    if (portfolioRows.length === 0) {
      return this.initializeUserInDb(rawUserId);
    }

    const holdingRows = await this.db
      .select()
      .from(securitiesHoldings)
      .where(eq(securitiesHoldings.userId, uuid));

    const holdingsMap: Record<string, { quantity: number; lockedQuantity: number }> = {};
    let targetStocks = 0;

    for (const h of holdingRows) {
      holdingsMap[h.symbolId] = {
        quantity: h.quantity,
        lockedQuantity: h.lockedQuantity,
      };
      if (h.symbolId === symbolId) {
        targetStocks = h.quantity;
      }
    }

    const cashBal = parseFloat(portfolioRows[0].cashBalance);
    const lockedCash = parseFloat(portfolioRows[0].lockedCash);

    const res: Portfolio = {
      usd: cashBal,
      stocks: targetStocks,
      cashBalance: cashBal,
      lockedCash,
      holdings: holdingsMap,
    };

    // Keep in-memory cache synchronized
    this.inMemoryPortfolios.set(rawUserId, res);
    this.inMemoryPortfolios.set(uuid, res);

    return res;
  }

  /**
   * Pre-trade database affordability check.
   */
  async canAffordDb(
    rawUserId: string,
    side: 'buy' | 'sell',
    price: number,
    quantity: number,
    symbolId: string = 'TCS'
  ): Promise<boolean> {
    const uuid = toValidUuid(rawUserId);

    if (side === 'buy') {
      const p = await this.db
        .select({ cashBalance: portfolios.cashBalance })
        .from(portfolios)
        .where(eq(portfolios.userId, uuid))
        .limit(1);

      if (p.length === 0) return false;
      return parseFloat(p[0].cashBalance) >= price * quantity;
    } else {
      const h = await this.db
        .select({ quantity: securitiesHoldings.quantity })
        .from(securitiesHoldings)
        .where(
          and(
            eq(securitiesHoldings.userId, uuid),
            eq(securitiesHoldings.symbolId, symbolId)
          )
        )
        .limit(1);

      if (h.length === 0) return false;
      return h[0].quantity >= quantity;
    }
  }

  /**
   * Locks user cash or shares when placing a resting limit order.
   */
  async lockFundsForOrder(order: Order, txClient?: any): Promise<void> {
    const client = txClient || this.db;
    const uuid = toValidUuid(order.userId);
    const symbol = order.symbol || 'TCS';

    const executeLock = async (tx: any) => {
      if (order.side === 'buy') {
        const requiredCash = Math.round(order.price * order.quantity * 100) / 100;
        const [portfolio] = await tx
          .select()
          .from(portfolios)
          .where(eq(portfolios.userId, uuid))
          .for('update');

        if (!portfolio) {
          throw new SettlementLockError(`Portfolio not found for user ${order.userId}`);
        }

        const currentCash = parseFloat(portfolio.cashBalance);
        if (currentCash < requiredCash) {
          throw new InsufficientFundsError(
            `Insufficient cash balance to place buy order. Available: ₹${currentCash.toFixed(2)}, Required: ₹${requiredCash.toFixed(2)}`,
            uuid,
            requiredCash,
            currentCash
          );
        }

        await tx
          .update(portfolios)
          .set({
            cashBalance: (currentCash - requiredCash).toFixed(2),
            lockedCash: (parseFloat(portfolio.lockedCash) + requiredCash).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(portfolios.userId, uuid));
      } else {
        const [holding] = await tx
          .select()
          .from(securitiesHoldings)
          .where(
            and(
              eq(securitiesHoldings.userId, uuid),
              eq(securitiesHoldings.symbolId, symbol)
            )
          )
          .for('update');

        if (!holding || holding.quantity < order.quantity) {
          const avail = holding ? holding.quantity : 0;
          throw new InsufficientCustodyError(
            `Insufficient custody to place sell order. Available: ${avail} shares, Required: ${order.quantity} shares`,
            uuid,
            symbol,
            order.quantity,
            avail
          );
        }

        await tx
          .update(securitiesHoldings)
          .set({
            quantity: holding.quantity - order.quantity,
            lockedQuantity: holding.lockedQuantity + order.quantity,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(securitiesHoldings.userId, uuid),
              eq(securitiesHoldings.symbolId, symbol)
            )
          );
      }
    };

    if (txClient) {
      await executeLock(client);
    } else {
      await this.db.transaction(executeLock, { isolationLevel: 'repeatable read' });
    }
  }

  /**
   * Unlocks cash or shares when cancelling a resting limit order.
   */
  async unlockFundsForOrder(order: Order, txClient?: any): Promise<void> {
    const client = txClient || this.db;
    const uuid = toValidUuid(order.userId);
    const symbol = order.symbol || 'TCS';

    const executeUnlock = async (tx: any) => {
      if (order.side === 'buy') {
        const cashToUnlock = Math.round(order.price * order.quantity * 100) / 100;
        const [portfolio] = await tx
          .select()
          .from(portfolios)
          .where(eq(portfolios.userId, uuid))
          .for('update');

        if (portfolio) {
          const currentLocked = parseFloat(portfolio.lockedCash);
          const deductLocked = Math.min(currentLocked, cashToUnlock);
          await tx
            .update(portfolios)
            .set({
              cashBalance: (parseFloat(portfolio.cashBalance) + deductLocked).toFixed(2),
              lockedCash: (currentLocked - deductLocked).toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(portfolios.userId, uuid));
        }
      } else {
        const [holding] = await tx
          .select()
          .from(securitiesHoldings)
          .where(
            and(
              eq(securitiesHoldings.userId, uuid),
              eq(securitiesHoldings.symbolId, symbol)
            )
          )
          .for('update');

        if (holding) {
          const sharesToUnlock = Math.min(holding.lockedQuantity, order.quantity);
          await tx
            .update(securitiesHoldings)
            .set({
              quantity: holding.quantity + sharesToUnlock,
              lockedQuantity: holding.lockedQuantity - sharesToUnlock,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(securitiesHoldings.userId, uuid),
                eq(securitiesHoldings.symbolId, symbol)
              )
            );
        }
      }
    };

    if (txClient) {
      await executeUnlock(client);
    } else {
      await this.db.transaction(executeUnlock, { isolationLevel: 'repeatable read' });
    }
  }

  /**
   * MULTI-COUNTERPARTY ATOMIC TRADE SETTLEMENT ENGINE (NR-01 backend)
   *
   * Executes atomic balance transfers and trade contract commits across 1 + k counterparties.
   *
   * Invariant Guardrails:
   *   1. Isolation: Runs under REPEATABLE READ with automatic serialization failure retry.
   *   2. Row Locks: SELECT ... FOR UPDATE acquired strictly in deterministic lexicographically
   *      sorted user UUID order. This mathematically prevents circular-wait deadlocks.
   *   3. Custody & Balance Invariant: Every counterparty's balance and custody is verified.
   *      If ANY seller has insufficient shares or buyer has insufficient funds, the entire
   *      transaction throws and rolls back cleanly with ZERO partial state updates.
   *   4. Immutable Contracts: Inserts into `trades` table.
   *   5. Double-Entry Invariant: Calls `LedgerService.recordTradeJournal` for each trade to
   *      insert 4 balanced debits and credits, verified by deferred trigger.
   */
  async settleTradesAtomic(params: SettleTradesParams): Promise<SettlementResult> {
    const { trades, takerOrder } = params;
    if (!trades || trades.length === 0) {
      return {
        success: true,
        transactionId: uuidv4(),
        tradeCount: 0,
        totalVolume: 0,
        totalCash: 0,
        trades: [],
        ledgerEntriesCount: 0,
        timestamp: Date.now(),
      };
    }

    const symbol = params.symbolId || trades[0].symbol || 'TCS';
    const batchTransactionId = uuidv4();

    return await withRepeatableReadRetry(async () => {
      return await this.db.transaction(
        async (tx) => {
          // ── STEP 1: Map all user IDs to valid UUIDs and determine lock order ───
          const userUuidMap = new Map<string, string>();
          for (const t of trades) {
            if (!userUuidMap.has(t.buyerId)) {
              userUuidMap.set(t.buyerId, toValidUuid(t.buyerId));
            }
            if (!userUuidMap.has(t.sellerId)) {
              userUuidMap.set(t.sellerId, toValidUuid(t.sellerId));
            }
          }

          // Strict lexicographical sort of distinct UUIDs eliminates circular-wait deadlocks
          const sortedUserUuids = Array.from(
            new Set(Array.from(userUuidMap.values()))
          ).sort((a, b) => a.localeCompare(b));

          // ── STEP 2: Acquire pessimistic row-level locks in sorted order ────────
          const lockedPortfolios = new Map<string, typeof portfolios.$inferSelect>();
          const lockedHoldings = new Map<string, typeof securitiesHoldings.$inferSelect>();

          for (const uid of sortedUserUuids) {
            // Lock portfolio row
            const pRows = await tx
              .select()
              .from(portfolios)
              .where(eq(portfolios.userId, uid))
              .for('update');

            if (pRows.length === 0) {
              // Ensure portfolio exists if newly initialized
              await tx
                .insert(portfolios)
                .values({
                  userId: uid,
                  cashBalance: STARTING_USD.toFixed(2),
                  lockedCash: '0.00',
                })
                .onConflictDoNothing();

              const recheckedP = await tx
                .select()
                .from(portfolios)
                .where(eq(portfolios.userId, uid))
                .for('update');

              if (recheckedP.length === 0) {
                throw new SettlementLockError(`Failed to lock portfolio for user ${uid}`);
              }
              lockedPortfolios.set(uid, recheckedP[0]);
            } else {
              lockedPortfolios.set(uid, pRows[0]);
            }

            // Lock securities holding row for this symbol
            let hRows = await tx
              .select()
              .from(securitiesHoldings)
              .where(
                and(
                  eq(securitiesHoldings.userId, uid),
                  eq(securitiesHoldings.symbolId, symbol)
                )
              )
              .for('update');

            if (hRows.length === 0) {
              await tx
                .insert(securitiesHoldings)
                .values({
                  userId: uid,
                  symbolId: symbol,
                  quantity: 0,
                  lockedQuantity: 0,
                })
                .onConflictDoNothing();

              hRows = await tx
                .select()
                .from(securitiesHoldings)
                .where(
                  and(
                    eq(securitiesHoldings.userId, uid),
                    eq(securitiesHoldings.symbolId, symbol)
                  )
                )
                .for('update');
            }

            if (hRows.length > 0) {
              lockedHoldings.set(uid, hRows[0]);
            }
          }

          // ── STEP 3: Aggregate net balance & custody deltas across all trades ───
          interface UserAccountDelta {
            cashDeltaCents: number; // positive = credit, negative = debit
            sharesDelta: number; // positive = credit shares, negative = debit shares
            lockedCashDecrementCents: number; // portion consumed from locked_cash
            lockedSharesDecrement: number; // portion consumed from locked_quantity
          }

          const deltas = new Map<string, UserAccountDelta>();
          for (const uid of sortedUserUuids) {
            deltas.set(uid, {
              cashDeltaCents: 0,
              sharesDelta: 0,
              lockedCashDecrementCents: 0,
              lockedSharesDecrement: 0,
            });
          }

          let totalVolume = 0;
          let totalCashCents = 0;

          for (const t of trades) {
            const buyerUuid = userUuidMap.get(t.buyerId)!;
            const sellerUuid = userUuidMap.get(t.sellerId)!;
            const tradeCashCents = Math.round(t.price * t.quantity * 100);

            totalVolume += t.quantity;
            totalCashCents += tradeCashCents;

            const bDelta = deltas.get(buyerUuid)!;
            const sDelta = deltas.get(sellerUuid)!;

            // Buyer accounting:
            // If buyer is taker: cash comes directly from cash_balance
            // If buyer is maker (resting bid): cash was locked in locked_cash
            const isBuyerTaker = takerOrder?.side === 'buy' && (takerOrder.userId === t.buyerId || toValidUuid(takerOrder.userId) === buyerUuid);
            if (isBuyerTaker) {
              bDelta.cashDeltaCents -= tradeCashCents;
            } else {
              bDelta.lockedCashDecrementCents += tradeCashCents;
            }
            bDelta.sharesDelta += t.quantity;

            // Seller accounting:
            // Seller always receives cash
            sDelta.cashDeltaCents += tradeCashCents;

            // If seller is maker (resting ask): shares were locked in locked_quantity
            // If seller is taker: shares come directly from quantity
            const isSellerTaker = takerOrder?.side === 'sell' && (takerOrder.userId === t.sellerId || toValidUuid(takerOrder.userId) === sellerUuid);
            if (isSellerTaker) {
              sDelta.sharesDelta -= t.quantity;
            } else {
              sDelta.lockedSharesDecrement += t.quantity;
            }
          }

          // ── STEP 4: Enforce custody & affordability invariant checks ───────────
          for (const uid of sortedUserUuids) {
            const p = lockedPortfolios.get(uid)!;
            const h = lockedHoldings.get(uid)!;
            const d = deltas.get(uid)!;

            const pCashCents = Math.round(parseFloat(p.cashBalance) * 100);
            const pLockedCashCents = Math.round(parseFloat(p.lockedCash) * 100);
            const hQty = h.quantity;
            const hLockedQty = h.lockedQuantity;

            // Calculate cash adjustments
            let effectiveCashCents = pCashCents + d.cashDeltaCents;
            let effectiveLockedCashCents = pLockedCashCents;

            // If locked cash decrement exceeds available locked cash, remainder comes from cash balance
            if (d.lockedCashDecrementCents > 0) {
              const fromLocked = Math.min(pLockedCashCents, d.lockedCashDecrementCents);
              const remainder = d.lockedCashDecrementCents - fromLocked;
              effectiveLockedCashCents -= fromLocked;
              effectiveCashCents -= remainder;
            }

            if (effectiveCashCents < 0) {
              throw new InsufficientFundsError(
                `Atomic Settlement Aborted: User ${uid} has insufficient cash balance. Available: ₹${(pCashCents / 100).toFixed(2)}, Deficit: ₹${(Math.abs(effectiveCashCents) / 100).toFixed(2)}`,
                uid,
                Math.abs(d.cashDeltaCents + d.lockedCashDecrementCents) / 100,
                pCashCents / 100
              );
            }

            // Calculate shares adjustments
            let effectiveQty = hQty + d.sharesDelta;
            let effectiveLockedQty = hLockedQty;

            // If locked shares decrement exceeds available locked quantity, remainder comes from unallocated quantity
            if (d.lockedSharesDecrement > 0) {
              const fromLockedQty = Math.min(hLockedQty, d.lockedSharesDecrement);
              const remainderQty = d.lockedSharesDecrement - fromLockedQty;
              effectiveLockedQty -= fromLockedQty;
              effectiveQty -= remainderQty;
            }

            if (effectiveQty < 0) {
              throw new InsufficientCustodyError(
                `Atomic Settlement Aborted: Seller ${uid} has insufficient custody for ${symbol}. Available: ${hQty} shares, Deficit: ${Math.abs(effectiveQty)} shares`,
                uid,
                symbol,
                Math.abs(d.sharesDelta - d.lockedSharesDecrement),
                hQty
              );
            }
          }

          // ── STEP 5: Apply balance commits to portfolios & securities_holdings ──
          for (const uid of sortedUserUuids) {
            const p = lockedPortfolios.get(uid)!;
            const h = lockedHoldings.get(uid)!;
            const d = deltas.get(uid)!;

            const pCashCents = Math.round(parseFloat(p.cashBalance) * 100);
            const pLockedCashCents = Math.round(parseFloat(p.lockedCash) * 100);
            const hQty = h.quantity;
            const hLockedQty = h.lockedQuantity;

            const fromLockedCash = Math.min(pLockedCashCents, d.lockedCashDecrementCents);
            const remainderCash = d.lockedCashDecrementCents - fromLockedCash;
            const newCashCents = pCashCents + d.cashDeltaCents - remainderCash;
            const newLockedCashCents = pLockedCashCents - fromLockedCash;

            const fromLockedQty = Math.min(hLockedQty, d.lockedSharesDecrement);
            const remainderQty = d.lockedSharesDecrement - fromLockedQty;
            const newQty = hQty + d.sharesDelta - remainderQty;
            const newLockedQty = hLockedQty - fromLockedQty;

            // Update portfolio
            await tx
              .update(portfolios)
              .set({
                cashBalance: (newCashCents / 100).toFixed(2),
                lockedCash: (newLockedCashCents / 100).toFixed(2),
                updatedAt: new Date(),
              })
              .where(eq(portfolios.userId, uid));

            // Update securities holding
            await tx
              .update(securitiesHoldings)
              .set({
                quantity: newQty,
                lockedQuantity: newLockedQty,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(securitiesHoldings.userId, uid),
                  eq(securitiesHoldings.symbolId, symbol)
                )
              );
          }

          // ── STEP 6: Ensure orders exist in orders table to satisfy trades FK ───
          for (const t of trades) {
            const buyerUuid = userUuidMap.get(t.buyerId)!;
            const sellerUuid = userUuidMap.get(t.sellerId)!;

            const buyOrderUuid = toValidUuid(t.buyOrderId);
            const sellOrderUuid = toValidUuid(t.sellOrderId);

            // Upsert Buy Order
            await tx
              .insert(orders)
              .values({
                orderId: buyOrderUuid,
                userId: buyerUuid,
                symbolId: symbol,
                side: 'BUY',
                orderType: 'LIMIT',
                price: t.price.toFixed(2),
                initialQuantity: t.quantity,
                remainingQuantity: 0,
                status: 'FILLED',
              })
              .onConflictDoUpdate({
                target: orders.orderId,
                set: {
                  remainingQuantity: 0,
                  status: 'FILLED',
                },
              });

            // Upsert Sell Order
            await tx
              .insert(orders)
              .values({
                orderId: sellOrderUuid,
                userId: sellerUuid,
                symbolId: symbol,
                side: 'SELL',
                orderType: 'LIMIT',
                price: t.price.toFixed(2),
                initialQuantity: t.quantity,
                remainingQuantity: 0,
                status: 'FILLED',
              })
              .onConflictDoUpdate({
                target: orders.orderId,
                set: {
                  remainingQuantity: 0,
                  status: 'FILLED',
                },
              });
          }

          // ── STEP 7: Record immutable trades execution contracts ────────────────
          const insertedTrades: SettlementResult['trades'] = [];
          for (const t of trades) {
            const tradeUuid = toValidUuid(t.id || uuidv4());
            const buyOrderUuid = toValidUuid(t.buyOrderId);
            const sellOrderUuid = toValidUuid(t.sellOrderId);
            const buyerUuid = userUuidMap.get(t.buyerId)!;
            const sellerUuid = userUuidMap.get(t.sellerId)!;

            await tx
              .insert(tradesTable)
              .values({
                tradeId: tradeUuid,
                buyOrderId: buyOrderUuid,
                sellOrderId: sellOrderUuid,
                buyerId: buyerUuid,
                sellerId: sellerUuid,
                symbolId: symbol,
                price: t.price.toFixed(2),
                quantity: t.quantity,
                takerSide: (takerOrder?.side?.toUpperCase() as 'BUY' | 'SELL') || 'BUY',
                executedAt: t.timestamp ? new Date(t.timestamp) : new Date(),
              })
              .onConflictDoNothing();

            insertedTrades.push({
              tradeId: tradeUuid,
              buyOrderId: buyOrderUuid,
              sellOrderId: sellOrderUuid,
              buyerId: buyerUuid,
              sellerId: sellerUuid,
              symbolId: symbol,
              price: t.price,
              quantity: t.quantity,
            });
          }

          // ── STEP 8: Append double-entry balanced ledger entries ────────────────
          let ledgerEntriesCount = 0;
          for (const t of trades) {
            const buyerUuid = userUuidMap.get(t.buyerId)!;
            const sellerUuid = userUuidMap.get(t.sellerId)!;

            const journal = await this.ledgerService.recordTradeJournal(
              {
                transactionId: uuidv4(),
                buyOrderId: toValidUuid(t.buyOrderId),
                sellOrderId: toValidUuid(t.sellOrderId),
                buyerId: buyerUuid,
                sellerId: sellerUuid,
                symbolId: symbol,
                price: t.price,
                quantity: t.quantity,
                description: `Atomic trade settlement: ${t.quantity} shares of ${symbol} @ ₹${t.price.toFixed(2)}`,
              },
              tx
            );
            ledgerEntriesCount += journal.entries.length;
          }

          // ── STEP 9: Refresh in-memory portfolio caches ─────────────────────────
          for (const uid of sortedUserUuids) {
            const p = lockedPortfolios.get(uid)!;
            const d = deltas.get(uid)!;
            const pCashCents = Math.round(parseFloat(p.cashBalance) * 100);
            const pLockedCashCents = Math.round(parseFloat(p.lockedCash) * 100);
            const fromLockedCash = Math.min(pLockedCashCents, d.lockedCashDecrementCents);
            const remainderCash = d.lockedCashDecrementCents - fromLockedCash;
            const newCash = (pCashCents + d.cashDeltaCents - remainderCash) / 100;

            const existingMem = this.inMemoryPortfolios.get(uid);
            if (existingMem) {
              existingMem.usd = newCash;
              existingMem.cashBalance = newCash;
              existingMem.stocks += d.sharesDelta;
              if (existingMem.holdings && existingMem.holdings[symbol]) {
                existingMem.holdings[symbol].quantity += d.sharesDelta;
              }
            }
          }

          return {
            success: true,
            transactionId: batchTransactionId,
            tradeCount: trades.length,
            totalVolume,
            totalCash: totalCashCents / 100,
            trades: insertedTrades,
            ledgerEntriesCount,
            timestamp: Date.now(),
          };
        },
        { isolationLevel: params.isolationLevel || 'repeatable read' }
      );
    });
  }
}
