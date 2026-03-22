import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
	type Chat,
	chat,
	type Node,
	type NodeMetadata,
	node,
	nodeMetadata,
} from "@/db/schema";

/**
 * Create a new chat record.
 * Uses onConflictDoNothing so repeated calls with the same id are safe.
 */
export async function createChat(
	id: string,
	title?: string,
	userId?: string,
): Promise<void> {
	await db
		.insert(chat)
		.values({ id, title: title ?? null, userId: userId ?? null })
		.onConflictDoNothing();
}

/**
 * Get a chat by id, creating it first if it doesn't exist.
 */
export async function getOrCreateChat(
	id: string,
	title?: string,
	userId?: string,
): Promise<Chat> {
	await createChat(id, title, userId);

	const rows = await db.select().from(chat).where(eq(chat.id, id)).limit(1);
	return rows[0];
}

/**
 * Save a single node (message) to the database.
 * Updates content on conflict so regenerated responses are persisted.
 */
export async function saveNode(data: {
	id: string;
	chatId: string;
	parentId: string | null;
	role: "user" | "assistant" | "system";
	content: string;
}): Promise<void> {
	await db
		.insert(node)
		.values({
			id: data.id,
			chatId: data.chatId,
			parentId: data.parentId,
			role: data.role,
			content: data.content,
		})
		.onConflictDoUpdate({
			target: node.id,
			set: { content: data.content },
		});
}

/**
 * Save metadata for an assistant node.
 * Updates fields on conflict so regenerated responses persist updated metadata.
 */
export async function saveNodeMetadata(data: {
	nodeId: string;
	provider?: string;
	model?: string;
	temperature?: number;
	tokenCount?: number;
}): Promise<void> {
	const values = {
		nodeId: data.nodeId,
		provider: data.provider ?? null,
		model: data.model ?? null,
		temperature: data.temperature ?? null,
		tokenCount: data.tokenCount ?? null,
	};
	await db
		.insert(nodeMetadata)
		.values(values)
		.onConflictDoUpdate({
			target: nodeMetadata.nodeId,
			set: {
				provider: values.provider,
				model: values.model,
				temperature: values.temperature,
				tokenCount: values.tokenCount,
			},
		});
}

/**
 * Get all nodes belonging to a chat, ordered by creation time ascending.
 * The caller can rebuild the tree structure using parentId references.
 */
export async function getChatNodes(chatId: string): Promise<Node[]> {
	return db
		.select()
		.from(node)
		.where(eq(node.chatId, chatId))
		.orderBy(node.createdAt);
}

/**
 * Get all nodes for a chat together with their metadata (if any).
 */
export async function getChatNodesWithMetadata(
	chatId: string,
): Promise<(Node & { metadata: NodeMetadata | null })[]> {
	const rows = await db
		.select({
			id: node.id,
			chatId: node.chatId,
			parentId: node.parentId,
			role: node.role,
			content: node.content,
			createdAt: node.createdAt,
			metadata: {
				nodeId: nodeMetadata.nodeId,
				provider: nodeMetadata.provider,
				model: nodeMetadata.model,
				temperature: nodeMetadata.temperature,
				toolsCalled: nodeMetadata.toolsCalled,
				files: nodeMetadata.files,
				tokenCount: nodeMetadata.tokenCount,
			},
		})
		.from(node)
		.leftJoin(nodeMetadata, eq(node.id, nodeMetadata.nodeId))
		.where(eq(node.chatId, chatId))
		.orderBy(node.createdAt);

	return rows.map((row) => ({
		id: row.id,
		chatId: row.chatId,
		parentId: row.parentId,
		role: row.role,
		content: row.content,
		createdAt: row.createdAt,
		metadata: row.metadata?.nodeId ? (row.metadata as NodeMetadata) : null,
	}));
}

/**
 * List all chats for a given user, ordered by most-recently-created first.
 * userId is required to prevent leaking chats across users.
 */
export async function listChats(userId: string): Promise<Chat[]> {
	return db
		.select()
		.from(chat)
		.where(eq(chat.userId, userId))
		.orderBy(desc(chat.createdAt));
}

/**
 * Update a chat's title.
 */
export async function updateChatTitle(
	chatId: string,
	title: string,
): Promise<void> {
	await db.update(chat).set({ title }).where(eq(chat.id, chatId));
}

/**
 * Get a single chat by id, or null if not found.
 */
export async function getChat(chatId: string): Promise<Chat | null> {
	const rows = await db.select().from(chat).where(eq(chat.id, chatId)).limit(1);
	return rows[0] ?? null;
}

/**
 * Delete a chat and all of its associated nodes and metadata.
 * Metadata is deleted first to respect foreign key constraints.
 */
export async function deleteChat(chatId: string): Promise<void> {
	// Find all node IDs belonging to this chat
	const nodeRows = await db
		.select({ id: node.id })
		.from(node)
		.where(eq(node.chatId, chatId));

	const nodeIds = nodeRows.map((r) => r.id);

	// Delete metadata for those nodes (if any exist)
	if (nodeIds.length > 0) {
		await db.delete(nodeMetadata).where(inArray(nodeMetadata.nodeId, nodeIds));
	}

	// Delete the nodes themselves
	await db.delete(node).where(eq(node.chatId, chatId));

	// Delete the chat record
	await db.delete(chat).where(eq(chat.id, chatId));
}
