# 🛡️ Sprint 4: Durability, WAL Crash Recovery & Concurrency Laboratory

> **Sprint Status:** ⏳ **UPCOMING (Weeks 10–12)**  
> **Primary Goal:** Prove zero-loss crash durability via automated PostgreSQL Write-Ahead Log (WAL) event replay, provide tick-by-tick time travel playback, and conduct live student concurrency benchmarks.  
> **Master Spec Reference:** [GLASS_BOX_PROJECT_SPECIFICATION.md#6-interactive-laboratory-scenarios--evaluation-plan](../GLASS_BOX_PROJECT_SPECIFICATION.md)

---

## 📋 Sprint Feature Cards

```
S4-01 [WAL Crash Recovery] ──► S4-02 [Time-Travel Replay]
            │
            ├─► S4-03 [Latency Telemetry Cockpit]
            │
            └─► S4-04 [Concurrency Lab Scenarios]
```

---

### Feature Card: `S4-01` — Automated Write-Ahead Log (WAL) Crash Recovery (`NR-06`)
- **Status:** `[ ] PENDING`
- **Owner:** Apoorva Pandey (`S24BCAU0120`)
- **Target Branch:** `feat/S4-01-wal-crash-recovery`
- **Prerequisites:** `S2-02`, `S2-05`
- **Scope & Implementation Details:**
  1. Append-Only Persistence Stream:
     - Every order placement, execution match, and cancellation event is persisted to `market_events_wal` with a monotonic `sequence_no`.
  2. Startup Recovery Routine:
     - On server process boot, check latest in-memory sequence vs. highest `sequence_no` in PostgreSQL.
     - Replay unapplied events sequentially back into RAM order book queues.
  3. Crash Simulation Lab Endpoint:
     - `POST /api/test/simulate-crash`: Sends `SIGKILL` (`kill -9`) or terminates engine process during active order bursts.
     - On container/process reboot, verify automated recovery reconstructs 100% of the active queue state with 0 lost trades.
- **Files Involved:**
  - Create: `packages/server/src/services/wal-recovery.ts`, `packages/server/src/services/wal-recovery.test.ts`
  - Modify: `packages/server/src/index.ts`
- **Acceptance Criteria (Definition of Done):**
  - [ ] Replaying 10,000 synthetic events restores exact book state and prices.
  - [ ] Force killing the process mid-burst results in 0 lost trades and 0 balance discrepancy after reboot.

---

### Feature Card: `S4-02` — Deterministic Time-Travel Replay ("Market Flight Recorder") (`NR-03`)
- **Status:** `[ ] PENDING`
- **Owner:** Sameer Bhati (`S24BCAU0106`)
- **Target Branch:** `feat/S4-02-time-travel-replay`
- **Prerequisites:** `S4-01`
- **Scope & Implementation Details:**
  1. Build Event Sourcing Replay API:
     - `GET /api/replay/events?symbol=INFY&fromSeq=100&toSeq=200`: Fetches sequential event stream.
  2. Frontend Flight Recorder Scrubber:
     - Interactive scrubber timeline at the bottom of the dashboard.
     - Play, pause, step forward, step backward buttons.
     - Speed multipliers: $0.25\times$, $0.5\times$, $1.0\times$, $2.0\times$.
  3. Visual Queue Depletion:
     - Watch resting orders get queued, partially eaten, or canceled in slow motion.
- **Files Involved:**
  - Create: `packages/client/src/components/TimeTravelScrubber.tsx`
  - Modify: `packages/client/src/store.ts`
- **Acceptance Criteria (Definition of Done):**
  - [ ] Dragging the scrubber slider smoothly shifts the order book UI to the exact historical book state at that sequence number.
  - [ ] Pausing live feed freezes live sockets and enters playback mode with an indicator banner.

---

### Feature Card: `S4-03` — Dual-Engine Latency Telemetry Cockpit (`NR-04`)
- **Status:** `[ ] PENDING`
- **Owner:** Apoorva Pandey (`S24BCAU0120`)
- **Target Branch:** `feat/S4-03-latency-telemetry`
- **Prerequisites:** `S2-05`
- **Scope & Implementation Details:**
  1. High-Resolution Timers (`process.hrtime.bigint()`):
     - **Matching Engine Latency:** Nanoseconds spent in RAM queue matching ($\approx 1.8 - 2.5\,\mu\text{s}$).
     - **Database Settlement Latency:** Milliseconds spent committing PostgreSQL ACID transaction ($\approx 2.5 - 4.5\,\text{ms}$).
     - **Network Transport Latency:** WebSocket packet transit duration ($\approx 10 - 18\,\text{ms}$).
  2. Live Cockpit Widget:
     - Real-time side-by-side bar chart / gauges contrasting microsecond in-memory matching vs. millisecond relational durability.
- **Files Involved:**
  - Create: `packages/client/src/components/LatencyCockpit.tsx`
  - Modify: `packages/server/src/matching-engine.ts`, `packages/shared/src/types.ts`
- **Acceptance Criteria (Definition of Done):**
  - [ ] Every trade broadcasts execution telemetry.
  - [ ] UI telemetry widget displays live running averages of RAM vs. DB vs. Network latencies.

---

### Feature Card: `S4-04` — Concurrency & Lock Contention Student Lab (`NR-08`)
- **Status:** `[ ] PENDING`
- **Owner:** Apoorva Pandey (`S24BCAU0120`) / Sameer Bhati (`S24BCAU0106`)
- **Target Branch:** `feat/S4-04-concurrency-lab`
- **Prerequisites:** `S2-05`
- **Scope & Implementation Details:**
  1. Automated Concurrency Benchmark Runner:
     - Script that spawns 50 parallel asynchronous clients submitting simultaneous market buy orders targeting the exact same resting ask order.
  2. Isolation Level Experimentation:
     - Toggle between `READ COMMITTED`, `REPEATABLE READ`, and `SERIALIZABLE`.
     - Measure and report:
       - Row lock wait time.
       - Serialization failure / rollback rate.
       - Effective throughput (commits/sec).
  3. Pre-configured student laboratory exercises with step-by-step PDF/Markdown lab guides.
- **Files Involved:**
  - Create: `packages/server/src/scripts/concurrency-lab.ts`, `docs/labs/concurrency-lab.md`
- **Acceptance Criteria (Definition of Done):**
  - [ ] Running the script demonstrates measurable serialization anomalies under `READ COMMITTED` and zero anomalies with retries under `REPEATABLE READ`.
  - [ ] Lab results exportable as a clean benchmark report for academic submission.
