# Go Matching Engine Integration

This document explains how the Go matching engine integrates with the Node.js backend.

## Architecture Overview

```
┌─────────────────────────────────────┐
│   React Frontend (unchanged)        │
└────────────┬────────────────────────┘
             │ HTTP + WebSocket
┌────────────▼────────────────────────┐
│   Node.js Server (port 3001)        │
│   ┌───────────────────────────────┐ │
│   │ tRPC API                      │ │
│   │ • Firebase Auth               │ │
│   │ • PortfolioManager (JS)       │ │
│   └──────────┬────────────────────┘ │
│              │                       │
│   ┌──────────▼────────────────────┐ │
│   │ GoMatchingEngineClient        │ │
│   │ (HTTP client via axios)       │ │
│   └──────────┬────────────────────┘ │
└──────────────┼─────────────────────┘
               │ HTTP/JSON (localhost:8080)
┌──────────────▼─────────────────────┐
│   Go HTTP Server (port 8080)       │
│   ┌──────────────────────────────┐ │
│   │ POST /place-order            │ │
│   │ POST /cancel-order           │ │
│   │ GET  /orderbook              │ │
│   │ GET  /health                 │ │
│   └──────────┬───────────────────┘ │
│              │                      │
│   ┌──────────▼───────────────────┐ │
│   │ MatchingEngine               │ │
│   │ • OrderBook (Go)             │ │
│   │ • Price-time matching        │ │
│   └──────────────────────────────┘ │
└────────────────────────────────────┘
```

## Communication Protocol

### HTTP/JSON over localhost

- **Protocol**: HTTP/1.1
- **Format**: JSON
- **Port**: 8080 (Go service)
- **Latency**: ~50-100 microseconds per request

### Request Flow Example

1. User places order via React UI
2. React → tRPC mutation → Node.js
3. Node.js validates auth & portfolio
4. Node.js → HTTP POST → Go service
5. Go processes order (fast matching)
6. Go → HTTP response → Node.js
7. Node.js updates portfolios
8. Node.js broadcasts via WebSocket
9. React UI updates

## Running the System

### Development Mode

1. **Start Go Service** (Terminal 1):
   ```bash
   cd packages/matching-engine-go
   go run main.go
   ```

2. **Start Node.js Server** (Terminal 2):
   ```bash
   cd packages/server
   USE_GO_ENGINE=true pnpm dev
   ```

3. **Start Frontend** (Terminal 3):
   ```bash
   cd packages/client
   pnpm dev
   ```

### Production Build

```bash
# Build Go binary
cd packages/matching-engine-go
go build -o matching-engine

# Node.js will spawn this binary automatically
cd ../server
pnpm start
```

## Environment Variables

Create `.env` in `packages/server/`:

```env
USE_GO_ENGINE=true              # Use Go engine (set to false for TypeScript)
GO_SERVICE_URL=http://localhost:8080  # Go service endpoint
PORT=3001                       # Node.js server port
```

## Switching Between Engines

The system supports both Go and TypeScript engines:

```bash
# Use Go engine (default)
USE_GO_ENGINE=true pnpm dev

# Use TypeScript engine (fallback)
USE_GO_ENGINE=false pnpm dev
```

This allows easy comparison and benchmarking.

## What Changed

### New Files
- `packages/matching-engine-go/` - Complete Go implementation
- `packages/server/src/go-client.ts` - HTTP client for Go service

### Modified Files
- `packages/server/src/index.ts` - Spawns Go process, connects client
- `packages/server/src/routers/app.ts` - Uses async Go client API

### Unchanged
- Frontend (React) - No changes needed
- PortfolioManager - Still in Node.js
- Authentication - Still Firebase in Node.js
- WebSocket broadcasting - Still Socket.io

## Performance Comparison

Expected improvements with Go engine:

| Operation | TypeScript | Go | Speedup |
|-----------|-----------|-----|---------|
| Single order match | ~50-100 µs | ~2-5 µs | **20-50x** |
| 1,000 orders/sec | Possible | Easy | - |
| 10,000 orders/sec | Struggles | Comfortable | **Much better** |
| Memory usage | Higher (V8) | Lower | **~50% less** |

## Testing the Integration

### Manual Test

```bash
# Test Go service directly
curl -X POST http://localhost:8080/place-order \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-1",
    "userId": "user1",
    "side": "buy",
    "price": 100,
    "quantity": 10,
    "timestamp": 1234567890
  }'
```

### Health Check

```bash
# Check Node.js server
curl http://localhost:3001/health

# Check Go service
curl http://localhost:8080/health
```

## Troubleshooting

### Go service won't start
- Ensure Go is installed: `go version`
- Check port 8080 is free: `lsof -i :8080`
- Check Go code compiles: `cd packages/matching-engine-go && go build`

### Connection errors
- Verify Go service is running on port 8080
- Check `USE_GO_ENGINE=true` in environment
- Review Node.js logs for connection attempts

### Performance not improved
- Ensure using production Go build: `go build -ldflags="-s -w"`
- Check not running in debug mode
- Verify localhost communication (no network overhead)

## Future Improvements

- [ ] Add gRPC for even faster communication
- [ ] Move PortfolioManager to Go for atomicity
- [ ] Add request batching for higher throughput
- [ ] Implement shared memory IPC for zero-copy
- [ ] Add comprehensive benchmarks
