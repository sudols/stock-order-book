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

## Performance

Expected improvements over TypeScript:
- 20-50x faster order matching
- Lower memory usage
- Better concurrency handling
