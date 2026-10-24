# 🗺️ Glass-Box Implementation Roadmap & Sprint Checklist

> **Living Task Tracker for Sprints 2, 3, and 4**  
> Aligned with [GLASS_BOX_PROJECT_SPECIFICATION.md](GLASS_BOX_PROJECT_SPECIFICATION.md).

---

## 📅 Sprint Overview

```
Sprint 1 (Weeks 1-3)  ──► Core In-Memory Matching Engine & Benchmarks [COMPLETED]
Sprint 2 (Weeks 4-6)  ──► 3NF PostgreSQL Schema, Multi-Party Settlement & Ledger Triggers [ACTIVE]
Sprint 3 (Weeks 7-9)  ──► Tool-Calling Agentic AI Tutor & Execution Trace UI Modal [ACTIVE]
Sprint 4 (Weeks 10-12) ──► Crash Recovery Testing, Concurrency Benchmarks & Student Trials [UPCOMING]
```

---

## 👥 Ownership Matrix

| Area | Primary Lead | Key Responsibilities |
| :--- | :--- | :--- |
| **Backend & Concurrency** | **Apoorva Pandey** (`S24BCAU0120`) | Atomic settlement, row-level locks, Gemini tool calling, Go matching engine, concurrency benchmarks |
| **Frontend & Database** | **Sameer Bhati** (`S24BCAU0106`) | React dashboard, collision tree modal, OBI gauge, time-travel scrubber, PostgreSQL schema & ledger triggers |

---

## 🔄 Sprint 2: 3NF PostgreSQL Schema, Atomic Settlement & Multi-Symbol Engine (Weeks 4–6)

### Phase 2.1: Database Infrastructure & 3NF Schema
- [ ] **Docker Compose Setup (`docker-compose.yml`):**
  - [ ] Add PostgreSQL 16 container with healthcheck and volume persistence.
  - [ ] Configure development and test databases.
- [ ] **ORM / Migration Engine Integration:**
  - [ ] Install Drizzle ORM (or Prisma) in `packages/server`.
  - [ ] Create database connection pool (`packages/server/src/db/`).
- [ ] **Define 3NF Relational Tables:**
  - [ ] `users` (UUID, username, email, role: `STUDENT` | `INSTRUCTOR` | `AUDITOR`).
  - [ ] `portfolios` (`cash_balance`, `locked_cash`, `CHECK >= 0`).
  - [ ] `securities_holdings` (`quantity`, `locked_quantity`, `CHECK >= 0`, `UNIQUE (user_id, symbol_id)`).
  - [ ] `symbols` (`symbol_id`, `company_name`, `tick_size = 0.05`, `lot_size = 1`, `circuit_limit_pct = 10%`, `is_halted`).
  - [ ] `orders` (`order_id`, `user_id`, `symbol_id`, `side`, `order_type`, `price`, `initial_quantity`, `remaining_quantity`, `status`).
  - [ ] `trades` (`trade_id`, `buy_order_id`, `sell_order_id`, `buyer_id`, `seller_id`, `price`, `quantity`, `executed_at`).
  - [ ] `ledger_entries` (double-entry journal: `transaction_id`, `account_id`, `account_type`, `debit`, `credit`).
  - [ ] `market_events_wal` (append-only WAL: `sequence_no`, `event_type`, `payload`, `symbol_id`).
- [ ] **Database Constraints & Triggers:**
  - [ ] Enforce non-negative invariants via PostgreSQL `CHECK` constraints on cash and stock holdings.
  - [ ] Implement database trigger/service enforcing double-entry invariant: $\sum \text{Debits} \equiv \sum \text{Credits}$.

### Phase 2.2: Multi-Symbol Order Book Architecture
- [ ] Refactor `OrderBook` to support multiple concurrent symbol instances:
  - [ ] `TCS` (Tata Consultancy Services)
  - [ ] `INFY` (Infosys Ltd)
  - [ ] `RELIANCE` (Reliance Industries)
  - [ ] `HDFCBANK` (HDFC Bank Ltd)
