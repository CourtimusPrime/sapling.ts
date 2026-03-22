import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
	convertToModelMessages,
	type JSONSchema7,
	streamText,
	type UIMessage,
} from "ai";
import { estimateTokens, getMaxTokens } from "@/lib/token-counter";
import { getSession } from "@/lib/session";
import { getUserApiKey } from "@/lib/api-key-persistence";

const SYSTEM_PROMPT =
	"You are a helpful assistant. Be concise and accurate in your responses.";

export async function POST(req: Request) {
	const {
		messages,
		tools,
		model: requestedModel,
	}: {
		messages: UIMessage[];
		tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
		model?: string;
	} = await req.json();

	// Check for user-specific API keys
	const sessionData = await getSession();
	let userOpenRouterKey: string | null = null;
	let userOpenAIKey: string | null = null;

	if (sessionData) {
		userOpenRouterKey = await getUserApiKey(
			sessionData.userId,
			"openrouter",
		);
		userOpenAIKey = await getUserApiKey(sessionData.userId, "openai");
	}

	// Determine which provider/key to use
	// Priority: user key > env var
	const openRouterKey =
		userOpenRouterKey ?? process.env.OPENROUTER_API_KEY ?? null;
	const openAIKey = userOpenAIKey ?? process.env.OPENAI_API_KEY ?? null;

	const useOpenRouter = !!openRouterKey;

	const provider = useOpenRouter
		? createOpenAI({
				baseURL: "https://openrouter.ai/api/v1",
				apiKey: openRouterKey!,
			})
		: createOpenAI({ apiKey: openAIKey! });

	const defaultModelId = useOpenRouter
		? (process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini")
		: (process.env.OPENAI_MODEL ?? "gpt-4o-mini");

	function createModel(modelId: string) {
		return useOpenRouter
			? provider.chat(modelId)
			: provider.responses(modelId);
	}

	const modelId = requestedModel || defaultModelId;
	const model = createModel(modelId);

	// --- Context window management ---
	// Trim the oldest messages if the conversation exceeds 45% of the
	// model's context window.  The system prompt is injected separately
	// (not inside `messages`), so every UIMessage here is user/assistant.
	const maxTokens = getMaxTokens(modelId);
	const MIN_KEEP_RECENT = 4;

	/** Extract the text content of a UIMessage for token estimation. */
	function uiMessageText(m: UIMessage): string {
		return m.parts
			.map((p) => {
				if (p.type === "text") return p.text;
				if (p.type === "reasoning") return p.text ?? "";
				return "";
			})
			.join("");
	}

	let trimmedMessages = messages;
	let totalTokens = messages.reduce(
		(sum, m) => sum + estimateTokens(uiMessageText(m)),
		0,
	);

	if (totalTokens > maxTokens && messages.length > MIN_KEEP_RECENT) {
		// Keep the last MIN_KEEP_RECENT messages, remove oldest first.
		const protectedEnd = messages.length - MIN_KEEP_RECENT;
		const removeSet = new Set<number>();

		for (let i = 0; i < protectedEnd && totalTokens > maxTokens; i++) {
			totalTokens -= estimateTokens(uiMessageText(messages[i]));
			removeSet.add(i);
		}

		trimmedMessages = messages.filter((_, i) => !removeSet.has(i));
	}

	const result = streamText({
		model,
		messages: await convertToModelMessages(trimmedMessages),
		system: SYSTEM_PROMPT,
		tools: {
			...frontendTools(tools ?? {}),
		},
		...(!useOpenRouter && {
			providerOptions: {
				openai: {
					reasoningEffort: "low",
					reasoningSummary: "auto",
				},
			},
		}),
	});

	return result.toUIMessageStreamResponse({
		sendReasoning: true,
		messageMetadata: ({ part }) => {
			if (part.type === "finish") {
				return {
					usage: part.totalUsage,
				};
			}
			if (part.type === "finish-step") {
				return {
					modelId: part.response.modelId,
				};
			}
			return undefined;
		},
	});
}
