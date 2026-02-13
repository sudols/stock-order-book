import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './store';
import { trpc } from './trpc';
import { AuthGate } from './components/AuthGate';
import { OrderBookView } from './components/OrderBook';
import { TradeForm } from './components/TradeForm';

export default function App() {
	const user = useStore((s) => s.user);
	const setUser = useStore((s) => s.setUser);
	const setPortfolio = useStore((s) => s.setPortfolio);
	const connectSocket = useStore((s) => s.connectSocket);
	const disconnectSocket = useStore((s) => s.disconnectSocket);
	const error = useStore((s) => s.error);
	const setError = useStore((s) => s.setError);

	// ── Auth listener ──────────────────────
	useEffect(() => {
		const unsub = onAuthStateChanged(auth, (fbUser) => {
			setUser(fbUser);
		});
		return unsub;
	}, [setUser]);

	// ── Socket.io connection ───────────────
	useEffect(() => {
		connectSocket();
		return () => disconnectSocket();
	}, [connectSocket, disconnectSocket]);

	// ── Fetch portfolio on login ───────────
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
			} catch {
				// Portfolio fetch failed — will retry on next action
			}
		})();
	}, [user, setPortfolio]);

	// ── Not logged in ─────────────────────
	if (!user) return <AuthGate />;

	// ── Main UI ───────────────────────────
	return (
		<div className="min-h-screen">
			{/* ── Header ── */}
			<header className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-md sticky top-0 z-10">
				<div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="text-xl">📈</span>
						<h1 className="text-base font-bold">Order Book</h1>
						<span className="text-xs bg-bid/20 text-bid px-2 py-0.5 rounded-full font-medium">
							LIVE
						</span>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-xs text-[var(--text-muted)] hidden sm:inline">
							{user.email}
						</span>
						<button
							onClick={() => signOut(auth)}
							className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-lg px-3 py-1.5 hover:bg-white/5 transition-colors"
						>
							Sign out
						</button>
					</div>
				</div>
			</header>

			{/* ── Global Error ── */}
			{error && (
				<div className="max-w-6xl mx-auto px-4 mt-3">
					<div className="flex items-center justify-between bg-ask/10 border border-ask/20 rounded-lg px-4 py-2 text-sm text-ask">
						<span>{error}</span>
						<button
							onClick={() => setError(null)}
							className="ml-4 text-ask/60 hover:text-ask"
						>
							✕
						</button>
					</div>
				</div>
			)}

			{/* ── Content ── */}
			<main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
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
