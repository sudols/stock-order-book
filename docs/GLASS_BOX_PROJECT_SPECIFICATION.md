# 📘 Glass-Box: Project Specification & Feature Blueprint

### Document Metadata

- **Project Title:** Glass-Box: Interactive Multi-Symbol Market Microstructure & ACID Transaction Simulator with Agentic AI
- **Course & Context:** Major Project Specification for Database Management Systems (DBMS)
- **Institution:** School of Computer Science Engineering & Technology (SCSET), Bennett University
- **Academic Program:** Bachelor of Computer Applications (BCA)
- **Team Members:** Apoorva Pandey (`S24BCAU0120`), Sameer Bhati (`S24BCAU0106`)

---

## 1. What the Project Is

**Glass-Box** is an open-source, web-native educational electronic exchange, market microstructure simulator, and database concurrency laboratory.

It addresses two fundamental educational dilemmas:

1. **The DBMS Pedagogy Gap:** In computer science education, ACID transactions and concurrency control are almost exclusively taught through the oversimplified toy example of _Account A transferring ₹100 to Account B_. This completely fails to prepare students for high-concurrency systems where multiple orders contend for shared row locks, multi-party orders match atomically across multiple sellers, and disk write latency directly threatens throughput.
2. **The "Black-Box" Abstraction of Retail Simulators:** Popular retail paper-trading platforms (TradingView Paper Trading, Moneybhai, NSE Paathshaala) allow users to practice speculative chart trading, but completely hide exchange internals. Users cannot inspect order queues, price-time priority sorting, counterparty identities, or database settlement.

**Glass-Box turns the financial exchange into an auditable "Glass Box":**

- **Computer Science Students** can inspect row-level lock contention, analyze query plans (`EXPLAIN ANALYZE`), benchmark isolation levels (`READ COMMITTED` vs. `REPEATABLE READ` vs. `SERIALIZABLE`), and trigger simulated engine crashes (`kill -9`) to verify automated Write-Ahead Log (WAL) event replay.
- **Finance & FinTech Students** gain transparent visibility into order book depth ladders, bid-ask spread dynamics, Order Book Imbalance (OBI), Volume-Weighted Average Price (VWAP) calculation, and liquidity depletion curves.
- **Embedded Agentic AI Tutor** uses structured tool-calling (function calling) to inspect real-time database state and provide mathematically grounded explanations of live market movements without hallucination.

---

## 2. Baseline State vs. Target State

