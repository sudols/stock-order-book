import { useStore } from '../store';
import type { Order } from '@orderbook/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function OrderBookView() {
	const bids = useStore((s) => s.bids);
	const asks = useStore((s) => s.asks);

	const maxQty = Math.max(
		...bids.map((o) => o.quantity),
		...asks.map((o) => o.quantity),
		1,
	);

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="text-lg">Order Book</CardTitle>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="grid grid-cols-3 gap-2 px-2 text-xs font-medium text-muted-foreground">
					<span>Price ($)</span>
					<span className="text-center">Qty</span>
					<span className="text-right">Total</span>
				</div>

				<div className="space-y-1">
					{[...asks].reverse().map((order) => (
						<OrderRow key={order.id} order={order} side="sell" maxQty={maxQty} />
					))}
					{asks.length === 0 && (
						<div className="py-2 text-center text-sm text-muted-foreground">No asks</div>
					)}
				</div>

				<Separator />

				<div className="flex items-center justify-between px-2 text-xs">
					<span className="text-muted-foreground">Spread</span>
					<span className="font-mono font-medium">
						{bids.length > 0 && asks.length > 0
							? `$${(asks[0].price - bids[0].price).toFixed(2)}`
							: '—'}
					</span>
				</div>

				<Separator />

				<div className="space-y-1">
					{bids.map((order) => (
						<OrderRow key={order.id} order={order} side="buy" maxQty={maxQty} />
					))}
					{bids.length === 0 && (
						<div className="py-2 text-center text-sm text-muted-foreground">No bids</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

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
		<div className="relative overflow-hidden rounded-md border border-transparent hover:bg-accent/30 transition-colors">
			<div
				className={isBid ? 'absolute inset-y-0 left-0 bg-emerald-500/10' : 'absolute inset-y-0 right-0 bg-rose-500/10'}
				style={{ width: `${depthPct}%` }}
			/>
			<div className="relative grid grid-cols-3 gap-2 px-2 py-1.5 text-sm font-mono">
				<span className={isBid ? 'font-medium text-emerald-600' : 'font-medium text-rose-600'}>
					{order.price.toFixed(2)}
				</span>
				<span className="text-center text-muted-foreground">{order.quantity}</span>
				<span className="text-right text-muted-foreground">
					{(order.price * order.quantity).toFixed(2)}
				</span>
			</div>
		</div>
	);
}
