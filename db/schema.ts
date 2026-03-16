import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chat = sqliteTable("chat", {
  id: text("id").primaryKey(),
  title: text("title"),
  defaultModel: text("default_model"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const node = sqliteTable(
  "node",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id),
    parentId: text("parent_id"), // nullable — null = root node of the chat
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("node_chat_id_idx").on(t.chatId), index("node_parent_id_idx").on(t.parentId)],
);

export const nodeMetadata = sqliteTable(
  "node_metadata",
  {
    nodeId: text("node_id")
      .primaryKey()
      .references(() => node.id),
    provider: text("provider"),
    model: text("model"),
    temperature: real("temperature"),
    toolsCalled: text("tools_called"), // JSON array
    files: text("files"), // JSON array
    tokenCount: integer("token_count"),
  },
  (t) => [
    index("node_metadata_provider_idx").on(t.provider),
    index("node_metadata_model_idx").on(t.model),
  ],
);

export type Chat = InferSelectModel<typeof chat>;
export type NewChat = InferInsertModel<typeof chat>;
export type Node = InferSelectModel<typeof node>;
export type NewNode = InferInsertModel<typeof node>;
export type NodeMetadata = InferSelectModel<typeof nodeMetadata>;
export type NewNodeMetadata = InferInsertModel<typeof nodeMetadata>;
