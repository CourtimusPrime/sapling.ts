![Sapling](./public/banner.png)

# 🌱 Sapling

Sapling is a **branching chat app** that turns every conversation into a navigable mindmap. Unlike linear chat interfaces, Sapling lets you fork any message, keep multiple threads alive simultaneously, and precisely control what context the model sees — so you can explore ideas without losing earlier paths or polluting the model's attention with irrelevant history.

Sapling looks like a familiar chatbot, but the real superpower is the sidebar mindmap: each message chain is a node path you can revisit and branch from. When generating a reply, Sapling walks up the selected branch and includes messages until it reaches ~45% of the model's context window, so long conversations never turn into context soup.

---

## Problem

When conversations drift -- because you explore a tangent, tried a different framing, or the model went in the wrong direction -- your only options are to manually scroll back, start over, and stuff context into a new message manually. There is no way to easily keep multiple simultaneous lines of reasoning alive or to preceisely choose which messages the model should and should not see. 

---

## Goals

- Let users branch a conversation at any node and pursue multiple lines of thought independently
- Visualize the conversation tree so users always know where they are and what paths exist
- Give users explicit control over context: which messages are upstream of the current node, and how much of the context window they consume
- Remain model-agnostic — users supply their own API credentials and choose the model

---

## Non-Goals

- Real-time collaborative editing (single-user sessions only, for now)
- Mobile-native apps
- Voice input or output
- Fine-tuning or model hosting

---

## Users

Sapling is designed for individual practitioners — engineers, product managers, researchers, and writers — who use AI assistants heavily and have hit the ceiling of linear chat. The target user is comfortable supplying their own AI API key and values control over the model's context.

---

## User Stories

**Branching**
- As a user, I can click any message in the mindmap and fork the conversation from that point, so I can explore a different direction without losing the original thread.
- As a user, I can see all branches of a conversation and switch between them freely.
- As a user, I can name or annotate a branch so I remember what I was exploring.

**Context control**
- As a user, I can see how many tokens the current branch path consumes before sending a message.
- As a user, Sapling automatically trims context to a safe threshold so I never hit a hard API limit mid-conversation.
- As a user, I can insert a system node at any point in the tree to steer the model's behavior from that branch onward.

**Model access**
- As a user, I provide my own API key and it is stored securely — never exposed to other users.
- As a user, I can choose which model to use per chat or per branch.
- As a user, I can see which model and provider generated each node.

**Session management**
- As a user, I can create multiple named chats, each with its own tree.
- As a user, my chats persist across sessions.
- As a user, I can sign in and out; my data is not accessible to other accounts.

---

## Features

### Conversation tree
- Every message (user or assistant) is a **node** with a parent pointer, forming an explicit tree rather than a flat list.
- The primary UI surface is a split view: a chat panel on the left and a zoomable/pannable mindmap on the right.
- Clicking any node in the mindmap navigates the chat panel to that branch and sets it as the active context for the next message.
- Nodes are color-coded by role (user, assistant, system).

### Branch creation
- Any node can be the starting point for a new branch via a fork action (button or keyboard shortcut).
- Branches diverge visually in the mindmap; sibling branches are laid out side by side.
- The active branch is highlighted; inactive branches are visible but dimmed.

### Context window management
- Before each generation, Sapling computes the token count of the full ancestor path (root → selected node).
- If the path exceeds the configured threshold (default: 45% of the model's stated context window), Sapling trims from the oldest messages first, preserving the system prompt and the most recent exchanges.
- A token usage indicator is shown in the input area while composing a message.

### Node metadata
- Each assistant node records: provider, model, temperature, token count, and any tools invoked.
- This metadata is visible on hover or in a node detail panel.

### Authentication & API key management
- Users register with an email and password.
- Each user stores one API key per provider; keys are encrypted at rest.
- The key is never returned to the client after initial submission — only a masked indicator confirming a key is set.

### Model selection
- Users can configure a default model at the account level.
- The default can be overridden per chat.
- Model selection is surfaced in the chat settings panel, not the main input area, to keep the interface clean.

---

## 🗄️ Data Model

> **DBDiagram**: [Click Here](https://dbdiagram.io/d/Sapling-69afb76877d079431b4557b3)

```dbml
Table user {
  id bigint [pk, increment]
  email text [not null, unique]
  password_hash text [not null]
  created_at timestamp [default: current_timestamp]
}

Table user_api_key {
  user_id bigint [pk, ref: > user.id]
  provider text [pk]
  encrypted_key text [not null]
  created_at timestamp [default: current_timestamp]
}

Table chat {
  id bigint [pk, increment]
  user_id bigint [not null, ref: > user.id]
  title text
  default_model text
  created_at timestamp [default: current_timestamp]
}

Enum role {
  user
  assistant
  system
}

Table node {
  id uuid [pk, auto generated]
  chat_id bigint [not null, ref: > chat.id]
  parent_id uuid [default: null]
  role role [not null]
  content text
  created_at timestamp [default: current_timestamp]

  Indexes {
    (chat_id)
    (parent_id)
  }
}

Table node_metadata {
  node_id uuid [pk, ref: > node.id]
  provider text [not null]
  model text [not null]
  temperature float [not null]
  tools_called text[] [default: null]
  files text[] [default: null]
  token_count bigint [not null, default: 0]

  Indexes {
    (node_id)
    (provider)
    (model)
  }
}
```

---

## 📔Terminology

| Term | Definition |
| ---- | ---------- |
| `chat` | Root container for a conversation tree |
| `node` | A single message or checkpoint within a chat |
| `branch` | A path from the root to a leaf node |
| `fork` | The act of creating a new child node from an existing non-leaf node |
| `active branch` | The branch currently selected for display and generation |
| `context path` | The ordered list of ancestor nodes fed to the model for a given generation |

---

## UX Principles

- **Spatial memory over scroll**: the mindmap gives conversations a physical location the user can learn and return to, rather than relying on scroll position.
- **Minimal chrome**: the input area stays clean; metadata and settings are secondary surfaces.
- **No surprises on context**: the user should always be able to see exactly what the model will receive before hitting send.
- **Forking is cheap**: the action to branch should feel as lightweight as sending a message, not like a modal workflow.