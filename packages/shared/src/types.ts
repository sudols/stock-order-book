// ─── Order ───────────────────────────────────────────────
export interface Order {
  id: string;
  userId: string;
  symbol?: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: number;
  orderType?: 'LIMIT' | 'MARKET';
}

// ─── Trade ───────────────────────────────────────────────
export interface Trade {
  id: string;
  symbol?: string;
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
  cashBalance?: number;
  lockedCash?: number;
  holdings?: Record<string, { quantity: number; lockedQuantity: number }>;
}

// ─── Price History ───────────────────────────────────────
export interface PriceHistoryItem {
  time: string;
  price: number;
  symbol?: string;
}

// ─── OrderBook Snapshot (sent to clients) ────────────────
export interface OrderBookSnapshot {
  symbol?: string;
  bids: Order[];
  asks: Order[];
  priceHistory: PriceHistoryItem[];
  timestamp: number;
}

// ─── OrderBook Update (sent to clients on every change) ──────
export interface OrderBookUpdate {
  symbol?: string;
  bids: Order[];
  asks: Order[];
  timestamp: number;
}

// ─── Market Parameters (FR-04) ───────────────────────────
export interface MarketParams {
  symbol: string;
  companyName?: string;
  tickSize: number;       // e.g. 0.05
  lotSize: number;        // e.g. 1
  basePrice: number;      // e.g. 3500.00
  circuitLimitPct: number; // e.g. 10.00 representing ±10%
  isHalted?: boolean;
}

export const SUPPORTED_SYMBOLS = ['TCS', 'INFY', 'RELIANCE', 'HDFCBANK'] as const;
export type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];

export const DEFAULT_MARKET_PARAMS: Record<SupportedSymbol, MarketParams> = {
  TCS: {
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services Ltd',
    tickSize: 0.05,
    lotSize: 1,
    basePrice: 3500.0,
    circuitLimitPct: 10.0,
    isHalted: false,
  },
  INFY: {
    symbol: 'INFY',
    companyName: 'Infosys Ltd',
    tickSize: 0.05,
    lotSize: 1,
    basePrice: 1500.0,
    circuitLimitPct: 10.0,
    isHalted: false,
  },
  RELIANCE: {
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Ltd',
    tickSize: 0.05,
    lotSize: 1,
    basePrice: 2500.0,
    circuitLimitPct: 10.0,
    isHalted: false,
  },
  HDFCBANK: {
    symbol: 'HDFCBANK',
    companyName: 'HDFC Bank Ltd',
    tickSize: 0.05,
    lotSize: 1,
    basePrice: 1600.0,
    circuitLimitPct: 10.0,
    isHalted: false,
  },
};

// ─── Result type for error handling ──────────────────────
export type Result<T, E = string> =
  | { success: T; error?: never }
  | { success?: never; error: E };

