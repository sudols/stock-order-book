package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"matching-engine/internal"
)

// Global matching engine instance
var engine *internal.MatchingEngine

func main() {
	// Initialize matching engine
	engine = internal.NewMatchingEngine()

	// Setup HTTP routes
	http.HandleFunc("/place-order", handlePlaceOrder)
	http.HandleFunc("/cancel-order", handleCancelOrder)
	http.HandleFunc("/orderbook", handleGetOrderBook)
	http.HandleFunc("/health", handleHealth)

	// Start server
	log.Println("🚀 Go Matching Engine listening on :8080")
	log.Println("   POST /place-order   - Place a new order")
	log.Println("   POST /cancel-order  - Cancel an order")
	log.Println("   GET  /orderbook     - Get order book snapshot")
	log.Println("   GET  /health        - Health check")

	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

// handlePlaceOrder handles POST /place-order
func handlePlaceOrder(w http.ResponseWriter, r *http.Request) {
	// Only accept POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse JSON body
	var order internal.Order
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Call matching engine
	trades, remaining, err := engine.PlaceOrder(&order)

	// Build response
	response := internal.PlaceOrderResponse{
		Trades:         trades,
		RemainingOrder: remaining,
	}
	if err != nil {
		response.Error = err.Error()
	}

	// Send JSON response
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding response: %v", err)
	}
}

// handleCancelOrder handles POST /cancel-order
func handleCancelOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req internal.CancelOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	order, err := engine.CancelOrder(req.OrderID, req.UserID)

	response := internal.CancelOrderResponse{
		Order: order,
	}
	if err != nil {
		response.Error = err.Error()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleGetOrderBook handles GET /orderbook
func handleGetOrderBook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	snapshot := engine.GetOrderBook()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snapshot)
}

// handleHealth handles GET /health
func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := map[string]interface{}{
		"status":    "ok",
		"orders":    engine.Size(),
		"timestamp": time.Now().UnixMilli(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
