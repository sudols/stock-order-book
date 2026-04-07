# Stock Order Book

A real-time stock order book application demonstrating high-performance order matching with both TypeScript and Go implementations.

## 🚀 Features

- **Dual Engine Support**: Choose between TypeScript or Go matching engine
- **Real-time Updates**: WebSocket-based order book synchronization
- **Dual Engine Evaluation**: Compare TypeScript and Go matching engines with shared benchmarks
- **Price-Time Priority**: Standard exchange matching algorithm
- **Portfolio Management**: Track user balances and prevent invalid trades
- **Firebase Authentication**: Secure user authentication

## 📦 Architecture

```
┌─────────────────────────────────────┐
│   React Frontend (Vite + React)     │
│   - Zustand state management        │
│   - Tailwind CSS styling            │
│   - tRPC client + Socket.io         │
└────────────┬────────────────────────┘
             │ HTTP/WebSocket
┌────────────▼────────────────────────┐
│   Node.js Backend (Express)         │
│   - tRPC API                        │
│   - Firebase Auth                   │
│   - PortfolioManager                │
└────────────┬────────────────────────┘
             │ HTTP/JSON
┌────────────▼────────────────────────┐
│   Matching Engine (Go or TypeScript)│
│   - OrderBook (maps + sorted arrays)│
│   - Price-time priority matching    │
└─────────────────────────────────────┘
```

## 🏃 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Go 1.21+ (for Go engine)
- Firebase project (for authentication)

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp packages/server/.env.example packages/server/.env
# Edit .env with your Firebase credentials
```

### Running with Go Engine (Recommended)

**Terminal 1 - Start Go matching engine:**
```bash
cd packages/matching-engine-go
go run main.go
```

**Terminal 2 - Start Node.js backend:**
```bash
cd packages/server
USE_GO_ENGINE=true pnpm dev
```

**Terminal 3 - Start React frontend:**
```bash
cd packages/client
pnpm dev
```

### Running with TypeScript Engine (Fallback)

```bash
# Terminal 1 - Backend only
cd packages/server
USE_GO_ENGINE=false pnpm dev

# Terminal 2 - Frontend
cd packages/client
pnpm dev
```

## 📊 Performance Benchmarks

### Compare All Implementations

Run comprehensive benchmarks comparing TypeScript variants and Go:

```bash
# From project root - runs both TS and Go benchmarks
./compare-benchmarks.sh
```

### Individual Benchmarks

**TypeScript (3 variants: Naive, Baseline, Optimized):**
```bash
cd packages/server
pnpm timing
```

**Go (Pure performance, no HTTP):**
```bash
cd packages/matching-engine-go
go run cmd/benchmark/main.go
```

**Go via HTTP (Real-world integration):**
```bash
cd packages/server
tsx benchmark.ts
```

### Benchmark Results (N=10,000 orders)

| Implementation | Time (ms) | Orders/sec | Per-Order (µs) |
|----------------|-----------|------------|----------------|
| **TypeScript Naive** | ~42.8 | 233k | ~4.28 |
| **TypeScript Baseline** | ~9.7 | 1.0M | ~0.97 |
| **TypeScript Optimized** | ~5.7 | 1.75M | ~0.57 |
| **Go Direct** | ~22.7 | 441k | ~2.27 |
| **Go via HTTP** | Varies by network/JSON overhead | Varies | Includes transport + serialization cost |

**Key Insights:**
- **Go Direct**: Low-microsecond latency and isolated process model
- **Go via HTTP**: Real-world integration, includes ~50-100µs network overhead
- **TS Optimized**: Advanced data structures, best for specific workloads
- **Go Benefits**: Better concurrency, lower memory, type safety

## 🧪 Testing

### Manual API Testing

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

# Check health
curl http://localhost:3001/health
curl http://localhost:8080/health
```

### Run Tests

```bash
# Backend tests
cd packages/server
pnpm test

# Frontend tests
cd packages/client
pnpm test
```

## 📁 Project Structure

```
/
├── packages/
│   ├── client/              # React frontend
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── store.ts     # Zustand state
│   │   │   └── trpc.ts      # tRPC client setup
│   │   └── package.json
│   │
│   ├── server/              # Node.js backend
│   │   ├── src/
│   │   │   ├── routers/     # tRPC routers
│   │   │   ├── middleware/  # Auth middleware
│   │   │   ├── go-client.ts # Go service client
│   │   │   ├── orderbook.ts # TypeScript OrderBook
│   │   │   └── matching-engine.ts # TypeScript engine
│   │   ├── benchmark.ts     # Performance benchmarks
│   │   └── package.json
│   │
│   ├── matching-engine-go/  # Go matching engine
│   │   ├── internal/
│   │   │   ├── types.go
│   │   │   ├── orderbook.go
│   │   │   └── matching_engine.go
│   │   ├── main.go          # HTTP server
│   │   └── go.mod
│   │
│   └── shared/              # Shared TypeScript types
│       └── src/types.ts
│
├── docs/                    # Documentation
│   ├── go-integration.md    # Go integration guide
│   ├── order-matching-system.md
│   └── technical-architecture.md
│
├── IMPLEMENTATION_SUMMARY.md # Implementation overview
└── package.json             # Root workspace config
```

## 🔧 Configuration

### Environment Variables

Create `packages/server/.env`:

```env
# Server
PORT=3001

# Go Engine
USE_GO_ENGINE=true
GO_SERVICE_URL=http://localhost:8080

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key
```

## 📚 Documentation

- [Go Integration Guide](docs/go-integration.md) - Detailed integration documentation
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - Complete implementation overview
- [Order Matching System](docs/order-matching-system.md) - Algorithm explanation
- [Technical Architecture](docs/technical-architecture.md) - System design

## 🎯 Key Features Explained

### OrderBook Data Structure

- **Hybrid approach**: Maps for O(1) lookups + sorted arrays for best bid/ask
- **Price-level grouping**: Orders at same price stored in FIFO order
- **Binary search insertions**: O(log p) where p = number of distinct price levels

### Matching Algorithm

1. **Price Priority**: Better prices execute first
2. **Time Priority**: Earlier orders at same price execute first
3. **Maker Price**: Trades execute at the resting order's price
4. **Partial Fills**: Orders can be partially matched

### Communication Protocol

- **HTTP/JSON**: Simple, debuggable protocol between Node.js and Go
- **Localhost**: No network overhead, ~50-100 µs latency
- **Async**: Non-blocking communication with async/await

## 🚧 Troubleshooting

### Go service won't start
```bash
# Check Go installation
go version

# Check port availability
lsof -i :8080

# Try building
cd packages/matching-engine-go
go build
```

### Connection errors
```bash
# Verify Go service is running
curl http://localhost:8080/health

# Check Node.js environment
echo $USE_GO_ENGINE

# Review logs
cd packages/server
USE_GO_ENGINE=true pnpm dev
```

### Performance issues
- Use production Go build: `go build -ldflags="-s -w"`
- Ensure not running in debug mode
- Check system resources (CPU, memory)

## 🤝 Contributing

This is an academic project demonstrating multi-language integration and performance optimization.

## 📄 License

MIT

## 🎓 Academic Context

This project demonstrates:
- Multi-language system integration
- Performance optimization through language choice
- Microservice architecture patterns
- Real-time data synchronization
- Clean API design and separation of concerns

See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for detailed academic context.
