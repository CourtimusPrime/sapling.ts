"use client";

import type { ThreadMessage } from "@assistant-ui/core";
import { useThreadRuntime } from "@assistant-ui/react";
import { Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

function extractText(message: ThreadMessage): string {
	return message.content
		.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
		.map((p) => p.text)
		.join(" ");
}

interface SearchResult {
	id: string;
	role: string;
	text: string;
	parentId: string | null;
}

export function SearchPanel({ onClose }: { onClose: () => void }) {
	const runtime = useThreadRuntime();
	const [query, setQuery] = useState("");

	const results = useMemo<SearchResult[]>(() => {
		if (query.length < 2) return [];

		try {
			const exported = runtime.export();
			const lowerQuery = query.toLowerCase();

			return exported.messages
				.filter(({ message }) => {
					const text = extractText(message).toLowerCase();
					return text.includes(lowerQuery);
				})
				.map(({ message, parentId }) => ({
					id: message.id,
					role: message.role,
					text: extractText(message),
					parentId,
				}))
				.slice(0, 20); // Max 20 results
		} catch {
			return [];
		}
	}, [query, runtime]);

	const navigateToMessage = useCallback(
		(messageId: string) => {
			try {
				const exported = runtime.export();
				runtime.import({ ...exported, headId: messageId });
			} catch {
				// Runtime may not be ready
			}
		},
		[runtime],
	);

	// Highlight matching text with surrounding context
	const highlight = (text: string, q: string) => {
		if (q.length < 2) return text;
		const idx = text.toLowerCase().indexOf(q.toLowerCase());
		if (idx === -1) return text;

		const before = text.slice(Math.max(0, idx - 40), idx);
		const match = text.slice(idx, idx + q.length);
		const after = text.slice(idx + q.length, idx + q.length + 40);

		return (
			<span>
				{before.length > 0 && idx > 40 && "..."}
				{before}
				<mark className="bg-amber-500/30 text-foreground rounded px-0.5">
					{match}
				</mark>
				{after}
				{after.length === 40 && "..."}
			</span>
		);
	};

	const roleColors: Record<string, string> = {
		user: "text-indigo-400",
		assistant: "text-emerald-400",
		system: "text-amber-400",
	};

	return (
		<div className="flex flex-col h-full">
			{/* Search input */}
			<div className="flex items-center gap-2 p-3 border-b">
				<Search className="size-4 text-muted-foreground shrink-0" />
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search messages..."
					className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
					autoFocus
				/>
				<button
					onClick={onClose}
					className="text-muted-foreground hover:text-foreground"
				>
					<X className="size-4" />
				</button>
			</div>

			{/* Results */}
			<div className="flex-1 overflow-y-auto">
				{query.length < 2 ? (
					<p className="p-4 text-sm text-muted-foreground text-center">
						Type at least 2 characters to search
					</p>
				) : results.length === 0 ? (
					<p className="p-4 text-sm text-muted-foreground text-center">
						No results found
					</p>
				) : (
					<div className="divide-y">
						{results.map((result) => (
							<button
								key={result.id}
								className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
								onClick={() => navigateToMessage(result.id)}
							>
								<div
									className={`text-[10px] uppercase tracking-wider mb-1 ${roleColors[result.role] ?? "text-muted-foreground"}`}
								>
									{result.role}
								</div>
								<div className="text-xs text-foreground line-clamp-2">
									{highlight(result.text, query)}
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
