import { NextResponse } from "next/server";
import {
	deleteUserApiKey,
	getUserApiKeys,
	maskApiKey,
	saveUserApiKey,
} from "@/lib/api-key-persistence";
import { decryptApiKey } from "@/lib/auth";
import { getSession } from "@/lib/session";

const VALID_PROVIDERS = ["openrouter", "openai"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

function isValidProvider(value: unknown): value is Provider {
	return (
		typeof value === "string" && VALID_PROVIDERS.includes(value as Provider)
	);
}

export async function GET() {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const keys = await getUserApiKeys(session.userId);

	const result = keys.map((k) => {
		let maskedKey: string;
		try {
			const decrypted = decryptApiKey(k.encryptedKey);
			maskedKey = maskApiKey(decrypted);
		} catch {
			maskedKey = "***";
		}
		return {
			provider: k.provider,
			hasKey: true,
			maskedKey,
		};
	});

	return NextResponse.json(result);
}

export async function POST(req: Request) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await req.json();
	const { provider, apiKey } = body;

	if (!isValidProvider(provider)) {
		return NextResponse.json(
			{ error: "Invalid provider. Must be 'openrouter' or 'openai'." },
			{ status: 400 },
		);
	}

	if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
		return NextResponse.json(
			{ error: "API key is required." },
			{ status: 400 },
		);
	}

	await saveUserApiKey(session.userId, provider, apiKey.trim());

	return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
	const session = await getSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await req.json();
	const { provider } = body;

	if (!isValidProvider(provider)) {
		return NextResponse.json(
			{ error: "Invalid provider. Must be 'openrouter' or 'openai'." },
			{ status: 400 },
		);
	}

	await deleteUserApiKey(session.userId, provider);

	return NextResponse.json({ success: true });
}
