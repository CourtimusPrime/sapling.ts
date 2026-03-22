import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BranchLabelsStore {
	labels: Record<string, string>; // nodeId -> label
	setLabel: (nodeId: string, label: string) => void;
	removeLabel: (nodeId: string) => void;
}

export const useBranchLabelsStore = create<BranchLabelsStore>()(
	persist(
		(set) => ({
			labels: {},
			setLabel: (nodeId, label) =>
				set((state) => ({
					labels: { ...state.labels, [nodeId]: label },
				})),
			removeLabel: (nodeId) =>
				set((state) => {
					const { [nodeId]: _, ...rest } = state.labels;
					return { labels: rest };
				}),
		}),
		{ name: "sapling-branch-labels" },
	),
);
