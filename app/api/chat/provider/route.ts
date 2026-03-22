import { NextResponse } from "next/server";

const usingOpenRouter = !!process.env.OPENROUTER_API_KEY;

export async function GET() {
	return NextResponse.json({
		provider: usingOpenRouter ? "openrouter" : "openai",
	});
}
