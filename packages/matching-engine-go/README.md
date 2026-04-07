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
- **Time**: ~18ms
- **Throughput**: ~550k orders/sec
- **Per-order latency**: ~1.8 µs

### Compare with TypeScript

```bash
# From project root
./compare-benchmarks.sh
```

This runs both TypeScript and Go benchmarks side-by-side.

## Performance

Measured improvements over TypeScript:
- **2-4x faster** than TypeScript Baseline
- **Per-order latency**: ~1.8 µs (vs ~5-10 µs in TS)
- **Lower memory usage**: ~50% less
- **Better concurrency**: Native goroutine support
