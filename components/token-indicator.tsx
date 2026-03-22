"use client";

import { useThreadRuntime } from "@assistant-ui/react";
import { useEffect, useState } from "react";
import { useModelStore } from "@/lib/model-store";
import { computeContextUsage } from "@/lib/token-counter";

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(n);
}

export function TokenIndicator() {
	const runtime = useThreadRuntime();
	const model = useModelStore((s) => s.model);
	const [usage, setUsage] = useState({
		totalTokens: 0,
		maxTokens: 0,
		percentage: 0,
		shouldTrim: false,
	});

	useEffect(() => {
		const update = () => {
			try {
				const state = runtime.getState();
				const messages = state.messages.map((m) => ({
					role: m.role,
					content: m.content
						.map((p) => (p.type === "text" ? p.text : ""))
						.join(""),
				}));
				setUsage(computeContextUsage(messages, model));
			} catch {
				// Runtime not ready yet
			}
		};

		update();
		const unsub = runtime.subscribe(update);
		return unsub;
	}, [runtime, model]);

	if (usage.totalTokens === 0) return null;

	const color =
		usage.percentage > 80
			? "text-red-400"
			: usage.percentage > 50
				? "text-amber-400"
				: "text-muted-foreground";

	const barColor =
		usage.percentage > 80
			? "bg-red-500"
			: usage.percentage > 50
				? "bg-amber-500"
				: "bg-emerald-500";

	return (
		<div
			className="flex items-center gap-2 text-[10px]"
			aria-label="Context window usage"
		>
			<div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
				<div
					className={`h-full rounded-full transition-all duration-300 ${barColor}`}
					style={{ width: `${Math.min(100, usage.percentage)}%` }}
					role="progressbar"
					aria-valuenow={usage.percentage}
					aria-valuemin={0}
					aria-valuemax={100}
				/>
			</div>
			<span className={color}>
				{formatTokens(usage.totalTokens)} / {formatTokens(usage.maxTokens)}
			</span>
		</div>
	);
}
