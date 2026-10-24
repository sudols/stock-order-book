import { v4 as uuidv4 } from "uuid";
import { sql, eq } from "drizzle-orm";
import { db as defaultDb, ledgerEntries, type LedgerEntry, type NewLedgerEntry } from "../db/index.js";

export class UnbalancedLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnbalancedLedgerError";
  }
}

export class InvalidLedgerEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLedgerEntryError";
  }
}

export type AccountType = "CASH" | "SECURITIES";

export interface TradeJournalParams {
  transactionId?: string;
  buyOrderId?: string;
  sellOrderId?: string;
  buyerId: string;
  sellerId: string;
  symbolId: string;
  price: number | string;
  quantity: number;
  description?: string;
}

export interface JournalEntryItem {
  transactionId: string;
  accountId: string;
  accountType: AccountType;
  symbolId?: string | null;
  debit: number | string;
  credit: number | string;
  description?: string;
}

export interface AccountLedgerBreakdown {
  debits: number;
  credits: number;
  discrepancy: number;
}

export interface AuditVerificationReport {
  verified: boolean;
  discrepancy: number;
  totalDebits: number;
  totalCredits: number;
  totalEntries: number;
  totalTransactions: number;
  unbalancedTransactionsCount: number;
  unbalancedTransactions: Array<{
    transactionId: string;
    debits: number;
    credits: number;
    discrepancy: number;
  }>;
  breakdown: {
    cash: AccountLedgerBreakdown;
    securities: AccountLedgerBreakdown;
  };
  timestamp: string;
}

export function toCents(val: string | number): number {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) {
    throw new InvalidLedgerEntryError(`Invalid numeric value: ${val}`);
  }
  return Math.round(n * 100);
}

export class LedgerService {
  private db: any;

  constructor(dbClient: any = defaultDb) {
    this.db = dbClient;
  }

  /**
   * Application-level mathematical invariant validation.
   * Enforces:
   * 1. All debit and credit amounts must be non-negative.
   * 2. For every transaction_id in the batch: sum(Debits) === sum(Credits).
   */
  public validateBalancedEntries(entries: JournalEntryItem[]): void {
    if (!entries || entries.length === 0) {
      throw new InvalidLedgerEntryError("Cannot record empty journal entries batch");
    }

    const txMap = new Map<string, { debits: number; credits: number; count: number }>();

    for (const entry of entries) {
      if (!entry.transactionId) {
        throw new InvalidLedgerEntryError("Every journal entry must have a valid transactionId");
      }
      if (!entry.accountId) {
        throw new InvalidLedgerEntryError("Every journal entry must specify accountId");
      }
      if (entry.accountType !== "CASH" && entry.accountType !== "SECURITIES") {
        throw new InvalidLedgerEntryError(
          `Invalid accountType: ${entry.accountType}. Expected 'CASH' or 'SECURITIES'`
        );
      }

      const debitCents = toCents(entry.debit);
      const creditCents = toCents(entry.credit);

      if (debitCents < 0 || creditCents < 0) {
        throw new InvalidLedgerEntryError(
          `Debit and credit amounts must be non-negative. Got debit: ${entry.debit}, credit: ${entry.credit}`
        );
      }

      if (debitCents === 0 && creditCents === 0) {
        throw new InvalidLedgerEntryError(
          "A journal entry must specify a positive amount for either debit or credit"
        );
      }

      const txRecord = txMap.get(entry.transactionId) || { debits: 0, credits: 0, count: 0 };
      txRecord.debits += debitCents;
      txRecord.credits += creditCents;
      txRecord.count += 1;
      txMap.set(entry.transactionId, txRecord);
    }

    // Invariant check for every transaction in the batch
    for (const [txId, totals] of txMap.entries()) {
      if (totals.debits !== totals.credits) {
        const discrepancy = Math.abs(totals.debits - totals.credits) / 100;
        throw new UnbalancedLedgerError(
          `Double-entry ledger invariant violation: Transaction ${txId} is unbalanced. ` +
            `Debits: ${(totals.debits / 100).toFixed(2)}, ` +
            `Credits: ${(totals.credits / 100).toFixed(2)}, ` +
            `Discrepancy: ${discrepancy.toFixed(2)}`
        );
      }
    }
  }

