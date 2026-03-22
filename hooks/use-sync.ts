"use client";
import { useThreadRuntime } from "@assistant-ui/react";
import { useEffect, useRef } from "react";

export function useSync() {
	const runtime = useThreadRuntime();
	const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSyncedRef = useRef("");

	useEffect(() => {
		const sync = () => {
			try {
				const exported = runtime.export();
				if (!exported.messages.length) return;

				const fingerprint = exported.messages
					.map(({ message }) => {
						const text = message.content.find(
							(p: { type: string }) => p.type === "text",
						) as { type: "text"; text: string } | undefined;
						return `${message.id}:${text?.text.length ?? 0}`;
					})
					.join("|");

				if (fingerprint === lastSyncedRef.current) return;
				lastSyncedRef.current = fingerprint;

				// Use the first message ID as chatId (stable across the thread's lifetime)
				const chatId = exported.messages[0].message.id;

				const messages = exported.messages.map(({ message, parentId }) => {
					// Extract text content from message parts
					let content = "";
					for (const part of message.content) {
						if (part.type === "text") {
							content += part.text;
						}
					}

					return {
						id: message.id,
						parentId,
						role: message.role as "user" | "assistant" | "system",
						content,
					};
				});

				fetch("/api/sync", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ chatId, messages }),
				}).catch(() => {
					// Silently fail — will retry on next change
				});
			} catch {
				// Runtime not ready
			}
		};

		const debouncedSync = () => {
			if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
			// Debounce by 2 seconds to avoid syncing on every streamed token
			syncTimeoutRef.current = setTimeout(sync, 2000);
		};

		const unsub = runtime.subscribe(debouncedSync);
		return () => {
			unsub();
			if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
		};
	}, [runtime]);
}
