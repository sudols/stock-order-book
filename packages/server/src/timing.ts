/**
 * timing.ts — Orders-per-second timing script.
 *
 * Measures how long the matching engine takes to execute N trades
 * using a sweep: N resting sell orders are pre-loaded onto the book,
 * then buy orders sweep through all of them in chunks.
 *
 * Chunked sweep: the engine rejects any single order with qty > 10,000,
 * so for N > 10,000 the sweep is split into slices of CHUNK_SIZE.
 * A single buyer covers all chunks — at PRICE=$0.01 the total cost is
 * N × $0.01, staying within the $10,000 default for N ≤ 1,000,000.
 *
 * Only the sweep placeOrder calls are timed — setup is excluded.
 *
 * OUTPUT: Tab-separated (TSV).
 *
 * Usage: pnpm --filter @orderbook/server timing
 */

import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';
import { OrderBook } from './orderbook.js';
import { PortfolioManager } from './portfolio-manager.js';
import { MatchingEngine } from './matching-engine.js';
import type { Order } from '@orderbook/shared';

// Config
const TRADE_COUNTS = [10, 100, 1000, 5000, 10000, 100_000 /*, 1_000_000 */];
const RUNS_PER_N = 3;
const PRICE = 0.01;
// Engine hard limit per single order quantity.
const CHUNK_SIZE = 10_000;
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a fresh engine with N resting sell orders already on the book.
 * Returns the engine and the list of chunked sweep buy orders to place.
 */
function setupEngine(n: number): {
	engine: MatchingEngine;
	sweepOrders: Order[];
} {
	const orderBook = new OrderBook();
	const pm = new PortfolioManager();
	const engine = new MatchingEngine(orderBook, pm);

	// N sellers with 1 quantity each at $PRICE, ready to be swept.
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

	// Split the sweep into slices of CHUNK_SIZE (engine qty limit per order).
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
function measureOnce(n: number): number {
	const { engine, sweepOrders } = setupEngine(n);

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
function measure(n: number): number {
	let total = 0;
	for (let r = 0; r < RUNS_PER_N; r++) {
		total += measureOnce(n);
	}
	return total / RUNS_PER_N;
}

function main(): void {
	console.log('Stock Order Book — Orders/sec Timing');
	console.log(
		`Sweep scenario | Price: $${PRICE} | Runs per N: ${RUNS_PER_N} | Chunk size: ${CHUNK_SIZE}`,
	);
	console.log('');

	// JIT warming on smallest N before official timing runs, to reduce noise from compilation during the timed runs.
	const warmupN = Math.min(...TRADE_COUNTS);
	process.stdout.write(`Warming up (N=${warmupN})... `);
	measureOnce(warmupN);
	console.log('done\n');
	console.log(['N', 'Time (ms)', 'Orders/sec'].join('\t'));

	for (const n of TRADE_COUNTS) {
		// if (n >= 100_000) {
		//   process.stderr.write(`  (N=${n.toLocaleString()} — this may take a while due to O(N²) splice overhead in OrderBook)\n`);
		// }
		const avgMs = measure(n);
		const ordersPerSec = Math.round(n / (avgMs / 1000));
		const timeFormatted = avgMs.toFixed(3);
		console.log([n, timeFormatted, ordersPerSec].join('\t'));
	}

	console.log('');
}

main();
