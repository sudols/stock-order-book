import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runMigrations } from "./migrate.js";
import { seedDatabase, INITIAL_SYMBOLS, INITIAL_USERS } from "./seed.js";
import {
  createDbConnection,
  TEST_DATABASE_URL,
  users,
  portfolios,
  securitiesHoldings,
  symbols,
  orders,
  trades,
  ledgerEntries,
  marketEventsWal,
} from "./index.js";
import { eq, sql } from "drizzle-orm";

// PostgreSQL SQLSTATE Error Codes
const PG_CHECK_VIOLATION = "23514";
const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";

async function expectConstraintViolation(
  promise: Promise<unknown>,
  expectedCode: string,
  expectedConstraintName?: string
) {
  try {
    await promise;
    expect.fail("Expected query to throw database constraint violation, but it succeeded");
  } catch (err: any) {
    const pgErr = err.cause || err;
    expect(pgErr.code).toBe(expectedCode);
    if (expectedConstraintName) {
      const constraint = pgErr.constraint_name || pgErr.message || "";
      expect(constraint).toContain(expectedConstraintName);
    }
  }
}

describe("3NF PostgreSQL Relational Schema & Migrations (S2-02)", () => {
  const { client, db } = createDbConnection(TEST_DATABASE_URL);

  beforeAll(async () => {
    // Apply migrations and seed test database
    await runMigrations(TEST_DATABASE_URL);
    await seedDatabase(db);
  });

  afterAll(async () => {
    await client.end({ timeout: 5 });
  });

  it("should create all 8 core relational tables in the 3NF schema", async () => {
    const result = await db.execute<{ table_name: string }>(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableNames = result.map((r) => r.table_name);
    const expectedTables = [
      "ledger_entries",
      "market_events_wal",
      "orders",
      "portfolios",
      "securities_holdings",
      "symbols",
      "trades",
      "users",
    ];

    for (const expected of expectedTables) {
      expect(tableNames).toContain(expected);
    }
  });

  it("should have seeded the 4 Indian equity symbols with correct market parameters", async () => {
    const seededSymbols = await db.select().from(symbols);
    expect(seededSymbols.length).toBe(4);

    const symbolIds = seededSymbols.map((s) => s.symbolId).sort();
    expect(symbolIds).toEqual(["HDFCBANK", "INFY", "RELIANCE", "TCS"]);

    for (const sym of seededSymbols) {
      expect(parseFloat(sym.tickSize)).toBe(0.05);
      expect(sym.lotSize).toBe(1);
      expect(parseFloat(sym.circuitLimitPct)).toBe(10.0);
      expect(sym.isHalted).toBe(false);
      expect(parseFloat(sym.basePrice)).toBeGreaterThan(0);
    }
  });

  it("should have seeded test users with ₹10,000 cash balance and 100 shares per symbol", async () => {
    const seededUsers = await db.select().from(users);
    expect(seededUsers.length).toBeGreaterThanOrEqual(INITIAL_USERS.length);

    for (const userSpec of INITIAL_USERS) {
      const userRecord = seededUsers.find((u) => u.username === userSpec.username);
      expect(userRecord).toBeDefined();

      // Verify portfolio
      const userPortfolios = await db
        .select()
        .from(portfolios)
        .where(eq(portfolios.userId, userRecord!.userId));
      expect(userPortfolios.length).toBe(1);
      expect(parseFloat(userPortfolios[0].cashBalance)).toBe(10000.0);
      expect(parseFloat(userPortfolios[0].lockedCash)).toBe(0.0);

      // Verify securities holdings for all 4 symbols
      const userHoldings = await db
        .select()
        .from(securitiesHoldings)
        .where(eq(securitiesHoldings.userId, userRecord!.userId));
      expect(userHoldings.length).toBe(4);

      for (const holding of userHoldings) {
        expect(holding.quantity).toBe(100);
        expect(holding.lockedQuantity).toBe(0);
      }
    }
  });

  it("should enforce CHECK constraint (cash_balance >= 0) on portfolios", async () => {
    const [testUser] = await db.select().from(users).limit(1);

    await expectConstraintViolation(
      db.execute(sql`
        UPDATE portfolios 
        SET cash_balance = -100.00 
        WHERE user_id = ${testUser.userId}
      `),
      PG_CHECK_VIOLATION,
      "portfolios_cash_balance_check"
    );
  });

  it("should enforce CHECK constraint (locked_cash >= 0) on portfolios", async () => {
    const [testUser] = await db.select().from(users).limit(1);

    await expectConstraintViolation(
      db.execute(sql`
        UPDATE portfolios 
        SET locked_cash = -50.00 
        WHERE user_id = ${testUser.userId}
      `),
      PG_CHECK_VIOLATION,
      "portfolios_locked_cash_check"
    );
  });

  it("should enforce CHECK constraint (quantity >= 0) on securities_holdings", async () => {
    const [testUser] = await db.select().from(users).limit(1);

    await expectConstraintViolation(
      db.execute(sql`
        UPDATE securities_holdings 
        SET quantity = -10 
        WHERE user_id = ${testUser.userId} AND symbol_id = 'TCS'
      `),
      PG_CHECK_VIOLATION,
      "securities_holdings_quantity_check"
    );
  });

  it("should enforce CHECK constraint (locked_quantity >= 0) on securities_holdings", async () => {
    const [testUser] = await db.select().from(users).limit(1);

    await expectConstraintViolation(
      db.execute(sql`
        UPDATE securities_holdings 
        SET locked_quantity = -5 
        WHERE user_id = ${testUser.userId} AND symbol_id = 'TCS'
      `),
      PG_CHECK_VIOLATION,
      "securities_holdings_locked_quantity_check"
    );
  });

  it("should enforce UNIQUE constraint on (user_id, symbol_id) in securities_holdings", async () => {
    const [testUser] = await db.select().from(users).limit(1);

    await expectConstraintViolation(
      db.insert(securitiesHoldings).values({
        userId: testUser.userId,
        symbolId: "TCS",
        quantity: 50,
        lockedQuantity: 0,
      }),
      PG_UNIQUE_VIOLATION,
      "securities_holdings_user_symbol_unique"
    );
  });

  it("should enforce CHECK constraint on users.role", async () => {
    await expectConstraintViolation(
      db.execute(sql`
        INSERT INTO users (username, email, role)
        VALUES ('invalid_user', 'invalid@glassbox.internal', 'SUPERUSER')
      `),
      PG_CHECK_VIOLATION,
      "users_role_check"
    );
  });

  it("should enforce FOREIGN KEY constraint on orders referencing non-existent symbol", async () => {
    const [testUser] = await db.select().from(users).limit(1);

    await expectConstraintViolation(
      db.insert(orders).values({
        userId: testUser.userId,
        symbolId: "FAKE",
        side: "BUY",
        orderType: "LIMIT",
        price: "100.00",
        initialQuantity: 10,
        remainingQuantity: 10,
        status: "RESTING",
      }),
      PG_FOREIGN_KEY_VIOLATION,
      "orders_symbol_id_symbols_symbol_id_fk"
    );
  });

  it("should support inserting and querying orders, trades, ledger entries, and WAL events", async () => {
    const [buyer, seller] = await db.select().from(users).limit(2);

    // 1. Insert Orders
    const [buyOrder] = await db
      .insert(orders)
      .values({
        userId: buyer.userId,
        symbolId: "TCS",
        side: "BUY",
        orderType: "LIMIT",
        price: "3500.00",
        initialQuantity: 10,
        remainingQuantity: 0,
        status: "FILLED",
      })
      .returning();

    const [sellOrder] = await db
      .insert(orders)
      .values({
        userId: seller.userId,
        symbolId: "TCS",
        side: "SELL",
        orderType: "LIMIT",
        price: "3500.00",
        initialQuantity: 10,
        remainingQuantity: 0,
        status: "FILLED",
      })
      .returning();

    expect(buyOrder.orderId).toBeDefined();
    expect(sellOrder.orderId).toBeDefined();

    // 2. Insert Trade
    const [trade] = await db
      .insert(trades)
      .values({
        buyOrderId: buyOrder.orderId,
        sellOrderId: sellOrder.orderId,
        buyerId: buyer.userId,
        sellerId: seller.userId,
        symbolId: "TCS",
        price: "3500.00",
        quantity: 10,
        takerSide: "BUY",
      })
      .returning();

    expect(trade.tradeId).toBeDefined();
    expect(parseFloat(trade.price)).toBe(3500.0);
    expect(trade.quantity).toBe(10);

    // 3. Insert Balanced Double-Entry Ledger Entries
    const txId = trade.tradeId;
    const tradeValue = "35000.00";

    const ledgerRows = await db
      .insert(ledgerEntries)
      .values([
        {
          transactionId: txId,
          accountId: buyer.userId,
          accountType: "CASH",
          debit: "0.00",
          credit: tradeValue,
          description: "Buyer cash debit for TCS execution",
        },
        {
          transactionId: txId,
          accountId: seller.userId,
          accountType: "CASH",
          debit: tradeValue,
          credit: "0.00",
          description: "Seller cash credit for TCS execution",
        },
      ])
      .returning();

    expect(ledgerRows.length).toBe(2);

    // 4. Insert Market Event WAL row
    const [walRow] = await db
      .insert(marketEventsWal)
      .values({
        symbolId: "TCS",
        eventType: "MATCH",
        payload: {
          tradeId: trade.tradeId,
          price: 3500.0,
          quantity: 10,
        },
        sequenceNo: Date.now(),
      })
      .returning();

    expect(walRow.eventId).toBeDefined();
    expect(typeof walRow.sequenceNo).toBe("number");
    expect((walRow.payload as { price: number }).price).toBe(3500.0);
  });
});
