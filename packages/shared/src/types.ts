// ─── Order ───────────────────────────────────────────────
export interface Order {
  id: string;
  userId: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: number;
}

// ─── Trade ───────────────────────────────────────────────
export interface Trade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  price: number;
  quantity: number;
  timestamp: number;
}

// ─── Portfolio ───────────────────────────────────────────
export interface Portfolio {
  usd: number;
  stocks: number;
}

// ─── OrderBook Snapshot (sent to clients) ────────────────
export interface OrderBookSnapshot {
  bids: Order[];
  asks: Order[];
  timestamp: number;
}

// ─── Result type for error handling ──────────────────────
export type Result<T, E = string> =
  | { success: T; error?: never }
  | { success?: never; error: E };
