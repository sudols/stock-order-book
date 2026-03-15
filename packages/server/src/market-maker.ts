import 'dotenv/config';

// Config
const API_URL = 'http://localhost:3001/trpc';
const BOT_ID = 'mock-market-maker-bot';
const SPREAD = 2; // $2 spread
const BASE_PRICE = 100;
const ORDER_SIZE_MIN = 1;
const ORDER_SIZE_MAX = 5;
const INTERVAL_MS = 200; // New orders every 200ms

// Utils
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function placeOrder(side: 'buy' | 'sell', price: number, quantity: number) {
  try {
    const response = await fetch(`${API_URL}/placeOrder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: BOT_ID,
        side,
        price,
        quantity,
      }),
    });

    if (!response.ok) {
        const txt = await response.text();
        console.error(`❌ Order failed: ${txt}`);
    } else {
        const json = await response.json();
        console.log(`✅ ${side.toUpperCase()} ${quantity} @ $${price}`);
    }
  } catch (err) {
    console.error('Network error:', err);
  }
}

async function run() {
  console.log(`🤖 Market Maker Bot starting...`);
  console.log(`   Target: ${API_URL}`);
  console.log(`   Spread: $${SPREAD}`);
  console.log(`   Interval: ${INTERVAL_MS}ms`);

  let currentPrice = BASE_PRICE;

  while (true) {
    // Random walk price
    const move = Math.random() > 0.5 ? 1 : -1;
    currentPrice += move;
    if (currentPrice < 50) currentPrice = 50;
    if (currentPrice > 150) currentPrice = 150;

    // Calculate Bid/Ask
    const bidPrice = currentPrice - Math.floor(SPREAD / 2);
    const askPrice = currentPrice + Math.ceil(SPREAD / 2);

    // Place Orders
    const qty = randomInt(ORDER_SIZE_MIN, ORDER_SIZE_MAX);
    
    // Fire and forget
    placeOrder('buy', bidPrice, qty);
    placeOrder('sell', askPrice, qty);

    await sleep(INTERVAL_MS);
  }
}

run();
