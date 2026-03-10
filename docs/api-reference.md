# API Reference

The backend exposes a **tRPC** API for actions (Mutations) and state retrieval (Queries), and uses **Socket.io** for real-time updates.

## Shared Types (`@orderbook/shared`)

All data structures are shared between client and server to ensure type safety.

### `Order`

```typescript
interface Order {
	id: string;
	userId: string;
	side: 'buy' | 'sell';
	price: number;
	quantity: number;
	timestamp: number;
}
```

### `Trade`

```typescript
interface Trade {
	id: string;
	buyOrderId: string;
	sellOrderId: string;
	price: number;
	quantity: number;
	timestamp: number;
}
```

### `Portfolio`

```typescript
interface Portfolio {
	usd: number; // Cash balance
	stocks: number; // Stock holdings
}
```

---

## tRPC Endpoints

All endpoints require a Firebase ID token for authentication.

### Mutations (Actions)

#### `placeOrder`

Places a new limit order on the book.

- **Input**:
  - `token`: Firebase ID token
  - `side`: `'buy' | 'sell'`
  - `price`: `number` (Must be positive)
  - `quantity`: `number` (Must be positive)
- **Output**:
  - `success`: `{ trades: Trade[], remainingOrder: Order | null }`
  - `error`: `string` (e.g., "Insufficient funds")

#### `cancelOrder`

Cancels an existing open order.

- **Input**:
  - `token`: Firebase ID token
  - `orderId`: `string`
- **Output**:
  - `success`: `Order` (The cancelled order)
  - `error`: `string`

### Queries (Data Retrieval)

#### `getPortfolio`

Retrieves the authenticated user's balance.

- **Input**: `{ token: string }`
- **Output**: `Portfolio`

#### `getOrderBook`

Retrieves the current state of the order book (Top 10 bids/asks).

- **Input**: `void`
- **Output**: `OrderBookSnapshot`

---

## Real-time Events (Socket.io)

### `orderbook`

Broadcasted whenever the order book changes (new order, trade, or cancellation).

- **Payload**:
  ```typescript
  {
    bids: Order[]; // Top 10 bids
    asks: Order[]; // Top 10 asks
    timestamp: number;
  }
  ```
