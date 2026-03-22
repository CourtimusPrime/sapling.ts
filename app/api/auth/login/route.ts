import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, setSessionCookie } from "@/lib/session";

const MAX_PASSWORD_LENGTH = 128;

export async function POST(req: Request) {
	try {
		// --- Rate limiting ---
		const headersList = await headers();
		const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
			?? headersList.get("x-real-ip")
			?? "unknown";
		const { allowed } = rateLimit(ip);
		if (!allowed) {
			return NextResponse.json(
				{ error: "Too many requests. Please try again later." },
				{ status: 429 },
			);
		}

		const body = await req.json();
		const { email, password } = body as { email?: string; password?: string };

		if (!email || !password) {
			return NextResponse.json(
				{ error: "Email and password are required." },
				{ status: 400 },
			);
		}

		if (password.length > MAX_PASSWORD_LENGTH) {
			return NextResponse.json(
				{ error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` },
				{ status: 400 },
			);
		}

		const normalizedEmail = email.toLowerCase().trim();

		const rows = await db
			.select()
			.from(user)
			.where(eq(user.email, normalizedEmail))
			.limit(1);

		const found = rows[0];

		if (!found || !verifyPassword(password, found.passwordHash)) {
			return NextResponse.json(
				{ error: "Invalid email or password." },
				{ status: 401 },
			);
		}

		// --- Create session ---
		const token = await createSession(found.id);
		await setSessionCookie(token);

		return NextResponse.json({ id: found.id, email: found.email });
	} catch (error) {
		console.error("[POST /api/auth/login] Error:", error);
		return NextResponse.json(
			{ error: "Login failed. Please try again." },
			{ status: 500 },
		);
	}
}
