import { useState } from 'react';
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
} from 'firebase/auth';
import { Turnstile } from '@marsidev/react-turnstile';
import { auth } from '../firebase';
import { useStore } from '../store';
import { API_URL } from '../trpc';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AuthGate() {
	const setUser = useStore((s) => s.setUser);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [isSignUp, setIsSignUp] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!auth) {
			setError('Firebase is not configured');
			return;
		}
		if (!turnstileToken) {
			setError('Please complete the security check.');
			return;
		}

		setLoading(true);
		setError(null);

		try {
			// 1. Verify Turnstile token with our backend
			const verifyRes = await fetch(`${API_URL}/api/verify-turnstile`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: turnstileToken }),
			});
			const verifyData = await verifyRes.json();
			if (!verifyData.success) {
				throw new Error(verifyData.error || 'Security check failed.');
			}

			// 2. Proceed with Firebase Auth
			const cred = isSignUp
				? await createUserWithEmailAndPassword(auth, email, password)
				: await signInWithEmailAndPassword(auth, email, password);
			setUser(cred.user);
		} catch (err: any) {
			setError(err.message?.replace('Firebase: ', '') || 'Auth failed');
		} finally {
			setLoading(false);
			// Reset turnstile token if there was an error to force re-verification
			if (error) setTurnstileToken(null);
		}
	};

	return (
		<div className="relative flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader className="space-y-2 text-center">
					<CardTitle className="text-xl">Stock Order Book</CardTitle>
					<CardDescription>
						{isSignUp ? 'Create an account' : 'Sign in to trade'}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{!auth && (
						<Alert variant="destructive">
							<AlertDescription>
								Firebase is not configured. Please check your environment variables.
							</AlertDescription>
						</Alert>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								required
								disabled={!auth}
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								required
								minLength={6}
								disabled={!auth}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="********"
							/>
						</div>

						<div className="space-y-1.5 flex justify-center py-2">
							<Turnstile 
								siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'} 
								onSuccess={setTurnstileToken} 
								options={{ theme: 'light' }}
							/>
						</div>

						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<Button
							type="submit"
							disabled={loading || !auth || !turnstileToken}
							className="w-full"
						>
							{loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
						</Button>
					</form>

					<Button
						type="button"
						variant="ghost"
						onClick={() => {
							setIsSignUp(!isSignUp);
							setError(null);
						}}
						className="w-full text-xs text-muted-foreground"
					>
						{isSignUp
							? 'Already have an account? Sign in'
							: "Don't have an account? Sign up"}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
