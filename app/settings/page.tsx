"use client";

import { ArrowLeft, Check, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StoredKey {
	provider: string;
	hasKey: boolean;
	maskedKey: string;
}

interface ProviderConfig {
	id: string;
	label: string;
	placeholder: string;
}

const PROVIDERS: ProviderConfig[] = [
	{
		id: "openrouter",
		label: "OpenRouter",
		placeholder: "sk-or-v1-...",
	},
	{
		id: "openai",
		label: "OpenAI",
		placeholder: "sk-...",
	},
];

export default function SettingsPage() {
	const [storedKeys, setStoredKeys] = useState<StoredKey[]>([]);
	const [inputValues, setInputValues] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState<Record<string, boolean>>({});
	const [deleting, setDeleting] = useState<Record<string, boolean>>({});
	const [feedback, setFeedback] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(true);

	const fetchKeys = useCallback(async () => {
		try {
			const res = await fetch("/api/settings/keys");
			if (res.ok) {
				const data: StoredKey[] = await res.json();
				setStoredKeys(data);
			}
		} catch {
			// silently fail — user will just see "No key set"
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchKeys();
	}, [fetchKeys]);

	function getStoredKey(provider: string): StoredKey | undefined {
		return storedKeys.find((k) => k.provider === provider);
	}

	async function handleSave(provider: string) {
		const apiKey = inputValues[provider]?.trim();
		if (!apiKey) return;

		setSaving((prev) => ({ ...prev, [provider]: true }));
		setFeedback((prev) => ({ ...prev, [provider]: "" }));

		try {
			const res = await fetch("/api/settings/keys", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ provider, apiKey }),
			});

			if (res.ok) {
				setInputValues((prev) => ({ ...prev, [provider]: "" }));
				setFeedback((prev) => ({ ...prev, [provider]: "saved" }));
				await fetchKeys();
				setTimeout(() => {
					setFeedback((prev) => ({ ...prev, [provider]: "" }));
				}, 2000);
			} else {
				const data = await res.json();
				setFeedback((prev) => ({
					...prev,
					[provider]: data.error || "Failed to save",
				}));
			}
		} catch {
			setFeedback((prev) => ({
				...prev,
				[provider]: "Network error",
			}));
		} finally {
			setSaving((prev) => ({ ...prev, [provider]: false }));
		}
	}

	async function handleDelete(provider: string) {
		setDeleting((prev) => ({ ...prev, [provider]: true }));
		setFeedback((prev) => ({ ...prev, [provider]: "" }));

		try {
			const res = await fetch("/api/settings/keys", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ provider }),
			});

			if (res.ok) {
				setFeedback((prev) => ({ ...prev, [provider]: "deleted" }));
				await fetchKeys();
				setTimeout(() => {
					setFeedback((prev) => ({ ...prev, [provider]: "" }));
				}, 2000);
			} else {
				const data = await res.json();
				setFeedback((prev) => ({
					...prev,
					[provider]: data.error || "Failed to delete",
				}));
			}
		} catch {
			setFeedback((prev) => ({
				...prev,
				[provider]: "Network error",
			}));
		} finally {
			setDeleting((prev) => ({ ...prev, [provider]: false }));
		}
	}

	return (
		<div className="mx-auto max-w-2xl px-4 py-8">
			<div className="mb-8">
				<Link
					href="/"
					className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft className="size-4" />
					Back to chat
				</Link>
				<h1 className="mt-4 font-semibold text-2xl">Settings</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your API keys. Your keys are encrypted and stored securely.
					User-provided keys take priority over server defaults.
				</p>
			</div>

			{loading ? (
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					Loading...
				</div>
			) : (
				<div className="space-y-8">
					{PROVIDERS.map((provider) => {
						const stored = getStoredKey(provider.id);
						const isSaving = saving[provider.id];
						const isDeleting = deleting[provider.id];
						const fb = feedback[provider.id];

						return (
							<section key={provider.id} className="rounded-lg border p-5">
								<div className="mb-3 flex items-center justify-between">
									<h2 className="font-medium text-lg">{provider.label}</h2>
									{stored ? (
										<span className="rounded-full bg-green-500/10 px-2.5 py-0.5 font-medium text-green-500 text-xs">
											Active
										</span>
									) : (
										<span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground text-xs">
											Not set
										</span>
									)}
								</div>

								{stored && (
									<div className="mb-3 flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
										<code className="font-mono text-sm">
											{stored.maskedKey}
										</code>
										<Button
											variant="ghost"
											size="icon-xs"
											onClick={() => handleDelete(provider.id)}
											disabled={isDeleting}
											aria-label={`Delete ${provider.label} key`}
										>
											{isDeleting ? (
												<Loader2 className="size-3 animate-spin" />
											) : (
												<Trash2 className="size-3" />
											)}
										</Button>
									</div>
								)}

								<div className="flex gap-2">
									<Input
										type="password"
										placeholder={
											stored
												? "Enter new key to replace..."
												: provider.placeholder
										}
										value={inputValues[provider.id] || ""}
										onChange={(e) =>
											setInputValues((prev) => ({
												...prev,
												[provider.id]: e.target.value,
											}))
										}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												handleSave(provider.id);
											}
										}}
									/>
									<Button
										onClick={() => handleSave(provider.id)}
										disabled={isSaving || !inputValues[provider.id]?.trim()}
										size="default"
									>
										{isSaving ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											"Save"
										)}
									</Button>
								</div>

								{fb && (
									<p
										className={`mt-2 flex items-center gap-1 text-sm ${
											fb === "saved" || fb === "deleted"
												? "text-green-500"
												: "text-destructive"
										}`}
									>
										{(fb === "saved" || fb === "deleted") && (
											<Check className="size-3" />
										)}
										{fb === "saved"
											? "Key saved successfully"
											: fb === "deleted"
												? "Key removed"
												: fb}
									</p>
								)}
							</section>
						);
					})}
				</div>
			)}
		</div>
	);
}
