CREATE TABLE "ledger_entries" (
	"entry_id" bigserial PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"account_type" varchar(20) NOT NULL,
	"symbol_id" varchar(10),
	"debit" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"credit" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_account_type_check" CHECK ("ledger_entries"."account_type" IN ('CASH', 'SECURITIES')),
	CONSTRAINT "ledger_debit_check" CHECK ("ledger_entries"."debit" >= 0),
	CONSTRAINT "ledger_credit_check" CHECK ("ledger_entries"."credit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "market_events_wal" (
	"event_id" bigserial PRIMARY KEY NOT NULL,
	"symbol_id" varchar(10) NOT NULL,
	"event_type" varchar(20) NOT NULL,
	"payload" jsonb NOT NULL,
	"sequence_no" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_events_wal_sequence_no_unique" UNIQUE("sequence_no"),
	CONSTRAINT "wal_event_type_check" CHECK ("market_events_wal"."event_type" IN ('ORDER_PLACED', 'MATCH', 'CANCEL'))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol_id" varchar(10) NOT NULL,
	"side" varchar(4) NOT NULL,
	"order_type" varchar(10) NOT NULL,
	"price" numeric(12, 2),
	"initial_quantity" integer NOT NULL,
	"remaining_quantity" integer NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_side_check" CHECK ("orders"."side" IN ('BUY', 'SELL')),
	CONSTRAINT "orders_type_check" CHECK ("orders"."order_type" IN ('LIMIT', 'MARKET')),
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('PENDING', 'RESTING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED')),
	CONSTRAINT "orders_initial_qty_check" CHECK ("orders"."initial_quantity" > 0),
	CONSTRAINT "orders_remaining_qty_check" CHECK ("orders"."remaining_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"portfolio_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cash_balance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"locked_cash" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolios_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "portfolios_cash_balance_check" CHECK ("portfolios"."cash_balance" >= 0),
	CONSTRAINT "portfolios_locked_cash_check" CHECK ("portfolios"."locked_cash" >= 0)
);
--> statement-breakpoint
CREATE TABLE "securities_holdings" (
	"holding_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol_id" varchar(10) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"locked_quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "securities_holdings_user_symbol_unique" UNIQUE("user_id","symbol_id"),
	CONSTRAINT "securities_holdings_quantity_check" CHECK ("securities_holdings"."quantity" >= 0),
	CONSTRAINT "securities_holdings_locked_quantity_check" CHECK ("securities_holdings"."locked_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "symbols" (
	"symbol_id" varchar(10) PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"tick_size" numeric(6, 2) DEFAULT '0.05' NOT NULL,
	"lot_size" integer DEFAULT 1 NOT NULL,
	"base_price" numeric(12, 2) NOT NULL,
	"circuit_limit_pct" numeric(4, 2) DEFAULT '10.00' NOT NULL,
	"is_halted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "symbols_tick_size_check" CHECK ("symbols"."tick_size" > 0),
	CONSTRAINT "symbols_lot_size_check" CHECK ("symbols"."lot_size" > 0),
	CONSTRAINT "symbols_base_price_check" CHECK ("symbols"."base_price" > 0),
	CONSTRAINT "symbols_circuit_limit_check" CHECK ("symbols"."circuit_limit_pct" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"trade_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buy_order_id" uuid NOT NULL,
	"sell_order_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"symbol_id" varchar(10) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"taker_side" varchar(4) NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trades_taker_side_check" CHECK ("trades"."taker_side" IN ('BUY', 'SELL')),
	CONSTRAINT "trades_price_check" CHECK ("trades"."price" > 0),
	CONSTRAINT "trades_quantity_check" CHECK ("trades"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'STUDENT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('STUDENT', 'INSTRUCTOR', 'AUDITOR'))
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_symbol_id_symbols_symbol_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("symbol_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_events_wal" ADD CONSTRAINT "market_events_wal_symbol_id_symbols_symbol_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("symbol_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_symbol_id_symbols_symbol_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("symbol_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "securities_holdings" ADD CONSTRAINT "securities_holdings_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "securities_holdings" ADD CONSTRAINT "securities_holdings_symbol_id_symbols_symbol_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("symbol_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_buy_order_id_orders_order_id_fk" FOREIGN KEY ("buy_order_id") REFERENCES "public"."orders"("order_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_sell_order_id_orders_order_id_fk" FOREIGN KEY ("sell_order_id") REFERENCES "public"."orders"("order_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyer_id_users_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_seller_id_users_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_symbol_id_symbols_symbol_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."symbols"("symbol_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_transaction_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_account_idx" ON "ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ledger_created_at_idx" ON "ledger_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wal_symbol_seq_idx" ON "market_events_wal" USING btree ("symbol_id","sequence_no");--> statement-breakpoint
CREATE INDEX "wal_created_at_idx" ON "market_events_wal" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_symbol_status_idx" ON "orders" USING btree ("symbol_id","status");--> statement-breakpoint
CREATE INDEX "orders_placed_at_idx" ON "orders" USING btree ("placed_at");--> statement-breakpoint
CREATE INDEX "trades_symbol_idx" ON "trades" USING btree ("symbol_id");--> statement-breakpoint
CREATE INDEX "trades_buyer_idx" ON "trades" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "trades_seller_idx" ON "trades" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "trades_executed_at_idx" ON "trades" USING btree ("executed_at");