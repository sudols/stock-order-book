import { io } from 'socket.io-client';
import type { OrderBookSnapshot, Order } from '@orderbook/shared';

const SERVER_URL = 'http://localhost:3001';
const SYMBOL = 'STOCK';
const ROWS = 10;

// Formatting helpers
const fmt = {
	price: (n: number) => `$${n.toFixed(2)}`,
	qty: (n: number) => String(n),
	time: (ts: number) => new Date(ts).toTimeString().slice(0, 12), // HH:MM:SS.mmm
	pad: (s: string, w: number, right = false) =>
		right ? s.padStart(w) : s.padEnd(w),
};

const LINE_WIDTH = 49;

function hr(left = '╠', mid = '╬', right = '╣', fill = '═') {
	const half = Math.floor((LINE_WIDTH - 2) / 2);
	return (
		left + fill.repeat(half) + mid + fill.repeat(LINE_WIDTH - 2 - half) + right
	);
}

function row(leftCell: string, rightCell: string) {
	const half = Math.floor((LINE_WIDTH - 2) / 2);
	const l = leftCell.padEnd(half);
	const r = rightCell.padEnd(LINE_WIDTH - 2 - half);
	return `║${l}${r}║`;
}

function center(text: string) {
	const inner = LINE_WIDTH - 2;
	const pad = Math.max(0, inner - text.length);
	const left = Math.floor(pad / 2);
	const right = pad - left;
	return `║${' '.repeat(left)}${text}${' '.repeat(right)}║`;
}

function top() {
	return '╔' + '═'.repeat(LINE_WIDTH - 2) + '╗';
}
function bottom() {
	return '╚' + '═'.repeat(LINE_WIDTH - 2) + '╝';
}

// ── Render ───────────────────────────────────────────────
function render(snap: OrderBookSnapshot) {
	const lines: string[] = [];

	lines.push(top());
	lines.push(center(`${fmt.time(snap.timestamp)}`));
	lines.push(hr('╠', '╦', '╣'));
	lines.push(row('  BIDS', '  ASKS'));
	lines.push(row('  Price      Qty', '  Price      Qty'));
	lines.push(hr());

	const maxRows = Math.max(snap.bids.length, snap.asks.length, ROWS);

	for (let i = 0; i < Math.min(maxRows, ROWS); i++) {
		const bid: Order | undefined = snap.bids[i];
		const ask: Order | undefined = snap.asks[i];

		const bidCell = bid
			? `  ${fmt.pad(fmt.price(bid.price), 9)}  ${fmt.pad(fmt.qty(bid.quantity), 4)}`
			: '';
		const askCell = ask
			? `  ${fmt.pad(fmt.price(ask.price), 9)}  ${fmt.pad(fmt.qty(ask.quantity), 4)}`
			: '';

		lines.push(row(bidCell, askCell));
	}

	const bestBid = snap.bids[0]?.price;
	const bestAsk = snap.asks[0]?.price;
	const spread =
		bestBid != null && bestAsk != null ? fmt.price(bestAsk - bestBid) : 'N/A';

	lines.push(hr('╠', '╩', '╣'));
	lines.push(
		row(
			`  Spread: ${spread}`,
			`  Bid: ${bestBid != null ? fmt.price(bestBid) : 'N/A'}  Ask: ${bestAsk != null ? fmt.price(bestAsk) : 'N/A'}`,
		),
	);
	lines.push(bottom());
	lines.push('  Press Ctrl+C to exit');

	process.stdout.write('\x1Bc'); // clear screen (works cross-platform)
	console.log(lines.join('\n'));
}

// Main
console.log(`Connecting to ${SERVER_URL}...`);

const socket = io(SERVER_URL, { transports: ['websocket'] });

socket.on('connect', () => {
	// Initial snapshot is emitted by the server immediately on connect — nothing to do here.
});

socket.on('connect_error', (err: Error) => {
	console.error(`\nCould not connect to server at ${SERVER_URL}`);
	console.error(
		`Make sure the server is running: pnpm --filter @orderbook/server dev`,
	);
	console.error(`Error: ${err.message}`);
	process.exit(1);
});

socket.on('orderbook', (snap: OrderBookSnapshot) => {
	render(snap);
});

process.on('SIGINT', () => {
	socket.disconnect();
	process.stdout.write('\x1Bc');
	console.log('Disconnected. Bye.');
	process.exit(0);
});
