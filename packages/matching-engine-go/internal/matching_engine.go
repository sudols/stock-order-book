package internal

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// MatchingEngine validates and matches orders using price-time priority
type MatchingEngine struct {
	orderBook *OrderBook
}

// NewMatchingEngine creates a new matching engine instance
func NewMatchingEngine() *MatchingEngine {
	return &MatchingEngine{
		orderBook: NewOrderBook(),
	}
}

// PlaceOrder validates and matches an incoming order against the book
// Returns executed trades and any remaining (resting) order
func (me *MatchingEngine) PlaceOrder(order *Order) ([]*Trade, *Order, error) {
	// Input validation
	if order.Price <= 0 {
		return nil, nil, errors.New("price must be positive")
	}
	if order.Quantity <= 0 {
		return nil, nil, errors.New("quantity must be positive")
	}
	if order.Price > 1_000_000 {
		return nil, nil, errors.New("price too high")
	}
	if order.Quantity > 10_000 {
		return nil, nil, errors.New("quantity too high")
	}

	// Note: Portfolio/fund checking is done in Node.js layer
	// This keeps the matching engine focused on pure matching logic

	trades := make([]*Trade, 0)
	remainingQty := order.Quantity

	// Matching loop
	for remainingQty > 0 {
		var opposite *Order

		// Get best opposite order
		if order.Side == SideBuy {
			opposite = me.orderBook.GetBestAsk()
		} else {
			opposite = me.orderBook.GetBestBid()
		}

		// No more matches available
		if opposite == nil {
			break
		}

		// Check if prices cross
		var canMatch bool
		if order.Side == SideBuy {
			canMatch = order.Price >= opposite.Price
		} else {
			canMatch = order.Price <= opposite.Price
		}

		if !canMatch {
			break
		}

		// Execute trade at maker's price (price-time priority)
		tradeQty := min(remainingQty, opposite.Quantity)

		trade := &Trade{
			ID:        uuid.New().String(),
			Price:     opposite.Price, // Taker gets maker's price
			Quantity:  tradeQty,
			Timestamp: time.Now().UnixMilli(),
		}

		// Set buyer/seller based on sides
		if order.Side == SideBuy {
			trade.BuyOrderID = order.ID
			trade.SellOrderID = opposite.ID
			trade.BuyerID = order.UserID
			trade.SellerID = opposite.UserID
		} else {
			trade.BuyOrderID = opposite.ID
			trade.SellOrderID = order.ID
			trade.BuyerID = opposite.UserID
			trade.SellerID = order.UserID
		}

		trades = append(trades, trade)
		remainingQty -= tradeQty

		// Update or remove the resting order
		if opposite.Quantity == tradeQty {
			me.orderBook.RemoveOrder(opposite.ID)
		} else {
			opposite.Quantity -= tradeQty
		}
	}

	// If quantity remains, add to book as resting order
	if remainingQty > 0 {
		restingOrder := &Order{
			ID:        order.ID,
			UserID:    order.UserID,
			Side:      order.Side,
			Price:     order.Price,
			Quantity:  remainingQty,
			Timestamp: order.Timestamp,
		}
		me.orderBook.AddOrder(restingOrder)
		return trades, restingOrder, nil
	}

	return trades, nil, nil
}

// CancelOrder cancels an existing order
func (me *MatchingEngine) CancelOrder(orderID string, userID string) (*Order, error) {
	order := me.orderBook.GetOrderByID(orderID)
	if order == nil {
		return nil, errors.New("order not found")
	}

	if order.UserID != userID {
		return nil, errors.New("not your order")
	}

	removed := me.orderBook.RemoveOrder(orderID)
	return removed, nil
}

// GetOrderBook returns the current order book snapshot
func (me *MatchingEngine) GetOrderBook() *OrderBookSnapshot {
	return &OrderBookSnapshot{
		Bids:      me.orderBook.GetTop10Bids(),
		Asks:      me.orderBook.GetTop10Asks(),
		Timestamp: time.Now().UnixMilli(),
	}
}

// Size returns total active orders in the book.
func (me *MatchingEngine) Size() int {
	return me.orderBook.Size()
}

// Helper function for min
func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