  /**
   * Records a balanced batch of journal entries in a single database transaction.
   * If a transaction client (`tx`) is provided, operates within that transaction;
   * otherwise opens a new database transaction.
   */
  public async recordJournalBatch(
    entries: JournalEntryItem[],
    txClient?: any
  ): Promise<LedgerEntry[]> {
    this.validateBalancedEntries(entries);

    const client = txClient || this.db;

    const formattedRows: NewLedgerEntry[] = entries.map((entry) => ({
      transactionId: entry.transactionId,
      accountId: entry.accountId,
      accountType: entry.accountType,
      symbolId: entry.symbolId || null,
      debit: (toCents(entry.debit) / 100).toFixed(2),
      credit: (toCents(entry.credit) / 100).toFixed(2),
      description: entry.description || null,
    }));

    if (txClient) {
      return await client.insert(ledgerEntries).values(formattedRows).returning();
    }

    return await client.transaction(async (tx: any) => {
      return await tx.insert(ledgerEntries).values(formattedRows).returning();
    });
  }

  /**
   * Institutional double-entry trade journal generator.
   * Creates 4 balanced rows across Buyer and Seller CASH and SECURITIES accounts:
   *   1. Buyer Cash Account: Credit (cash outflow = price × quantity)
   *   2. Buyer Securities Account: Debit (shares inflow = quantity)
   *   3. Seller Cash Account: Debit (cash inflow = price × quantity)
   *   4. Seller Securities Account: Credit (shares outflow = quantity)
   *
   * Mathematical Invariant:
   *   Sum(Debits) === Sum(Credits) === (price × quantity) + quantity
   *   Also holds per account type:
   *   Cash: Debit = Credit = price × quantity
   *   Securities: Debit = Credit = quantity
   */
  public async recordTradeJournal(
    trade: TradeJournalParams,
    txClient?: any
  ): Promise<{ transactionId: string; entries: LedgerEntry[] }> {
    const txId = trade.transactionId || uuidv4();
    const priceNum = typeof trade.price === "string" ? parseFloat(trade.price) : trade.price;
    const quantity = trade.quantity;

    if (isNaN(priceNum) || priceNum <= 0) {
      throw new InvalidLedgerEntryError(`Invalid trade execution price: ${trade.price}`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new InvalidLedgerEntryError(`Trade quantity must be a positive integer. Got: ${quantity}`);
    }

    const totalCashVal = (Math.round(priceNum * quantity * 100) / 100).toFixed(2);
    const sharesVal = quantity.toFixed(2);

    const entries: JournalEntryItem[] = [
      // 1. Buyer Cash: Credit (cash outflow)
      {
        transactionId: txId,
        accountId: trade.buyerId,
        accountType: "CASH",
        symbolId: null,
        debit: "0.00",
        credit: totalCashVal,
        description:
          trade.description ||
          `Buyer cash outflow for ${quantity} shares of ${trade.symbolId} @ ₹${priceNum.toFixed(2)}`,
      },
      // 2. Buyer Securities: Debit (shares inflow)
      {
        transactionId: txId,
        accountId: trade.buyerId,
        accountType: "SECURITIES",
        symbolId: trade.symbolId,
        debit: sharesVal,
        credit: "0.00",
        description:
          trade.description ||
          `Buyer securities custody inflow for ${quantity} shares of ${trade.symbolId}`,
      },
      // 3. Seller Cash: Debit (cash inflow)
      {
        transactionId: txId,
        accountId: trade.sellerId,
        accountType: "CASH",
        symbolId: null,
        debit: totalCashVal,
        credit: "0.00",
        description:
          trade.description ||
          `Seller cash inflow for ${quantity} shares of ${trade.symbolId} @ ₹${priceNum.toFixed(2)}`,
      },
      // 4. Seller Securities: Credit (shares outflow)
      {
        transactionId: txId,
        accountId: trade.sellerId,
        accountType: "SECURITIES",
        symbolId: trade.symbolId,
        debit: "0.00",
        credit: sharesVal,
        description:
          trade.description ||
          `Seller securities custody outflow for ${quantity} shares of ${trade.symbolId}`,
      },
    ];

    const inserted = await this.recordJournalBatch(entries, txClient);
    return { transactionId: txId, entries: inserted };
  }

  /**
   * System-wide ledger integrity audit.
   * Runs aggregate checks across all journal entries in the database to verify:
   * 1. Global sum(Debits) === sum(Credits) (overall discrepancy = 0.00)
   * 2. Invariant holds individually for every transaction_id
   * 3. Invariant holds for each account type (CASH, SECURITIES)
   */
  public async verifyLedgerIntegrity(txClient?: any): Promise<AuditVerificationReport> {
    const client = txClient || this.db;

    // 1. Global Summary
    const summaryResult = await client.execute(sql`
      SELECT 
        COALESCE(SUM(debit), 0.00)::text as total_debits,
        COALESCE(SUM(credit), 0.00)::text as total_credits,
        COUNT(*)::int as total_entries,
        COUNT(DISTINCT transaction_id)::int as total_transactions
      FROM ledger_entries;
    `);

    const summaryRow = summaryResult[0] || {};
    const totalDebits = parseFloat(summaryRow.total_debits || "0.00");
    const totalCredits = parseFloat(summaryRow.total_credits || "0.00");
    const totalEntries = parseInt(summaryRow.total_entries || "0", 10);
    const totalTransactions = parseInt(summaryRow.total_transactions || "0", 10);

    // 2. Account Type Breakdown
    const breakdownResult = await client.execute(sql`
      SELECT 
        account_type,
        COALESCE(SUM(debit), 0.00)::text as debits,
        COALESCE(SUM(credit), 0.00)::text as credits
      FROM ledger_entries
      GROUP BY account_type;
    `);

    const breakdown: { cash: AccountLedgerBreakdown; securities: AccountLedgerBreakdown } = {
      cash: { debits: 0, credits: 0, discrepancy: 0 },
      securities: { debits: 0, credits: 0, discrepancy: 0 },
    };

    for (const row of breakdownResult) {
      const debits = parseFloat(row.debits || "0.00");
      const credits = parseFloat(row.credits || "0.00");
      const diff = Math.abs(Math.round((debits - credits) * 100) / 100);

      if (row.account_type === "CASH") {
        breakdown.cash = { debits, credits, discrepancy: diff };
      } else if (row.account_type === "SECURITIES") {
        breakdown.securities = { debits, credits, discrepancy: diff };
      }
    }

    // 3. Unbalanced Transactions
    const unbalancedResult = await client.execute(sql`
      SELECT 
        transaction_id,
        COALESCE(SUM(debit), 0.00)::text as debits,
        COALESCE(SUM(credit), 0.00)::text as credits,
        ABS(COALESCE(SUM(debit), 0.00) - COALESCE(SUM(credit), 0.00))::text as discrepancy
      FROM ledger_entries
      GROUP BY transaction_id
      HAVING SUM(debit) <> SUM(credit);
    `);

    const unbalancedTransactions = unbalancedResult.map((r: any) => ({
      transactionId: r.transaction_id,
      debits: parseFloat(r.debits || "0.00"),
      credits: parseFloat(r.credits || "0.00"),
      discrepancy: parseFloat(r.discrepancy || "0.00"),
    }));

    const globalDiscrepancy = Math.abs(Math.round((totalDebits - totalCredits) * 100) / 100);
    const verified =
      globalDiscrepancy === 0 &&
      unbalancedTransactions.length === 0 &&
      breakdown.cash.discrepancy === 0 &&
      breakdown.securities.discrepancy === 0;

    return {
      verified,
      discrepancy: globalDiscrepancy,
      totalDebits,
      totalCredits,
      totalEntries,
      totalTransactions,
      unbalancedTransactionsCount: unbalancedTransactions.length,
      unbalancedTransactions,
      breakdown,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retrieves all journal entries recorded for a given transactionId.
   */
  public async getEntriesByTransactionId(
    transactionId: string,
    txClient?: any
  ): Promise<LedgerEntry[]> {
    const client = txClient || this.db;
    return await client
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.transactionId, transactionId))
      .orderBy(ledgerEntries.entryId);
  }

  /**
   * Retrieves ledger journal history for a specific user/account.
   */
  public async getAccountLedger(
    accountId: string,
    options: { limit?: number; offset?: number } = {},
    txClient?: any
  ): Promise<LedgerEntry[]> {
    const client = txClient || this.db;
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    return await client
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.accountId, accountId))
      .orderBy(sql`${ledgerEntries.createdAt} DESC`, sql`${ledgerEntries.entryId} DESC`)
      .limit(limit)
      .offset(offset);
  }
}

// Default singleton instance
export const ledgerService = new LedgerService();
