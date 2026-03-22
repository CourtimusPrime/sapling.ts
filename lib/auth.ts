import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
	timingSafeEqual,
} from "node:crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

/** Hash a password using scrypt with a random salt. */
export function hashPassword(password: string): string {
	const salt = randomBytes(SALT_LENGTH).toString("hex");
	const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
	return `${salt}:${hash}`;
}

/** Verify a password against a stored salt:hash string. */
export function verifyPassword(password: string, storedHash: string): boolean {
	const parts = storedHash.split(":");
	if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
	const [salt, hash] = parts;
	const hashBuffer = Buffer.from(hash, "hex");
	const testBuffer = scryptSync(password, salt, KEY_LENGTH);
	return timingSafeEqual(hashBuffer, testBuffer);
}

/** Generate a cryptographically random session token (64 hex chars). */
export function generateSessionToken(): string {
	return randomBytes(32).toString("hex");
}

/** Generate a random user ID (32 hex chars). */
export function generateUserId(): string {
	return randomBytes(16).toString("hex");
}

// ---------------------------------------------------------------------------
// API key encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

const effectiveEncryptionKey =
	process.env.ENCRYPTION_KEY ?? "dev-only-not-for-production";

function deriveEncryptionKey(): Buffer {
	if (
		!process.env.ENCRYPTION_KEY &&
		process.env.NODE_ENV === "production" &&
		typeof window === "undefined"
	) {
		throw new Error(
			"ENCRYPTION_KEY environment variable is required in production",
		);
	}
	return scryptSync(effectiveEncryptionKey, "sapling-salt", 32);
}

/** Encrypt an API key for storage. Returns iv:tag:ciphertext in hex. */
export function encryptApiKey(plaintext: string): string {
	const key = deriveEncryptionKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a stored API key. Expects iv:tag:ciphertext in hex. */
export function decryptApiKey(ciphertext: string): string {
	const [ivHex, tagHex, encryptedHex] = ciphertext.split(":");
	const key = deriveEncryptionKey();
	const decipher = createDecipheriv(
		"aes-256-gcm",
		key,
		Buffer.from(ivHex, "hex"),
	);
	decipher.setAuthTag(Buffer.from(tagHex, "hex"));
	return (
		decipher.update(Buffer.from(encryptedHex, "hex"), undefined, "utf8") +
		decipher.final("utf8")
	);
}
