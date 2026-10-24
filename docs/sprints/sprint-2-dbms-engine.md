# ⚡ Sprint 2: 3NF PostgreSQL Schema, Atomic Settlement & Multi-Symbol Engine

> **Sprint Status:** 🔄 **ACTIVE (Weeks 4–6)**  
> **Primary Goal:** Transition from in-memory prototype to ACID-compliant PostgreSQL relational engine with bank-grade double-entry ledger and multi-symbol support.  
> **Master Spec Reference:** [GLASS_BOX_PROJECT_SPECIFICATION.md#4-postgresql-3nf-relational-database-schema](../GLASS_BOX_PROJECT_SPECIFICATION.md)

---

## 📋 Sprint Feature Cards

```
S2-01 [Postgres Docker] ──► S2-02 [3NF Schema] ──► S2-03 [Double-Entry Ledger]
                                  │
                                  ├─► S2-04 [Multi-Symbol Books]
                                  │
                                  └─► S2-05 [Multi-Party Atomic Settlement]
```

---

### Feature Card: `S2-01` — Local PostgreSQL Infrastructure & Docker Setup
- **Status:** `[ ] PENDING`
- **Owner:** Sameer Bhati (`S24BCAU0106`) / Apoorva Pandey (`S24BCAU0120`)
- **Target Branch:** `feat/S2-01-postgres-docker`
- **Prerequisites:** None
- **Scope & Implementation Details:**
  1. Add `docker-compose.yml` to the project root:
     - PostgreSQL 16 image (`postgres:16-alpine`).
     - Port mapping: `5432:5432`.
     - Environment variables: `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=glassbox`.
     - Persistent volume: `postgres_data:/var/lib/postgresql/data`.
     - Health check using `pg_isready -U postgres`.
  2. Configure `.env.example` and update `.env` in root and `packages/server/`:
     - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/glassbox`
     - `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/glassbox_test`
  3. Ensure `.gitignore` ignores `postgres_data/`.
- **Files Involved:**
  - Create: `docker-compose.yml`
  - Modify: `.env.example`, `packages/server/.env`
- **Acceptance Criteria (Definition of Done):**
  - [ ] `docker compose up -d` boots PostgreSQL 16 cleanly with zero errors.
  - [ ] `docker compose exec postgres pg_isready` returns `accepting connections`.
  - [ ] Node.js client can successfully ping the database over port 5432.

---

### Feature Card: `S2-02` — 3NF Relational Schema & Migrations
- **Status:** `[ ] PENDING`
- **Owner:** Sameer Bhati (`S24BCAU0106`)
- **Target Branch:** `feat/S2-02-postgres-schema`
- **Prerequisites:** `S2-01`
- **Scope & Implementation Details:**
  1. Set up Drizzle ORM (recommended for type-safe, sub-millisecond query performance) in `packages/server`:
     - Install: `drizzle-orm`, `postgres` (or `pg`), and `drizzle-kit` (dev).
     - Add `packages/server/src/db/index.ts` (connection client) and `packages/server/src/db/schema.ts`.
  2. Implement the 8 core tables as specified in `capstone.md`:
     - **`users`:** `user_id` (UUID PK), `username` (VARCHAR UNIQUE), `email` (VARCHAR UNIQUE), `role` (`STUDENT` | `INSTRUCTOR` | `AUDITOR`), `created_at`.
     - **`portfolios`:** `portfolio_id` (UUID PK), `user_id` (UUID FK → users), `cash_balance` (NUMERIC(15,2)), `locked_cash` (NUMERIC(15,2)), `updated_at`.
       - *Constraint:* `CHECK (cash_balance >= 0)`, `CHECK (locked_cash >= 0)`.
     - **`securities_holdings`:** `holding_id` (UUID PK), `user_id` (UUID FK → users), `symbol_id` (VARCHAR(10) FK → symbols), `quantity` (INT), `locked_quantity` (INT), `updated_at`.
       - *Constraint:* `CHECK (quantity >= 0)`, `CHECK (locked_quantity >= 0)`, `UNIQUE (user_id, symbol_id)`.
     - **`symbols`:** `symbol_id` (VARCHAR(10) PK), `company_name` (VARCHAR), `tick_size` (NUMERIC(6,2) DEFAULT 0.05), `lot_size` (INT DEFAULT 1), `base_price` (NUMERIC(12,2)), `circuit_limit_pct` (NUMERIC(4,2) DEFAULT 10.00), `is_halted` (BOOLEAN DEFAULT false).
     - **`orders`:** `order_id` (UUID PK), `user_id` (UUID FK), `symbol_id` (VARCHAR(10) FK), `side` (`BUY` | `SELL`), `order_type` (`LIMIT` | `MARKET`), `price` (NUMERIC(12,2)), `initial_quantity` (INT), `remaining_quantity` (INT), `status` (`PENDING` | `RESTING` | `PARTIALLY_FILLED` | `FILLED` | `CANCELLED`), `placed_at` (TIMESTAMPTZ).
     - **`trades`:** `trade_id` (UUID PK), `buy_order_id` (UUID FK), `sell_order_id` (UUID FK), `buyer_id` (UUID FK), `seller_id` (UUID FK), `symbol_id` (VARCHAR(10) FK), `price` (NUMERIC(12,2)), `quantity` (INT), `taker_side` (`BUY` | `SELL`), `executed_at` (TIMESTAMPTZ).
     - **`ledger_entries`:** `entry_id` (BIGSERIAL PK), `transaction_id` (UUID), `account_id` (UUID), `account_type` (`CASH` | `SECURITIES`), `symbol_id` (VARCHAR(10) NULL), `debit` (NUMERIC(15,2)), `credit` (NUMERIC(15,2)), `description` (TEXT), `created_at` (TIMESTAMPTZ).
     - **`market_events_wal`:** `event_id` (BIGSERIAL PK), `symbol_id` (VARCHAR(10) FK), `event_type` (`ORDER_PLACED` | `MATCH` | `CANCEL`), `payload` (JSONB), `sequence_no` (BIGINT UNIQUE), `created_at` (TIMESTAMPTZ).
  3. Create automated migration script (`pnpm --filter @orderbook/server db:migrate`) and seed script (`db:seed`) for initial symbols (`TCS`, `INFY`, `RELIANCE`, `HDFCBANK`) and initial demo users.
- **Files Involved:**
  - Create: `packages/server/src/db/index.ts`, `packages/server/src/db/schema.ts`, `packages/server/src/db/seed.ts`, `drizzle.config.ts`
  - Modify: `packages/server/package.json`
- **Acceptance Criteria (Definition of Done):**
  - [ ] Migration creates all 8 tables with proper foreign keys, UUID defaults, and `CHECK` constraints.
  - [ ] Inserting a negative `cash_balance` or negative `quantity` throws a database constraint violation error.
  - [ ] Seed script executes and populates the 4 Indian equities and test users with ₹10,000 cash and 100 shares.

---

### Feature Card: `S2-03` — Double-Entry Financial Ledger & Trigger Invariants (`NR-05`)
- **Status:** `[ ] PENDING`
- **Owner:** Sameer Bhati (`S24BCAU0106`)
- **Target Branch:** `feat/S2-03-double-entry-ledger`
- **Prerequisites:** `S2-02`
- **Scope & Implementation Details:**
  1. Implement the institutional double-entry journal service in `packages/server/src/services/ledger.ts`:
     - Every trade between Buyer A and Seller B creates balanced ledger rows:
       - Buyer Cash Account: Credit (cash outflow = price × quantity)
       - Buyer Securities Account: Debit (shares inflow = quantity)
       - Seller Cash Account: Debit (cash inflow = price × quantity)
       - Seller Securities Account: Credit (shares outflow = quantity)
  2. Enforce the mathematical invariant:
     $$\sum \text{Debits} \equiv \sum \text{Credits} \quad \text{for every transaction\_id}$$
  3. Add a PostgreSQL deferred constraint trigger or service validation hook verifying that any unbalanced transaction is automatically rejected and rolled back.
  4. Implement an audit integrity endpoint:
     - `GET /api/audit/verify-ledger`: Runs aggregate sum checks across the entire system to verify 0 discrepancy.
- **Files Involved:**
  - Create: `packages/server/src/services/ledger.ts`, `packages/server/src/services/ledger.test.ts`
  - Modify: `packages/server/src/routers/app.ts`
- **Acceptance Criteria (Definition of Done):**
  - [ ] Unit tests verify that unbalanced journal entries trigger an immediate rollback.
  - [ ] Executing 100 mock trades results in `Σ Debits == Σ Credits` across all entries in `ledger_entries`.
  - [ ] Audit query endpoint returns `200 OK` with `{ verified: true, discrepancy: 0.00 }`.

---

### Feature Card: `S2-04` — Multi-Symbol Order Book Architecture & Market Parameters (`FR-04`)
- **Status:** `[ ] PENDING`
- **Owner:** Apoorva Pandey (`S24BCAU0120`)
- **Target Branch:** `feat/S2-04-multi-symbol-books`
- **Prerequisites:** `S2-02`
- **Scope & Implementation Details:**
  1. Refactor `packages/server/src/matching-engine.ts` and `orderbook.ts`:
     - Replace monolithic single book with a `Map<string, OrderBook>` keyed by symbol.
     - Support concurrent books for: `TCS`, `INFY`, `RELIANCE`, `HDFCBANK`.
  2. Implement Market Parameters:
     - Minimum Tick Size: ₹0.05 (reject orders whose price is not a multiple of 0.05).
     - Standard Lot Size: 1 share.
     - Dynamic Daily Circuit Breakers: $\pm 10\%$ band around `base_price`. Orders placed outside $[\text{base\_price} \times 0.90, \text{base\_price} \times 1.10]$ are rejected at validation.
  3. Update WebSocket broadcast layer to use symbol-specific rooms (e.g. `orderbook:TCS`, `orderbook:INFY`, `priceHistory:TCS`).
- **Files Involved:**
  - Modify: `packages/server/src/matching-engine.ts`, `packages/server/src/orderbook.ts`, `packages/server/src/index.ts`, `packages/shared/src/types.ts`
  - Test: `packages/server/src/matching-engine.test.ts`
- **Acceptance Criteria (Definition of Done):**
  - [ ] Can concurrently submit and match orders for `TCS` and `INFY` without state crosstalk.
  - [ ] An order for ₹1,400.03 is rejected for invalid tick size (must be ₹1,400.05).
  - [ ] An order placed outside the $\pm 10\%$ circuit band is rejected with an explanatory message.
  - [ ] All 24 existing matching engine tests updated and passing.

---

### Feature Card: `S2-05` — Multi-Counterparty Atomic Trade Settlement Engine (`NR-01` backend)
- **Status:** `[ ] PENDING`
- **Owner:** Apoorva Pandey (`S24BCAU0120`)
- **Target Branch:** `feat/S2-05-atomic-settlement`
- **Prerequisites:** `S2-02`, `S2-03`, `S2-04`
- **Scope & Implementation Details:**
  1. Upgrade `packages/server/src/portfolio-manager.ts`:
     - Replace RAM `Map` with transactional database queries.
  2. Multi-Counterparty Atomic Settlement:
     - An incoming market order sweeping resting limit orders across $k$ distinct sellers must settle atomically across $1 + k$ accounts.
     - Execute under `REPEATABLE READ` isolation.
  3. Pessimistic Row Locking & Deadlock Prevention:
     - Lock buyer and all counterparty portfolios and security holdings using `SELECT ... FOR UPDATE`.
     - **Deterministic sorted lock ordering:** Always sort accounts to be locked by `user_id` / `holding_id` before querying. This mathematically eliminates circular wait deadlock conditions.
  4. Atomically commit:
     - Deduct buyer cash, credit buyer shares.
     - Deduct seller shares, credit seller cash.
     - Decrement locked balances.
     - Record `trades` rows.
     - Append balanced `ledger_entries` entries.
- **Files Involved:**
  - Modify: `packages/server/src/portfolio-manager.ts`, `packages/server/src/matching-engine.ts`
  - Test: `packages/server/src/atomic-settlement.test.ts`
- **Acceptance Criteria (Definition of Done):**
  - [ ] A market order sweeping 3 distinct sellers at 3 price tiers settles atomically in a single PostgreSQL transaction.
  - [ ] If any seller has insufficient custody or a balance check fails, the entire transaction rolls back cleanly with zero partial balance changes.
  - [ ] High-concurrency test simulating simultaneous crossed orders completes with zero circular-wait deadlocks.
