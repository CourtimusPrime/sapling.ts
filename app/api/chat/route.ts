import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
	convertToModelMessages,
	type JSONSchema7,
	streamText,
	type UIMessage,
} from "ai";
import { estimateTokens, getMaxTokens } from "@/lib/token-counter";

const usingOpenRouter = !!process.env.OPENROUTER_API_KEY;

const provider = usingOpenRouter
	? createOpenAI({
			baseURL: "https://openrouter.ai/api/v1",
			apiKey: process.env.OPENROUTER_API_KEY,
		})
	: createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const defaultModelId = usingOpenRouter
	? (process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini")
	: (process.env.OPENAI_MODEL ?? "gpt-4o-mini");

function createModel(modelId: string) {
	return usingOpenRouter ? provider.chat(modelId) : provider.responses(modelId);
}

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
		...(!usingOpenRouter && {
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
