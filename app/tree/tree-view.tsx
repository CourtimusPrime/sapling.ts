"use client";

import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type NodeData = {
  id: string;
  chatId: string;
  parentId: string | null;
  content: string;
};

// Compute (x, y) positions via a simple recursive tree layout.
// Returns a map of nodeId → {x, y}.
function layoutTree(nodes: NodeData[]): Map<string, { x: number; y: number }> {
  const NODE_W = 220;
  const NODE_H = 80;
  const GAP_X = 40;
  const GAP_Y = 120;

  const childMap = new Map<string | null, NodeData[]>();
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
    const total = children.reduce((sum, c) => sum + calcWidth(c.id) + GAP_X, -GAP_X);
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

export function TreeView({ nodes: rawNodes }: { nodes: NodeData[] }) {
  const positions = layoutTree(rawNodes);

  const flowNodes: Node[] = rawNodes.map((n) => ({
    id: n.id,
    position: positions.get(n.id) ?? { x: 0, y: 0 },
    data: { label: n.content },
    style: {
      width: 220,
      fontSize: 12,
      background: "#1e1e2e",
      border: "1px solid #45475a",
      borderRadius: 8,
      color: "#cdd6f4",
      padding: "8px 12px",
    },
  }));

  const flowEdges: Edge[] = rawNodes
    .filter((n) => n.parentId !== null)
    .map((n) => ({
      id: `${n.parentId}-${n.id}`,
      source: n.parentId!,
      target: n.id,
      style: { stroke: "#6c7086" },
    }));

  if (rawNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        No messages in the database yet.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
    >
      <Background color="#313244" gap={24} />
      <Controls />
    </ReactFlow>
  );
}
