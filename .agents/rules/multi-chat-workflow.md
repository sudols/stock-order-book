# Multi-Chat Development Rules & Invariants

You are working on **Glass-Box: Interactive Multi-Symbol Market Microstructure & ACID Transaction Simulator with Agentic AI**.

Because the developer works across multiple parallel/separate chat sessions for different features:

1. **Always Check Status First:**
   - Read `docs/ROADMAP.md` to see which features are pending, in-progress, or completed.
   - For detailed feature implementation cards, inspect `docs/sprints/sprint-2-dbms-engine.md`, `docs/sprints/sprint-3-agentic-ai-ui.md`, or `docs/sprints/sprint-4-durability-telemetry.md`.
2. **Branching:**
   - Develop features on dedicated branches: `feat/<FEATURE-ID>-<slug>` (e.g. `feat/S2-01-postgres-docker`).
3. **Strict ACID & Financial Invariants:**
   - Pessimistic locking: `SELECT ... FOR UPDATE` under `REPEATABLE READ`.
   - Sorted lock acquisition: Always sort portfolio and securities holding locks by ID to avoid circular wait deadlocks.
   - Double-entry balance invariant: Every executed trade must create balancing debits and credits ($\sum \text{Debits} \equiv \sum \text{Credits}$).
   - Non-negative balances: `CHECK (cash_balance >= 0)`, `CHECK (locked_cash >= 0)`, `CHECK (quantity >= 0)`.
4. **Always Update Task Status:**
   - When completing or progressing a task, update `docs/ROADMAP.md` and the relevant sprint file.
   - Run `pnpm test` to ensure existing matching engine tests pass before concluding.
