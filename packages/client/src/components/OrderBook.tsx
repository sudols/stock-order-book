import { useStore } from '../store';
import type { Order } from '@orderbook/shared';

export function OrderBookView() {
	const bids = useStore((s) => s.bids);
	const asks = useStore((s) => s.asks);

	const maxQty = Math.max(
		...bids.map((o) => o.quantity),
		...asks.map((o) => o.quantity),
		1,
	);

	return (
		<div className="glass-card p-5">
			<h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
				<span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
				Order Book
			</h2>

			{/* Header row */}
			<div className="grid grid-cols-3 gap-2 text-xs text-[var(--text-muted)] font-medium mb-2 px-2">
				<span>Price ($)</span>
				<span className="text-center">Qty</span>
				<span className="text-right">Total</span>
			</div>

			{/* ── Asks (reversed so lowest ask is at bottom) ── */}
			<div className="mb-1 space-y-[2px]">
				{[...asks].reverse().map((order) => (
					<OrderRow key={order.id} order={order} side="sell" maxQty={maxQty} />
				))}
				{asks.length === 0 && (
					<div className="text-center text-sm text-[var(--text-muted)] py-3">
						No asks
					</div>
				)}
			</div>

			{/* ── Spread ── */}
			<div className="border-y border-[var(--border)] py-2 px-2 my-1 flex justify-between text-xs">
				<span className="text-[var(--text-muted)]">Spread</span>
				<span className="mono font-medium">
					{bids.length > 0 && asks.length > 0
						? `$${(asks[0].price - bids[0].price).toFixed(2)}`
						: '—'}
				</span>
			</div>

			{/* ── Bids ── */}
			<div className="mt-1 space-y-[2px]">
				{bids.map((order) => (
					<OrderRow key={order.id} order={order} side="buy" maxQty={maxQty} />
				))}
				{bids.length === 0 && (
					<div className="text-center text-sm text-[var(--text-muted)] py-3">
						No bids
					</div>
				)}
			</div>
		</div>
	);
}

// ─── Single Row ────────────────────────────────────────
function OrderRow({
	order,
	side,
	maxQty,
}: {
	order: Order;
	side: 'buy' | 'sell';
	maxQty: number;
}) {
	const depthPct = (order.quantity / maxQty) * 100;
	const isBid = side === 'buy';

	return (
		<div className="relative rounded-md overflow-hidden">
			{/* Depth bar */}
			<div
				className={`absolute inset-0 ${isBid ? 'depth-bar-bid' : 'depth-bar-ask'}`}
				style={{ width: `${depthPct}%`, [isBid ? 'left' : 'right']: 0 }}
			/>

			<div className="relative grid grid-cols-3 gap-2 py-1.5 px-2 text-sm mono hover:bg-white/[0.03] transition-colors">
				<span className={isBid ? 'text-bid' : 'text-ask'} style={{ fontWeight: 500 }}>
					{order.price.toFixed(2)}
				</span>
				<span className="text-center text-[var(--text-secondary)]">
					{order.quantity}
				</span>
				<span className="text-right text-[var(--text-secondary)]">
					{(order.price * order.quantity).toFixed(2)}
				</span>
			</div>
		</div>
	);
}
