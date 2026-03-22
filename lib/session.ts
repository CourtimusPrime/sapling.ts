import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { session } from "@/db/schema";
import { generateSessionToken } from "./auth";

const SESSION_COOKIE = "sapling_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Create a new session row and return the token.
 * The caller is responsible for setting the cookie via `setSessionCookie`.
 */
export async function createSession(userId: string): Promise<string> {
	const token = generateSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

	await db.insert(session).values({
		id: token,
		userId,
		expiresAt,
	});

	return token;
}

/**
 * Read the session cookie and validate it against the database.
 * Returns `{ userId }` when valid, or `null` if expired / missing.
 */
export async function getSession(): Promise<{ userId: string } | null> {
	const cookieStore = await cookies();
	const token = cookieStore.get(SESSION_COOKIE)?.value;
	if (!token) return null;

	const rows = await db
		.select({ userId: session.userId })
		.from(session)
		.where(and(eq(session.id, token), gt(session.expiresAt, new Date())))
		.limit(1);

	return rows[0] ?? null;
}

/**
 * Set the session cookie on the response.
 */
export async function setSessionCookie(token: string) {
	const cookieStore = await cookies();
	cookieStore.set(SESSION_COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: SESSION_DURATION_MS / 1000,
		path: "/",
	});
}

/**
 * Delete the session from the database and clear the cookie.
 */
export async function clearSession() {
	const cookieStore = await cookies();
	const token = cookieStore.get(SESSION_COOKIE)?.value;

	if (token) {
		await db.delete(session).where(eq(session.id, token));
	}

	cookieStore.delete(SESSION_COOKIE);
}
