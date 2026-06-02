import { useState } from 'react';
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useStore } from '../store';
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
						<Alert>
							<AlertDescription>
								Firebase not configured. Use mock login below.
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

						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<Button
							type="submit"
							disabled={loading || !auth}
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

			<div className="absolute bottom-8 left-0 right-0 text-center">
				<Button
					type="button"
					variant="link"
					onClick={() => {
						const randomId = Math.floor(Math.random() * 10000);
						const uid = `mock-user-${randomId}`;
						const mockUser: any = {
							uid,
							email: `user${randomId}@demo.local`,
							emailVerified: true,
							isAnonymous: false,
							getIdToken: async () => uid,
							toJSON: () => ({}),
						};
						setUser(mockUser);
					}}
					className="text-xs"
				>
					[DEV] Mock Login (Random User)
				</Button>
			</div>
		</div>
	);
}
