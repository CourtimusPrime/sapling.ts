import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  JSONSchema7,
  streamText,
  convertToModelMessages,
  type UIMessage,
} from "ai";

const usingOpenRouter = !!process.env.OPENROUTER_API_KEY;

const provider = usingOpenRouter
  ? createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    })
  : createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const model = usingOpenRouter
  ? provider.chat(process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini")
  : provider.responses(process.env.OPENAI_MODEL ?? "gpt-4o-mini");

export async function POST(req: Request) {
  const {
    messages,
    system,
    tools,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
  } = await req.json();

  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    system,
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
