# 🏁 Sprint 1: Baseline In-Memory Engine & Dual Engine Benchmarks

> **Status:** ✅ **COMPLETED (Weeks 1–3)**  
> **Master Blueprint Reference:** [GLASS_BOX_PROJECT_SPECIFICATION.md](../GLASS_BOX_PROJECT_SPECIFICATION.md)

---

## Sprint Summary
Sprint 1 delivered the baseline prototype of the stock order book. It proved out three data structure implementations in TypeScript, measured microsecond performance, created a dual-engine comparison with a compiled Go matching engine, and established real-time UI streaming via WebSockets.

---

## Feature Cards & Verification

### `[x]` S1-01: Baseline OrderBook (HashMaps + Sorted Arrays)
- **Description:** Hybrid order book storing limit orders in price-sorted arrays and order lookups in HashMaps.
- **Key Files:** `packages/server/src/orderbook.ts`, `packages/shared/src/types.ts`
- **Acceptance Criteria Verified:**
  - Fast $O(1)$ lookup by `orderId` and price level.
  - Sorted array preserves price-time priority for bids (descending) and asks (ascending).
  - 24/24 unit tests passing in `packages/server/src/matching-engine.test.ts`.

### `[x]` S1-02: Naive & Optimized OrderBook Variants
- **Description:** Implemented naive array-based book (`orderbook-naive.ts`) and linked-list/queue-optimized book (`orderbook-optimized.ts`) to benchmark data structure performance differences (up to $6\times$).
- **Key Files:** `packages/server/src/orderbook-naive.ts`, `packages/server/src/orderbook-optimized.ts`, `packages/server/src/timing.ts`
- **Acceptance Criteria Verified:**
  - Automated timing script `pnpm timing` executes standardized order bursts.
  - Verified FIFO queue execution across all three variants.

### `[x]` S1-03: In-Memory Portfolio Manager
- **Description:** Initial prototype tracking user balances (USD and stock quantities) in memory with validation prior to trade submission.
- **Key Files:** `packages/server/src/portfolio-manager.ts`
- **Acceptance Criteria Verified:**
  - Pre-trade fund verification (`canAfford`).
  - Balance updates upon trade execution.
  - *Note:* In Sprint 2, this is upgraded to ACID PostgreSQL transactions (`S2-05`).

### `[x]` S1-04: Full-Stack Real-Time Dashboard
- **Description:** Vite + React 18 client displaying live order depth, trade history, price charts, and order entry forms.
- **Key Files:** `packages/client/src/App.tsx`, `packages/client/src/store.ts`, `packages/server/src/index.ts`
- **Acceptance Criteria Verified:**
  - Live socket broadcasts on order updates and price history deltas.
  - Client state synchronization with Zustand store.

### `[x]` S1-05: Go Matching Engine Benchmark
- **Description:** Direct Go matching engine binary demonstrating language-level performance contrast.
- **Key Files:** `packages/matching-engine-go/`
- **Acceptance Criteria Verified:**
  - Measured throughput exceeding 2.5M orders/sec.
