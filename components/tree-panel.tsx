"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type ReactFlowInstance,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useThreadRuntime } from "@assistant-ui/react";
import type { ThreadMessage } from "@assistant-ui/core";
import { GitFork } from "lucide-react";

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

const NODE_W = 240;
const NODE_H = 84;
const GAP_X = 40;
const GAP_Y = 100;

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

  function calcWidth(id: string): number {
    const children = childMap.get(id) ?? [];
    if (children.length === 0) {
      subtreeWidth.set(id, NODE_W);
      return NODE_W;
    }
    const total = children.reduce(
      (sum, c) => sum + calcWidth(c.id) + GAP_X,
      -GAP_X,
    );
    subtreeWidth.set(id, total);
    return total;
  }

  const roots = childMap.get(null) ?? [];
  for (const r of roots) calcWidth(r.id);

  const positions = new Map<string, { x: number; y: number }>();

  function place(id: string, x: number, y: number) {
    positions.set(id, { x, y });
    const children = childMap.get(id) ?? [];
    let cursor = x - (subtreeWidth.get(id)! - NODE_W) / 2;
    for (const child of children) {
      const cw = subtreeWidth.get(child.id)!;
      place(child.id, cursor + (cw - NODE_W) / 2, y + NODE_H + GAP_Y);
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

function formatModelId(modelId: string): string {
  // Strip provider prefix for display (e.g. "openai/gpt-4o-mini" -> "gpt-4o-mini")
  const parts = modelId.split("/");
  return parts.length > 1 ? parts[parts.length - 1] : modelId;
}

function TreeNode({ data }: NodeProps) {
  const roleStyle = ROLE_STYLES[data.role as string] ?? ROLE_STYLES.system;
  const metadata = data.metadata as NodeMetadata | undefined;

  return (
    <div className="group relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
      <div className="text-[11px] leading-snug">
        <div
          className="text-[9px] uppercase tracking-wider mb-0.5 font-semibold"
          style={{ color: roleStyle.border, opacity: 0.85 }}
        >
          {roleStyle.label}
        </div>
        <div className="line-clamp-2" style={{ color: "#e2e8f0" }}>
          {data.label as string}
        </div>
        {metadata && (metadata.modelId || metadata.usage) && (
          <div
            className="mt-1 flex flex-wrap items-center gap-1.5"
            style={{ fontSize: 9 }}
          >
            {metadata.modelId && (
              <span
                className="inline-flex items-center rounded px-1 py-px"
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "rgba(148, 163, 184, 0.9)",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                }}
                title={`Model: ${metadata.modelId}`}
              >
                {formatModelId(metadata.modelId)}
              </span>
            )}
            {metadata.usage && (
              <span
                style={{ color: "rgba(148, 163, 184, 0.65)" }}
                title={`Prompt: ${metadata.usage.promptTokens ?? "?"} tokens, Completion: ${metadata.usage.completionTokens ?? "?"} tokens`}
              >
                {metadata.usage.completionTokens != null
                  ? `${metadata.usage.completionTokens} tok`
                  : null}
              </span>
            )}
          </div>
        )}
      </div>
      {/* Fork button - appears on hover */}
      <button
        className="absolute -right-1 -bottom-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1 shadow-sm"
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "#94a3b8" }}
        >
          <circle cx="12" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
          <path d="M12 12v3" />
        </svg>
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
          onFork: handleFork,
        },
        style: {
          width: NODE_W,
          fontSize: 11,
          background: style.bg,
          border: `1.5px solid ${style.border}`,
          borderRadius: 10,
          color: "#e2e8f0",
          padding: "8px 12px",
          opacity: n.isActive ? 1 : 0.5,
          boxShadow: n.isHead
            ? "0 0 0 2px rgba(96, 165, 250, 0.6)"
            : n.isActive
              ? "0 0 0 2px rgba(255, 255, 255, 0.15)"
              : "none",
          cursor: "pointer",
          transition: "opacity 0.2s, box-shadow 0.2s",
        },
      };
    });

    const edges: Edge[] = treeData.messages
      .filter(({ parentId }) => parentId !== null)
      .map(({ message, parentId }) => {
        const isActivePath =
          activeMessageIds.has(message.id) &&
          activeMessageIds.has(parentId!);

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
  }, [treeData, activeMessageIds, handleFork]);

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

  // Fit view only when the number of nodes changes (not on every token)
  useEffect(() => {
    if (flowNodes.length !== prevNodeCount.current && flowNodes.length > 0) {
      prevNodeCount.current = flowNodes.length;
      // Small delay to let ReactFlow process the new nodes
      const timer = setTimeout(() => {
        rfInstance.current?.fitView({ padding: 0.3 });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [flowNodes.length]);

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
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#313244" gap={24} />
        <Controls
          showInteractive={false}
          className="!bg-background !border-border !shadow-md [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent"
        />
      </ReactFlow>
    </div>
  );
}
