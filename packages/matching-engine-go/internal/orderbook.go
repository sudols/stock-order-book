package internal

// OrderBook — Optimized Implementation (Linked Queue Per Price Level)
//
// Thread Safety:
//   This OrderBook is NOT thread-safe on its own. Thread safety is provided
//   by the semaphore in main.go which serializes all HTTP handler access.
//   This design reduces lock overhead from 10+ lock/unlock cycles per request
//   to just 1 acquire/release at the handler level.
//
// Design:
//   - map[float64]*PriceLevel where PriceLevel = doubly-linked list of orders
//   - Sorted price-level arrays (distinct prices only)
//   - No array splice overhead on removals — O(1) unlink
//
// Complexity (p = distinct price levels, k = orders at one price):
//   AddOrder    → O(log p)  binary search + O(1) append to tail
//   RemoveOrder → O(1)      direct unlink (no array shift)
//   GetBestBid  → O(1)      index 0 of bidPriceLevels → level.head
//   GetBestAsk  → O(1)      index 0 of askPriceLevels → level.head
//   GetTop10    → O(10)     walk linked lists

// ── Linked list node ─────────────────────────────────
type OrderNode struct {
	Order *Order
	Next  *OrderNode
	Prev  *OrderNode
}

// ── Price level (doubly-linked list) ─────────────────
type PriceLevel struct {
	Head  *OrderNode
	Tail  *OrderNode
	Count int
}

// NewPriceLevel creates a new empty price level
func NewPriceLevel() *PriceLevel {
	return &PriceLevel{
		Head:  nil,
		Tail:  nil,
		Count: 0,
	}
}

// Append adds an order to the tail (FIFO)
func (pl *PriceLevel) Append(order *Order) *OrderNode {
	node := &OrderNode{Order: order, Next: nil, Prev: nil}

	if pl.Tail == nil {
		// Empty list
		pl.Head = node
		pl.Tail = node
	} else {
		// Append to tail
		pl.Tail.Next = node
		node.Prev = pl.Tail
		pl.Tail = node
	}

	pl.Count++
	return node
}

// Remove removes a node from the list (O(1))
func (pl *PriceLevel) Remove(node *OrderNode) {
	if node.Prev != nil {
		node.Prev.Next = node.Next
	} else {
		// Removing head
		pl.Head = node.Next
	}

	if node.Next != nil {
		node.Next.Prev = node.Prev
	} else {
		// Removing tail
		pl.Tail = node.Prev
	}

	pl.Count--
}

// CollectOrders collects up to n orders from this level
func (pl *PriceLevel) CollectOrders(n int) []*Order {
	result := make([]*Order, 0, n)
	current := pl.Head
	for current != nil && len(result) < n {
		result = append(result, current.Order)
		current = current.Next
	}
	return result
}

// GetAllOrders returns all orders (for testing/debugging)
func (pl *PriceLevel) GetAllOrders() []*Order {
	result := make([]*Order, 0, pl.Count)
	current := pl.Head
	for current != nil {
		result = append(result, current.Order)
		current = current.Next
	}
	return result
}

// ── Main OrderBook ───────────────────────────────────
type OrderBook struct {
	// Price-level maps (linked lists per price)
	bidsByPrice map[float64]*PriceLevel
	asksByPrice map[float64]*PriceLevel

	// Sorted price-level arrays (distinct prices only)
	// bids: descending (highest bid first)
	// asks: ascending (lowest ask first)
	bidPriceLevels []float64
	askPriceLevels []float64

	// ID → node lookup for O(1) cancel
	nodesById map[string]*OrderNode

	// Order count
	size int
}

// NewOrderBook creates a new empty order book
func NewOrderBook() *OrderBook {
	return &OrderBook{
		bidsByPrice:    make(map[float64]*PriceLevel),
		asksByPrice:    make(map[float64]*PriceLevel),
		bidPriceLevels: make([]float64, 0),
		askPriceLevels: make([]float64, 0),
		nodesById:      make(map[string]*OrderNode),
		size:           0,
	}
}

// AddOrder adds an order to the book
func (ob *OrderBook) AddOrder(order *Order) {
	var priceMap map[float64]*PriceLevel
	var priceLevels *[]float64
	var ascending bool

	if order.Side == SideBuy {
		priceMap = ob.bidsByPrice
		priceLevels = &ob.bidPriceLevels
		ascending = false // bids descending
	} else {
		priceMap = ob.asksByPrice
		priceLevels = &ob.askPriceLevels
		ascending = true // asks ascending
	}

	level, exists := priceMap[order.Price]
	if !exists {
		// New price level — create and insert price into sorted array
		level = NewPriceLevel()
		priceMap[order.Price] = level
		insertSorted(priceLevels, order.Price, ascending)
	}

	// Append order to level's tail (FIFO)
	node := level.Append(order)
	ob.nodesById[order.ID] = node

	ob.size++
}

