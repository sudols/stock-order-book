/**
 * timing.ts — Multi-Variant Performance Comparison
 *
 * Measures how different OrderBook implementations perform under the same workload.
 * Tests 3 variants:
 *   1. Naive: full sorted arrays, O(n log n) inserts
 *   2. Baseline: current Map<price, Order[]> + sorted price levels
 *   3. Optimized: linked queue per price level, O(1) removal
 *
 * Workload: Sweep scenario — N resting sell orders, then buy orders sweep through.
 *
 * OUTPUT: Comparison table showing time and throughput per variant.
 *
 * Usage: pnpm --filter @orderbook/server timing
 */

import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';
import type { Order } from '@orderbook/shared';
import { PortfolioManager } from './portfolio-manager.js';
import { MatchingEngine } from './matching-engine.js';

// Config
const TRADE_COUNTS = [10, 100, 500, 1000, 2500, 5000, 10000];
const RUNS_PER_N = 2;
const PRICE = 0.01;
const CHUNK_SIZE = 10_000; // Engine hard limit per single order quantity

// Variant definitions
const VARIANTS = [
	{ name: 'Naive', path: './orderbook-naive.js' },
	{ name: 'Baseline', path: './orderbook.js' },
	{ name: 'Optimized', path: './orderbook-optimized.js' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────

interface BenchResult {
	n: number;
	avgMs: number;
	ordersPerSec: number;
}

/**
 * Build a fresh engine with N resting sell orders already on the book.
 * Returns the engine and the list of chunked sweep buy orders to place.
 */
async function setupEngine(
	OrderBookClass: any,
	n: number,
): Promise<{
	engine: MatchingEngine;
	sweepOrders: Order[];
}> {
	const orderBook = new OrderBookClass();
	const pm = new PortfolioManager();
	const engine = new MatchingEngine(orderBook, pm);

	// N sellers with 1 quantity each at $PRICE
	for (let i = 0; i < n; i++) {
		const sellerId = `seller-${i}`;
		pm.initializeUser(sellerId);
		const result = engine.placeOrder({
			id: uuidv4(),
			userId: sellerId,
			side: 'sell',
			price: PRICE,
			quantity: 1,
			timestamp: Date.now(),
		});
		if ('error' in result) {
			throw new Error(`Setup failed at sell order ${i}: ${result.error}`);
		}
	}

	const buyerId = 'bench-buyer';
	pm.initializeUser(buyerId);

	// Split the sweep into slices of CHUNK_SIZE
	const sweepOrders: Order[] = [];
	let remaining = n;
	while (remaining > 0) {
		const qty = Math.min(remaining, CHUNK_SIZE);
		sweepOrders.push({
			id: uuidv4(),
			userId: buyerId,
			side: 'buy',
			price: PRICE,
			quantity: qty,
			timestamp: Date.now(),
		});
		remaining -= qty;
	}

	return { engine, sweepOrders };
}

/**
 * Time a single full sweep for N trades (all chunks combined).
 * Returns elapsed milliseconds.
 */
async function measureOnce(OrderBookClass: any, n: number): Promise<number> {
	const { engine, sweepOrders } = await setupEngine(OrderBookClass, n);

	let totalTrades = 0;
	const start = performance.now();
	for (const order of sweepOrders) {
		const result = engine.placeOrder(order);
		if ('error' in result) {
			throw new Error(`Sweep failed for N=${n}: ${result.error}`);
		}
		totalTrades += result.success?.trades.length ?? 0;
	}
	const end = performance.now();

	if (totalTrades !== n) {
		throw new Error(`Expected ${n} trades, got ${totalTrades}`);
	}

	return end - start;
}

/**
 * Run measureOnce RUNS_PER_N times and return the average elapsed ms.
 */
async function measure(OrderBookClass: any, n: number): Promise<number> {
	let total = 0;
	for (let r = 0; r < RUNS_PER_N; r++) {
		total += await measureOnce(OrderBookClass, n);
	}
	return total / RUNS_PER_N;
}

/**
 * Benchmark one variant across all N values.
 */
async function benchmarkVariant(
	name: string,
	OrderBookClass: any,
): Promise<BenchResult[]> {
	const results: BenchResult[] = [];

	// Warmup run on smallest N
	const warmupN = Math.min(...TRADE_COUNTS);
	await measureOnce(OrderBookClass, warmupN);

	for (const n of TRADE_COUNTS) {
		const avgMs = await measure(OrderBookClass, n);
		const ordersPerSec = Math.round(n / (avgMs / 1000));
		results.push({ n, avgMs, ordersPerSec });
	}

	return results;
}

/**
 * Format number with thousand separators
 */
function formatNumber(num: number): string {
	return num.toLocaleString();
}

/**
 * Main entry point — benchmark all variants and output comparison
 */
async function main(): Promise<void> {
	console.log('Stock Order Book — Performance Comparison');
	console.log('==========================================');
	console.log(
		`Sweep scenario | Price: $${PRICE} | Runs per N: ${RUNS_PER_N} | Chunk size: ${CHUNK_SIZE}`,
	);
	console.log('');

	// Benchmark each variant
	for (const variant of VARIANTS) {
		console.log(`\n=== Benchmarking: ${variant.name} ===`);
		const { OrderBook } = await import(variant.path);

		console.log('N\tTime (ms)\tOrders/sec');

		const results = await benchmarkVariant(variant.name, OrderBook);

		// Print individual results
		for (const result of results) {
			console.log(
				`${result.n}\t${result.avgMs.toFixed(3)}\t${formatNumber(result.ordersPerSec)}`,
			);
		}
	}
}

main().catch((err) => {
	console.error('Benchmark failed:', err);
	process.exit(1);
});
