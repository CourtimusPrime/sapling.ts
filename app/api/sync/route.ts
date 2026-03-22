import { NextResponse } from "next/server";
import {
  getOrCreateChat,
  saveNode,
  saveNodeMetadata,
} from "@/lib/chat-persistence";

interface SyncMessage {
  id: string;
  parentId: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: {
    provider?: string;
    model?: string;
    temperature?: number;
    tokenCount?: number;
  };
}

interface SyncRequestBody {
  chatId: string;
  title?: string;
  messages: SyncMessage[];
}

/**
 * POST /api/sync — Bulk-persist the current thread state.
 *
 * Body: {
 *   chatId: string,
 *   title?: string,
 *   messages: Array<{
 *     id: string,
 *     parentId: string | null,
 *     role: "user" | "assistant" | "system",
 *     content: string,
 *     metadata?: { provider?, model?, temperature?, tokenCount? }
 *   }>
 * }
 *
 * Every message is inserted with onConflictDoNothing, so calling this endpoint
 * repeatedly with the same data is safe and idempotent.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SyncRequestBody;
    const { chatId, title, messages } = body;

    if (!chatId || typeof chatId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'chatId' field" },
        { status: 400 },
      );
    }

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Missing or invalid 'messages' field (must be an array)" },
        { status: 400 },
      );
    }

    if (messages.length > 500) {
      return NextResponse.json(
        { error: "Too many messages (max 500 per sync)" },
        { status: 400 },
      );
    }

    // Ensure the chat exists
    await getOrCreateChat(chatId, title);

    const validRoles = new Set(["user", "assistant", "system"]);
    let saved = 0;

    for (const msg of messages) {
      if (
        !msg.id ||
        !msg.role ||
        !validRoles.has(msg.role) ||
        typeof msg.content !== "string" ||
        msg.content.length > 1_000_000
      ) {
        continue; // skip malformed entries
      }

      await saveNode({
        id: msg.id,
        chatId,
        parentId: msg.parentId ?? null,
        role: msg.role,
        content: msg.content,
      });

      if (msg.metadata) {
        await saveNodeMetadata({
          nodeId: msg.id,
          ...msg.metadata,
        });
      }

      saved++;
    }

    return NextResponse.json({
      chatId,
      saved,
      total: messages.length,
    });
  } catch (error) {
    console.error("[POST /api/sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync messages" },
      { status: 500 },
    );
  }
}