- [ ] Add dynamic daily circuit breakers ($\pm 10\%$ band around base price).
- [ ] Implement symbol switching in frontend UI and independent WebSocket feed channels.

### Phase 2.3: Multi-Counterparty Atomic Trade Settlement Engine
- [ ] Transition `PortfolioManager` from RAM `Map` to ACID PostgreSQL transactions.
- [ ] Implement pessimistic row locking with `SELECT ... FOR UPDATE` under `REPEATABLE READ`.
- [ ] Enforce deterministic lock acquisition ordering (sorted by user ID / holding ID) to eliminate deadlocks.
- [ ] Multi-counterparty settlement: atomic commit updating 1 buyer and $k$ matching sellers with VWAP calculations.

---

## 🔄 Sprint 3: Agentic AI Tutor & "Glass-Box" Visualizations (Weeks 7–9)

### Phase 3.1: Tool-Calling Agentic AI Market Microstructure Tutor
- [ ] Integrate `@google/genai` (Gemini API) in backend.
- [ ] Implement the 5 structured database tools for the AI agent:
  - [ ] `get_orderbook_depth(symbol)`
  - [ ] `calculate_slippage(symbol, order_size, side)`
  - [ ] `get_orderbook_imbalance(symbol)`
  - [ ] `inspect_recent_trades(symbol, limit)`
  - [ ] `explain_price_movement(symbol, timeframe)`
- [ ] Build floating AI Tutor drawer/chat interface in frontend client.
- [ ] Add system prompts for market microstructure explanations with live telemetry data.

### Phase 3.2: "Glass-Box" Execution Trace Modal (Collision Tree)
- [ ] Design interactive modal that triggers on order fills.
- [ ] Render hierarchical Collision Tree:
  - [ ] Counterparty maker order IDs and user IDs.
  - [ ] FIFO queue position / queue rank consumed.
  - [ ] Price tiers crossed across the book.
  - [ ] Volume-Weighted Average Price (VWAP) calculation: $\text{VWAP} = \frac{\sum P_i Q_i}{\sum Q_i}$.
  - [ ] Calculated slippage cost vs. best quote.

### Phase 3.3: Order Book Imbalance (OBI) Gauge
- [ ] Backend calculation of OBI across top 5 price tiers:
  $$\text{OBI} = \frac{V_{\text{bid}} - V_{\text{ask}}}{V_{\text{bid}} + V_{\text{ask}}} \quad \in [-1.0, +1.0]$$
- [ ] Frontend animated needle/gradient gauge displaying live market pressure.

---

## ⏳ Sprint 4: Time-Travel Replay, WAL Recovery & Concurrency Lab (Weeks 10–12)

### Phase 4.1: Deterministic Time-Travel Replay ("Flight Recorder")
- [ ] Log every order insertion, match, and cancellation to `market_events_wal` with monotonic `sequence_no`.
- [ ] Build UI scrubber bar allowing students to pause, rewind, and replay ticks at $0.25\times$ / $0.5\times$ speed.

### Phase 4.2: Automated WAL Crash Recovery
- [ ] Build recovery service that triggers on server startup or simulated crash (`kill -9`).
- [ ] Query unapplied events from PostgreSQL and replay into in-memory book state with 0% data loss.

### Phase 4.3: Dual-Engine Latency Telemetry Cockpit
- [ ] Implement high-resolution timers:
  - [ ] In-memory RAM matching latency ($\approx 1.8 - 2.5\,\mu\text{s}$)
  - [ ] PostgreSQL ACID disk commit latency ($\approx 2.5 - 4.5\,\text{ms}$)
  - [ ] Network WebSocket transit latency ($\approx 10 - 18\,\text{ms}$)
- [ ] Live UI cockpit widget visualizing systems trade-offs.

### Phase 4.4: Concurrency & Lock Contention Student Lab
- [ ] Automated stress-test script simulating 50 concurrent buyers competing for the same resting liquidity.
- [ ] Observable metrics comparing `READ COMMITTED` vs. `REPEATABLE READ` vs. `SERIALIZABLE` isolation levels.