// RemoveOrder removes an order from the book by ID
func (ob *OrderBook) RemoveOrder(orderID string) *Order {
	node, exists := ob.nodesById[orderID]
	if !exists {
		return nil
	}

	order := node.Order
	delete(ob.nodesById, orderID)

	var priceMap map[float64]*PriceLevel
	var priceLevels *[]float64
	var ascending bool

	if order.Side == SideBuy {
		priceMap = ob.bidsByPrice
		priceLevels = &ob.bidPriceLevels
		ascending = false
	} else {
		priceMap = ob.asksByPrice
		priceLevels = &ob.askPriceLevels
		ascending = true
	}

	level := priceMap[order.Price]

	// Unlink from list (O(1))
	level.Remove(node)

	if level.Count == 0 {
		// Price level is now empty — evict
		delete(priceMap, order.Price)
		removeSorted(priceLevels, order.Price, ascending)
	}

	ob.size--
	return order
}

// GetBestBid returns the highest bid order (or nil if none)
func (ob *OrderBook) GetBestBid() *Order {
	if len(ob.bidPriceLevels) == 0 {
		return nil
	}

	level := ob.bidsByPrice[ob.bidPriceLevels[0]]
	if level == nil || level.Head == nil {
		return nil
	}
	return level.Head.Order
}

// GetBestAsk returns the lowest ask order (or nil if none)
func (ob *OrderBook) GetBestAsk() *Order {
	if len(ob.askPriceLevels) == 0 {
		return nil
	}

	level := ob.asksByPrice[ob.askPriceLevels[0]]
	if level == nil || level.Head == nil {
		return nil
	}
	return level.Head.Order
}

// GetTop10Bids returns the top 10 bid orders
func (ob *OrderBook) GetTop10Bids() []*Order {
	return ob.getTopN(ob.bidPriceLevels, ob.bidsByPrice, 10)
}

// GetTop10Asks returns the top 10 ask orders
func (ob *OrderBook) GetTop10Asks() []*Order {
	return ob.getTopN(ob.askPriceLevels, ob.asksByPrice, 10)
}

// GetOrderByID retrieves an order by its ID
func (ob *OrderBook) GetOrderByID(orderID string) *Order {
	node := ob.nodesById[orderID]
	if node == nil {
		return nil
	}
	return node.Order
}

// Size returns the total number of orders in the book
func (ob *OrderBook) Size() int {
	return ob.size
}

// ─── Private helpers ─────────────────────────────────

// getTopN collects up to n orders by iterating price levels in priority order.
func (ob *OrderBook) getTopN(priceLevels []float64, priceMap map[float64]*PriceLevel, n int) []*Order {
	result := make([]*Order, 0, n)

	for _, price := range priceLevels {
		if len(result) >= n {
			break
		}
		level := priceMap[price]
		remaining := n - len(result)
		result = append(result, level.CollectOrders(remaining)...)
	}

	return result
}

// insertSorted inserts a price into a sorted slice using binary search
// O(log p) to find position, O(p) for the copy shift
// ascending true: lowest first (asks)
// ascending false: highest first (bids)
func insertSorted(arr *[]float64, price float64, ascending bool) {
	slice := *arr
	lo, hi := 0, len(slice)

	for lo < hi {
		mid := (lo + hi) / 2
		var goRight bool
		if ascending {
			goRight = slice[mid] < price
		} else {
			goRight = slice[mid] > price
		}

		if goRight {
			lo = mid + 1
		} else {
			hi = mid
		}
	}

	// Insert at position lo
	slice = append(slice, 0)
	copy(slice[lo+1:], slice[lo:])
	slice[lo] = price
	*arr = slice
}

// removeSorted removes a price from a sorted slice using binary search
// O(log p) to find, O(p) for the copy shift
func removeSorted(arr *[]float64, price float64, ascending bool) {
	slice := *arr
	lo, hi := 0, len(slice)

	for lo < hi {
		mid := (lo + hi) / 2
		var goRight bool
		if ascending {
			goRight = slice[mid] < price
		} else {
			goRight = slice[mid] > price
		}

		if goRight {
			lo = mid + 1
		} else {
			hi = mid
		}
	}

	if lo < len(slice) && slice[lo] == price {
		slice = append(slice[:lo], slice[lo+1:]...)
		*arr = slice
	}
}
