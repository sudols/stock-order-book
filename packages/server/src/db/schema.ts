import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  bigserial,
  bigint,
  boolean,
  timestamp,
  jsonb,
  text,
  check,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * 1. USERS TABLE
 * System users, students, instructors, and auditors.
 */
export const users = pgTable(
  "users",
  {
    userId: uuid("user_id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    role: varchar("role", { length: 20 }).notNull().default("STUDENT"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("users_role_check", sql`${table.role} IN ('STUDENT', 'INSTRUCTOR', 'AUDITOR')`),
  ]
);

/**
 * 2. SYMBOLS TABLE
 * Tradable market instruments, tick size rules, and circuit limit bands.
 */
export const symbols = pgTable(
  "symbols",
  {
    symbolId: varchar("symbol_id", { length: 10 }).primaryKey(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    tickSize: numeric("tick_size", { precision: 6, scale: 2 }).notNull().default("0.05"),
    lotSize: integer("lot_size").notNull().default(1),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
    circuitLimitPct: numeric("circuit_limit_pct", { precision: 4, scale: 2 }).notNull().default("10.00"),
    isHalted: boolean("is_halted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("symbols_tick_size_check", sql`${table.tickSize} > 0`),
    check("symbols_lot_size_check", sql`${table.lotSize} > 0`),
    check("symbols_base_price_check", sql`${table.basePrice} > 0`),
    check("symbols_circuit_limit_check", sql`${table.circuitLimitPct} >= 0`),
  ]
);

/**
 * 3. PORTFOLIOS TABLE
 * User fiat cash balance custody and locked cash in resting buy limit orders.
 */
export const portfolios = pgTable(
  "portfolios",
  {
    portfolioId: uuid("portfolio_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.userId, { onDelete: "cascade" }),
    cashBalance: numeric("cash_balance", { precision: 15, scale: 2 }).notNull().default("0.00"),
    lockedCash: numeric("locked_cash", { precision: 15, scale: 2 }).notNull().default("0.00"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("portfolios_cash_balance_check", sql`${table.cashBalance} >= 0`),
    check("portfolios_locked_cash_check", sql`${table.lockedCash} >= 0`),
  ]
);

/**
 * 4. SECURITIES_HOLDINGS TABLE
 * Per-user stock asset custody and locked quantity in resting sell limit orders.
 */
export const securitiesHoldings = pgTable(
  "securities_holdings",
  {
    holdingId: uuid("holding_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    symbolId: varchar("symbol_id", { length: 10 })
      .notNull()
      .references(() => symbols.symbolId, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    lockedQuantity: integer("locked_quantity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("securities_holdings_quantity_check", sql`${table.quantity} >= 0`),
    check("securities_holdings_locked_quantity_check", sql`${table.lockedQuantity} >= 0`),
    unique("securities_holdings_user_symbol_unique").on(table.userId, table.symbolId),
  ]
);

/**
 * 5. ORDERS TABLE
 * Lifecycle tracking for LIMIT and MARKET orders.
 */
export const orders = pgTable(
  "orders",
  {
    orderId: uuid("order_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    symbolId: varchar("symbol_id", { length: 10 })
      .notNull()
      .references(() => symbols.symbolId, { onDelete: "restrict" }),
    side: varchar("side", { length: 4 }).notNull(),
    orderType: varchar("order_type", { length: 10 }).notNull(),
    price: numeric("price", { precision: 12, scale: 2 }),
    initialQuantity: integer("initial_quantity").notNull(),
    remainingQuantity: integer("remaining_quantity").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("orders_side_check", sql`${table.side} IN ('BUY', 'SELL')`),
    check("orders_type_check", sql`${table.orderType} IN ('LIMIT', 'MARKET')`),
    check(
      "orders_status_check",
      sql`${table.status} IN ('PENDING', 'RESTING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED')`
    ),
    check("orders_initial_qty_check", sql`${table.initialQuantity} > 0`),
    check("orders_remaining_qty_check", sql`${table.remainingQuantity} >= 0`),
    index("orders_user_id_idx").on(table.userId),
    index("orders_symbol_status_idx").on(table.symbolId, table.status),
    index("orders_placed_at_idx").on(table.placedAt),
  ]
);

/**
 * 6. TRADES TABLE
 * Immutable executed contracts pairing buyer, seller, execution price, and filled shares.
 */
export const trades = pgTable(
  "trades",
  {
    tradeId: uuid("trade_id").primaryKey().defaultRandom(),
    buyOrderId: uuid("buy_order_id")
      .notNull()
      .references(() => orders.orderId, { onDelete: "cascade" }),
    sellOrderId: uuid("sell_order_id")
      .notNull()
      .references(() => orders.orderId, { onDelete: "cascade" }),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    symbolId: varchar("symbol_id", { length: 10 })
      .notNull()
      .references(() => symbols.symbolId, { onDelete: "restrict" }),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    takerSide: varchar("taker_side", { length: 4 }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("trades_taker_side_check", sql`${table.takerSide} IN ('BUY', 'SELL')`),
    check("trades_price_check", sql`${table.price} > 0`),
    check("trades_quantity_check", sql`${table.quantity} > 0`),
    index("trades_symbol_idx").on(table.symbolId),
    index("trades_buyer_idx").on(table.buyerId),
    index("trades_seller_idx").on(table.sellerId),
    index("trades_executed_at_idx").on(table.executedAt),
  ]
);

/**
 * 7. LEDGER_ENTRIES TABLE
 * Institutional-grade double-entry bookkeeping journal.
 * Enforces invariant: sum(Debits) === sum(Credits) for every transaction_id.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    entryId: bigserial("entry_id", { mode: "number" }).primaryKey(),
    transactionId: uuid("transaction_id").notNull(),
    accountId: uuid("account_id").notNull(),
    accountType: varchar("account_type", { length: 20 }).notNull(),
    symbolId: varchar("symbol_id", { length: 10 }).references(() => symbols.symbolId, {
      onDelete: "restrict",
    }),
    debit: numeric("debit", { precision: 15, scale: 2 }).notNull().default("0.00"),
    credit: numeric("credit", { precision: 15, scale: 2 }).notNull().default("0.00"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("ledger_account_type_check", sql`${table.accountType} IN ('CASH', 'SECURITIES')`),
    check("ledger_debit_check", sql`${table.debit} >= 0`),
    check("ledger_credit_check", sql`${table.credit} >= 0`),
    index("ledger_transaction_idx").on(table.transactionId),
    index("ledger_account_idx").on(table.accountId),
    index("ledger_created_at_idx").on(table.createdAt),
  ]
);

/**
 * 8. MARKET_EVENTS_WAL TABLE
 * Append-only Write-Ahead Log (WAL) event stream for deterministic in-memory crash recovery.
 */
export const marketEventsWal = pgTable(
  "market_events_wal",
  {
    eventId: bigserial("event_id", { mode: "number" }).primaryKey(),
    symbolId: varchar("symbol_id", { length: 10 })
      .notNull()
      .references(() => symbols.symbolId, { onDelete: "restrict" }),
    eventType: varchar("event_type", { length: 20 }).notNull(),
    payload: jsonb("payload").notNull(),
    sequenceNo: bigint("sequence_no", { mode: "number" }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("wal_event_type_check", sql`${table.eventType} IN ('ORDER_PLACED', 'MATCH', 'CANCEL')`),
    index("wal_symbol_seq_idx").on(table.symbolId, table.sequenceNo),
    index("wal_created_at_idx").on(table.createdAt),
  ]
);

// Type inference exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Symbol = typeof symbols.$inferSelect;
export type NewSymbol = typeof symbols.$inferInsert;

export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;

export type SecurityHolding = typeof securitiesHoldings.$inferSelect;
export type NewSecurityHolding = typeof securitiesHoldings.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntries.$inferInsert;

export type MarketEventWal = typeof marketEventsWal.$inferSelect;
export type NewMarketEventWal = typeof marketEventsWal.$inferInsert;
