/**
 * Lightweight token estimation and context window management.
 *
 * Works in both client and server environments (no browser APIs).
 * Uses a ~4 characters per token heuristic rather than loading a full
 * tokenizer — accurate enough for threshold decisions.
 */

/**
 * Approximate token count using the ~4 chars per token heuristic.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/** Known context window sizes for popular models (in tokens). */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
	// OpenRouter format
	"openai/gpt-4o-mini": 128_000,
	"openai/gpt-4o": 128_000,
	"anthropic/claude-sonnet-4": 200_000,
	"anthropic/claude-haiku-4": 200_000,
	"google/gemini-2.5-flash": 1_000_000,
	"google/gemini-2.5-pro": 1_000_000,
	// OpenAI direct format
	"gpt-4o-mini": 128_000,
	"gpt-4o": 128_000,
	"o3-mini": 200_000,
};

export const DEFAULT_CONTEXT_WINDOW = 128_000;

/** Trim threshold: 45% of the model's stated context window. */
export const CONTEXT_THRESHOLD = 0.45;

/** Minimum number of recent messages to always preserve when trimming. */
const MIN_KEEP_RECENT = 4;

export function getContextWindow(modelId: string | null): number {
	if (!modelId) return DEFAULT_CONTEXT_WINDOW;
	return MODEL_CONTEXT_WINDOWS[modelId] ?? DEFAULT_CONTEXT_WINDOW;
}

export function getMaxTokens(modelId: string | null): number {
	return Math.floor(getContextWindow(modelId) * CONTEXT_THRESHOLD);
}

/**
 * Given the current branch messages and model, compute:
 * - totalTokens: estimated tokens for the full ancestor path
 * - maxTokens: 45% of the model's context window
 * - percentage: how full the context is (0-100)
 * - shouldTrim: whether we need to trim
 */
export function computeContextUsage(
	messages: Array<{ role: string; content: string }>,
	modelId: string | null,
): {
	totalTokens: number;
	maxTokens: number;
	percentage: number;
	shouldTrim: boolean;
} {
	const totalTokens = messages.reduce(
		(sum, m) => sum + estimateTokens(m.content),
		0,
	);
	const maxTokens = getMaxTokens(modelId);
	const percentage = Math.min(100, Math.round((totalTokens / maxTokens) * 100));

	return {
		totalTokens,
		maxTokens,
		percentage,
		shouldTrim: totalTokens > maxTokens,
	};
}

/**
 * Trim messages to fit within the context threshold.
 *
 * Strategy:
 *   1. Always keep the system prompt (index 0 if role === "system").
 *   2. Always keep the last `MIN_KEEP_RECENT` messages.
 *   3. Remove the oldest non-protected messages first until under budget.
 *
 * Returns a new array — does not mutate the input.
 */
export function trimMessages<T extends { role: string; content: string }>(
	messages: T[],
	modelId: string | null,
): T[] {
	const maxTokens = getMaxTokens(modelId);

	let totalTokens = messages.reduce(
		(sum, m) => sum + estimateTokens(m.content),
		0,
	);

	if (totalTokens <= maxTokens) return messages;

	const hasSystemPrompt = messages.length > 0 && messages[0].role === "system";
	const trimStartIdx = hasSystemPrompt ? 1 : 0;
	const trimEndIdx = Math.max(trimStartIdx, messages.length - MIN_KEEP_RECENT);

	// Build a list of indices that are candidates for removal (oldest first).
	const removable: number[] = [];
	for (let i = trimStartIdx; i < trimEndIdx; i++) {
		removable.push(i);
	}

	// Greedily remove from the oldest until we're under budget.
	const removeSet = new Set<number>();
	for (const idx of removable) {
		if (totalTokens <= maxTokens) break;
		totalTokens -= estimateTokens(messages[idx].content);
		removeSet.add(idx);
	}

	return messages.filter((_, i) => !removeSet.has(i));
}