```
┌───────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Current Baseline (Initial Prototype) │ Target State (New Features to Implement)               │
├───────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ • In-memory Map balance tracking      │ • 3NF PostgreSQL Relational Schema with strict ACID    │
│ • Monolithic single asset ('stocks')  │ • Multi-symbol engine (TCS, INFY, RELIANCE, HDFCBANK)  │
│ • Naive non-transactional arithmetic  │ • Multi-counterparty atomic settlement (k+1 accounts)  │
│ • No database persistence / zero WAL  │ • Event sourcing WAL log & automated crash recovery    │
│ • Aggregated "Order Filled" popup     │ • Interactive "Glass-Box" Collision Tree modal         │
│ • No double-entry ledger              │ • Bank-grade double-entry journal (Σ Debits ≡ Σ Credits)│
│ • No educational guidance             │ • Tool-calling Agentic AI Market Microstructure Tutor   │
│ • Static historical charts only       │ • Deterministic tick-by-tick Time-Travel Replay        │
│ • Hidden backend latencies            │ • Empirical Systems Latency Telemetry Cockpit          │
└───────────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 3. Detailed New Features Decided for Implementation

### 1. ACID Relational Settlement & Multi-Counterparty Atomic Trade Settlement Engine

- **The Problem:** An incoming market buy order for 50 shares of `TCS` may sweep three distinct resting limit orders at ₹1,400 (20 shares), ₹1,402 (20 shares), and ₹1,405 (10 shares). Naive balance updating causes race conditions, double-spending, and inconsistent states.
- **The Solution:**
  - Complete migration of custody and balances from RAM to PostgreSQL 3NF.
  - Multi-party atomic settlement spanning $k+1$ accounts (1 buyer and $k$ distinct sellers).
  - Enforces pessimistic row-level locking via `SELECT ... FOR UPDATE` under `REPEATABLE READ` isolation.
  - To prevent circular wait deadlocks, row locks on portfolios and securities holdings are acquired in deterministic sorted order.
  - Calculates dynamic volume-weighted execution pricing, debits/credits cash, decrements locked cash/shares, updates order states (`RESTING`, `PARTIALLY_FILLED`, `FILLED`), and appends immutable execution contracts to `trades` in a single atomic commit.

### 2. Multi-Symbol Order Book Architecture & Market Parameters

- **The Problem:** The current prototype is hardcoded to a single generic stock.
- **The Solution:**
  - Independent concurrent order book instances for major Indian equities: `TCS`, `INFY`, `RELIANCE`, and `HDFCBANK`.
  - Database-driven market configuration per symbol:
    - Minimum Tick Size: ₹0.05
    - Standard Lot Size: 1 share
    - Dynamic Daily Circuit Breakers: $\pm 10\%$ band around base price (orders outside the band are rejected at validation).
    - Market State: `ACTIVE`, `HALTED`, `CIRCUIT_BREAKER_TRIPPED`.
  - Real-time symbol switching and independent WebSocket feed channels.

### 3. Tool-Calling Agentic AI Market Microstructure Tutor

- **The Problem:** Generic chatbots give copy-pasted textbook answers and hallucinate stock prices.
- **The Solution:**
  - Embedded conversational AI tutor powered by Google Gemini API using structured **function calling / tool calling**.
  - Programmatic access to five backend tools:
    1. `get_orderbook_depth(symbol)`: Queries top 10 price levels and cumulative volume.
    2. `calculate_slippage(symbol, order_size, side)`: Calculates expected execution price vs. top-of-book.
    3. `get_orderbook_imbalance(symbol)`: Computes real-time OBI ratio across top 5 tiers.
    4. `inspect_recent_trades(symbol, limit)`: Queries PostgreSQL for latest executed trade contracts.
    5. `explain_price_movement(symbol, timeframe)`: Analyzes order book sweeps and taker volume bursts.
  - When a student asks: _"Why did INFY jump by 1.2% in the last 2 minutes?"_, the AI calls the database tools, inspects the order queue, and explains: _"A 500-share taker buy order swept through the top 3 ask tiers, causing ₹4.50 slippage due to low book depth."_

### 4. "Glass-Box" Execution Trace Modal (Collision Tree Breakdown)

- **The Problem:** Existing trading portals only return a single aggregated confirmation price (e.g., _"Order Filled at ₹1,402"_).
- **The Solution:**
  - Interactive visual modal that opens upon order execution.
  - Renders a hierarchical **Collision Tree** displaying:
    - Maker user identities and maker order IDs matched against.
    - FIFO queue position (queue rank) of each matched limit order.
    - Price tiers consumed across the book.
    - Volume-Weighted Average Price (VWAP) calculation:
      $$\text{VWAP} = \frac{\sum_{i=1}^{n} (P_i \times Q_i)}{\sum_{i=1}^{n} Q_i}$$
    - Effective slippage cost incurred by consuming resting liquidity.

### 5. Deterministic Time-Travel Replay ("Market Flight Recorder")

- **The Problem:** Static historical charts cannot show how high-speed order book queues evolved or how cancellations affected liquidity.
- **The Solution:**
  - PostgreSQL event sourcing append-only log table: `market_events_wal`.
  - Monotonic `sequence_no` for every order placement, match, and cancelation.
  - Interactive scrubber bar on the UI allowing students to pause live execution, scrub backwards, and step tick-by-tick at slow speeds ($0.25\times$, $0.5\times$) to observe FIFO queue arrivals, cancellations, and liquidity depletion in slow motion.

### 6. Dual-Engine Latency Telemetry Cockpit

- **The Problem:** Students do not grasp the fundamental systems trade-off between microsecond matching speed and millisecond transactional durability.
- **The Solution:**
  - Real-time side-by-side performance profiling telemetry:
    1. **In-Memory Matching Engine Latency:** High-resolution nanosecond timers measuring RAM queue management ($\approx 1.8 - 2.5\,\mu\text{s}$).
    2. **Database Settlement Latency:** PostgreSQL disk ACID transaction commit duration ($\approx 2.5 - 4.5\,\text{ms}$).
    3. **Network Transport Latency:** WebSocket packet broadcast time via Socket.io ($\approx 10 - 18\,\text{ms}$).
  - Live UI cockpit illustrating why High-Frequency Trading (HFT) firms invest millions in low-latency infrastructure.

### 7. Double-Entry Ledger with Database-Enforced Financial Invariants

- **The Problem:** Typical student projects naively update balance fields (`balance = balance - X`), making them prone to negative balances, lost funds, and audit failures.
- **The Solution:**
  - Institutional-grade double-entry bookkeeping journal table: `ledger_entries`.
  - Every executed trade generates balanced debit and credit entries across cash and securities accounts.
  - Mathematical balance invariant strictly verified:
    $$\sum \text{Debits} \equiv \sum \text{Credits}$$
  - PostgreSQL check constraints and triggers enforce:
    - `CHECK (cash_balance >= 0)`
    - `CHECK (locked_cash >= 0)`
    - `CHECK (quantity >= 0)`
    - `CHECK (locked_quantity >= 0)`
  - Guarantees money or shares can never be created out of nowhere or drop below zero.

### 8. Automated Write-Ahead Log (WAL) Crash Recovery

- **The Problem:** Pure in-memory matching engines lose all state when the server process crashes or restarts.
- **The Solution:**
  - Decoupled asynchronous persistence worker.
  - Every event is logged to PostgreSQL `market_events_wal`.
  - Upon server restart or simulated crash (`kill -9`), an automated recovery routine queries PostgreSQL, retrieves all unapplied events in sequence order, and replays them into RAM.
  - Reconstructs 100% of the active order book queues with zero trade loss and zero data divergence.

### 9. Order Book Imbalance (OBI) Gauge & Microstructure Metrics

- **The Problem:** Beginners look only at price; quantitative market makers trade based on book pressure and volume imbalance.
- **The Solution:**
  - Real-time calculation and animated gauge rendering Order Book Imbalance (OBI) across the top 5 price tiers:
    $$\text{OBI} = \frac{V_{\text{bid}} - V_{\text{ask}}}{V_{\text{bid}} + V_{\text{ask}}} \quad \in [-1.0, +1.0]$$
  - Positive values ($>0$) signal buying pressure; negative values ($<0$) signal selling pressure.
  - Integrated with the Agentic AI tutor to trigger automated alerts when liquidity drains rapidly.

### 10. Matching Engine Modifiability & Algorithm Benchmark Sandbox

- **The Problem:** Computer science students need an experimental testbench to evaluate data structure performance under identical workloads.
- **The Solution:**
  - Modular engine interface allowing students to switch between internal matching implementations:
    1. _Array-based sorted lists_
    2. _HashMap + Double-ended FIFO queue per price level_
    3. _Optimized Go engine with pointer-based order queues_
  - Built-in benchmark suite executing standardized synthetic order bursts (10,000 to 100,000 orders) to measure order matching time (orders/sec) and memory footprints directly in the browser.

---

## 4. PostgreSQL 3NF Relational Database Schema

### Entity-Relationship (ER) Overview Table

| Table Name                | Primary & Foreign Keys                                                                                                                       | Core Attributes & Constraints                                                                                                                                | Functional Invariants & Business Purpose                                                              |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **`users`**               | `user_id` (UUID PK)                                                                                                                          | `username` (VARCHAR UNIQUE), `email` (VARCHAR UNIQUE), `role` (`STUDENT`, `INSTRUCTOR`, `AUDITOR`)                                                           | Credentials, authentication identity, and administrative permissions.                                 |
| **`portfolios`**          | `portfolio_id` (UUID PK)<br>`user_id` (FK → users.user_id)                                                                                   | `cash_balance` (NUMERIC(15,2)), `locked_cash` (NUMERIC(15,2)), `updated_at`<br>`CHECK (cash_balance >= 0)`, `CHECK (locked_cash >= 0)`                       | Tracks fiat cash reserves. Locked cash represents funds pledged in resting limit buy orders.          |
| **`securities_holdings`** | `holding_id` (UUID PK)<br>`user_id` (FK → users.user_id)<br>`symbol_id` (FK → symbols.symbol_id)                                             | `quantity` (INT), `locked_quantity` (INT), `updated_at`<br>`CHECK (quantity >= 0)`, `CHECK (locked_quantity >= 0)`<br>`UNIQUE (user_id, symbol_id)`          | Per-user stock asset custody. Locked quantity represents shares pledged in resting limit sell orders. |
| **`symbols`**             | `symbol_id` (VARCHAR(10) PK)                                                                                                                 | `company_name` (VARCHAR), `tick_size` (NUMERIC(6,2)), `lot_size` (INT), `base_price` (NUMERIC(12,2)), `circuit_limit_pct` (10%), `is_halted` (BOOL)          | Defines tradable market instruments, tick size rules (₹0.05), and regulatory 10% circuit limits.      |
| **`orders`**              | `order_id` (UUID PK)<br>`user_id` (FK → users.user_id)<br>`symbol_id` (FK → symbols.symbol_id)                                               | `side` (`BUY`/`SELL`), `order_type` (`LIMIT`/`MARKET`), `price` (NUMERIC(12,2)), `initial_quantity` (INT), `remaining_quantity` (INT), `status`, `placed_at` | Full order lifecycle: `PENDING`, `RESTING`, `PARTIALLY_FILLED`, `FILLED`, `CANCELLED`.                |
| **`trades`**              | `trade_id` (UUID PK)<br>`buy_order_id` (FK → orders)<br>`sell_order_id` (FK → orders)<br>`buyer_id` (FK → users)<br>`seller_id` (FK → users) | `symbol_id` (FK → symbols), `price` (NUMERIC(12,2)), `quantity` (INT), `taker_side` (`BUY`/`SELL`), `executed_at` (TIMESTAMPTZ)                              | Immutable executed contracts pairing buyer, seller, execution price, and filled shares.               |
| **`ledger_entries`**      | `entry_id` (BIGSERIAL PK)<br>`transaction_id` (UUID FK)                                                                                      | `account_id` (UUID), `account_type` (`CASH`/`SECURITIES`), `debit` (NUMERIC(15,2)), `credit` (NUMERIC(15,2)), `description`, `timestamp`                     | Double-entry journal. Enforces invariant: $\sum \text{Debits} \equiv \sum \text{Credits}$.            |
| **`market_events_wal`**   | `event_id` (BIGSERIAL PK)<br>`symbol_id` (FK → symbols)                                                                                      | `event_type` (`ORDER_PLACED`, `MATCH`, `CANCEL`), `payload` (JSONB), `sequence_no` (BIGINT UNIQUE), `created_at`                                             | Append-only event stream used for deterministic in-memory crash recovery and replay.                  |

### Entity-Relationship Cardinality Diagram

```
  [USERS] ────(1:1)─── [PORTFOLIOS]
     │(1:N) └────────(1:N)─── [SECURITIES_HOLDINGS] ───(N:1)─── [SYMBOLS]
     │(1:N)                                                        │(1:N)
  [ORDERS] ───(1:N)─── [TRADES] ───────────────────────────────────┤
                         │(1:N)                                    ▼
                  [LEDGER_ENTRIES]                        [MARKET_EVENTS_WAL]
