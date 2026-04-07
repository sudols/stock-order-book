/**
 * Benchmark script to compare TypeScript vs Go matching engine performance
 * 
 * Run with:
 *   tsx benchmark.ts
 */

import { OrderBook as TSOrderBook } from './src/orderbook.js';
import { MatchingEngine as TSMatchingEngine } from './src/matching-engine.js';
import { PortfolioManager } from './src/portfolio-manager.js';
import { GoMatchingEngineClient } from './src/go-client.js';
import type { Order } from '@orderbook/shared';

const ITERATIONS = 10_000;
const TEST_USER = 'benchmark-user';

// Helper to generate random order
function generateOrder(id: number, side: 'buy' | 'sell'): Order {
  return {
    id: `order-${id}`,
    userId: TEST_USER,
    side,
    price: 100 + Math.random() * 10, // Price between 100-110
    quantity: Math.floor(Math.random() * 10) + 1, // 1-10 shares
    timestamp: Date.now(),
  };
}

async function benchmarkTypeScript() {
  console.log('\n📊 Benchmarking TypeScript Matching Engine...\n');
  
  const orderBook = new TSOrderBook();
  const portfolioManager = new PortfolioManager();
  const engine = new TSMatchingEngine(orderBook, portfolioManager);
  
  // Initialize user with lots of funds
  portfolioManager.initializeUser(TEST_USER);
  const portfolio = portfolioManager.getPortfolio(TEST_USER)!;
  portfolio.usd = 1_000_000;
  portfolio.stocks = 100_000;

  const start = performance.now();
  
  for (let i = 0; i < ITERATIONS; i++) {
    const side = i % 2 === 0 ? 'buy' : 'sell';
    const order = generateOrder(i, side);
    engine.placeOrder(order);
  }
  
  const end = performance.now();
  const duration = end - start;
  const avgLatency = duration / ITERATIONS;
  const throughput = (ITERATIONS / duration) * 1000;

  console.log(`Total time: ${duration.toFixed(2)} ms`);
  console.log(`Average latency: ${(avgLatency * 1000).toFixed(2)} µs per order`);
  console.log(`Throughput: ${throughput.toFixed(0)} orders/second`);
  console.log(`Final order book size: ${orderBook.size}`);
  
  return { duration, avgLatency, throughput };
}

async function benchmarkGo() {
  console.log('\n🚀 Benchmarking Go Matching Engine...\n');
  
  const client = new GoMatchingEngineClient();
  
  // Verify connection
  try {
    await client.health();
  } catch (error) {
    console.error('❌ Go service not running. Start it with: cd packages/matching-engine-go && go run main.go');
    process.exit(1);
  }

  const start = performance.now();
  
  for (let i = 0; i < ITERATIONS; i++) {
    const side = i % 2 === 0 ? 'buy' : 'sell';
    const order = generateOrder(i, side);
    await client.placeOrder(order);
  }
  
  const end = performance.now();
  const duration = end - start;
  const avgLatency = duration / ITERATIONS;
  const throughput = (ITERATIONS / duration) * 1000;

  console.log(`Total time: ${duration.toFixed(2)} ms`);
  console.log(`Average latency: ${(avgLatency * 1000).toFixed(2)} µs per order`);
  console.log(`Throughput: ${throughput.toFixed(0)} orders/second`);
  
  const snapshot = await client.getOrderBook();
  console.log(`Final order book size: ${snapshot.bids.length + snapshot.asks.length} (visible)`);
  
  return { duration, avgLatency, throughput };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Stock Order Book - Matching Engine Benchmark');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\nTesting with ${ITERATIONS.toLocaleString()} orders...\n`);

  // Run TypeScript benchmark
  const tsResults = await benchmarkTypeScript();
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Run Go benchmark
  const goResults = await benchmarkGo();

  // Compare results
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Comparison');
  console.log('═══════════════════════════════════════════════════════\n');

  const speedup = tsResults.duration / goResults.duration;
  const latencyImprovement = tsResults.avgLatency / goResults.avgLatency;
  const throughputImprovement = goResults.throughput / tsResults.throughput;

  console.log(`⚡ Overall speedup: ${speedup.toFixed(2)}x faster with Go`);
  console.log(`📉 Latency reduction: ${latencyImprovement.toFixed(2)}x lower`);
  console.log(`📈 Throughput increase: ${throughputImprovement.toFixed(2)}x higher`);
  
  console.log('\n┌────────────────────┬─────────────────┬─────────────────┬──────────┐');
  console.log('│ Metric             │ TypeScript      │ Go              │ Speedup  │');
  console.log('├────────────────────┼─────────────────┼─────────────────┼──────────┤');
  console.log(`│ Total Time         │ ${tsResults.duration.toFixed(2).padStart(12)} ms │ ${goResults.duration.toFixed(2).padStart(12)} ms │ ${speedup.toFixed(2)}x     │`);
  console.log(`│ Avg Latency        │ ${(tsResults.avgLatency * 1000).toFixed(2).padStart(12)} µs │ ${(goResults.avgLatency * 1000).toFixed(2).padStart(12)} µs │ ${latencyImprovement.toFixed(2)}x     │`);
  console.log(`│ Throughput         │ ${tsResults.throughput.toFixed(0).padStart(10)} ops │ ${goResults.throughput.toFixed(0).padStart(10)} ops │ ${throughputImprovement.toFixed(2)}x     │`);
  console.log('└────────────────────┴─────────────────┴─────────────────┴──────────┘\n');

  console.log('✅ Benchmark complete!\n');
}

main().catch(console.error);
