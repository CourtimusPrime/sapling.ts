import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { getSession } from "@/lib/session";

export async function GET() {
	try {
		const sess = await getSession();
		if (!sess) {
			return NextResponse.json(
				{ error: "Not authenticated." },
				{ status: 401 },
			);
		}

		const rows = await db
			.select({ id: user.id, email: user.email })
			.from(user)
			.where(eq(user.id, sess.userId))
			.limit(1);

		const found = rows[0];
		if (!found) {
			return NextResponse.json({ error: "User not found." }, { status: 401 });
		}

		return NextResponse.json(found);
	} catch (error) {
		console.error("[GET /api/auth/me] Error:", error);
		return NextResponse.json(
			{ error: "Failed to get user info." },
			{ status: 500 },
		);
	}
}
