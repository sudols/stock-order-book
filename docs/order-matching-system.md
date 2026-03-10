# Order Matching System

The core of this project is the **Matching Engine**, which determines how buy and sell orders interacts.

## 1. Data Structures (The "Hybrid" Approach)

To ensure high performance, we use a combination of data structures:

| Data Structure          | Purpose                       | Time Complexity                                         |
| :---------------------- | :---------------------------- | :------------------------------------------------------ |
| **Map<ID, Order>**      | Find order by ID              | **O(1)**                                                |
| **Map<Price, Order[]>** | Find orders at specific price | **O(1)**                                                |
| **Sorted Array[]**      | Get Best Bid / Best Ask       | **O(1)** (Access)                                       |
| **Sorted Array[]**      | Insert Order                  | **O(n)** (due to shift) or **O(log n)** (binary search) |

_Note: While array insertion is technically O(n) because of shifting elements, for reasonable order book depths, it is effectively instantaneous and provides the fastest read access for specific UI slices._

## 2. Matching Logic (Price-Time Priority)

The engine follows standard exchange rules:

1.  **Price Priority**: Better prices execute first.
    - Buy orders with **higher** prices are prioritized.
    - Sell orders with **lower** prices are prioritized.
2.  **Time Priority**: If prices are equal, the order that arrived **earlier** executes first.

### The Algorithm

When a new order (Taker) arrives:

1.  **Validation**: Check if price > 0, quantity > 0, and User has funds.
2.  **Look for Match**:
    - If **Buy** order: Look at the **Best Ask** (lowest sell price).
    - If **Sell** order: Look at the **Best Bid** (highest buy price).
3.  **Price Check**:
    - Does the Taker price cross the Maker price? (e.g., Buy Price >= Sell Price).
4.  **Execution**:
    - If yes, a trade is created for the minimum quantity of the two.
    - The Maker order is reduced or removed.
    - The Taker order is reduced.
    - Repeats until the Taker order is filled or no more matching orders exist.
5.  **Resting**:
    - Any remaining quantity of the Taker order is added to the Order Book as a new Maker order.

## 3. Example Scenario

**Initial Book:**

- Sell Orders (Asks):
  - 10 @ $105
  - 5 @ $102 (Best Ask)

**Action:** User places a **Buy** order for **8 shares @ $105**.

**Execution Steps:**

1.  **Match 1**: Matches against Best Ask (5 @ $102).
    - Trade: 5 shares @ $102.
    - Remaining Buy Order: 3 shares.
    - Ask @ $102 is removed.
2.  **Match 2**: Matches against next Best Ask (10 @ $105).
    - Trade: 3 shares @ $105.
    - Remaining Buy Order: 0 shares (Fully Filled).
    - Ask @ $105 reduced to 7 shares.

**Result:** The buyer got 5 shares cheaper than their limit price ($102 vs $105), which is a standard feature of limit orders (you get the best available price).
