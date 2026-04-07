# Go Matching Engine - Pure Performance Benchmark

This benchmark measures the **raw performance** of the Go matching engine without any HTTP overhead.

## Methodology

Matches the TypeScript `timing.ts` benchmark methodology:

### Sweep Scenario

1. **Setup**: Place N resting **sell** orders at $0.01
2. **Execute**: Place **buy** orders that sweep through all resting orders
3. **Measure**: Time from first buy order to last trade completion

### Test Sizes

- 10, 100, 500, 1K, 2.5K, 5K, 10K orders

### Runs

- Each test runs **2 times** and reports the average
- First run acts as warmup (not included in results)

## Running

```bash
# From matching-engine-go directory
go run cmd/benchmark/main.go

# Or build and run
go build -o benchmark cmd/benchmark/main.go
./benchmark
```

## Output Format

```
N       Time (ms)       Orders/sec      Per-Order (µs)
10      0.005           2,222,222       0.45
100     0.056           1,801,801       0.56
1000    0.771           1,297,016       0.77
10000   7.466           1,339,315       0.75
```

## Comparison with TypeScript

Run both benchmarks:

```bash
# From project root
./compare-benchmarks.sh
```

Or run separately:

```bash
# TypeScript (from packages/server)
pnpm timing

# Go (from packages/matching-engine-go)
go run cmd/benchmark/main.go
```

## Why Direct Testing?

Testing Go **without HTTP** gives us:

1. **Pure algorithm performance** - No network overhead
2. **Fair comparison** - TS also uses direct calls
3. **True potential** - Shows what Go can achieve
4. **Isolation** - Separates matching speed from communication costs

The HTTP integration (via `main.go` server) adds ~50-100µs per request, which is useful for real-world testing but masks the raw speed improvement.

## Expected Results

At N=10,000 orders:

| Metric | TypeScript (Optimized) | Go (Optimized) | Comparison |
|--------|------------------------|----------------|------------|
| **Total Time** | ~4.6 ms | ~7.5 ms | TS ~1.6x faster |
| **Per-Order** | ~0.46 µs | ~0.75 µs | TS ~1.6x faster |
| **Throughput** | 2.1M orders/sec | 1.3M orders/sec | TS ~1.6x higher |

Both implementations now use the same optimized linked-queue data structure for O(1) order removals.

**For baseline comparison:**

| Metric | TypeScript (Baseline) | Go (Optimized) | Speedup |
|--------|----------------------|----------------|---------|
| **Total Time** | ~11.2 ms | ~7.5 ms | 1.5x faster |
| **Per-Order** | ~1.1 µs | ~0.75 µs | 1.5x faster |

## About the Implementation

### Data Structures

**Go Implementation (Optimized):**
- `map[float64]*PriceLevel` for price-level storage
- `PriceLevel` = doubly-linked list of `OrderNode`
- `[]float64` sorted slices for best bid/ask lookup
- `map[string]*OrderNode` for O(1) order lookup by ID
- Binary search for price level insertions: O(log p)
- O(1) order removal (unlink from linked list)
- Thread-safe with `sync.RWMutex`

**TypeScript Optimized:**
- `Map<number, PriceLevel>` for price-level storage
- `PriceLevel` = doubly-linked list of `OrderNode`
- `number[]` sorted arrays for price levels
- `Map<string, OrderNode>` for O(1) order lookup
- Same complexity characteristics as Go

**TypeScript Baseline:**
- `Map<number, Order[]>` for price-level storage
- `number[]` sorted arrays
- O(k) removal within price level (array splice)

### Why Go is Slightly Slower?

The remaining ~1.6x difference is due to:
- V8's JIT compilation optimizes hot paths aggressively
- JavaScript's single-threaded model avoids mutex overhead
- Go's sync.RWMutex adds small overhead for thread safety
- Memory allocation patterns differ between languages

## Conclusion

This benchmark demonstrates that Go provides:
- Competitive performance (within 2x of TypeScript)
- Better concurrency primitives (goroutines vs async)
- Lower memory footprint
- Type safety without runtime overhead
- Excellent for microservice architecture

The Go implementation is now production-ready with:
- Same optimized data structures as TypeScript
- Thread-safe concurrent access
- Predictable latency under load
