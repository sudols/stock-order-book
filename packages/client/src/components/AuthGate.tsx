import { useState } from 'react';
import {
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useStore } from '../store';

export function AuthGate() {
	const setUser = useStore((s) => s.setUser);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [isSignUp, setIsSignUp] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!auth) return;

		setLoading(true);
		setError(null);

		try {
			const cred = isSignUp
				? await createUserWithEmailAndPassword(auth, email, password)
				: await signInWithEmailAndPassword(auth, email, password);
			setUser(cred.user);
		} catch (err: any) {
			setError(err.message?.replace('Firebase: ', '') || 'Auth failed');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<div className="glass-card glow-border p-8 w-full max-w-sm">
				{/* Logo / Title */}
				<div className="text-center mb-8">
					<div className="text-3xl mb-2">📈</div>
					<h1 className="text-xl font-bold">Stock Order Book</h1>
					<p className="text-sm text-[var(--text-muted)] mt-1">
						{isSignUp ? 'Create an account' : 'Sign in to trade'}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Message if Auth is missing */}
					{!auth && (
						<div className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-lg mb-4">
							⚠️ Firebase not configured. Please use <b>Mock Login</b> below.
						</div>
					)}
					<div>
						<label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">
							Email
						</label>
						<input
							type="email"
							required
							disabled={!auth}
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors disabled:opacity-50"
						/>
					</div>
					<div>
						<label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">
							Password
						</label>
						<input
							type="password"
							required
							minLength={6}
							disabled={!auth}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors disabled:opacity-50"
						/>
					</div>

					{error && (
						<div className="text-sm text-ask bg-ask/10 rounded-lg px-3 py-2">
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={loading || !auth}
						className="w-full py-3 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
					>
						{loading ? 'Loading…' : isSignUp ? 'Create Account' : 'Sign In'}
					</button>
				</form>

				<div className="mt-4 text-center">
					<button
						type="button"
						onClick={() => {
							setIsSignUp(!isSignUp);
							setError(null);
						}}
						className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
					>
						{isSignUp
							? 'Already have an account? Sign in'
							: "Don't have an account? Sign up"}
					</button>
				</div>
			</div>

			{/* ── Mock Login (Dev Only) ── */}
			<div className="absolute bottom-8 left-0 right-0 text-center">
				<button
					type="button"
					onClick={() => {
						// Mock User object that satisfies the store's User type (partial)
						const mockUser: any = {
							uid: 'mock-user-123',
							email: 'demo@localhost',
							emailVerified: true,
							isAnonymous: false,
							metadata: {},
							providerData: [],
							refreshToken: '',
							tenantId: null,
							delete: async () => { },
							getIdToken: async () => 'mock-user-123',
							getIdTokenResult: async () => ({} as any),
							reload: async () => { },
							toJSON: () => ({}),
						};
						setUser(mockUser);
					}}
					className="text-xs font-mono text-[var(--accent)] hover:underline opacity-50 hover:opacity-100 transition-opacity"
				>
					[DEV] Mock Login
				</button>
			</div>
		</div>
	);
}
