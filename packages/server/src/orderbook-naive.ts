import type { Order } from '@orderbook/shared';

/**
 * OrderBook — Naive Implementation (Intentionally Slow)
 *
 * Design:
 *   • Full sorted Order[] arrays per side (bids, asks)
 *   • Re-sorts entire array on every insert → O(n log n)
 *   • Linear search + splice on removal → O(n)
 *
 * Purpose:
 *   Demonstrates why naive approaches degrade at scale.
 *   Recreates the "old implementation" behavior mentioned in orderbook.ts.
 *
 * Complexity (n = total orders):
 *   addOrder    → O(n log n)  full array sort on every insert
 *   removeOrder → O(n)        findIndex scan + splice shift
 *   getBestBid  → O(1)        index 0 of sorted array
 *   getBestAsk  → O(1)        index 0 of sorted array
 *   getTop10    → O(1)        slice first 10
 */
export class OrderBook {
  private bids: Order[] = [];
  private asks: Order[] = [];

  private ordersById = new Map<string, Order>();

  private _size = 0;

  addOrder(order: Order): void {
    this.ordersById.set(order.id, order);

    if (order.side === 'buy') {
      this.bids.push(order);
      this.bids.sort((a, b) => {
        if (b.price !== a.price) return b.price - a.price;
        return a.timestamp - b.timestamp;
      });
    } else {
      this.asks.push(order);
      this.asks.sort((a, b) => {
        if (a.price !== b.price) return a.price - b.price;
        return a.timestamp - b.timestamp;
      });
    }

    this._size++;
  }

  removeOrder(orderId: string): Order | null {
    const order = this.ordersById.get(orderId);
    if (!order) return null;

    this.ordersById.delete(orderId);

    const arr = order.side === 'buy' ? this.bids : this.asks;
    const idx = arr.findIndex((o) => o.id === orderId);
    if (idx !== -1) arr.splice(idx, 1);

    this._size--;
    return order;
  }

  getOrdersAtPrice(side: 'buy' | 'sell', price: number): Order[] {
    const arr = side === 'buy' ? this.bids : this.asks;
    return arr.filter((o) => o.price === price);
  }

  getBestBid(): Order | null {
    return this.bids[0] ?? null;
  }

  getBestAsk(): Order | null {
    return this.asks[0] ?? null;
  }

  getTop10Bids(): Order[] {
    return this.bids.slice(0, 10);
  }

  getTop10Asks(): Order[] {
    return this.asks.slice(0, 10);
  }

  getOrderById(orderId: string): Order | null {
    return this.ordersById.get(orderId) ?? null;
  }

  get size(): number {
    return this._size;
  }
}
