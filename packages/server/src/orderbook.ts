import type { Order } from '@orderbook/shared';

/**
 * OrderBook — Data-only class (no matching logic).
 *
 * Hybrid storage:
 *   • Sorted arrays  → for UI (getTop10Bids / getTop10Asks)
 *   • HashMaps       → for O(1) price lookup & cancel
 */
export class OrderBook {
  // ── sorted arrays (for UI display) ──
  private bids: Order[] = [];
  private asks: Order[] = [];

  // ── HashMaps (for fast lookup) ──
  private bidsByPrice = new Map<number, Order[]>();
  private asksByPrice = new Map<number, Order[]>();
  private ordersById = new Map<string, Order>();

  // ─── Add ─────────────────────────────────────────────
  addOrder(order: Order): void {
    // 1. Track by ID
    this.ordersById.set(order.id, order);

    // 2. Add to price-level map
    const priceMap = order.side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    const bucket = priceMap.get(order.price) || [];
    bucket.push(order);
    priceMap.set(order.price, bucket);

    // 3. Insert into sorted array
    if (order.side === 'buy') {
      this.bids.push(order);
      this.bids.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
    } else {
      this.asks.push(order);
      this.asks.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
    }
  }

  // ─── Remove ──────────────────────────────────────────
  removeOrder(orderId: string): Order | null {
    const order = this.ordersById.get(orderId);
    if (!order) return null;

    // 1. Remove from price-level map
    const priceMap = order.side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    const bucket = priceMap.get(order.price);
    if (bucket) {
      const filtered = bucket.filter((o) => o.id !== orderId);
      if (filtered.length === 0) {
        priceMap.delete(order.price);
      } else {
        priceMap.set(order.price, filtered);
      }
    }

    // 2. Remove from sorted array
    const arr = order.side === 'buy' ? this.bids : this.asks;
    const idx = arr.findIndex((o) => o.id === orderId);
    if (idx !== -1) arr.splice(idx, 1);

    // 3. Remove from ID map
    this.ordersById.delete(orderId);

    return order;
  }

  // ─── Queries ─────────────────────────────────────────
  getOrdersAtPrice(side: 'buy' | 'sell', price: number): Order[] {
    const priceMap = side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    return priceMap.get(price) || [];
  }

  getBestBid(): Order | null {
    return this.bids[0] || null;
  }

  getBestAsk(): Order | null {
    return this.asks[0] || null;
  }

  getTop10Bids(): Order[] {
    return this.bids.slice(0, 10);
  }

  getTop10Asks(): Order[] {
    return this.asks.slice(0, 10);
  }

  getOrderById(orderId: string): Order | null {
    return this.ordersById.get(orderId) || null;
  }

  /** Number of orders currently in the book. */
  get size(): number {
    return this.bids.length + this.asks.length;
  }
}
