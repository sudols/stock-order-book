import 'dotenv/config';

// Config
const BOT_SECRET_KEY = process.env.BOT_SECRET_KEY || 'mock-market-maker-bot';
const SPREAD = 2; // $2 spread
const BASE_PRICE = 90;
const ORDER_SIZE_MIN = 1;
const ORDER_SIZE_MAX = 5;
const INTERVAL_MS = 200; // New orders every 200ms

// Utils
const randomInt = (min: number, max: number) =>
	Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MarketMakerController {
	private activeUntil: number = 0;

	activate(durationMs: number) {
		this.activeUntil = Date.now() + durationMs;
	}

	extend(durationMs: number) {
		if (this.checkActive()) {
			this.activeUntil += durationMs;
		} else {
			this.activeUntil = Date.now() + durationMs;
		}
	}

	checkActive(): boolean {
		return Date.now() < this.activeUntil;
	}
}

export const marketMakerController = new MarketMakerController();

async function placeOrder(
	apiUrl: string,
	side: 'buy' | 'sell',
	price: number,
	quantity: number,
) {
	try {
		const response = await fetch(`${apiUrl}/placeOrder`, {
			method: 'POST',
			headers: { 
				'Content-Type': 'application/json',
				'x-bot-secret': BOT_SECRET_KEY
			},
			body: JSON.stringify({
				token: BOT_SECRET_KEY,
				side,
				price,
				quantity,
			}),
		});

		if (!response.ok) {
			const txt = await response.text();
			console.error(`[Market Maker] Order failed: ${txt}`);
		} else {
			await response.json();
		}
	} catch (err) {
		console.error('[Market Maker] Network error placing order:', err);
	}
}

export async function startMarketMaker(apiUrl: string) {
	console.log(`   Market Maker Bot starting in on-demand mode...`);
	console.log(`   Target: ${apiUrl}`);
	console.log(`   Spread: $${SPREAD}`);
	console.log(`   Interval: ${INTERVAL_MS}ms`);

	let currentPrice = BASE_PRICE;

	// Let it start active for 1 minute on boot so it's already trading when they first load
	// marketMakerController.activate(60 * 1000);

	while (true) {
		try {
			if (marketMakerController.checkActive()) {
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
				placeOrder(apiUrl, 'buy', bidPrice, qty);
				placeOrder(apiUrl, 'sell', askPrice, qty);

				await sleep(INTERVAL_MS);
			} else {
				// When paused/idle, check status every 1.5 seconds to save CPU cycles
				await sleep(1500);
			}
		} catch (e) {
			console.error('[Market Maker] Loop error:', e);
			await sleep(1000);
		}
	}
}

// Check if run directly from CLI
const isDirectRun = process.argv[1]?.includes('market-maker') || false;
if (isDirectRun) {
	const defaultApiUrl = process.env.API_URL || 'http://localhost:3001/trpc';
	// If run directly, run permanently (unlimited lease)
	marketMakerController.activate(100 * 365 * 24 * 60 * 60 * 1000); // 100 years lease!
	startMarketMaker(defaultApiUrl);
}
