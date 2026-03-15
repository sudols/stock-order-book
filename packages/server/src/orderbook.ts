import type { Order } from '@orderbook/shared';

/**
 * OrderBook — Data-only class (no matching logic).
 *
 * Storage:
 *   • `bidsByPrice` / `asksByPrice` — Map<price, Order[]>
 *     Each bucket holds orders at that price in FIFO arrival order.
 *     Used for O(1) price-level access and as the source of truth for
 *     getBestBid / getBestAsk.
 *
 *   • `bidPriceLevels` / `askPriceLevels` — sorted number[]
 *     Compact arrays of *distinct prices only* (not individual orders).
 *     Kept sorted (bids descending, asks ascending) via binary search insert.
 *     Length = number of distinct active price levels (typically 20–50),
 *     not total order count.
 *
 *   • `ordersById` — Map<id, Order>
 *     Used for O(1) cancel and ID-based lookup.
 *
 * Complexity (p = distinct price levels, k = orders at one price level):
 *   addOrder    → O(log p + p)  binary search find + splice shift in price levels
 *   removeOrder → O(log p + p)  binary search find + splice shift in price levels
 *                 + O(k) scan within the price-level bucket (k is typically small)
 *   getBestBid  → O(1)          index 0 of bidPriceLevels → bucket[0]
 *   getBestAsk  → O(1)          index 0 of askPriceLevels → bucket[0]
 *   getTop10    → O(10)         walk first few price levels until 10 orders collected
 *
 * Previous implementation maintained full sorted Order[] arrays and called
 * .sort() on every insert (O(n log n)) and findIndex + splice on every
 * removal (O(n)), where n = total orders in the book. This caused throughput
 * to degrade visibly at high order counts. The fix separates the display path
 * (getTop10) from the matching hot path (getBestBid / getBestAsk) — only the
 * latter needs to be O(1) and it now is, without touching the full order arrays.
 */
export class OrderBook {
  // ── price-level maps (source of truth) ───────────────
  private bidsByPrice = new Map<number, Order[]>();
  private asksByPrice = new Map<number, Order[]>();

  // ── sorted price-level arrays (distinct prices only) ─
  // bids: descending (highest bid first)
  // asks: ascending  (lowest ask first)
  private bidPriceLevels: number[] = [];
  private askPriceLevels: number[] = [];

  // ── ID map ────────────────────────────────────────────
  private ordersById = new Map<string, Order>();

  // ── order count ───────────────────────────────────────
  private _size = 0;

  // ─── Add ─────────────────────────────────────────────
  addOrder(order: Order): void {
    this.ordersById.set(order.id, order);

    const priceMap = order.side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    const existing = priceMap.get(order.price);

    if (existing) {
      // Price level already exists — append (preserves FIFO within level).
      existing.push(order);
    } else {
      // New price level — create bucket and record the price in sorted array.
      priceMap.set(order.price, [order]);
      if (order.side === 'buy') {
        this.insertSorted(this.bidPriceLevels, order.price, 'desc');
      } else {
        this.insertSorted(this.askPriceLevels, order.price, 'asc');
      }
    }

    this._size++;
  }

  // ─── Remove ──────────────────────────────────────────
  removeOrder(orderId: string): Order | null {
    const order = this.ordersById.get(orderId);
    if (!order) return null;

    this.ordersById.delete(orderId);

    const priceMap = order.side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    const bucket = priceMap.get(order.price)!;

    // Remove by reference — avoids a second string comparison loop.
    const idx = bucket.indexOf(order);
    if (idx !== -1) bucket.splice(idx, 1);

    if (bucket.length === 0) {
      // Price level is now empty — evict from map and price levels array.
      priceMap.delete(order.price);
      if (order.side === 'buy') {
        this.removeSorted(this.bidPriceLevels, order.price, 'desc');
      } else {
        this.removeSorted(this.askPriceLevels, order.price, 'asc');
      }
    }

    this._size--;
    return order;
  }

  // ─── Queries ─────────────────────────────────────────
  getOrdersAtPrice(side: 'buy' | 'sell', price: number): Order[] {
    const priceMap = side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    return priceMap.get(price) ?? [];
  }

  getBestBid(): Order | null {
    if (this.bidPriceLevels.length === 0) return null;
    // bidPriceLevels[0] is always the highest active bid price.
    return this.bidsByPrice.get(this.bidPriceLevels[0])![0] ?? null;
  }

  getBestAsk(): Order | null {
    if (this.askPriceLevels.length === 0) return null;
    // askPriceLevels[0] is always the lowest active ask price.
    return this.asksByPrice.get(this.askPriceLevels[0])![0] ?? null;
  }

  getTop10Bids(): Order[] {
    return this.getTopN(this.bidPriceLevels, this.bidsByPrice, 10);
  }

  getTop10Asks(): Order[] {
    return this.getTopN(this.askPriceLevels, this.asksByPrice, 10);
  }

  getOrderById(orderId: string): Order | null {
    return this.ordersById.get(orderId) ?? null;
  }

  get size(): number {
    return this._size;
  }

  // ─── Private helpers ─────────────────────────────────

  /**
   * Collect up to `n` orders by iterating price levels in priority order.
   * Naturally respects price-time priority: levels are pre-sorted, and
   * orders within each level are stored in FIFO arrival order.
   */
  private getTopN(
    priceLevels: number[],
    priceMap: Map<number, Order[]>,
    n: number,
  ): Order[] {
    const result: Order[] = [];
    for (const price of priceLevels) {
      if (result.length >= n) break;
      for (const order of priceMap.get(price)!) {
        result.push(order);
        if (result.length >= n) break;
      }
    }
    return result;
  }

  /**
   * Binary search insert — O(log p) to find position, O(p) for the splice shift.
   * Keeps `arr` sorted without a full re-sort on every call.
   * dir 'desc': highest first (bids).
   * dir 'asc':  lowest first  (asks).
   */
  private insertSorted(arr: number[], price: number, dir: 'asc' | 'desc'): void {
    let lo = 0,
      hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const goRight = dir === 'desc' ? arr[mid] > price : arr[mid] < price;
      if (goRight) lo = mid + 1;
      else hi = mid;
    }
    arr.splice(lo, 0, price);
  }

  /**
   * Binary search remove — O(log p) to find, O(p) for the splice shift.
   * Only called when a price-level bucket becomes empty.
   */
  private removeSorted(arr: number[], price: number, dir: 'asc' | 'desc'): void {
    let lo = 0,
      hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const goRight = dir === 'desc' ? arr[mid] > price : arr[mid] < price;
      if (goRight) lo = mid + 1;
      else hi = mid;
    }
    if (arr[lo] === price) arr.splice(lo, 1);
  }
}
