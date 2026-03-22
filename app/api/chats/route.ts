import { NextResponse } from "next/server";
import { createChat, listChats } from "@/lib/chat-persistence";
import { getSession } from "@/lib/session";
import {
	MAX_ID_LENGTH,
	MAX_TITLE_LENGTH,
	validateOptionalString,
	validateString,
} from "@/lib/validation";

/**
 * GET /api/chats — List all chats ordered by createdAt desc.
 */
export async function GET() {
	try {
		const sessionData = await getSession();
		const chats = await listChats(sessionData?.userId);
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
		const sessionData = await getSession();

		const body = await req.json();
		const { id, title } = body as { id?: string; title?: string };

		const idError = validateString(id, "id", MAX_ID_LENGTH);
		if (idError) {
			return NextResponse.json({ error: idError }, { status: 400 });
		}

		const titleError = validateOptionalString(title, "title", MAX_TITLE_LENGTH);
		if (titleError) {
			return NextResponse.json({ error: titleError }, { status: 400 });
		}

		await createChat(id as string, title, sessionData?.userId);

		return NextResponse.json({ id, title: title ?? null }, { status: 201 });
	} catch (error) {
		console.error("[POST /api/chats] Error:", error);
		return NextResponse.json(
			{ error: "Failed to create chat" },
			{ status: 500 },
		);
	}
}
