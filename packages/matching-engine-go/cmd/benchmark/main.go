package main

import (
	"fmt"
	"time"

	"matching-engine/internal"

	"github.com/google/uuid"
)

// Config matching timing.ts
var (
	tradeCounts = []int{10, 100, 500, 1000, 2500, 5000, 10000}
	runsPerN    = 2
	price       = 0.01
	chunkSize   = 10000 // Engine hard limit per single order quantity
)

// BenchResult holds benchmark results for a given N
type BenchResult struct {
	N            int
	AvgMs        float64
	OrdersPerSec int
}

// setupEngine creates a fresh engine with N resting sell orders
// Returns the engine and the list of chunked sweep buy orders to place
func setupEngine(n int) (*internal.MatchingEngine, []*internal.Order) {
	engine := internal.NewMatchingEngine()

	// N sellers with 1 quantity each at $price
	for i := 0; i < n; i++ {
		sellerID := fmt.Sprintf("seller-%d", i)

		sellOrder := &internal.Order{
			ID:        uuid.New().String(),
			UserID:    sellerID,
			Side:      internal.SideSell,
			Price:     price,
			Quantity:  1,
			Timestamp: time.Now().UnixMilli(),
		}

		_, _, err := engine.PlaceOrder(sellOrder)
		if err != nil {
			panic(fmt.Sprintf("Setup failed at sell order %d: %v", i, err))
		}
	}

	// Split the sweep into slices of chunkSize
	buyerID := "bench-buyer"
	var sweepOrders []*internal.Order
	remaining := n

	for remaining > 0 {
		qty := remaining
		if qty > chunkSize {
			qty = chunkSize
		}

		sweepOrders = append(sweepOrders, &internal.Order{
			ID:        uuid.New().String(),
			UserID:    buyerID,
			Side:      internal.SideBuy,
			Price:     price,
			Quantity:  float64(qty),
			Timestamp: time.Now().UnixMilli(),
		})

		remaining -= qty
	}

	return engine, sweepOrders
}

// measureOnce times a single full sweep for N trades
// Returns elapsed milliseconds
func measureOnce(n int) float64 {
	engine, sweepOrders := setupEngine(n)

	totalTrades := 0
	start := time.Now()

	for _, order := range sweepOrders {
		trades, _, err := engine.PlaceOrder(order)
		if err != nil {
			panic(fmt.Sprintf("Sweep failed for N=%d: %v", n, err))
		}
		totalTrades += len(trades)
	}

	elapsed := time.Since(start)

	if totalTrades != n {
		panic(fmt.Sprintf("Expected %d trades, got %d", n, totalTrades))
	}

	return float64(elapsed.Microseconds()) / 1000.0 // Convert to milliseconds
}

// measure runs measureOnce runsPerN times and returns the average
func measure(n int) float64 {
	var total float64
	for r := 0; r < runsPerN; r++ {
		total += measureOnce(n)
	}
	return total / float64(runsPerN)
}

// benchmarkGo runs the full benchmark across all N values
func benchmarkGo() []BenchResult {
	var results []BenchResult

	// Warmup run on smallest N
	warmupN := tradeCounts[0]
	_ = measureOnce(warmupN)

	for _, n := range tradeCounts {
		avgMs := measure(n)
		ordersPerSec := int(float64(n) / (avgMs / 1000.0))

		results = append(results, BenchResult{
			N:            n,
			AvgMs:        avgMs,
			OrdersPerSec: ordersPerSec,
		})
	}

	return results
}

// formatNumber formats number with thousand separators
func formatNumber(num int) string {
	if num < 1000 {
		return fmt.Sprintf("%d", num)
	}

	// Simple thousand separator
	str := fmt.Sprintf("%d", num)
	result := ""
	for i, c := range str {
		if i > 0 && (len(str)-i)%3 == 0 {
			result += ","
		}
		result += string(c)
	}
	return result
}

func main() {
	fmt.Println("Stock Order Book — Go Matching Engine Benchmark")
	fmt.Println("=================================================")
	fmt.Printf("Sweep scenario | Price: $%.2f | Runs per N: %d | Chunk size: %d\n", price, runsPerN, chunkSize)
	fmt.Println()

	fmt.Println("=== Benchmarking: Go (Direct) ===")
	fmt.Println("N\tTime (ms)\tOrders/sec\tPer-Order (µs)")

	results := benchmarkGo()

	// Print individual results
	for _, result := range results {
		perOrderUs := (result.AvgMs / float64(result.N)) * 1000.0 // Convert to microseconds
		fmt.Printf("%d\t%.3f\t\t%s\t\t%.2f\n",
			result.N,
			result.AvgMs,
			formatNumber(result.OrdersPerSec),
			perOrderUs,
		)
	}

	fmt.Println()
	fmt.Println("✅ Benchmark complete!")
	fmt.Println()
	fmt.Println("Compare with TypeScript benchmarks using:")
	fmt.Println("  cd ../server && pnpm timing")
}
