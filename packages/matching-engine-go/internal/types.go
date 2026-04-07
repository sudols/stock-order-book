package internal

// Side represents the order side (buy or sell)
type Side string

const (
	SideBuy  Side = "buy"
	SideSell Side = "sell"
)

// Order represents a single order in the order book
type Order struct {
	ID        string  `json:"id"`
	UserID    string  `json:"userId"`
	Side      Side    `json:"side"`
	Price     float64 `json:"price"`
	Quantity  float64 `json:"quantity"`
	Timestamp int64   `json:"timestamp"`
}

// Trade represents a completed trade between two orders
type Trade struct {
	ID          string  `json:"id"`
	BuyOrderID  string  `json:"buyOrderId"`
	SellOrderID string  `json:"sellOrderId"`
	BuyerID     string  `json:"buyerId"`
	SellerID    string  `json:"sellerId"`
	Price       float64 `json:"price"`
	Quantity    float64 `json:"quantity"`
	Timestamp   int64   `json:"timestamp"`
}

// PlaceOrderResponse is the response returned when placing an order
type PlaceOrderResponse struct {
	Trades         []*Trade `json:"trades"`
	RemainingOrder *Order   `json:"remainingOrder,omitempty"`
	Error          string   `json:"error,omitempty"`
}

// CancelOrderRequest is the request to cancel an order
type CancelOrderRequest struct {
	OrderID string `json:"orderId"`
	UserID  string `json:"userId"`
}

// CancelOrderResponse is the response when canceling an order
type CancelOrderResponse struct {
	Order *Order `json:"order,omitempty"`
	Error string `json:"error,omitempty"`
}

// OrderBookSnapshot represents the current state of the order book
type OrderBookSnapshot struct {
	Bids      []*Order `json:"bids"`
	Asks      []*Order `json:"asks"`
	Timestamp int64    `json:"timestamp"`
}