```

---

## 5. Requirements Table: Baseline vs. Novel Contributions

| Req ID      | Requirement Name                           |   Classification   | Detailed Description                                                                                                                                                        | Existing Support Status                                                                                 |
| :---------- | :----------------------------------------- | :----------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| **`FR-01`** | Limit & Market Order Submission            |      Baseline      | Submitting limit and market orders with lot and tick size checks.                                                                                                           | Standard in retail broker screens.                                                                      |
| **`FR-02`** | Real-Time Depth Ladder                     |      Baseline      | Streaming live bid/ask queues across top price tiers via WebSockets.                                                                                                        | Standard in retail broker screens.                                                                      |
| **`FR-03`** | Portfolio Asset Valuation                  |      Baseline      | Displays cash balances, stock inventory, and P&L.                                                                                                                           | Standard paper trading feature.                                                                         |
| **`FR-04`** | Multi-Symbol Trading                       |      Baseline      | Operates independent order books for `TCS`, `INFY`, `RELIANCE`, and `HDFCBANK`.                                                                                             | Standard exchange feature.                                                                              |
| **`FR-05`** | Role-Based Authentication                  |      Baseline      | Distinguishes `STUDENT`, `INSTRUCTOR`, and `AUDITOR` permissions.                                                                                                           | Standard web app feature.                                                                               |
| **`NR-01`** | **Glass-Box Execution Trace Modal**        | Novel Contribution | Dissects multi-counterparty partial executions into an interactive collision tree showing maker IDs, queue rank, VWAP, and slippage.                                        | **Novel:** Existing apps only give a single aggregated confirmation price.                              |
| **`NR-02`** | **Tool-Calling Agentic AI Tutor**          | Novel Contribution | Embedded conversational tutor that executes real database tool calls to explain live market causality and anomalies with real numbers.                                      | **Novel:** No other simulator has an AI tutor calling live database tools.                              |
| **`NR-03`** | **Deterministic Time-Travel Replay**       | Novel Contribution | Scrub and replay order book events tick-by-tick at 0.5x speed using PostgreSQL event sourcing logs.                                                                         | **Novel:** Regular apps only replay line charts, not internal order queues.                             |
| **`NR-04`** | **Dual-Engine Latency Telemetry**          | Novel Contribution | Live cockpit contrasting in-memory RAM matching latency (~2 µs) vs. PostgreSQL ACID commit latency (~3 ms).                                                                 | **Novel:** Real trading platforms hide their backend infrastructure latency.                            |
| **`NR-05`** | **Double-Entry Ledger with DB Invariants** | Novel Contribution | Bank-grade journal enforcing $\sum \text{Debits} \equiv \sum \text{Credits}$ and database `CHECK (balance >= 0)` constraints.                                               | **Novel:** Student projects usually do `balance = balance - price` on a single column.                  |
| **`NR-06`** | **Automated WAL Crash Recovery**           | Novel Contribution | Automated routine that replays unexecuted events from PostgreSQL back into RAM on crash (`kill -9`) to restore full state with zero lost trades.                            | **Novel:** In-memory simulators lose all orders on restart; Glass-Box recovers state with 0% data loss. |
| **`NR-07`** | **Order Book Imbalance (OBI) Gauge**       | Novel Contribution | Live meter computing and displaying buying vs. selling pressure across top 5 tiers: $\text{OBI} = \frac{\text{Bid Vol} - \text{Ask Vol}}{\text{Bid Vol} + \text{Ask Vol}}$. | **Novel:** Microstructure metrics are absent in standard student software.                              |
| **`NR-08`** | **Matching Engine Modifiability Sandbox**  | Novel Contribution | Ability to tweak internal data structures (arrays vs. heaps vs. trees) and observe immediate throughput and latency shifts.                                                 | **Novel:** Commercial engines are closed-source; Glass-Box turns the engine into an experiment.         |

---

## 6. Interactive Laboratory Scenarios & Evaluation Plan

```
┌──────────────────────────────────────┬──────────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Laboratory Scenario                  │ Student Action in Lab                    │ Observable System & Database Outcome                   │
├──────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 1. Concurrency & Lock Contention Lab │ Spawn 50 parallel automated threads      │ Observe row lock wait times in PostgreSQL; observe     │
│                                      │ submitting market orders at same price.  │ transaction rollbacks under SERIALIZABLE vs REPEATABLE.│
│                                      │                                          │                                                        │
│ 2. Market Impact & Slippage Lab      │ Submit a large market buy order sweeping │ Open Glass-Box Execution Trace modal; observe order     │
│                                      │ past top-of-book liquidity.              │ fragmentation, VWAP calculation, and price slippage.   │
│                                      │                                          │                                                        │
│ 3. Crash Recovery & Durability Lab   │ Force-kill Go matching engine process    │ Automated PostgreSQL WAL script triggers on reboot and │
│                                      │ (`kill -9`) during an active order flood.│ replays orders back into RAM with 0% loss.             │
│                                      │                                          │                                                        │
│ 4. Double-Entry Ledger Audit Lab     │ Execute high-volume trade bursts and     │ Verify that database triggers enforce balance invariant│
│                                      │ run automated consistency audit queries. │ and CHECK (balance >= 0) prevents negative accounts.   │
└──────────────────────────────────────┴──────────────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 7. Sprint Implementation Roadmap & Team Ownership

