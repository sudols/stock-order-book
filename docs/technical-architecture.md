# Technical Architecture

## Monorepo Structure

The project is organized as a monorepo using `pnpm workspaces`, allowing efficient code sharing and dependency management.

```
/
├── packages/
│   ├── client/       # React Frontend
│   ├── server/       # Node.js Backend & Matching Engine
│   └── shared/       # Shared Types & interfaces
```

## Backend Architecture

The backend follows the **Single Responsibility Principle (SRP)**, separating data storage from business logic.

### 1. The OrderBook (`orderbook.ts`)

- **Responsibility**: Pure data structure for storing orders.
- **Hybrid Storage**:
  - **HashMaps**: Used for O(1) lookup by ID and O(1) lookup by price level.
  - **Sorted Arrays**: Used for O(n log n) insertion (maintained sorted) effectively for fast O(1) retrieval of best bid/ask and top N orders for the UI.
- **Key Operations**:
  - `addOrder`: Updates HashMaps and inserts into sorted array.
  - `removeOrder`: O(1) removal from HashMaps, O(n) removal from array (splicing).
  - `getBestBid` / `getBestAsk`: O(1) access to array head.

### 2. The Matching Engine (`matching-engine.ts`)

- **Responsibility**: Business logic for order matching.
- **Logic**:
  - Validates input (positive price, quantity, user funds).
  - Matches orders based on **Price-Time Priority**.
  - Executes trades and updates the `OrderBook` and `PortfolioManager`.
  - Returns executed trades and any remaining resting order.

### 3. Portfolio Manager (`portfolio-manager.ts`)

- **Responsibility**: Tracks user balances.
- **Logic**:
  - In-memory `Map` of user portfolios.
  - `canAfford`: Checks if a user has enough USD (for buy) or Stocks (for sell).
  - `executeTrade`: Atomically updates buyer and seller balances.

### 4. API Layer (`routers/app.ts`)

- **Technology**: tRPC
- **Function**: Exposes endpoints like `placeOrder` and `getPortfolio`.
- **Flow**:
  1.  Receives request.
  2.  Verifies Auth Token (Firebase).
  3.  Calls `MatchingEngine`.
  4.  Broadcasts updates via Socket.io.
  5.  Returns result to client.

## Frontend Architecture

### 1. State Management (`store.ts`)

- **Library**: Zustand
- **State**:
  - `user`: Current logged-in user.
  - `bids` / `asks`: Current state of the order book (synced via WebSocket).
  - `portfolio`: User's current balance.

### 2. Real-time Updates

- **Technology**: Socket.io-client
- **Flow**:
  - Connects to backend on mount.
  - Listens for `orderbook` events.
  - Updates Zustand store, which triggers UI re-renders.

### 3. Component Structure

- **Smart Components**: Connect to store (e.g., `OrderBookView`, `TradeForm`).
- **UI Components**: Pure presentational components using Tailwind CSS.
