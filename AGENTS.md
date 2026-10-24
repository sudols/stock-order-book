# 🤖 Instructions for AI Assistants & Multi-Chat Workflow

> **CRITICAL**: This repository is developed using a **multi-chat workflow** where different features and sprints are built across parallel, separate conversations.
> 
> **Any AI assistant starting a new session MUST read this file first.**

---

## 📌 Project Overview & Master Documents

- **Project Title:** Glass-Box: Interactive Multi-Symbol Market Microstructure & ACID Transaction Simulator with Agentic AI
- **Context:** BCA Major Project for Database Management Systems (DBMS), SCSET, Bennett University
- **Team:** Apoorva Pandey (`S24BCAU0120`) & Sameer Bhati (`S24BCAU0106`)
- **Master Blueprint:** [`docs/GLASS_BOX_PROJECT_SPECIFICATION.md`](docs/GLASS_BOX_PROJECT_SPECIFICATION.md) (or root [`capstone.md`](capstone.md))
- **Master Roadmap & Status:** [`docs/ROADMAP.md`](docs/ROADMAP.md)

---

## 🚀 Multi-Chat Protocol: How to Work on a Feature

When the user asks you to implement a feature in any chat session, follow this strict protocol:

### Step 1: Identify the Feature & Specification
1. Open [`docs/ROADMAP.md`](docs/ROADMAP.md) and the corresponding sprint file in [`docs/sprints/`](docs/sprints/):
   - **Sprint 2 (Active):** [`docs/sprints/sprint-2-dbms-engine.md`](docs/sprints/sprint-2-dbms-engine.md) (`S2-01` to `S2-05`)
   - **Sprint 3 (Active):** [`docs/sprints/sprint-3-agentic-ai-ui.md`](docs/sprints/sprint-3-agentic-ai-ui.md) (`S3-01` to `S3-04`)
   - **Sprint 4 (Upcoming):** [`docs/sprints/sprint-4-durability-telemetry.md`](docs/sprints/sprint-4-durability-telemetry.md) (`S4-01` to `S4-04`)
2. Read the **Acceptance Criteria**, **Files Involved**, and **Dependencies** for that specific feature.

### Step 2: Git Branching
Check what branch you are on. If starting a new feature, ensure you create or checkout the dedicated branch specified in the task card:
```bash
git checkout -b feat/<FEATURE-ID>-<short-description>
# Examples:
# git checkout -b feat/S2-01-postgres-docker
# git checkout -b feat/S2-02-postgres-schema
# git checkout -b feat/S3-01-gemini-ai-tutor
```

### Step 3: Implementation & Invariant Guardrails
- **ACID & Concurrency Invariants:**
  - Always enforce `SELECT ... FOR UPDATE` under `REPEATABLE READ` isolation for atomic balance settlements.
  - Row locks on `portfolios` and `securities_holdings` **must be acquired in deterministic sorted order** (by UUID / symbol) to prevent circular-wait deadlocks.
  - Double-entry ledger invariant: Every transaction must balance ($\sum \text{Debits} \equiv \sum \text{Credits}$).
- **Type Safety & Shared Types:**
  - Keep types synchronized across `packages/shared`, `packages/server`, and `packages/client`.
- **Preserve Existing Functionality:**
  - Do not break existing in-memory benchmarks or tests unless explicitly deprecating them.

### Step 4: Verification Before Marking Done
Before finishing a feature or chat turn:
1. Run server tests: `pnpm test` (or `pnpm --filter @orderbook/server test`)
2. If frontend was modified, verify client builds: `pnpm --filter @orderbook/client build`
3. Verify all Acceptance Criteria listed in the task card have been satisfied.

### Step 5: Update the Progress Tracking
1. Mark the feature as `[x] COMPLETED` in [`docs/ROADMAP.md`](docs/ROADMAP.md) and in the corresponding `docs/sprints/sprint-X-*.md` file.
2. Note the branch name or commit hash.
3. Commit your changes with a conventional commit message (e.g., `feat(db): S2-02 implement 3NF PostgreSQL schema`).

---

## 📂 Monorepo Structure

```
stock-order-book/
├── packages/
│   ├── client/               # React 18 + Tailwind + Zustand + Socket.io frontend
│   ├── server/               # Node.js + Express + tRPC + Socket.io + PostgreSQL settlement
│   ├── shared/               # Shared TypeScript schemas, types, and Zod validators
│   └── matching-engine-go/   # Go matching engine benchmark
├── docs/                     # Specifications, architecture, and sprint roadmaps
│   ├── GLASS_BOX_PROJECT_SPECIFICATION.md
│   ├── ROADMAP.md            # MASTER PROGRESS DASHBOARD
│   ├── sprints/              # GRANULAR TASK SPECIFICATIONS FOR CHATS
│   │   ├── sprint-1-baseline.md
│   │   ├── sprint-2-dbms-engine.md
│   │   ├── sprint-3-agentic-ai-ui.md
│   │   └── sprint-4-durability-telemetry.md
│   └── ...
├── archive/                  # Old semester archives (do not touch)
└── AGENTS.md                 # THIS FILE (Read by every agent)
```
