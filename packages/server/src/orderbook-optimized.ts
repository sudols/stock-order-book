import type { Order } from '@orderbook/shared';

/**
 * OrderBook — Optimized Implementation (Linked Queue Per Price Level)
 *
 * Design:
 *   • Map<price, PriceLevel> where PriceLevel = doubly-linked list of orders
 *   • Sorted price-level arrays (distinct prices only, same as baseline)
 *   • No array splice overhead on removals — O(1) unlink
 *
 * Purpose:
 *   Eliminates array shifting bottleneck from baseline implementation.
 *   Better scalability for high-volume removal scenarios.
 *
 * Complexity (p = distinct price levels, k = orders at one price):
 *   addOrder    → O(log p)  binary search + O(1) append to tail
 *   removeOrder → O(1)      direct unlink (no array shift)
 *   getBestBid  → O(1)      index 0 of bidPriceLevels → level.head
 *   getBestAsk  → O(1)      index 0 of askPriceLevels → level.head
 *   getTop10    → O(10)     walk linked lists
 */

// ── Linked list node ─────────────────────────────────
interface OrderNode {
  order: Order;
  next: OrderNode | null;
  prev: OrderNode | null;
}

// ── Price level (doubly-linked list) ─────────────────
class PriceLevel {
  head: OrderNode | null = null;
  tail: OrderNode | null = null;
  count = 0;

  /** Append order to tail (FIFO) */
  append(order: Order): OrderNode {
    const node: OrderNode = { order, next: null, prev: null };

    if (!this.tail) {
      // Empty list
      this.head = this.tail = node;
    } else {
      // Append to tail
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }

    this.count++;
    return node;
  }

  /** Remove node from list (O(1)) */
  remove(node: OrderNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      // Removing head
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      // Removing tail
      this.tail = node.prev;
    }

    this.count--;
  }

  /** Collect up to n orders from this level */
  collectOrders(n: number): Order[] {
    const result: Order[] = [];
    let current = this.head;
    while (current && result.length < n) {
      result.push(current.order);
      current = current.next;
    }
    return result;
  }

  /** Get all orders (for testing/debugging) */
  getAllOrders(): Order[] {
    const result: Order[] = [];
    let current = this.head;
    while (current) {
      result.push(current.order);
      current = current.next;
    }
    return result;
  }
}

// ── Main OrderBook ───────────────────────────────────
export class OrderBook {
  // Price-level maps (linked lists per price)
  private bidsByPrice = new Map<number, PriceLevel>();
  private asksByPrice = new Map<number, PriceLevel>();

  // Sorted price-level arrays (distinct prices only)
  private bidPriceLevels: number[] = [];
  private askPriceLevels: number[] = [];

  // ID → node lookup for O(1) cancel
  private nodesById = new Map<string, OrderNode>();

  private _size = 0;

  // ─── Add ─────────────────────────────────────────────
  addOrder(order: Order): void {
    const priceMap = order.side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    let level = priceMap.get(order.price);

    if (!level) {
      // New price level — create and insert price into sorted array
      level = new PriceLevel();
      priceMap.set(order.price, level);

      if (order.side === 'buy') {
        this.insertSorted(this.bidPriceLevels, order.price, 'desc');
      } else {
        this.insertSorted(this.askPriceLevels, order.price, 'asc');
      }
    }

    // Append order to level's tail (FIFO)
    const node = level.append(order);
    this.nodesById.set(order.id, node);

    this._size++;
  }

  // ─── Remove ──────────────────────────────────────────
  removeOrder(orderId: string): Order | null {
    const node = this.nodesById.get(orderId);
    if (!node) return null;

    const order = node.order;
    this.nodesById.delete(orderId);

    const priceMap = order.side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    const level = priceMap.get(order.price)!;

    // Unlink from list (O(1))
    level.remove(node);

    if (level.count === 0) {
      // Price level is now empty — evict
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
    const level = priceMap.get(price);
    return level ? level.getAllOrders() : [];
  }

  getBestBid(): Order | null {
    if (this.bidPriceLevels.length === 0) return null;
    const level = this.bidsByPrice.get(this.bidPriceLevels[0])!;
    return level.head?.order ?? null;
  }

  getBestAsk(): Order | null {
    if (this.askPriceLevels.length === 0) return null;
    const level = this.asksByPrice.get(this.askPriceLevels[0])!;
    return level.head?.order ?? null;
  }

  getTop10Bids(): Order[] {
    return this.getTopN(this.bidPriceLevels, this.bidsByPrice, 10);
  }

  getTop10Asks(): Order[] {
    return this.getTopN(this.askPriceLevels, this.asksByPrice, 10);
  }

  getOrderById(orderId: string): Order | null {
    const node = this.nodesById.get(orderId);
    return node?.order ?? null;
  }

  get size(): number {
    return this._size;
  }

  // ─── Private helpers ─────────────────────────────────

  /**
   * Collect up to `n` orders by iterating price levels in priority order.
   */
  private getTopN(
    priceLevels: number[],
    priceMap: Map<number, PriceLevel>,
    n: number,
  ): Order[] {
    const result: Order[] = [];
    for (const price of priceLevels) {
      if (result.length >= n) break;
      const level = priceMap.get(price)!;
      const remaining = n - result.length;
      result.push(...level.collectOrders(remaining));
    }
    return result;
  }

  /**
   * Binary search insert — O(log p) to find position, O(p) for the splice shift.
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
