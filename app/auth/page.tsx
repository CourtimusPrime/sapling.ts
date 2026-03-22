"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "login" | "register";

export default function AuthPage() {
	const router = useRouter();
	const [mode, setMode] = useState<Mode>("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			const endpoint =
				mode === "login" ? "/api/auth/login" : "/api/auth/register";

			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error ?? "Something went wrong.");
				return;
			}

			// Success -- redirect to the main app
			router.push("/");
			router.refresh();
		} catch {
			setError("Network error. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-dvh items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="space-y-2 text-center">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						{mode === "login" ? "Sign in to Sapling" : "Create an account"}
					</h1>
					<p className="text-sm text-muted-foreground">
						{mode === "login"
							? "Enter your credentials to continue."
							: "Enter your email and a password to get started."}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<label
							htmlFor="email"
							className="text-sm font-medium text-foreground"
						>
							Email
						</label>
						<Input
							id="email"
							type="email"
							placeholder="you@example.com"
							required
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<label
							htmlFor="password"
							className="text-sm font-medium text-foreground"
						>
							Password
						</label>
						<Input
							id="password"
							type="password"
							placeholder={
								mode === "register" ? "At least 8 characters" : "Your password"
							}
							required
							autoComplete={
								mode === "login" ? "current-password" : "new-password"
							}
							minLength={mode === "register" ? 8 : undefined}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>

					{error && (
						<p className="text-sm text-destructive" role="alert">
							{error}
						</p>
					)}

					<Button type="submit" className="w-full" disabled={loading}>
						{loading
							? "Please wait..."
							: mode === "login"
								? "Sign in"
								: "Create account"}
					</Button>
				</form>

				<p className="text-center text-sm text-muted-foreground">
					{mode === "login" ? (
						<>
							Don&apos;t have an account?{" "}
							<button
								type="button"
								className="text-primary underline-offset-4 hover:underline"
								onClick={() => {
									setMode("register");
									setError(null);
								}}
							>
								Sign up
							</button>
						</>
					) : (
						<>
							Already have an account?{" "}
							<button
								type="button"
								className="text-primary underline-offset-4 hover:underline"
								onClick={() => {
									setMode("login");
									setError(null);
								}}
							>
								Sign in
							</button>
						</>
					)}
				</p>
			</div>
		</div>
	);
}
