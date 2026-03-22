# Sapling — Remaining Gaps (PRD vs Codebase)

> Auto-maintained by the recurring dev loop. Items are deleted when shipped.

## High Priority

- [ ] **Context window management** — Token counting per message, 45% threshold auto-trimming, token usage indicator in the composer area
- [ ] **Authentication** — User registration/login, session management, per-user data isolation

## Medium Priority

- [ ] **API key management** — Per-user, per-provider encrypted key storage (replace env var approach)
- [ ] **Branch naming/annotation** — Allow users to label branches for easier navigation
- [ ] **System node insertion** — Allow inserting system prompt nodes at any point in the tree to steer the model

## Low Priority

- [ ] **Rate limiting** — Add per-IP rate limiting on `/api/chat` to prevent abuse
- [ ] **Input validation hardening** — Max-length checks on all string fields in API routes
- [ ] **Lockfile** — Commit a `yarn.lock` or `package-lock.json` for reproducible builds and `npm audit`
- [ ] **Tree page cleanup** — Remove or redirect `/tree` standalone page now that split-view exists
- [ ] **Search within conversation** — Find messages across branches
- [ ] **Mobile UX polish** — Improve tree panel overlay transitions and gesture support
