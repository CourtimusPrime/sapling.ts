import type {
	RemoteThreadInitializeResponse,
	RemoteThreadListAdapter,
	RemoteThreadListResponse,
	RemoteThreadMetadata,
} from "@assistant-ui/core";
import type { AssistantStream } from "assistant-stream";
import { createAssistantStream } from "assistant-stream";

/**
 * A RemoteThreadListAdapter backed by the app's SQLite database via API routes.
 *
 * This adapter persists the thread list (chats) to the server so that
 * conversations survive page refreshes. It implements the full interface
 * expected by assistant-ui's useRemoteThreadListRuntime.
 *
 * Archive support uses a title-prefix convention ("[archived] ") since the
 * schema doesn't have a dedicated archived column yet.
 */
export function createThreadListAdapter(): RemoteThreadListAdapter {
	return {
		async list(): Promise<RemoteThreadListResponse> {
			const res = await fetch("/api/chats");
			if (!res.ok) {
				throw new Error(`Failed to list chats: ${res.status}`);
			}
			const chats = await res.json();
			return {
				threads: chats.map(
					(c: {
						id: string;
						title?: string | null;
						createdAt?: string | null;
					}) => {
						const title = c.title ?? undefined;
						const isArchived = title?.startsWith("[archived] ") ?? false;
						const cleanTitle = isArchived
							? title?.slice("[archived] ".length)
							: title;
						return {
							remoteId: c.id,
							title: cleanTitle || undefined,
							status: isArchived ? ("archived" as const) : ("regular" as const),
						};
					},
				),
			};
		},

		async initialize(
			threadId: string,
		): Promise<RemoteThreadInitializeResponse> {
			const res = await fetch("/api/chats", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: threadId }),
			});
			if (!res.ok) {
				throw new Error(`Failed to create chat: ${res.status}`);
			}
			const data = await res.json();
			return { remoteId: data.id, externalId: undefined };
		},

		async rename(remoteId: string, newTitle: string): Promise<void> {
			const res = await fetch(`/api/chats/${remoteId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: newTitle }),
			});
			if (!res.ok) {
				throw new Error(`Failed to rename chat: ${res.status}`);
			}
		},

		async archive(remoteId: string): Promise<void> {
			const res = await fetch(`/api/chats/${remoteId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ archived: true }),
			});
			if (!res.ok) {
				throw new Error(`Failed to archive chat: ${res.status}`);
			}
		},

		async unarchive(remoteId: string): Promise<void> {
			const res = await fetch(`/api/chats/${remoteId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ archived: false }),
			});
			if (!res.ok) {
				throw new Error(`Failed to unarchive chat: ${res.status}`);
			}
		},

		async delete(remoteId: string): Promise<void> {
			const res = await fetch(`/api/chats/${remoteId}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				throw new Error(`Failed to delete chat: ${res.status}`);
			}
		},

		async generateTitle(
			_remoteId: string,
			_messages: readonly unknown[],
		): Promise<AssistantStream> {
			// Return an empty stream; title generation is not yet implemented.
			// The first user message will be used as a fallback title by assistant-ui.
			// TODO: Implement server-side title generation (e.g., via an LLM call).
			return createAssistantStream(() => {});
		},

		async fetch(threadId: string): Promise<RemoteThreadMetadata> {
			const res = await fetch(`/api/chats/${threadId}`);
			if (!res.ok) {
				throw new Error(`Failed to fetch chat: ${res.status}`);
			}
			const c = await res.json();
			const title = c.title ?? undefined;
			const isArchived = title?.startsWith("[archived] ") ?? false;
			const cleanTitle = isArchived
				? title?.slice("[archived] ".length)
				: title;
			return {
				remoteId: c.id,
				title: cleanTitle || undefined,
				status: isArchived ? "archived" : "regular",
			};
		},
	};
}
