import { db } from "@/db/client";
import { node } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TreeView } from "./tree-view";

export const dynamic = "force-dynamic";

export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ chatId?: string }>;
}) {
  const { chatId } = await searchParams;

  const rows = await db
    .select({
      id: node.id,
      chatId: node.chatId,
      parentId: node.parentId,
      content: node.content,
      role: node.role,
    })
    .from(node)
    .where(chatId ? eq(node.chatId, chatId) : undefined)
    .orderBy(node.createdAt);

  // Only show user messages as tree nodes
  const userNodes = rows
    .filter((n) => n.role === "user")
    .map((n) => ({
      id: n.id,
      chatId: n.chatId,
      parentId: n.parentId,
      content: n.content.length > 120 ? n.content.slice(0, 117) + "…" : n.content,
    }));

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center gap-3 border-b px-4 h-14 shrink-0">
        <a href="/" className="text-muted-foreground hover:text-foreground text-sm">
          ← back
        </a>
        <span className="text-sm font-medium">Thread Tree</span>
        {chatId && (
          <span className="text-xs text-muted-foreground font-mono">{chatId}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {userNodes.length} user message{userNodes.length !== 1 ? "s" : ""}
        </span>
      </header>
      <div className="flex-1">
        <TreeView nodes={userNodes} />
      </div>
    </div>
  );
}
