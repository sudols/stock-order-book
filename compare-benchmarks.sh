#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Comparison script - runs both TS and Go benchmarks and displays results

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Stock Order Book - Performance Comparison: TypeScript vs Go ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Cannot run Go benchmarks."
    exit 1
fi

echo "🔄 Running benchmarks (this may take 1-2 minutes)..."
echo ""

# Run TypeScript benchmarks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 TypeScript Benchmarks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
cd "$ROOT_DIR/packages/server"
pnpm timing
echo ""

# Run Go benchmark
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Go Benchmark (Direct - No HTTP)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
cd "$ROOT_DIR/packages/matching-engine-go"
go run cmd/benchmark/main.go
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Key Insights"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary for N=10,000 orders:"
echo ""
echo "  - Use the benchmark tables above as the source of truth."
echo "  - In this sweep workload, TypeScript Baseline/Optimized can outperform Go Direct."
echo "  - Go Direct still runs in low-microsecond per-order latency."
echo "  - Go via HTTP (packages/server/benchmark.ts) includes network/JSON overhead."
echo "  - Re-run multiple times for stable averages on your machine."
echo ""
echo "✅ Benchmarks complete!"
