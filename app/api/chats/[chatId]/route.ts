import { NextResponse } from "next/server";
import { deleteChat, getChat, updateChatTitle } from "@/lib/chat-persistence";

/**
 * GET /api/chats/[chatId] — Get a single chat by id.
 */
export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ chatId: string }> },
) {
	try {
		const { chatId } = await params;
		const chatRecord = await getChat(chatId);

		if (!chatRecord) {
			return NextResponse.json({ error: "Chat not found" }, { status: 404 });
		}

		return NextResponse.json(chatRecord);
	} catch (error) {
		console.error("[GET /api/chats/[chatId]] Error:", error);
		return NextResponse.json({ error: "Failed to get chat" }, { status: 500 });
	}
}

/**
 * PATCH /api/chats/[chatId] — Update a chat's title.
 * Body: { title?: string }
 *
 * Archive/unarchive is handled by prefixing/removing "[archived] " from the title.
 * TODO: Add a proper `archived_at` column to the schema for cleaner archive support.
 */
export async function PATCH(
	req: Request,
	{ params }: { params: Promise<{ chatId: string }> },
) {
	try {
		const { chatId } = await params;
		const body = await req.json();

		const chatRecord = await getChat(chatId);
		if (!chatRecord) {
			return NextResponse.json({ error: "Chat not found" }, { status: 404 });
		}

		// Handle explicit title update
		if (typeof body.title === "string") {
			await updateChatTitle(chatId, body.title);
		}

		// Handle archive/unarchive via title prefix convention
		if (typeof body.archived === "boolean") {
			const currentTitle = body.title ?? chatRecord.title ?? "New Chat";
			const isCurrentlyArchived = currentTitle.startsWith("[archived] ");
			const cleanTitle = isCurrentlyArchived
				? currentTitle.slice("[archived] ".length)
				: currentTitle;

			const newTitle = body.archived ? `[archived] ${cleanTitle}` : cleanTitle;

			await updateChatTitle(chatId, newTitle);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[PATCH /api/chats/[chatId]] Error:", error);
		return NextResponse.json(
			{ error: "Failed to update chat" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/chats/[chatId] — Delete a chat and all its nodes/metadata.
 */
export async function DELETE(
	_req: Request,
	{ params }: { params: Promise<{ chatId: string }> },
) {
	try {
		const { chatId } = await params;
		await deleteChat(chatId);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[DELETE /api/chats/[chatId]] Error:", error);
		return NextResponse.json(
			{ error: "Failed to delete chat" },
			{ status: 500 },
		);
	}
}
