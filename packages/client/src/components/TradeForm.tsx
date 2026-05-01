import { useState } from 'react';
import { useStore } from '../store';
import { trpc } from '../trpc';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

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
						`${trades.length} trade(s) executed - ${trades.reduce((s: number, t: { quantity: number }) => s + t.quantity, 0)} shares @ $${trades[0].price.toFixed(2)}`,
					);
				} else {
					setFeedback('Order placed on the book');
				}
				setPrice('');
				setQuantity('');

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
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="text-lg">Place Order</CardTitle>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-2">
					<Button
						type="button"
						variant={isBuy ? 'default' : 'outline'}
						onClick={() => setSide('buy')}
					>
						Buy
					</Button>
					<Button
						type="button"
						variant={!isBuy ? 'destructive' : 'outline'}
						onClick={() => setSide('sell')}
					>
						Sell
					</Button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-3">
					<div className="space-y-1.5">
						<Label htmlFor="price">Price ($)</Label>
						<Input
							id="price"
							type="number"
							step="0.01"
							min="0.01"
							required
							value={price}
							onChange={(e) => setPrice(e.target.value)}
							placeholder="0.00"
							className="font-mono"
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="quantity">Quantity</Label>
						<Input
							id="quantity"
							type="number"
							step="1"
							min="1"
							required
							value={quantity}
							onChange={(e) => setQuantity(e.target.value)}
							placeholder="0"
							className="font-mono"
						/>
					</div>

					{price && quantity && (
						<p className="px-1 text-xs text-muted-foreground">
							Total:{' '}
							<span className="font-mono text-foreground">
								${(parseFloat(price) * parseInt(quantity, 10) || 0).toFixed(2)}
							</span>
						</p>
					)}

					<Button
						type="submit"
						disabled={loading || !user}
						variant={isBuy ? 'default' : 'destructive'}
						className="w-full"
					>
						{loading ? 'Placing...' : `${isBuy ? 'Buy' : 'Sell'} Order`}
					</Button>
				</form>

				{feedback && (
					<Alert>
						<AlertDescription>{feedback}</AlertDescription>
					</Alert>
				)}

				{portfolio && (
					<>
						<Separator />
						<div className="space-y-2">
							<p className="text-sm font-medium">Portfolio</p>
							<div className="grid grid-cols-2 gap-3">
								<div className="rounded-md border bg-muted/30 p-3">
									<p className="text-xs text-muted-foreground">Cash</p>
									<p className="mt-1 font-mono text-sm font-medium">
										${portfolio.usd.toFixed(2)}
									</p>
								</div>
								<div className="rounded-md border bg-muted/30 p-3">
									<p className="text-xs text-muted-foreground">Stocks</p>
									<p className="mt-1 font-mono text-sm font-medium">{portfolio.stocks}</p>
								</div>
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
