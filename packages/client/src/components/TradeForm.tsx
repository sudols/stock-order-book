import { useState } from 'react';
import { useStore } from '../store';
import { trpc } from '../trpc';
import { auth } from '../firebase';

export function TradeForm() {
	const user = useStore((s) => s.user);
	const portfolio = useStore((s) => s.portfolio);
	const setPortfolio = useStore((s) => s.setPortfolio);
	const setError = useStore((s) => s.setError);

	const [side, setSide] = useState<'buy' | 'sell'>('buy');
	const [price, setPrice] = useState('');
	const [quantity, setQuantity] = useState('');
	const [loading, setLoading] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;

		setLoading(true);
		setFeedback(null);
		setError(null);

		try {
			const token = await user.getIdToken();
			const result = await trpc.placeOrder.mutate({
				token,
				side,
				price: parseFloat(price),
				quantity: parseInt(quantity, 10),
			});

			if ('error' in result && result.error) {
				setError(result.error);
			} else if ('success' in result && result.success) {
				const trades = result.success.trades;
				if (trades.length > 0) {
					setFeedback(
						`✅ ${trades.length} trade(s) executed — ${trades.reduce((s: number, t: { quantity: number }) => s + t.quantity, 0)} shares @ $${trades[0].price.toFixed(2)}`,
					);
				} else {
					setFeedback('📋 Order placed on the book');
				}
				setPrice('');
				setQuantity('');

				// Refresh portfolio
				const p = await trpc.getPortfolio.query({ token });
				setPortfolio(p);
			}
		} catch (err: any) {
			setError(err.message || 'Something went wrong');
		} finally {
			setLoading(false);
		}
	};

	const isBuy = side === 'buy';

	return (
		<div className="glass-card p-5">
			<h2 className="text-lg font-semibold mb-4">Place Order</h2>

			{/* ── Side Toggle ── */}
			<div className="flex rounded-lg overflow-hidden border border-[var(--border)] mb-4">
				<button
					type="button"
					onClick={() => setSide('buy')}
					className={`flex-1 py-2.5 text-sm font-semibold transition-all ${isBuy
						? 'bg-bid text-white shadow-lg shadow-bid/20'
						: 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
						}`}
				>
					Buy
				</button>
				<button
					type="button"
					onClick={() => setSide('sell')}
					className={`flex-1 py-2.5 text-sm font-semibold transition-all ${!isBuy
						? 'bg-ask text-white shadow-lg shadow-ask/20'
						: 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
						}`}
				>
					Sell
				</button>
			</div>

			<form onSubmit={handleSubmit} className="space-y-3">
				{/* Price */}
				<div>
					<label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">
						Price ($)
					</label>
					<input
						type="number"
						step="0.01"
						min="0.01"
						required
						value={price}
						onChange={(e) => setPrice(e.target.value)}
						placeholder="0.00"
						className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
					/>
				</div>

				{/* Quantity */}
				<div>
					<label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">
						Quantity
					</label>
					<input
						type="number"
						step="1"
						min="1"
						required
						value={quantity}
						onChange={(e) => setQuantity(e.target.value)}
						placeholder="0"
						className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
					/>
				</div>

				{/* Total preview */}
				{price && quantity && (
					<div className="text-xs text-[var(--text-muted)] px-1">
						Total: <span className="mono text-[var(--text-secondary)]">${(parseFloat(price) * parseInt(quantity, 10) || 0).toFixed(2)}</span>
					</div>
				)}

				{/* Submit */}
				<button
					type="submit"
					disabled={loading || !user}
					className={`w-full py-3 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isBuy
						? 'bg-bid hover:bg-bid-dark shadow-lg shadow-bid/20'
						: 'bg-ask hover:bg-ask-dark shadow-lg shadow-ask/20'
						}`}
				>
					{loading ? 'Placing…' : `${isBuy ? 'Buy' : 'Sell'} Order`}
				</button>
			</form>

			{/* Feedback */}
			{feedback && (
				<div className="mt-3 text-sm text-bid bg-bid/10 rounded-lg px-3 py-2">
					{feedback}
				</div>
			)}

			{/* ── Portfolio ── */}
			{portfolio && (
				<div className="mt-4 pt-4 border-t border-[var(--border)]">
					<h3 className="text-xs text-[var(--text-muted)] font-medium mb-2">
						Portfolio
					</h3>
					<div className="grid grid-cols-2 gap-3">
						<div className="bg-[var(--bg-secondary)] rounded-lg p-3">
							<div className="text-xs text-[var(--text-muted)]">Cash</div>
							<div className="mono text-sm font-medium mt-1">
								${portfolio.usd.toFixed(2)}
							</div>
						</div>
						<div className="bg-[var(--bg-secondary)] rounded-lg p-3">
							<div className="text-xs text-[var(--text-muted)]">Stocks</div>
							<div className="mono text-sm font-medium mt-1">
								{portfolio.stocks}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
