package internal

import "sync"

// OrderBook is a data-only structure for storing orders
// Uses maps and sorted arrays for O(1) lookups and fast best bid/ask retrieval
type OrderBook struct {
	// Price-level maps (source of truth)
	bidsByPrice map[float64][]*Order
	asksByPrice map[float64][]*Order

	// Sorted price-level arrays (distinct prices only)
	// bids: descending (highest bid first)
	// asks: ascending (lowest ask first)
	bidPriceLevels []float64
	askPriceLevels []float64

	// ID map for O(1) lookup
	ordersById map[string]*Order

	// Order count
	size int

	// Mutex for thread-safety
	mu sync.RWMutex
}

// NewOrderBook creates a new empty order book
func NewOrderBook() *OrderBook {
	return &OrderBook{
		bidsByPrice:    make(map[float64][]*Order),
		asksByPrice:    make(map[float64][]*Order),
		bidPriceLevels: make([]float64, 0),
		askPriceLevels: make([]float64, 0),
		ordersById:     make(map[string]*Order),
		size:           0,
	}
}

// AddOrder adds an order to the book
func (ob *OrderBook) AddOrder(order *Order) {
	ob.mu.Lock()
	defer ob.mu.Unlock()

	ob.ordersById[order.ID] = order

	var priceMap map[float64][]*Order
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

	existing, exists := priceMap[order.Price]
	if exists {
		// Price level exists - append to preserve FIFO
		priceMap[order.Price] = append(existing, order)
	} else {
		// New price level - create bucket and insert into sorted array
		priceMap[order.Price] = []*Order{order}
		insertSorted(priceLevels, order.Price, ascending)
	}

	ob.size++
}

// RemoveOrder removes an order from the book by ID
func (ob *OrderBook) RemoveOrder(orderID string) *Order {
	ob.mu.Lock()
	defer ob.mu.Unlock()

	order, exists := ob.ordersById[orderID]
	if !exists {
		return nil
	}

	delete(ob.ordersById, orderID)

	var priceMap map[float64][]*Order
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

	bucket := priceMap[order.Price]

	// Find and remove the order from the bucket
	for i, o := range bucket {
		if o.ID == orderID {
			bucket = append(bucket[:i], bucket[i+1:]...)
			break
		}
	}

	if len(bucket) == 0 {
		// Price level is empty - remove from map and sorted array
		delete(priceMap, order.Price)
		removeSorted(priceLevels, order.Price, ascending)
	} else {
		priceMap[order.Price] = bucket
	}

	ob.size--
	return order
}

// GetBestBid returns the highest bid order (or nil if none)
func (ob *OrderBook) GetBestBid() *Order {
	ob.mu.RLock()
	defer ob.mu.RUnlock()

	if len(ob.bidPriceLevels) == 0 {
		return nil
	}

	bestPrice := ob.bidPriceLevels[0]
	orders := ob.bidsByPrice[bestPrice]
	if len(orders) == 0 {
		return nil
	}
	return orders[0]
}

// GetBestAsk returns the lowest ask order (or nil if none)
func (ob *OrderBook) GetBestAsk() *Order {
	ob.mu.RLock()
	defer ob.mu.RUnlock()

	if len(ob.askPriceLevels) == 0 {
		return nil
	}

	bestPrice := ob.askPriceLevels[0]
	orders := ob.asksByPrice[bestPrice]
	if len(orders) == 0 {
		return nil
	}
	return orders[0]
}

// GetTop10Bids returns the top 10 bid orders
func (ob *OrderBook) GetTop10Bids() []*Order {
	ob.mu.RLock()
	defer ob.mu.RUnlock()

	return ob.getTopN(ob.bidPriceLevels, ob.bidsByPrice, 10)
}

// GetTop10Asks returns the top 10 ask orders
func (ob *OrderBook) GetTop10Asks() []*Order {
	ob.mu.RLock()
	defer ob.mu.RUnlock()

	return ob.getTopN(ob.askPriceLevels, ob.asksByPrice, 10)
}

// GetOrderByID retrieves an order by its ID
func (ob *OrderBook) GetOrderByID(orderID string) *Order {
	ob.mu.RLock()
	defer ob.mu.RUnlock()

	return ob.ordersById[orderID]
}

// Size returns the total number of orders in the book
func (ob *OrderBook) Size() int {
	ob.mu.RLock()
	defer ob.mu.RUnlock()

	return ob.size
}

// getTopN collects up to n orders by iterating price levels
func (ob *OrderBook) getTopN(priceLevels []float64, priceMap map[float64][]*Order, n int) []*Order {
	result := make([]*Order, 0, n)

	for _, price := range priceLevels {
		if len(result) >= n {
			break
		}
		orders := priceMap[price]
		for _, order := range orders {
			result = append(result, order)
			if len(result) >= n {
				break
			}
		}
	}

	return result
}

// insertSorted inserts a price into a sorted slice using binary search
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
