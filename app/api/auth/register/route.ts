import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { generateUserId, hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, setSessionCookie } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
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

		// --- Validation ---
		if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
			return NextResponse.json(
				{ error: "A valid email address is required." },
				{ status: 400 },
			);
		}

		if (
			!password ||
			typeof password !== "string" ||
			password.length < MIN_PASSWORD_LENGTH
		) {
			return NextResponse.json(
				{
					error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
				},
				{ status: 400 },
			);
		}

		if (password.length > MAX_PASSWORD_LENGTH) {
			return NextResponse.json(
				{
					error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`,
				},
				{ status: 400 },
			);
		}

		const normalizedEmail = email.toLowerCase().trim();

		// --- Check for duplicate email ---
		const existing = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, normalizedEmail))
			.limit(1);

		if (existing.length > 0) {
			return NextResponse.json(
				{ error: "An account with this email already exists." },
				{ status: 409 },
			);
		}

		// --- Create user ---
		const userId = generateUserId();
		const passwordHash = hashPassword(password);

		await db.insert(user).values({
			id: userId,
			email: normalizedEmail,
			passwordHash,
		});

		// --- Create session ---
		const token = await createSession(userId);
		await setSessionCookie(token);

		return NextResponse.json(
			{ id: userId, email: normalizedEmail },
			{ status: 201 },
		);
	} catch (error) {
		console.error("[POST /api/auth/register] Error:", error);
		return NextResponse.json(
			{ error: "Registration failed. Please try again." },
			{ status: 500 },
		);
	}
}
