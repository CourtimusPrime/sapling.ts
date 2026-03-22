import { NextResponse } from "next/server";
import {
	getChatNodesWithMetadata,
	getOrCreateChat,
	saveNode,
	saveNodeMetadata,
} from "@/lib/chat-persistence";
import { getSession } from "@/lib/session";
import {
	MAX_CONTENT_LENGTH,
	MAX_ID_LENGTH,
	validateRole,
	validateString,
} from "@/lib/validation";

/**
 * GET /api/chats/[chatId]/nodes — Get all nodes for a chat.
 */
export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ chatId: string }> },
) {
	try {
		const { chatId } = await params;
		const nodes = await getChatNodesWithMetadata(chatId);
		return NextResponse.json(nodes);
	} catch (error) {
		console.error("[GET /api/chats/[chatId]/nodes] Error:", error);
		return NextResponse.json({ error: "Failed to get nodes" }, { status: 500 });
	}
}

/**
 * POST /api/chats/[chatId]/nodes — Save a new node.
 */
export async function POST(
	req: Request,
	{ params }: { params: Promise<{ chatId: string }> },
) {
	try {
		const sessionData = await getSession();
		const { chatId } = await params;

		const body = await req.json();
		const { id, parentId, role, content, metadata } = body as {
			id?: string;
			parentId?: string | null;
			role?: string;
			content?: string;
			metadata?: {
				provider?: string;
				model?: string;
				temperature?: number;
				tokenCount?: number;
			};
		};

		const idError = validateString(id, "id", MAX_ID_LENGTH);
		if (idError) {
			return NextResponse.json({ error: idError }, { status: 400 });
		}

		const roleError = validateRole(role);
		if (roleError) {
			return NextResponse.json({ error: roleError }, { status: 400 });
		}

		const contentError = validateString(content, "content", MAX_CONTENT_LENGTH);
		if (contentError) {
			return NextResponse.json({ error: contentError }, { status: 400 });
		}

		await getOrCreateChat(chatId, undefined, sessionData?.userId);

		const validId = id as string;
		const validContent = content as string;

		await saveNode({
			id: validId,
			chatId,
			parentId: parentId ?? null,
			role: role as "user" | "assistant" | "system",
			content: validContent,
		});

		if (metadata) {
			await saveNodeMetadata({
				nodeId: validId,
				...metadata,
			});
		}

		return NextResponse.json({ id, chatId }, { status: 201 });
	} catch (error) {
		console.error("[POST /api/chats/[chatId]/nodes] Error:", error);
		return NextResponse.json({ error: "Failed to save node" }, { status: 500 });
	}
}
