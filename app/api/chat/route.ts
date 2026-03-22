import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
	convertToModelMessages,
	type JSONSchema7,
	streamText,
	type UIMessage,
} from "ai";

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

	const result = streamText({
		model,
		messages: await convertToModelMessages(messages),
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
