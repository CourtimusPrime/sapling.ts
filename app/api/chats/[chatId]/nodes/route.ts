import { NextResponse } from "next/server";
import {
  getChatNodesWithMetadata,
  getOrCreateChat,
  saveNode,
  saveNodeMetadata,
} from "@/lib/chat-persistence";
import {
  validateString,
  validateRole,
  MAX_ID_LENGTH,
  MAX_CONTENT_LENGTH,
} from "@/lib/validation";

/**
 * GET /api/chats/[chatId]/nodes — Get all nodes for a chat.
 * Returns nodes with their metadata for rebuilding the tree.
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
    return NextResponse.json(
      { error: "Failed to get nodes" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/chats/[chatId]/nodes — Save a new node.
 * Body: { id: string, parentId: string | null, role: string, content: string, metadata?: { ... } }
 *
 * The chat is created automatically if it doesn't exist yet.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
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

    // Ensure the chat exists
    await getOrCreateChat(chatId);

    await saveNode({
      id: id!,
      chatId,
      parentId: parentId ?? null,
      role: role as "user" | "assistant" | "system",
      content: content!,
    });

    // Save metadata if provided (typically for assistant messages)
    if (metadata) {
      await saveNodeMetadata({
        nodeId: id!,
        ...metadata,
      });
    }

    return NextResponse.json({ id, chatId }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/chats/[chatId]/nodes] Error:", error);
    return NextResponse.json(
      { error: "Failed to save node" },
      { status: 500 },
    );
  }
}
