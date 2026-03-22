import { NextResponse } from "next/server";
import { createChat, listChats } from "@/lib/chat-persistence";

/**
 * GET /api/chats — List all chats ordered by createdAt desc.
 */
export async function GET() {
  try {
    const chats = await listChats();
    return NextResponse.json(chats);
  } catch (error) {
    console.error("[GET /api/chats] Error:", error);
    return NextResponse.json(
      { error: "Failed to list chats" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/chats — Create a new chat.
 * Body: { id: string, title?: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, title } = body as { id?: string; title?: string };

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'id' field" },
        { status: 400 },
      );
    }

    await createChat(id, title);

    return NextResponse.json({ id, title: title ?? null }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/chats] Error:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 },
    );
  }
}
