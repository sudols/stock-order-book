# 🧠 Sprint 3: Agentic AI Tutor & "Glass-Box" Visualizations

> **Sprint Status:** 🔄 **ACTIVE (Weeks 7–9)**  
> **Primary Goal:** Implement the tool-calling Gemini agentic tutor and "Glass-Box" educational UI visualizations (Collision Tree Execution Trace modal, OBI gauge, multi-symbol switcher).  
> **Master Spec Reference:** [GLASS_BOX_PROJECT_SPECIFICATION.md#3-detailed-new-features-decided-for-implementation](../GLASS_BOX_PROJECT_SPECIFICATION.md)

---

## 📋 Sprint Feature Cards

```
S3-01 [Agentic AI Tutor] ──────┐
                               ├──► Integrated Educational UI Experience
S3-02 [Collision Tree Modal] ──┤
                               │
S3-03 [OBI Pressure Gauge] ────┤
                               │
S3-04 [Multi-Symbol Selector] ─┘
```

---

### Feature Card: [x] `S3-01` — Tool-Calling Agentic AI Market Microstructure Tutor (`NR-02`)
- **Status:** `[x] COMPLETED`
- **Owner:** Apoorva Pandey (`S24BCAU0120`)
- **Target Branch:** `feat/S3-01-gemini-ai-tutor`
- **Prerequisites:** `S2-02`, `S2-04`
- **Scope & Implementation Details:**
  - [x] 1. Set up Google Gemini API integration in `packages/server/src/services/ai-tutor.ts` using `@google/genai` or `@google/generative-ai`.
  - [x] 2. Implement structured **tool calling / function calling** with 5 database inspection tools:
     - `get_orderbook_depth(symbol: string)`: Queries top 10 price levels and cumulative volume.
     - `calculate_slippage(symbol: string, order_size: number, side: 'BUY'|'SELL')`: Computes expected execution price vs. top-of-book.
     - `get_orderbook_imbalance(symbol: string)`: Computes real-time OBI ratio across top 5 tiers.
     - `inspect_recent_trades(symbol: string, limit: number)`: Returns latest executed trade contracts from PostgreSQL.
     - `explain_price_movement(symbol: string, timeframe: string)`: Queries taker order flow and book depth sweeps over the timeframe.
  - [x] 3. System Prompt Engineering:
     - Strict pedagogical personality: explain market causality mathematically (e.g. why slippage occurred, why spread widened).
     - **Zero hallucination guarantee:** The AI must only cite numbers fetched from its tool calls.
  - [x] 4. Expose tRPC / WebSocket conversation endpoint:
     - `tRPC query / mutation: aiTutor.askQuestion({ message: string, symbol: string })`.
  - [x] 5. Frontend Floating Drawer:
     - Expandable AI Tutor drawer in bottom-right corner of client.
     - Streaming response rendering with Markdown and tool-call audit tags.
- **Files Involved:**
  - [x] Created: `packages/server/src/services/ai-tutor.ts`, `packages/client/src/components/AITutorDrawer.tsx`, `packages/server/src/services/ai-tutor.test.ts`
  - [x] Modified: `packages/server/src/routers/app.ts`, `packages/client/src/App.tsx`, `packages/server/src/index.ts`, `packages/server/src/orderbook.ts`, `packages/shared/src/types.ts`
- **Acceptance Criteria (Definition of Done):**
  - [x] Asking "Why did INFY price move?" triggers Gemini to execute `inspect_recent_trades` and `get_orderbook_depth`.
  - [x] Response cites actual database numbers (order volume, slippage, trade prices) without hallucination.
  - [x] Tool execution telemetry is displayed in an expandable "Tool Audit" accordion in the UI.

---

### Feature Card: `S3-02` — "Glass-Box" Execution Trace Modal (Collision Tree) (`NR-01`)
- **Status:** `[ ] PENDING`
- **Owner:** Sameer Bhati (`S24BCAU0106`)
- **Target Branch:** `feat/S3-02-execution-trace-modal`
- **Prerequisites:** `S2-05`
- **Scope & Implementation Details:**
  1. Replace the generic "Order Filled" notification with a rich interactive **Collision Tree Modal**.
  2. The modal breaks down the execution of an order that swept resting liquidity:
     - **Taker Order Summary:** User, side, total requested quantity, timestamp.
     - **Hierarchical Collision Tree:**
       - Level-by-level list of resting maker limit orders consumed.
       - Maker user alias/ID, order ID, and FIFO queue rank at the moment of match.
       - Price tiers crossed (e.g., Tier 1: ₹1,400, Tier 2: ₹1,402).
     - **VWAP Calculation Breakdown:**
       $$\text{VWAP} = \frac{\sum_{i=1}^n (P_i \times Q_i)}{\sum_{i=1}^n Q_i}$$
     - **Slippage Cost Metric:** Difference between top-of-book best price and effective VWAP:
       $$\text{Slippage} = |\text{VWAP} - P_{\text{best}}|$$
  3. UI Polish:
     - Built with Tailwind CSS and Radix/shadcn dialog primitives.
     - Color-coded: green for buy sweeps, red for sell sweeps.
- **Files Involved:**
  - Create: `packages/client/src/components/ExecutionTraceModal.tsx`, `packages/shared/src/types/trace.ts`
  - Modify: `packages/client/src/store.ts`, `packages/client/src/App.tsx`
- **Acceptance Criteria (Definition of Done):**
  - [ ] Executing a multi-level market sweep triggers the Collision Tree modal immediately upon receipt of the execution contract.
  - [ ] Correctly displays each counterparty maker order, queue rank, and partial quantity filled.
  - [ ] Displays exact mathematical step-by-step VWAP calculation matching backend execution.

---

### Feature Card: `S3-03` — Order Book Imbalance (OBI) Gauge (`NR-07`)
- **Status:** `[ ] PENDING`
- **Owner:** Sameer Bhati (`S24BCAU0106`)
- **Target Branch:** `feat/S3-03-obi-gauge`
- **Prerequisites:** `S2-04`
- **Scope & Implementation Details:**
  1. Backend computation across top 5 depth tiers:
     $$\text{OBI} = \frac{V_{\text{bid}} - V_{\text{ask}}}{V_{\text{bid}} + V_{\text{ask}}} \quad \in [-1.0, +1.0]$$
  2. Broadcast OBI updates over Socket.io alongside order book depth.
  3. Frontend Component:
     - Semi-circular speedometer/gauge or dynamic bi-directional pressure bar.
     - Visual zones:
       - $<-0.5$: Strong Selling Pressure (Red)
       - $-0.5$ to $+0.5$: Balanced Liquidity (Neutral Gray/Blue)
       - $>+0.5$: Strong Buying Pressure (Green)
     - Smooth animated transition as orders arrive or cancel.
- **Files Involved:**
  - Create: `packages/client/src/components/OBIGauge.tsx`
  - Modify: `packages/server/src/orderbook.ts`, `packages/client/src/store.ts`
- **Acceptance Criteria (Definition of Done):**
  - [ ] Submitting a heavy burst of bids visibly pushes OBI gauge into positive green territory ($>+0.5$).
  - [ ] Submitting asks immediately drives the value negative.
  - [ ] Calculated value matches mathematical formula precisely.

---

### Feature Card: `S3-04` — Multi-Symbol Dashboard UI & Instrument Selector (`FR-04` UI)
- **Status:** `[ ] PENDING`
- **Owner:** Sameer Bhati (`S24BCAU0106`)
- **Target Branch:** `feat/S3-04-symbol-selector-ui`
- **Prerequisites:** `S2-04`
- **Scope & Implementation Details:**
  1. Add Symbol Navigation Bar at the top of the dashboard:
     - Tabs for `TCS`, `INFY`, `RELIANCE`, and `HDFCBANK`.
     - Displays real-time Last Traded Price (LTP), 24h change, and circuit breaker band indicator ($[\text{Lower Band}, \text{Upper Band}]$).
  2. Switching symbols dynamically switches:
     - Order book depth ladder.
     - Interactive price chart.
     - Recent trades stream.
     - Active socket subscription room.
- **Files Involved:**
  - Create: `packages/client/src/components/SymbolSelector.tsx`
  - Modify: `packages/client/src/App.tsx`, `packages/client/src/store.ts`
- **Acceptance Criteria (Definition of Done):**
  - [ ] Switching between symbols updates all UI components cleanly in $<100\text{ms}$ with zero memory leaks or ghost socket events.
  - [ ] Circuit breaker limits for selected symbol are clearly visible on the order entry form.
