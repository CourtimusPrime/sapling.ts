"use client";

import {
	Background,
	Controls,
	type Edge,
	Handle,
	type Node,
	type NodeMouseHandler,
	type NodeProps,
	Position,
	ReactFlow,
	type ReactFlowInstance,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import type { ThreadMessage } from "@assistant-ui/core";
import { useThreadRuntime } from "@assistant-ui/react";
import { GitFork } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBranchLabelsStore } from "@/lib/branch-labels-store";

// ---------- Layout algorithm ----------

type NodeMetadata = {
	modelId?: string;
	usage?: { promptTokens?: number; completionTokens?: number };
};

type TreeNodeData = {
	id: string;
	parentId: string | null;
	role: "user" | "assistant" | "system";
	content: string;
	isActive: boolean;
	isHead: boolean;
	metadata?: NodeMetadata;
};

const NODE_W = 24;
const NODE_H = 24;
const GAP_X = 20;
const GAP_Y = 24;

function layoutTree(
	nodes: TreeNodeData[],
): Map<string, { x: number; y: number }> {
	const childMap = new Map<string | null, TreeNodeData[]>();
	for (const n of nodes) {
		const key = n.parentId ?? null;
		if (!childMap.has(key)) childMap.set(key, []);
		childMap.get(key)!.push(n);
	}

	const subtreeWidth = new Map<string, number>();

	function calcWidth(id: string, visited = new Set<string>()): number {
		if (visited.has(id)) return NODE_W; // cycle detected
		visited.add(id);
		const children = childMap.get(id) ?? [];
		if (children.length === 0) {
			subtreeWidth.set(id, NODE_W);
			return NODE_W;
		}
		const total = children.reduce(
			(sum, c) => sum + calcWidth(c.id, visited) + GAP_X,
			-GAP_X,
		);
		subtreeWidth.set(id, total);
		return total;
	}

	const roots = childMap.get(null) ?? [];
	for (const r of roots) calcWidth(r.id);

	const positions = new Map<string, { x: number; y: number }>();

	function place(
		id: string,
		x: number,
		y: number,
		visited = new Set<string>(),
	) {
		if (visited.has(id)) return; // cycle detected
		visited.add(id);
		positions.set(id, { x, y });
		const children = childMap.get(id) ?? [];
		let cursor = x - (subtreeWidth.get(id)! - NODE_W) / 2;
		for (const child of children) {
			const cw = subtreeWidth.get(child.id)!;
			place(child.id, cursor + (cw - NODE_W) / 2, y + NODE_H + GAP_Y, visited);
			cursor += cw + GAP_X;
		}
	}

	let rootX = 0;
	for (const r of roots) {
		place(r.id, rootX, 0);
		rootX += (subtreeWidth.get(r.id) ?? NODE_W) + GAP_X * 2;
	}

	return positions;
}

// ---------- Helpers ----------

function extractTextContent(message: ThreadMessage): string {
	for (const part of message.content) {
		if (part.type === "text") {
			const text = part.text.trim();
			return text.length > 80 ? `${text.slice(0, 77)}...` : text;
		}
	}
	return "(empty)";
}

function extractMetadata(message: ThreadMessage): NodeMetadata | undefined {
	if (message.role !== "assistant") return undefined;

	const custom = message.metadata?.custom as
		| Record<string, unknown>
		| undefined;
	if (!custom) return undefined;

	const modelId = custom.modelId as string | undefined;
	const usage = custom.usage as
		| { promptTokens?: number; completionTokens?: number }
		| undefined;

	if (!modelId && !usage) return undefined;
	return { modelId, usage };
}

const ROLE_STYLES: Record<
	string,
	{ bg: string; border: string; label: string }
> = {
	user: {
		bg: "rgba(49, 46, 129, 0.8)",
		border: "#6366f1",
		label: "You",
	},
	assistant: {
		bg: "rgba(6, 78, 59, 0.8)",
		border: "#10b981",
		label: "Assistant",
	},
	system: {
		bg: "rgba(120, 53, 15, 0.8)",
		border: "#f59e0b",
		label: "System",
	},
};

// ---------- Custom Node Component (defined outside TreePanel for stable reference) ----------

function TreeNode({ data }: NodeProps) {
	const roleStyle = ROLE_STYLES[data.role as string] ?? ROLE_STYLES.system;
	const content = data.label as string;

	return (
		<div className="group relative" title={content}>
			<Handle
				type="target"
				position={Position.Top}
				className="!bg-transparent !border-0 !w-0 !h-0"
			/>
			<div
				className="rounded-full"
				style={{
					width: 16,
					height: 16,
					background: roleStyle.border,
					margin: 4,
				}}
			/>
			{/* Fork button — appears on hover */}
			<button
				type="button"
				className="absolute -right-3 -top-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-0.5 shadow-sm"
				style={{
					background: "rgba(30, 30, 46, 0.95)",
					border: "1px solid rgba(148, 163, 184, 0.3)",
				}}
				onClick={(e) => {
					e.stopPropagation();
					(data.onFork as ((nodeId: string) => void) | undefined)?.(
						data.nodeId as string,
					);
				}}
				title="Fork from here"
			>
				<GitFork size={10} style={{ color: "#94a3b8" }} />
			</button>
			<Handle
				type="source"
				position={Position.Bottom}
				className="!bg-transparent !border-0 !w-0 !h-0"
			/>
		</div>
	);
}

