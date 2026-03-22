import { create } from "zustand";

export const OPENROUTER_MODELS = [
	{ id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
	{ id: "openai/gpt-4o", label: "GPT-4o" },
	{ id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
	{ id: "anthropic/claude-haiku-4", label: "Claude Haiku 4" },
	{ id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
	{ id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

export const OPENAI_MODELS = [
	{ id: "gpt-4o-mini", label: "GPT-4o Mini" },
	{ id: "gpt-4o", label: "GPT-4o" },
	{ id: "o3-mini", label: "o3 Mini" },
] as const;

interface ModelStore {
	/** null means use the server default */
	model: string | null;
	setModel: (model: string | null) => void;
}

export const useModelStore = create<ModelStore>((set) => ({
	model: null,
	setModel: (model) => set({ model }),
}));
