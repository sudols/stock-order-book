# 📘 Glass-Box

> **Interactive Multi-Symbol Market Microstructure & ACID Transaction Simulator with Agentic AI**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![pnpm: workspace](https://img.shields.io/badge/pnpm-workspace-orange.svg)](https://pnpm.io/)

**Glass-Box** is an open-source, web-native educational electronic exchange, market microstructure simulator, and database concurrency laboratory designed for computer science and fintech students.

Unlike typical retail paper trading platforms that treat exchange internals as an opaque "black box," Glass-Box turns the financial exchange into an auditable and transparent learning environment:

- **Computer Science & DBMS:** Inspect row-level lock contention (`SELECT ... FOR UPDATE`), evaluate transaction isolation levels (`READ COMMITTED` vs. `REPEATABLE READ`), and test Write-Ahead Log (WAL) event replay after simulated engine crashes (`kill -9`).
- **Market Microstructure & FinTech:** Gain live visibility into multi-symbol order book depth ladders (TCS, INFY, RELIANCE, HDFCBANK), Order Book Imbalance (OBI), Volume-Weighted Average Price (VWAP), and liquidity depletion curves.
- **Embedded Agentic AI Tutor:** Powered by Google Gemini structured function calling, an embedded tutor inspects real-time order book and transaction state to explain market dynamics without hallucinations.

---

## 🏗️ Monorepo Architecture

The project is structured as a monorepo managed with `pnpm workspaces`:

```
stock-order-book/
├── packages/
│   ├── client/               # React 18 + Tailwind CSS + Zustand + Socket.io frontend
│   ├── server/               # Node.js + Express + tRPC + Socket.io + PostgreSQL settlement
│   ├── shared/               # Shared TypeScript schemas, types, and Zod validators
│   └── matching-engine-go/   # High-throughput Go matching engine benchmark
├── docs/                     # Specifications, architecture, and sprint roadmaps
│   ├── GLASS_BOX_PROJECT_SPECIFICATION.md
│   ├── ROADMAP.md
│   ├── technical-architecture.md
│   ├── order-matching-system.md
│   └── api-reference.md
├── archive/                  # Previous semester deliverables & milestone reports
│   └── previous-sem/
├── capstone.md               # Capstone project blueprint & requirement breakdown
├── docker-compose.yml        # Local PostgreSQL database (Sprint 2)
└── package.json              # Monorepo root scripts
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js `>= 18.0.0`
- `pnpm` (`npm install -g pnpm`)
- Optional: Docker & Docker Compose (for PostgreSQL in Sprint 2)

### Installation
```bash
# Clone the repository
git clone https://github.com/sudols/stock-order-book.git
cd stock-order-book

# Install dependencies across all packages
pnpm install
```

### Environment Configuration
Copy `.env.example` to `.env` in both the root and `packages/server/`:
```bash
cp .env.example .env
cp .env.example packages/server/.env
cp .env.example packages/client/.env
```

### Running the Development Environment
```bash
# Launch server and client simultaneously
pnpm dev
```
- **Frontend Dashboard:** http://localhost:5173
- **Backend API & WebSockets:** http://localhost:3001

---

## 🗺️ Implementation Roadmap

| Sprint | Phase | Focus | Status |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | Weeks 1–3 | In-Memory Matching Engine, OrderBook Variants & Benchmarks | ✅ Completed |
| **Sprint 2** | Weeks 4–6 | 3NF PostgreSQL Relational Schema, Multi-Party Atomic Settlement & Ledger Triggers | 🔄 **Active** |
| **Sprint 3** | Weeks 7–9 | Tool-Calling Agentic AI Tutor & Execution Trace Collision Tree Modal | 🔄 **Active** |
| **Sprint 4** | Weeks 10–12| Automated WAL Crash Recovery, Concurrency Isolation Benchmarks & Lab Scenarios | ⏳ Upcoming |

See [docs/ROADMAP.md](docs/ROADMAP.md) for detailed task-by-task tracking and [docs/GLASS_BOX_PROJECT_SPECIFICATION.md](docs/GLASS_BOX_PROJECT_SPECIFICATION.md) for full project requirements.

---

## 👥 Project Team

- **Apoorva Pandey** (`S24BCAU0120`) — *Backend Architecture, Concurrency & Agentic AI Lead*
- **Sameer Bhati** (`S24BCAU0106`) — *Frontend Systems & Database Infrastructure Lead*

*School of Computer Science Engineering & Technology (SCSET), Bennett University*  
*BCA Major Project Specification for Database Management Systems (DBMS)*

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
