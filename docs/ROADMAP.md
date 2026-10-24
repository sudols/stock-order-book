# 🗺️ Glass-Box Implementation Roadmap & Master Status Dashboard

> **Master Progress Dashboard for Multi-Chat Parallel Development**  
> Aligned with [GLASS_BOX_PROJECT_SPECIFICATION.md](GLASS_BOX_PROJECT_SPECIFICATION.md) and [AGENTS.md](../AGENTS.md).

---

## 🚦 Global Sprint Status

```
Sprint 1 (Weeks 1-3)  ──► In-Memory Matching Engine & Dual Engine Benchmarks    [✅ COMPLETED]
Sprint 2 (Weeks 4-6)  ──► 3NF PostgreSQL Schema, Settlement & Multi-Symbol Engine [🔄 ACTIVE]
Sprint 3 (Weeks 7-9)  ──► Tool-Calling Agentic AI Tutor & Execution Trace Modal  [🔄 ACTIVE]
Sprint 4 (Weeks 10-12) ──► WAL Crash Recovery, Time-Travel Replay & Telemetry     [⏳ UPCOMING]
```

---

## 👥 Ownership Matrix

| Area | Primary Lead | Key Responsibilities |
| :--- | :--- | :--- |
| **Backend Architecture & Concurrency** | **Apoorva Pandey** (`S24BCAU0120`) | Atomic settlement, row locks, Gemini tool calling, Go matching engine, concurrency benchmarks |
| **Frontend Systems & Database** | **Sameer Bhati** (`S24BCAU0106`) | React dashboard, collision tree modal, OBI gauge, time-travel scrubber, PostgreSQL schema & ledger triggers |

---

## 📊 Feature Progress Tracker (All Sprints)

### Sprint 1: Baseline Prototype (Weeks 1–3) — ✅ COMPLETED
*Detailed specs:* [docs/sprints/sprint-1-baseline.md](sprints/sprint-1-baseline.md)

| Feature ID | Feature Name | Assignee | Target Branch | Status |
| :--- | :--- | :--- | :--- | :---: |
| `S1-01` | Baseline OrderBook (HashMaps + Sorted Arrays) | Apoorva Pandey | `main` | `[x]` |
| `S1-02` | Naive & Optimized OrderBook Variants | Apoorva Pandey | `main` | `[x]` |
| `S1-03` | In-Memory Portfolio Manager | Sameer Bhati | `main` | `[x]` |
| `S1-04` | Full-Stack Real-Time Dashboard (React/Tailwind) | Sameer Bhati | `main` | `[x]` |
| `S1-05` | Go Matching Engine Benchmark Comparison | Apoorva Pandey | `main` | `[x]` |

---

### Sprint 2: 3NF PostgreSQL Schema & Multi-Symbol Engine (Weeks 4–6) — 🔄 ACTIVE
*Detailed specs:* [docs/sprints/sprint-2-dbms-engine.md](sprints/sprint-2-dbms-engine.md)

| Feature ID | Feature Name | Assignee | Target Branch | Status |
| :--- | :--- | :--- | :--- | :---: |
| `S2-01` | Local PostgreSQL 16 Infrastructure & Docker Compose | Sameer / Apoorva | `feat/S2-01-postgres-docker` | `[x]` |
| `S2-02` | 3NF Relational Schema & Migrations (8 Core Tables) | Sameer Bhati | `feat/S2-02-postgres-schema` | `[x]` |
| `S2-03` | Double-Entry Financial Ledger & Trigger Invariants (`NR-05`) | Sameer Bhati | `feat/S2-03-double-entry-ledger` | `[x]` |
| `S2-04` | Multi-Symbol Order Books & Market Parameters (`FR-04`) | Apoorva Pandey | `feat/S2-04-multi-symbol-books` | `[x]` |
| `S2-05` | Multi-Counterparty Atomic Trade Settlement (`NR-01` Core) | Apoorva Pandey | `feat/S2-05-atomic-settlement` | `[ ]` |

---

### Sprint 3: Agentic AI Tutor & Visualizations (Weeks 7–9) — 🔄 ACTIVE
*Detailed specs:* [docs/sprints/sprint-3-agentic-ai-ui.md](sprints/sprint-3-agentic-ai-ui.md)

| Feature ID | Feature Name | Assignee | Target Branch | Status |
| :--- | :--- | :--- | :--- | :---: |
| `S3-01` | Tool-Calling Agentic AI Tutor with 5 Tools (`NR-02`) | Apoorva Pandey | `feat/S3-01-gemini-ai-tutor` | `[ ]` |
| `S3-02` | "Glass-Box" Collision Tree Execution Trace Modal (`NR-01` UI) | Sameer Bhati | `feat/S3-02-execution-trace-modal` | `[ ]` |
| `S3-03` | Order Book Imbalance (OBI) Gauge (`NR-07`) | Sameer Bhati | `feat/S3-03-obi-gauge` | `[ ]` |
| `S3-04` | Multi-Symbol Dashboard UI & Instrument Selector | Sameer Bhati | `feat/S3-04-symbol-selector-ui` | `[ ]` |

---

### Sprint 4: Durability, Telemetry & Concurrency Lab (Weeks 10–12) — ⏳ UPCOMING
*Detailed specs:* [docs/sprints/sprint-4-durability-telemetry.md](sprints/sprint-4-durability-telemetry.md)

| Feature ID | Feature Name | Assignee | Target Branch | Status |
| :--- | :--- | :--- | :--- | :---: |
| `S4-01` | Automated Write-Ahead Log (WAL) Crash Recovery (`NR-06`) | Apoorva Pandey | `feat/S4-01-wal-crash-recovery` | `[ ]` |
| `S4-02` | Deterministic Time-Travel Replay ("Flight Recorder") (`NR-03`) | Sameer Bhati | `feat/S4-02-time-travel-replay` | `[ ]` |
| `S4-03` | Dual-Engine Latency Telemetry Cockpit (`NR-04`) | Apoorva Pandey | `feat/S4-03-latency-telemetry` | `[ ]` |
| `S4-04` | Concurrency & Lock Contention Student Lab Scenarios (`NR-08`) | Apoorva / Sameer | `feat/S4-04-concurrency-lab` | `[ ]` |

---

## 📌 Multi-Chat Usage Cheat Sheet

When starting a new chat session to build any feature:
1. **Reference the Feature ID:** Tell the assistant: *"Please work on Feature S2-01"* or *"Please implement S3-02 Collision Tree modal"*.
2. **Branch Check:** The assistant creates or checks out `feat/<FEATURE-ID>-<slug>`.
3. **Execution & Acceptance:** Follow the exact Acceptance Criteria in the sprint file.
4. **Update Status & Checkboxes:** Change `[ ]` to `[x]` in this table AND mark all checkboxes (`[x]`) in the sprint task card (header, status, scope items, files, acceptance criteria) as mandated by `AGENTS.md`.
