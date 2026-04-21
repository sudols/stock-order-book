import type { Order } from '@orderbook/shared';
import { DoublyLinkedList, DoublyLinkedListNode } from '@datastructures-js/linked-list';

/**
 * OrderBook — Optimized Implementation (Linked Queue Per Price Level)
 *
 * Design:
 *   • Map<price, DoublyLinkedList<Order>> using library implementation
 *   • Sorted price-level arrays (distinct prices only, same as baseline)
 *   • No array splice overhead on removals — O(1) unlink
 *
 *
 * Complexity (p = distinct price levels, k = orders at one price):
 *   addOrder    → O(log p)  binary search + O(1) append to tail
 *   removeOrder → O(1)      direct unlink (no array shift)
 *   getBestBid  → O(1)      index 0 of bidPriceLevels → level.head
 *   getBestAsk  → O(1)      index 0 of askPriceLevels → level.head
 *   getTop10    → O(10)     walk linked lists
 */

export class OrderBook {
  private bidsByPrice = new Map<number, DoublyLinkedList<Order>>();
  private asksByPrice = new Map<number, DoublyLinkedList<Order>>();
  private bidPriceLevels: number[] = [];
  private askPriceLevels: number[] = [];

  private nodesById = new Map<string, DoublyLinkedListNode>();
  private _size = 0;

  addOrder(order: Order): void {
    const priceMap = order.side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    let list = priceMap.get(order.price);

    if (!list) {
      list = new DoublyLinkedList<Order>();
      priceMap.set(order.price, list);

      if (order.side === 'buy') {
        this.insertSorted(this.bidPriceLevels, order.price, 'desc');
      } else {
        this.insertSorted(this.askPriceLevels, order.price, 'asc');
      }
    }

    const node = list.insertLast(order);
    this.nodesById.set(order.id, node);

    this._size++;
  }

  removeOrder(orderId: string): Order | null {
    const node = this.nodesById.get(orderId);
    if (!node) return null;

    const order = node.getValue();
    this.nodesById.delete(orderId);

    const priceMap = order.side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    const list = priceMap.get(order.price)!;

    list.remove(node);

    if (list.isEmpty()) {
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

  getOrdersAtPrice(side: 'buy' | 'sell', price: number): Order[] {
    const priceMap = side === 'buy' ? this.bidsByPrice : this.asksByPrice;
    const list = priceMap.get(price);
    if (!list) return [];
    
    const orders: Order[] = [];
    list.forEach(node => orders.push(node.getValue()));
    return orders;
  }

  getBestBid(): Order | null {
    if (this.bidPriceLevels.length === 0) return null;
    return this.bidsByPrice.get(this.bidPriceLevels[0])!.head()?.getValue() ?? null;
  }

  getBestAsk(): Order | null {
    if (this.askPriceLevels.length === 0) return null;
    return this.asksByPrice.get(this.askPriceLevels[0])!.head()?.getValue() ?? null;
  }

  getTop10Bids(): Order[] {
    return this.getTopN(this.bidPriceLevels, this.bidsByPrice, 10);
  }

  getTop10Asks(): Order[] {
    return this.getTopN(this.askPriceLevels, this.asksByPrice, 10);
  }

  getOrderById(orderId: string): Order | null {
    return this.nodesById.get(orderId)?.getValue() ?? null;
  }

  get size(): number {
    return this._size;
  }


  private getTopN(
    priceLevels: number[],
    priceMap: Map<number, DoublyLinkedList<Order>>,
    n: number,
  ): Order[] {
    const result: Order[] = [];
    
    for (const price of priceLevels) {
      if (result.length >= n) break;
      
      const list = priceMap.get(price)!;
      const remaining = n - result.length;
      let count = 0;
      
      list.forEach(node => {
        if (count < remaining) {
          result.push(node.getValue());
          count++;
        }
      });
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
