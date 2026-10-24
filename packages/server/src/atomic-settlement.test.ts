import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { sql, eq, and } from 'drizzle-orm';
import {
  createDbConnection,
  TEST_DATABASE_URL,
  users,
  symbols,
  portfolios,
  securitiesHoldings,
  orders,
  trades as tradesTable,
  ledgerEntries,
} from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import {
  PortfolioManager,
  InsufficientFundsError,
  InsufficientCustodyError,
  toValidUuid,
} from './portfolio-manager.js';
import { MatchingEngine } from './matching-engine.js';
import { OrderBook } from './orderbook.js';
import { LedgerService } from './services/ledger.js';
import type { Order, Trade } from '@orderbook/shared';

describe('Multi-Counterparty Atomic Trade Settlement Engine (S2-05 / NR-01 backend)', () => {
  const { client, db } = createDbConnection(TEST_DATABASE_URL);
  const ledgerService = new LedgerService(db);
  const portfolioManager = new PortfolioManager(db, ledgerService);

  beforeAll(async () => {
    // 1. Run migrations and baseline seed
    await runMigrations(TEST_DATABASE_URL);
    await seedDatabase(db);
  });

  afterAll(async () => {
    await client.end({ timeout: 5 });
  });

  beforeEach(async () => {
    // Tests use unique users and scoped queries for deterministic isolation
  });

  /** Helper to create clean test user with known cash and stock custody */
  async function createTestTrader(
    name: string,
    cash: number,
    stocks: number,
    symbol: string = 'TCS'
  ): Promise<{ userId: string; username: string }> {
    const userId = uuidv4();
    const username = `${name}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    await db.insert(users).values({
      userId,
      username,
      email: `${username}@glassbox.internal`,
      role: 'STUDENT',
    });

    await db.insert(portfolios).values({
      userId,
      cashBalance: cash.toFixed(2),
      lockedCash: '0.00',
    });

    await db.insert(securitiesHoldings).values({
      userId,
      symbolId: symbol,
      quantity: stocks,
      lockedQuantity: 0,
    });

    return { userId, username };
  }

  // ─────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA 1: Sweeping 3 distinct sellers at 3 price tiers
  // ─────────────────────────────────────────────────────────────
  describe('1. Multi-Counterparty Market Order Sweep (1 Buyer + 3 Sellers across 3 Price Tiers)', () => {
    it('should atomically settle a market order sweeping 3 distinct sellers at 3 price tiers in a single PostgreSQL transaction under REPEATABLE READ', async () => {
      const symbol = 'TCS';

      // Setup: 1 Buyer with ₹300,000 cash, 0 TCS shares
      const buyer = await createTestTrader('buyer_sweep', 300_000, 0, symbol);

      // Setup: 3 Distinct Sellers with 100 TCS shares and ₹10,000 cash each
      const seller1 = await createTestTrader('seller_1', 10_000, 100, symbol);
      const seller2 = await createTestTrader('seller_2', 10_000, 100, symbol);
      const seller3 = await createTestTrader('seller_3', 10_000, 100, symbol);

      const book = new OrderBook(symbol);
      const engine = new MatchingEngine(book, portfolioManager);

      // Resting Limit Sell Orders at 3 distinct price tiers:
      // Tier 1: Seller 1 offers 10 shares @ ₹3,400.00
      // Tier 2: Seller 2 offers 20 shares @ ₹3,450.00
      // Tier 3: Seller 3 offers 30 shares @ ₹3,500.00
      const sellOrder1: Order = {
        id: uuidv4(),
        userId: seller1.userId,
        symbol,
        side: 'sell',
        price: 3400.0,
        quantity: 10,
        orderType: 'LIMIT',
        timestamp: Date.now() - 30,
      };
      const sellOrder2: Order = {
        id: uuidv4(),
        userId: seller2.userId,
        symbol,
        side: 'sell',
        price: 3450.0,
        quantity: 20,
        orderType: 'LIMIT',
        timestamp: Date.now() - 20,
      };
      const sellOrder3: Order = {
        id: uuidv4(),
        userId: seller3.userId,
        symbol,
        side: 'sell',
        price: 3500.0,
        quantity: 30,
        orderType: 'LIMIT',
        timestamp: Date.now() - 10,
      };

      // Place resting sell orders and lock funds in DB
      const resS1 = await engine.placeOrderAsync(sellOrder1);
      const resS2 = await engine.placeOrderAsync(sellOrder2);
      const resS3 = await engine.placeOrderAsync(sellOrder3);

      expect(resS1.success).toBeDefined();
      expect(resS2.success).toBeDefined();
      expect(resS3.success).toBeDefined();

      // Verify sellers' shares were locked
      const hS1 = await portfolioManager.getPortfolioFromDb(seller1.userId, symbol);
      expect(hS1.holdings![symbol].lockedQuantity).toBe(10);
      expect(hS1.holdings![symbol].quantity).toBe(90);

      // Buyer places a MARKET order for 60 shares (sweeping all 3 tiers!)
      const marketBuyOrder: Order = {
        id: uuidv4(),
        userId: buyer.userId,
        symbol,
        side: 'buy',
        price: 0, // Market order
        quantity: 60,
        orderType: 'MARKET',
        timestamp: Date.now(),
      };

      const matchRes = await engine.placeOrderAsync(marketBuyOrder);

      expect(matchRes.success).toBeDefined();
      const { trades, remainingOrder, settlement } = matchRes.success!;

      // ── Verify matching engine output ──
      expect(trades.length).toBe(3);
      expect(remainingOrder).toBeNull(); // Market order fully filled
      expect(settlement).toBeDefined();
      expect(settlement!.tradeCount).toBe(3);
      expect(settlement!.totalVolume).toBe(60);

      // Total expected cash:
      // Tier 1: 10 * 3400 = ₹34,000.00
      // Tier 2: 20 * 3450 = ₹69,000.00
      // Tier 3: 30 * 3500 = ₹105,000.00
      // Total Cash = ₹208,000.00
      const expectedTotalCash = 34_000 + 69_000 + 105_000;
      expect(settlement!.totalCash).toBe(expectedTotalCash);

      // ── Verify Buyer Balances in Database ──
      const buyerPort = await portfolioManager.getPortfolioFromDb(buyer.userId, symbol);
      expect(buyerPort.cashBalance).toBe(300_000 - expectedTotalCash); // ₹92,000.00
      expect(buyerPort.stocks).toBe(60); // 60 shares received

      // ── Verify Seller 1 Balances in Database ──
      const s1Port = await portfolioManager.getPortfolioFromDb(seller1.userId, symbol);
      expect(s1Port.cashBalance).toBe(10_000 + 34_000); // ₹44,000.00
      expect(s1Port.stocks).toBe(90);
      expect(s1Port.holdings![symbol].lockedQuantity).toBe(0); // 10 locked shares delivered

      // ── Verify Seller 2 Balances in Database ──
      const s2Port = await portfolioManager.getPortfolioFromDb(seller2.userId, symbol);
      expect(s2Port.cashBalance).toBe(10_000 + 69_000); // ₹79,000.00
      expect(s2Port.stocks).toBe(80);
      expect(s2Port.holdings![symbol].lockedQuantity).toBe(0);

      // ── Verify Seller 3 Balances in Database ──
      const s3Port = await portfolioManager.getPortfolioFromDb(seller3.userId, symbol);
      expect(s3Port.cashBalance).toBe(10_000 + 105_000); // ₹115,000.00
      expect(s3Port.stocks).toBe(70);
      expect(s3Port.holdings![symbol].lockedQuantity).toBe(0);

      // ── Verify Trades Table ──
      const persistedTrades = await db
        .select()
        .from(tradesTable)
        .where(eq(tradesTable.buyerId, buyer.userId));
      expect(persistedTrades.length).toBe(3);

      // ── Verify Double-Entry Ledger Invariant (NR-05) ──
      // Buyer has 2 entries per trade (1 cash credit, 1 shares debit) * 3 trades = 6 entries
      const persistedLedgerBuyer = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.accountId, buyer.userId));
      expect(persistedLedgerBuyer.length).toBe(6);

      const auditReport = await ledgerService.verifyLedgerIntegrity();
      expect(auditReport.verified).toBe(true);
      expect(auditReport.discrepancy).toBe(0);
      expect(auditReport.unbalancedTransactionsCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA 2: Clean Rollback on Custody or Balance Failure
  // ─────────────────────────────────────────────────────────────
  describe('2. Atomic Rollback Guarantees (Zero Partial Balance Leakage)', () => {
    it('should cleanly abort and roll back the entire transaction if any seller in the sweep has insufficient custody', async () => {
      const symbol = 'TCS';

      // Buyer with ₹300,000 cash
      const buyer = await createTestTrader('buyer_fail_custody', 300_000, 0, symbol);

      // Seller 1: 10 shares (sufficient)
      const seller1 = await createTestTrader('seller_ok_1', 10_000, 10, symbol);
      // Seller 2: ONLY 5 shares in DB custody (INSUFFICIENT! Needs 20 shares)
      const seller2 = await createTestTrader('seller_insufficient', 10_000, 5, symbol);
      // Seller 3: 30 shares (sufficient)
      const seller3 = await createTestTrader('seller_ok_3', 10_000, 30, symbol);

      const book = new OrderBook(symbol);
      const engine = new MatchingEngine(book, portfolioManager);

      // Place resting sell orders directly on the in-memory book
      // (simulating orders that matched, but Seller 2's custody check fails at settlement time)
      const sellOrder1: Order = {
        id: uuidv4(),
        userId: seller1.userId,
        symbol,
        side: 'sell',
        price: 3400.0,
        quantity: 10,
        orderType: 'LIMIT',
        timestamp: Date.now() - 30,
      };
      const sellOrder2: Order = {
        id: uuidv4(),
        userId: seller2.userId,
        symbol,
        side: 'sell',
        price: 3450.0,
        quantity: 20, // Requires 20 shares, but Seller 2 only has 5!
        orderType: 'LIMIT',
        timestamp: Date.now() - 20,
      };
      const sellOrder3: Order = {
        id: uuidv4(),
        userId: seller3.userId,
        symbol,
        side: 'sell',
        price: 3500.0,
        quantity: 30,
        orderType: 'LIMIT',
        timestamp: Date.now() - 10,
      };

      book.addOrder(sellOrder1);
      book.addOrder(sellOrder2);
      book.addOrder(sellOrder3);

      const initialBookSize = book.size;
      expect(initialBookSize).toBe(3);

      // Incoming buyer sweep
      const marketBuyOrder: Order = {
        id: uuidv4(),
        userId: buyer.userId,
        symbol,
        side: 'buy',
        price: 0,
        quantity: 60,
        orderType: 'MARKET',
        timestamp: Date.now(),
      };

      const matchRes = await engine.placeOrderAsync(marketBuyOrder);

      // ── Verify Settlement Fails ──
      expect(matchRes.error).toBeDefined();
      expect(matchRes.error).toContain('insufficient custody');

      // ── Verify ZERO Partial Balances Changed in PostgreSQL ──
      // Buyer: ₹300,000 cash, 0 shares
      const bCheck = await portfolioManager.getPortfolioFromDb(buyer.userId, symbol);
      expect(bCheck.cashBalance).toBe(300_000);
      expect(bCheck.stocks).toBe(0);

      // Seller 1: NOT settled partially! Exactly ₹10,000 cash and 10 shares
      const s1Check = await portfolioManager.getPortfolioFromDb(seller1.userId, symbol);
      expect(s1Check.cashBalance).toBe(10_000);
      expect(s1Check.stocks).toBe(10);

      // Seller 2: Exactly ₹10,000 cash and 5 shares
      const s2Check = await portfolioManager.getPortfolioFromDb(seller2.userId, symbol);
      expect(s2Check.cashBalance).toBe(10_000);
      expect(s2Check.stocks).toBe(5);

      // Seller 3: Exactly ₹10,000 cash and 30 shares
      const s3Check = await portfolioManager.getPortfolioFromDb(seller3.userId, symbol);
      expect(s3Check.cashBalance).toBe(10_000);
      expect(s3Check.stocks).toBe(30);

      // ── Verify ZERO trades and ZERO ledger rows persisted for this buyer ──
      const dbTrades = await db
        .select()
        .from(tradesTable)
        .where(eq(tradesTable.buyerId, buyer.userId));
      expect(dbTrades.length).toBe(0);

      const dbLedger = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.accountId, buyer.userId));
      expect(dbLedger.length).toBe(0);

      // ── Verify Order Book Rolled Back Correctly ──
      expect(book.size).toBe(initialBookSize);
      expect(book.getOrderById(sellOrder1.id)).toBeDefined();
      expect(book.getOrderById(sellOrder2.id)).toBeDefined();
      expect(book.getOrderById(sellOrder3.id)).toBeDefined();
    });

    it('should cleanly abort and roll back if buyer has insufficient cash balance to fund the entire sweep', async () => {
      const symbol = 'TCS';

      // Buyer has only ₹50,000 cash, but the sweep requires ₹208,000!
      const buyer = await createTestTrader('buyer_poor', 50_000, 0, symbol);
      const seller1 = await createTestTrader('seller_sweep_1', 10_000, 10, symbol);
      const seller2 = await createTestTrader('seller_sweep_2', 10_000, 20, symbol);
      const seller3 = await createTestTrader('seller_sweep_3', 10_000, 30, symbol);

      const book = new OrderBook(symbol);
      const engine = new MatchingEngine(book, portfolioManager);

      book.addOrder({
        id: uuidv4(),
        userId: seller1.userId,
        symbol,
        side: 'sell',
        price: 3400.0,
        quantity: 10,
        orderType: 'LIMIT',
        timestamp: Date.now() - 30,
      });
      book.addOrder({
        id: uuidv4(),
        userId: seller2.userId,
        symbol,
        side: 'sell',
        price: 3450.0,
        quantity: 20,
        orderType: 'LIMIT',
        timestamp: Date.now() - 20,
      });
      book.addOrder({
        id: uuidv4(),
        userId: seller3.userId,
        symbol,
        side: 'sell',
        price: 3500.0,
        quantity: 30,
        orderType: 'LIMIT',
        timestamp: Date.now() - 10,
      });

      const sweepOrder: Order = {
        id: uuidv4(),
        userId: buyer.userId,
        symbol,
        side: 'buy',
        price: 0,
        quantity: 60,
        orderType: 'MARKET',
        timestamp: Date.now(),
      };

      const matchRes = await engine.placeOrderAsync(sweepOrder);

      expect(matchRes.error).toBeDefined();
      expect(matchRes.error).toContain('insufficient cash');

      // Zero partial balance leakage
      const buyerPort = await portfolioManager.getPortfolioFromDb(buyer.userId, symbol);
      expect(buyerPort.cashBalance).toBe(50_000);
      expect(buyerPort.stocks).toBe(0);

      const s1Port = await portfolioManager.getPortfolioFromDb(seller1.userId, symbol);
      expect(s1Port.cashBalance).toBe(10_000);
      expect(s1Port.stocks).toBe(10);

      const trades = await db
        .select()
        .from(tradesTable)
        .where(eq(tradesTable.buyerId, buyer.userId));
      expect(trades.length).toBe(0);
      const ledger = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.accountId, buyer.userId));
      expect(ledger.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA 3: High-Concurrency Deadlock Immunity
  // ─────────────────────────────────────────────────────────────
  describe('3. Concurrency & Deadlock Immunity (Deterministic Sorted Lock Ordering)', () => {
    it('should complete simultaneous crossed order settlements with ZERO circular-wait deadlocks', async () => {
      const symbol = 'TCS';

      // Create 4 active concurrent traders with sufficient cash and custody
      const traderA = await createTestTrader('trader_concurrent_A', 500_000, 500, symbol);
      const traderB = await createTestTrader('trader_concurrent_B', 500_000, 500, symbol);
      const traderC = await createTestTrader('trader_concurrent_C', 500_000, 500, symbol);
      const traderD = await createTestTrader('trader_concurrent_D', 500_000, 500, symbol);

      const traders = [traderA, traderB, traderC, traderD];

      // Prepare 24 crossed trades firing concurrently in opposite directions
      // Without deterministic sorted locking, A -> B and B -> A would trigger 40P01 deadlock!
      const concurrentSettlements: Array<() => Promise<any>> = [];

      for (let i = 0; i < 24; i++) {
        const buyer = traders[i % traders.length];
        const seller = traders[(i + 1) % traders.length];

        const mockTrade: Trade = {
          id: uuidv4(),
          buyOrderId: uuidv4(),
          sellOrderId: uuidv4(),
          buyerId: buyer.userId,
          sellerId: seller.userId,
          symbol,
          price: 3500.0,
          quantity: 2,
          timestamp: Date.now(),
        };

        concurrentSettlements.push(() =>
          portfolioManager.settleTradesAtomic({
            trades: [mockTrade],
            symbolId: symbol,
          })
        );
      }

      // Fire all 24 settlement transactions simultaneously
      const results = await Promise.allSettled(
        concurrentSettlements.map((task) => task())
      );

      // Verify that NO error was a PostgreSQL 40P01 Deadlock!
      for (const res of results) {
        if (res.status === 'rejected') {
          const err = res.reason;
          const isDeadlock =
            err?.code === '40P01' ||
            (err?.message && err.message.toLowerCase().includes('deadlock'));
          expect(isDeadlock).toBe(false);
        } else {
          expect(res.value.success).toBe(true);
        }
      }

      // Verify overall ledger integrity
      const audit = await ledgerService.verifyLedgerIntegrity();
      expect(audit.verified).toBe(true);
      expect(audit.discrepancy).toBe(0);
      expect(audit.unbalancedTransactionsCount).toBe(0);
    });
  });
});