const nodeTypes = { treeNode: TreeNode };

// ---------- Component ----------

export function TreePanel() {
	const threadRuntime = useThreadRuntime();
	const rfInstance = useRef<ReactFlowInstance | null>(null);
	const prevNodeCount = useRef(0);

	const [treeData, setTreeData] = useState<{
		headId?: string | null;
		messages: Array<{ message: ThreadMessage; parentId: string | null }>;
	}>({ headId: null, messages: [] });

	// System prompt dialog state
	const [systemDialogOpen, setSystemDialogOpen] = useState(false);
	const [systemDialogNodeId, setSystemDialogNodeId] = useState<string | null>(
		null,
	);
	const [systemPromptText, setSystemPromptText] = useState("");

	// Label dialog state
	const [labelDialogOpen, setLabelDialogOpen] = useState(false);
	const [labelDialogNodeId, setLabelDialogNodeId] = useState<string | null>(
		null,
	);
	const [labelText, setLabelText] = useState("");

	// Branch labels from persistent store
	const branchLabels = useBranchLabelsStore((s) => s.labels);
	const setBranchLabel = useBranchLabelsStore((s) => s.setLabel);
	const removeBranchLabel = useBranchLabelsStore((s) => s.removeLabel);

	// Subscribe to runtime changes and export the full tree
	useEffect(() => {
		const update = () => {
			try {
				const exported = threadRuntime.export();
				setTreeData(exported);
			} catch {
				// Runtime may not be ready yet
			}
		};

		// Initial load
		update();

		// Subscribe to future changes
		const unsub = threadRuntime.subscribe(update);
		return unsub;
	}, [threadRuntime]);

	// Derive active message IDs by walking from headId up through parent chain
	const activeMessageIds = useMemo(() => {
		const ids = new Set<string>();
		if (!treeData.headId) return ids;

		const parentMap = new Map<string, string | null>();
		for (const { message, parentId } of treeData.messages) {
			parentMap.set(message.id, parentId);
		}

		let current: string | null = treeData.headId;
		while (current) {
			if (ids.has(current)) break; // cycle detected
			ids.add(current);
			current = parentMap.get(current) ?? null;
		}
		return ids;
	}, [treeData]);

	// Fork handler: navigate to the clicked node so the next user message branches from there
	const handleFork = useCallback(
		(nodeId: string) => {
			try {
				const exported = threadRuntime.export();
				threadRuntime.import({ ...exported, headId: nodeId });
			} catch {
				// Runtime may not be ready
			}
		},
		[threadRuntime],
	);

	// System prompt insertion handler
	const handleInsertSystem = useCallback((nodeId: string) => {
		setSystemDialogNodeId(nodeId);
		setSystemPromptText("");
		setSystemDialogOpen(true);
	}, []);

	const confirmInsertSystem = useCallback(() => {
		if (!systemDialogNodeId || !systemPromptText.trim()) return;

		try {
			const exported = threadRuntime.export();
			const newId = crypto.randomUUID();

			const systemMessage = {
				id: newId,
				role: "system",
				content: [{ type: "text", text: systemPromptText.trim() }],
				createdAt: new Date(),
				metadata: {
					custom: {},
				},
			} as unknown as ThreadMessage;

			const updatedMessages = [
				...exported.messages,
				{ message: systemMessage, parentId: systemDialogNodeId },
			];

			threadRuntime.import({
				headId: newId,
				messages: updatedMessages,
			});
		} catch {
			// Runtime may not be ready
		}

		setSystemDialogOpen(false);
		setSystemDialogNodeId(null);
		setSystemPromptText("");
	}, [threadRuntime, systemDialogNodeId, systemPromptText]);

	// Label handler
	const handleLabel = useCallback(
		(nodeId: string) => {
			setLabelDialogNodeId(nodeId);
			setLabelText(branchLabels[nodeId] ?? "");
			setLabelDialogOpen(true);
		},
		[branchLabels],
	);

	const confirmLabel = useCallback(() => {
		if (!labelDialogNodeId) return;

		const trimmed = labelText.trim();
		if (trimmed) {
			setBranchLabel(labelDialogNodeId, trimmed);
		} else {
			removeBranchLabel(labelDialogNodeId);
		}

		setLabelDialogOpen(false);
		setLabelDialogNodeId(null);
		setLabelText("");
	}, [labelDialogNodeId, labelText, setBranchLabel, removeBranchLabel]);

	// Build tree nodes and flow data
	const { flowNodes, flowEdges } = useMemo(() => {
		if (treeData.messages.length === 0) {
			return { flowNodes: [], flowEdges: [] };
		}

		const treeNodes: TreeNodeData[] = treeData.messages.map(
			({ message, parentId }) => ({
				id: message.id,
				parentId,
				role: message.role,
				content: extractTextContent(message),
				isActive: activeMessageIds.has(message.id),
				isHead: message.id === treeData.headId,
				metadata: extractMetadata(message),
			}),
		);

		const positions = layoutTree(treeNodes);

		const nodes: Node[] = treeNodes.map((n) => {
			const style = ROLE_STYLES[n.role] ?? ROLE_STYLES.system;
			const pos = positions.get(n.id) ?? { x: 0, y: 0 };

			return {
				id: n.id,
				type: "treeNode",
				position: pos,
				data: {
					label: n.content,
					role: n.role,
					roleLabel: style.label,
					isActive: n.isActive,
					isHead: n.isHead,
					nodeId: n.id,
					metadata: n.metadata,
					branchLabel: branchLabels[n.id],
					onFork: handleFork,
					onInsertSystem: handleInsertSystem,
					onLabel: handleLabel,
				},
				style: {
					width: NODE_W,
					height: NODE_H,
					background: "transparent",
					border: "none",
					padding: 0,
					opacity: n.isActive ? 1 : 0.4,
					cursor: "pointer",
					transition: "opacity 0.2s",
				},
			};
		});

		const edges: Edge[] = treeData.messages
			.filter(({ parentId }) => parentId !== null)
			.map(({ message, parentId }) => {
				const isActivePath =
					activeMessageIds.has(message.id) && activeMessageIds.has(parentId!);

				return {
					id: `${parentId}-${message.id}`,
					source: parentId!,
					target: message.id,
					style: {
						stroke: isActivePath
							? "rgba(148, 163, 184, 0.8)"
							: "rgba(100, 116, 139, 0.35)",
						strokeWidth: isActivePath ? 2 : 1,
					},
					animated: isActivePath,
				};
			});

		return { flowNodes: nodes, flowEdges: edges };
	}, [
		treeData,
		activeMessageIds,
		handleFork,
		handleInsertSystem,
		handleLabel,
		branchLabels,
	]);

	// Handle node click -- navigate to the clicked node's branch
	const onNodeClick: NodeMouseHandler = useCallback(
		(_event, clickedNode) => {
			try {
				const exported = threadRuntime.export();
				if (exported.headId === clickedNode.id) return; // already there
				threadRuntime.import({ ...exported, headId: clickedNode.id });
			} catch {
				// Runtime may not be ready or node not found
			}
		},
		[threadRuntime],
	);

	// Fit view when the tree structure changes (node count or active branch)
	const treeFingerprint = `${flowNodes.length}:${treeData.headId}`;
	useEffect(() => {
		if (
			treeFingerprint !== prevNodeCount.current.toString() &&
			flowNodes.length > 0
		) {
			prevNodeCount.current = flowNodes.length;
			const timer = setTimeout(() => {
				rfInstance.current?.fitView({ padding: 0.15, duration: 300 });
			}, 50);
			return () => clearTimeout(timer);
		}
	}, [treeFingerprint, flowNodes.length]);

	// Empty state
	if (flowNodes.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
				<GitFork className="size-10 text-muted-foreground/40" />
				<p className="text-muted-foreground text-sm">
					Start chatting to see your conversation tree
				</p>
			</div>
		);
	}

	return (
		<div className="h-full w-full">
			<ReactFlow
				nodes={flowNodes}
				edges={flowEdges}
				nodeTypes={nodeTypes}
				onNodeClick={onNodeClick}
				onInit={(instance) => {
					rfInstance.current = instance;
					instance.fitView({ padding: 0.3 });
				}}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
				minZoom={0.05}
				maxZoom={3}
				proOptions={{ hideAttribution: true }}
			>
				<Background color="#313244" gap={24} />
				<Controls
					showInteractive={false}
					className="!bg-background !border-border !shadow-md [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent"
				/>
			</ReactFlow>

			{/* System Prompt Dialog */}
			<Dialog open={systemDialogOpen} onOpenChange={setSystemDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Insert System Prompt</DialogTitle>
						<DialogDescription>
							Add a system message to steer the model&apos;s behavior from this
							branch onward.
						</DialogDescription>
					</DialogHeader>
					<textarea
						className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
						placeholder="You are a helpful assistant that..."
						value={systemPromptText}
						onChange={(e) => setSystemPromptText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
								confirmInsertSystem();
							}
						}}
					/>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setSystemDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={confirmInsertSystem}
							disabled={!systemPromptText.trim()}
						>
							Insert
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Branch Label Dialog */}
			<Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Name Branch</DialogTitle>
						<DialogDescription>
							Add a label to remember what you were exploring. Leave empty to
							remove.
						</DialogDescription>
					</DialogHeader>
					<Input
						placeholder="e.g. Refactor approach, Creative tone..."
						value={labelText}
						onChange={(e) => setLabelText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								confirmLabel();
							}
						}}
						autoFocus
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setLabelDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={confirmLabel}>
							{labelText.trim() ? "Save" : "Remove"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