```
  Sprint 1 (Weeks 1-3)  ──► Core In-Memory Matching Engine & Dual Engine Benchmarks (Completed)
  Sprint 2 (Weeks 4-6)  ──► 3NF PostgreSQL Schema, Multi-Party Settlement & Ledger Triggers (Active)
  Sprint 3 (Weeks 7-9)  ──► Tool-Calling Agentic AI Tutor & Execution Trace UI Modal (Active)
  Sprint 4 (Weeks 10-12) ──► Crash Recovery Testing, Concurrency Benchmarks & Student Trials (Upcoming)
```

### Team Responsibilities

- **Apoorva Pandey (`S24BCAU0120`) — Backend Architecture, Concurrency & Agentic AI Lead:**
  - In-memory matching engine core (Go and TypeScript)
  - Multi-party atomic settlement transactions (`SELECT ... FOR UPDATE`)
  - Google Gemini structured tool-calling API integration and prompt engineering
  - Concurrency isolation level benchmarking scripts
- **Sameer Bhati (`S24BCAU0106`) — Frontend Systems & Database Infrastructure Lead:**
  - React 18 / Tailwind educational dashboard
  - Glass-Box Execution Trace collision tree modal and depth ladders
  - Order Book Imbalance (OBI) gauge and time-travel replay scrubbing bar
  - PostgreSQL 3NF schema implementation and double-entry ledger triggers

---

### File Locations

- **Project Documentation File:** [`docs/GLASS_BOX_PROJECT_SPECIFICATION.md`](file:///home/ark/dev/stock-order-book/docs/GLASS_BOX_PROJECT_SPECIFICATION.md)
- **Artifact File:** [`glass_box_project_specification.md`](file:///home/ark/.gemini/antigravity/brain/4daf8e98-6aa5-4100-823e-2e5cbcf7bd43/glass_box_project_specification.md)
- **Compiled PDF Report (9 Pages):** [`Glass_Box_DBMS_Project_Report.pdf`](file:///home/ark/dev/stock-order-book/Glass_Box_DBMS_Project_Report.pdf)
