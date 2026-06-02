import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './store';
import { trpc } from './trpc';
import { AuthGate } from './components/AuthGate';
import { OrderBookView } from './components/OrderBook';
import { TradeForm } from './components/TradeForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function App() {
	const user = useStore((s) => s.user);
	const setUser = useStore((s) => s.setUser);
	const setPortfolio = useStore((s) => s.setPortfolio);
	const connectSocket = useStore((s) => s.connectSocket);
	const disconnectSocket = useStore((s) => s.disconnectSocket);
	const error = useStore((s) => s.error);
	const setError = useStore((s) => s.setError);

	useEffect(() => {
		if (!auth) return;
		const unsub = onAuthStateChanged(auth, (fbUser) => {
			setUser(fbUser);
		});
		return unsub;
	}, [setUser]);

	useEffect(() => {
		connectSocket();
		return () => disconnectSocket();
	}, [connectSocket, disconnectSocket]);

	useEffect(() => {
		if (!user) {
			setPortfolio(null);
			return;
		}
		(async () => {
			try {
				const token = await user.getIdToken();
				const p = await trpc.getPortfolio.query({ token });
				setPortfolio(p);
				
				// Automatically trigger MarketMaker for 3 minutes on login
				await trpc.extendMarketMaker.mutate({ token, durationMs: 3 * 60 * 1000 });
			} catch {
				// ignore transient fetch failures
			}
		})();
	}, [user, setPortfolio]);

	if (!user) return <AuthGate />;

	return (
		<div className="min-h-screen bg-background">
			<header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
					<div className="flex items-center gap-3">
						<h1 className="text-base font-semibold tracking-tight">
							Order Book
						</h1>
						<Badge variant="secondary" className="gap-1">
							<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
							LIVE
						</Badge>
					</div>
					<div className="flex items-center gap-2">
						<span className="hidden text-sm text-muted-foreground sm:inline">
							{user.email ?? user.uid}
						</span>
						<Button
							variant="secondary"
							size="sm"
							onClick={async () => {
								if (!user) return;
								try {
									const token = await user.getIdToken();
									await trpc.extendMarketMaker.mutate({ token, durationMs: 90 * 1000 });
								} catch (e) {
									console.error('Failed to trigger market maker', e);
								}
							}}
						>
							Trigger MarketMaker
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								if (!auth) return;
								signOut(auth).then(() => setUser(null));
							}}
						>
							Sign out
						</Button>
					</div>
				</div>
			</header>

			{error && (
				<div className="mx-auto mt-4 max-w-6xl px-4">
					<Alert variant="destructive">
						<AlertDescription className="flex items-center justify-between gap-4">
							<span>{error}</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setError(null)}
								className="h-auto p-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
							>
								Dismiss
							</Button>
						</AlertDescription>
					</Alert>
				</div>
			)}

			<main className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<OrderBookView />
				</div>
				<div>
					<TradeForm />
				</div>
			</main>
		</div>
	);
}
