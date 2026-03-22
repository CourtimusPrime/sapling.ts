# Sapling — Remaining Gaps (PRD vs Codebase)

> Auto-maintained by the recurring dev loop. Check items off as they're completed.

## High Priority

- [ ] **Client-side sync integration** — Wire up `runtime.subscribe()` to auto-persist messages to `/api/sync` after each assistant response completes
- [ ] **Fork/branch creation** — Add a "Fork" button on tree nodes and in the chat UI to create a new branch from any message
- [ ] **Context window management** — Token counting per message, 45% threshold auto-trimming, token usage indicator in the composer area
- [ ] **Model/provider selection UI** — Per-chat model selection in a settings panel, store in `chat.default_model`
- [ ] **Authentication** — User registration/login, session management, per-user data isolation

## Medium Priority

- [ ] **API key management** — Per-user, per-provider encrypted key storage (replace env var approach)
- [ ] **Branch naming/annotation** — Allow users to label branches for easier navigation
- [ ] **System node insertion** — Allow inserting system prompt nodes at any point in the tree to steer the model
- [ ] **Node metadata display** — Show provider, model, temperature, token count on hover or in a detail panel
- [ ] **Thread list persistence** — Wire up assistant-ui's `RemoteThreadListAdapter` to persist thread list to SQLite

## Low Priority

- [ ] **Rate limiting** — Add per-IP rate limiting on `/api/chat` to prevent abuse
- [ ] **Input validation hardening** — Max-length checks on all string fields in API routes
- [ ] **Lockfile** — Commit a `yarn.lock` or `package-lock.json` for reproducible builds and `npm audit`
- [ ] **Tree page cleanup** — Remove or redirect `/tree` standalone page now that split-view exists
- [ ] **Search within conversation** — Find messages across branches
- [ ] **Mobile UX polish** — Improve tree panel overlay transitions and gesture support
