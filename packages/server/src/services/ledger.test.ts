import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { sql, eq } from "drizzle-orm";
import http from "node:http";
import express from "express";
import {
  createDbConnection,
  TEST_DATABASE_URL,
  users,
  symbols,
  ledgerEntries,
} from "../db/index.js";
import { runMigrations } from "../db/migrate.js";
import { seedDatabase } from "../db/seed.js";
import {
  LedgerService,
  UnbalancedLedgerError,
  InvalidLedgerEntryError,
} from "./ledger.js";
import { createAppRouter } from "../routers/app.js";
import { MatchingEngine } from "../matching-engine.js";
import { PortfolioManager } from "../portfolio-manager.js";
import { OrderBook } from "../orderbook.js";
import { Server as SocketServer } from "socket.io";

const PG_CHECK_VIOLATION = "23514";

describe("Double-Entry Financial Ledger & Trigger Invariants (S2-03 / NR-05)", () => {
  const { client, db } = createDbConnection(TEST_DATABASE_URL);
  const ledgerService = new LedgerService(db);

  let seededUsers: Array<{ userId: string; username: string }>;
  let seededSymbols: Array<{ symbolId: string }>;

  beforeAll(async () => {
    // Ensure migrations and seed are ready
    await runMigrations(TEST_DATABASE_URL);
    await seedDatabase(db);

    seededUsers = await db.select({ userId: users.userId, username: users.username }).from(users);
    seededSymbols = await db.select({ symbolId: symbols.symbolId }).from(symbols);
  });

  afterAll(async () => {
    await client.end({ timeout: 5 });
  });

  beforeEach(async () => {
    // Reset ledger entries table to guarantee deterministic test assertions
    await db.execute(sql`TRUNCATE TABLE ledger_entries RESTART IDENTITY;`);
  });

  describe("1. Application-Level Validation & Invariants", () => {
    it("should reject recording a journal batch if Sum(Debits) !== Sum(Credits)", async () => {
      const txId = uuidv4();
      const buyer = seededUsers[0];
      const seller = seededUsers[1];

      const unbalancedBatch = [
        {
          transactionId: txId,
          accountId: buyer.userId,
          accountType: "CASH" as const,
          debit: "0.00",
          credit: "1500.00",
        },
        {
          transactionId: txId,
          accountId: seller.userId,
          accountType: "CASH" as const,
          debit: "1400.00", // Unbalanced by ₹100.00!
          credit: "0.00",
        },
      ];

      await expect(
        ledgerService.recordJournalBatch(unbalancedBatch)
      ).rejects.toThrow(UnbalancedLedgerError);

      // Verify no rows were persisted
      const rows = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.transactionId, txId));
      expect(rows.length).toBe(0);
    });

    it("should reject negative amounts or empty journal batches", async () => {
      await expect(ledgerService.recordJournalBatch([])).rejects.toThrow(
        InvalidLedgerEntryError
      );

      const txId = uuidv4();
      const user = seededUsers[0];

      await expect(
        ledgerService.recordJournalBatch([
          {
            transactionId: txId,
            accountId: user.userId,
            accountType: "CASH",
            debit: "-50.00",
            credit: "-50.00",
          },
        ])
      ).rejects.toThrow(InvalidLedgerEntryError);
    });

    it("should reject trade journal recording with non-positive price or quantity", async () => {
      const buyer = seededUsers[0];
      const seller = seededUsers[1];

      await expect(
        ledgerService.recordTradeJournal({
          buyerId: buyer.userId,
          sellerId: seller.userId,
          symbolId: "TCS",
          price: 0,
          quantity: 10,
        })
      ).rejects.toThrow(InvalidLedgerEntryError);

      await expect(
        ledgerService.recordTradeJournal({
          buyerId: buyer.userId,
          sellerId: seller.userId,
          symbolId: "TCS",
          price: 100,
          quantity: -5,
        })
      ).rejects.toThrow(InvalidLedgerEntryError);
    });
  });

  describe("2. Database Trigger Invariants & Immediate Rollback", () => {
    it("should trigger immediate database rollback when raw SQL inserts an unbalanced transaction", async () => {
      const txId = uuidv4();
      const buyer = seededUsers[0];

      let errorThrown: any = null;

      try {
        // Attempt to insert a single debit row without corresponding credit in a transaction
        await db.transaction(async (tx) => {
          await tx.insert(ledgerEntries).values({
            transactionId: txId,
            accountId: buyer.userId,
            accountType: "CASH",
            symbolId: null,
            debit: "5000.00",
            credit: "0.00",
            description: "Unbalanced malicious/rogue cash debit",
          });
        });
      } catch (err: any) {
        errorThrown = err.cause || err;
      }

      expect(errorThrown).toBeDefined();
      expect(errorThrown.code).toBe(PG_CHECK_VIOLATION);
      expect(errorThrown.message).toContain("Double-entry ledger invariant violation");
      expect(errorThrown.message).toContain(txId);

      // Verify transaction was rolled back and 0 rows exist for txId
      const persistedRows = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.transactionId, txId));
      expect(persistedRows.length).toBe(0);
    });

    it("should rollback transaction if a statement updates an entry to break the balance", async () => {
      const buyer = seededUsers[0];
      const seller = seededUsers[1];

      // 1. Record a valid balanced trade
      const { transactionId } = await ledgerService.recordTradeJournal({
        buyerId: buyer.userId,
        sellerId: seller.userId,
        symbolId: "INFY",
        price: 1500.0,
        quantity: 10,
      });

      const initialEntries = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.transactionId, transactionId));
      expect(initialEntries.length).toBe(4);

      // 2. Attempt to corrupt one row by altering debit
      let errorThrown: any = null;
      try {
        await db.transaction(async (tx) => {
          await tx
            .update(ledgerEntries)
            .set({ debit: "9999.00" })
            .where(eq(ledgerEntries.entryId, initialEntries[0].entryId));
        });
      } catch (err: any) {
        errorThrown = err.cause || err;
      }

      expect(errorThrown).toBeDefined();
      expect(errorThrown.code).toBe(PG_CHECK_VIOLATION);

      // Verify the update was rolled back and original values remain intact
      const afterRollbackEntries = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.transactionId, transactionId));
      const corruptedRow = afterRollbackEntries.find((r) => r.entryId === initialEntries[0].entryId);
      expect(corruptedRow?.debit).toBe(initialEntries[0].debit);
    });
  });

  describe("3. Double-Entry Trade Journaling (4-legged trade structure)", () => {
    it("should generate 4 balanced rows per trade matching accounting specifications", async () => {
      const buyer = seededUsers[0];
      const seller = seededUsers[1];
      const symbol = "TCS";
      const price = 3520.5;
      const quantity = 15;
      const expectedCash = (Math.round(price * quantity * 100) / 100).toFixed(2); // "52807.50"
      const expectedShares = quantity.toFixed(2); // "15.00"

      const { transactionId, entries } = await ledgerService.recordTradeJournal({
        buyerId: buyer.userId,
        sellerId: seller.userId,
        symbolId: symbol,
        price,
        quantity,
      });

      expect(transactionId).toBeDefined();
      expect(entries.length).toBe(4);

      // 1. Buyer Cash: Credit outflow
      const buyerCash = entries.find(
        (e) => e.accountId === buyer.userId && e.accountType === "CASH"
      );
      expect(buyerCash).toBeDefined();
      expect(buyerCash?.debit).toBe("0.00");
      expect(buyerCash?.credit).toBe(expectedCash);
      expect(buyerCash?.symbolId).toBeNull();

      // 2. Buyer Securities: Debit inflow
      const buyerSecurities = entries.find(
        (e) => e.accountId === buyer.userId && e.accountType === "SECURITIES"
      );
      expect(buyerSecurities).toBeDefined();
      expect(buyerSecurities?.debit).toBe(expectedShares);
      expect(buyerSecurities?.credit).toBe("0.00");
      expect(buyerSecurities?.symbolId).toBe(symbol);

      // 3. Seller Cash: Debit inflow
      const sellerCash = entries.find(
        (e) => e.accountId === seller.userId && e.accountType === "CASH"
      );
      expect(sellerCash).toBeDefined();
      expect(sellerCash?.debit).toBe(expectedCash);
      expect(sellerCash?.credit).toBe("0.00");
      expect(sellerCash?.symbolId).toBeNull();

      // 4. Seller Securities: Credit outflow
      const sellerSecurities = entries.find(
        (e) => e.accountId === seller.userId && e.accountType === "SECURITIES"
      );
      expect(sellerSecurities).toBeDefined();
      expect(sellerSecurities?.debit).toBe("0.00");
      expect(sellerSecurities?.credit).toBe(expectedShares);
      expect(sellerSecurities?.symbolId).toBe(symbol);

      // Verify mathematical balance for this transaction
      const totalDebits = entries.reduce((sum, e) => sum + parseFloat(e.debit), 0);
      const totalCredits = entries.reduce((sum, e) => sum + parseFloat(e.credit), 0);
      expect(totalDebits).toBeCloseTo(totalCredits, 2);
    });
  });

  describe("4. 100 Mock Trades Stress & Balance Invariant Verification", () => {
    it("should execute 100 mock trades with Sum(Debits) === Sum(Credits) across all entries", async () => {
      const symbolsList = ["TCS", "INFY", "RELIANCE", "HDFCBANK"];
      const basePrices: Record<string, number> = {
        TCS: 3500.0,
        INFY: 1450.0,
        RELIANCE: 2900.0,
        HDFCBANK: 1650.0,
      };

      const buyer = seededUsers[0];
      const seller = seededUsers[1];

      // Execute 100 diverse trades
      const TRADE_COUNT = 100;
      for (let i = 1; i <= TRADE_COUNT; i++) {
        const symbol = symbolsList[i % symbolsList.length];
        // Vary price and quantity deterministically
        const price = basePrices[symbol] + (i % 20) * 0.5;
        const quantity = 1 + (i % 15);

        await ledgerService.recordTradeJournal({
          buyerId: buyer.userId,
          sellerId: seller.userId,
          symbolId: symbol,
          price,
          quantity,
          description: `Trade #${i} mock execution`,
        });
      }

      // Verify total entries count
      const totalEntriesCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(ledgerEntries);
      expect(Number(totalEntriesCount[0].count)).toBe(TRADE_COUNT * 4); // 400 entries

      // Verify aggregate sum of Debits === sum of Credits
      const aggregateResult = await db.execute<{
        sum_debits: string;
        sum_credits: string;
      }>(sql`
        SELECT 
          COALESCE(SUM(debit), 0.00)::text as sum_debits,
          COALESCE(SUM(credit), 0.00)::text as sum_credits
        FROM ledger_entries;
      `);

      const sumDebits = parseFloat(aggregateResult[0].sum_debits);
      const sumCredits = parseFloat(aggregateResult[0].sum_credits);

      expect(sumDebits).toBeGreaterThan(0);
      expect(sumCredits).toBeGreaterThan(0);
      expect(sumDebits).toBe(sumCredits);
      expect(Math.abs(sumDebits - sumCredits)).toBe(0);

      // Verify audit service report
      const auditReport = await ledgerService.verifyLedgerIntegrity();
      expect(auditReport.verified).toBe(true);
      expect(auditReport.discrepancy).toBe(0.0);
      expect(auditReport.totalEntries).toBe(400);
      expect(auditReport.totalTransactions).toBe(100);
      expect(auditReport.unbalancedTransactionsCount).toBe(0);
      expect(auditReport.breakdown.cash.discrepancy).toBe(0.0);
      expect(auditReport.breakdown.securities.discrepancy).toBe(0.0);
    });
  });

  describe("5. Audit Query Endpoints (HTTP GET /api/audit/verify-ledger & tRPC verifyLedger)", () => {
    it("should return 200 OK with { verified: true, discrepancy: 0.00 } from Express endpoint", async () => {
      // 1. Seed at least one trade so the ledger has data
      const buyer = seededUsers[0];
      const seller = seededUsers[1];
      await ledgerService.recordTradeJournal({
        buyerId: buyer.userId,
        sellerId: seller.userId,
        symbolId: "TCS",
        price: 3500.0,
        quantity: 10,
      });

      // 2. Spin up an ephemeral Express app mounting the endpoint
      const app = express();
      app.use(express.json());
      app.get("/api/audit/verify-ledger", async (_req, res) => {
        try {
          const report = await ledgerService.verifyLedgerIntegrity();
          res.status(200).json(report);
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as any).port;

      try {
        const response = await fetch(`http://localhost:${port}/api/audit/verify-ledger`);
        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data.verified).toBe(true);
        expect(data.discrepancy).toBe(0.0);
        expect(data.unbalancedTransactionsCount).toBe(0);
        expect(data.totalEntries).toBeGreaterThan(0);
        expect(data.breakdown.cash.discrepancy).toBe(0.0);
        expect(data.breakdown.securities.discrepancy).toBe(0.0);
      } finally {
        server.close();
      }
    });

    it("should return { verified: true, discrepancy: 0.00 } from tRPC verifyLedger procedure", async () => {
      // Spin up tRPC router with injected ledgerService
      const matchingEngine = new MatchingEngine(new OrderBook(), new PortfolioManager());
      const orderBook = new OrderBook();
      const portfolioManager = new PortfolioManager();
      const mockIo = { emit: () => {} } as unknown as SocketServer;

      const appRouter = createAppRouter({
        matchingEngine,
        portfolioManager,
        orderBook,
        io: mockIo,
        ledgerService,
      });

      const caller = appRouter.createCaller({} as any);
      const result = await caller.verifyLedger();

      expect(result.verified).toBe(true);
      expect(result.discrepancy).toBe(0.0);
      expect(result.unbalancedTransactionsCount).toBe(0);
    });
  });
});
