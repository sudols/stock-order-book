# Go Matching Engine

High-performance order matching engine written in Go, replacing the TypeScript implementation.

## Architecture

This service provides an HTTP/JSON API for order matching operations:
- **POST /place-order** - Place a new order and match it against the book
- **POST /cancel-order** - Cancel an existing order
- **GET /orderbook** - Get current order book snapshot
- **GET /health** - Health check endpoint

## Communication

Communicates with Node.js backend via HTTP/JSON over localhost:8080.

## Running

```bash
go run main.go
```

## Building

```bash
go build -o matching-engine
./matching-engine
```

## Benchmarking

### Pure Go Performance (No HTTP)

Run the direct benchmark to measure raw matching engine performance:

```bash
go run cmd/benchmark/main.go
```

This runs the same "sweep scenario" as the TypeScript benchmarks for apples-to-apples comparison.

**Sample Results (N=10,000 orders):**
- **Time**: ~7.5ms
- **Throughput**: ~1.3M orders/sec
- **Per-order latency**: ~0.75 µs

### Compare with TypeScript

```bash
# From project root
./compare-benchmarks.sh
```

This runs both TypeScript and Go benchmarks side-by-side.

## Performance

The Go implementation uses the same optimized data structures as TypeScript Optimized:
- Doubly-linked lists per price level for O(1) order removals
- Sorted price-level arrays for fast best bid/ask lookup
- Hash map for O(1) order lookup by ID

Measured performance:
- **~1.5x faster** than TypeScript Baseline
- **Competitive** with TypeScript Optimized (~1.6x slower due to mutex overhead)
- **Per-order latency**: ~0.75 µs
- **Throughput**: ~1.3M orders/sec
- **Lower memory usage**: ~50% less than Node.js
- **Better concurrency**: Native goroutine support with thread-safe operations
