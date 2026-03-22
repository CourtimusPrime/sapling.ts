"use client";

import { useEffect, useState } from "react";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	OPENAI_MODELS,
	OPENROUTER_MODELS,
	useModelStore,
} from "@/lib/model-store";

export function ModelSelector() {
	const model = useModelStore((s) => s.model);
	const setModel = useModelStore((s) => s.setModel);
	const [provider, setProvider] = useState<"openrouter" | "openai" | null>(
		null,
	);

	// Detect the provider on mount by checking the /api/chat/provider endpoint
	// For simplicity, we infer from available models: if current model contains "/",
	// it's OpenRouter format. Otherwise, use a simple fetch to detect.
	useEffect(() => {
		fetch("/api/chat/provider")
			.then((res) => res.json())
			.then((data: { provider: string }) => {
				setProvider(data.provider === "openrouter" ? "openrouter" : "openai");
			})
			.catch(() => {
				// Fallback: assume OpenRouter if we can't detect
				setProvider("openrouter");
			});
	}, []);

	if (!provider) return null;

	const models = provider === "openrouter" ? OPENROUTER_MODELS : OPENAI_MODELS;

	return (
		<Select
			value={model ?? "default"}
			onValueChange={(value) => setModel(value === "default" ? null : value)}
		>
			<SelectTrigger
				className="h-7 w-auto min-w-[140px] max-w-[200px] gap-1.5 border-border/50 bg-transparent px-2 text-xs text-muted-foreground hover:text-foreground"
				aria-label="Select model"
			>
				<SelectValue placeholder="Default model" />
			</SelectTrigger>
			<SelectContent align="end">
				<SelectGroup>
					<SelectLabel>Model</SelectLabel>
					<SelectItem value="default">Server default</SelectItem>
					{models.map((m) => (
						<SelectItem key={m.id} value={m.id}>
							{m.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
