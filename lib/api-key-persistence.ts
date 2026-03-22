import { db } from "@/db/client";
import { userApiKey } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { encryptApiKey, decryptApiKey } from "./auth";

export async function getUserApiKeys(userId: string) {
	return db.select().from(userApiKey).where(eq(userApiKey.userId, userId));
}

export async function getUserApiKey(
	userId: string,
	provider: string,
): Promise<string | null> {
	const rows = await db
		.select()
		.from(userApiKey)
		.where(
			and(eq(userApiKey.userId, userId), eq(userApiKey.provider, provider)),
		)
		.limit(1);

	if (!rows[0]) return null;
	try {
		return decryptApiKey(rows[0].encryptedKey);
	} catch {
		return null; // Corrupted or re-keyed — treat as missing
	}
}

export async function saveUserApiKey(
	userId: string,
	provider: string,
	apiKey: string,
) {
	const encrypted = encryptApiKey(apiKey);
	await db
		.insert(userApiKey)
		.values({
			userId,
			provider,
			encryptedKey: encrypted,
		})
		.onConflictDoUpdate({
			target: [userApiKey.userId, userApiKey.provider],
			set: { encryptedKey: encrypted },
		});
}

export async function deleteUserApiKey(userId: string, provider: string) {
	await db
		.delete(userApiKey)
		.where(
			and(eq(userApiKey.userId, userId), eq(userApiKey.provider, provider)),
		);
}

export function maskApiKey(key: string): string {
	if (key.length <= 9) return "***";
	return key.slice(0, 5) + "..." + key.slice(-4);
}
