# Sapling — Remaining Gaps (PRD vs Codebase)

> Auto-maintained by the recurring dev loop. Items are deleted when shipped.

## High Priority

- [ ] **Authentication** — User registration/login, session management, per-user data isolation (PRD requires user table, user_api_key table, chat.user_id FK)

## Medium Priority

- [ ] **API key management** — Per-user, per-provider encrypted key storage (replace env var approach)

## Low Priority

- [ ] **Input validation hardening** — Max-length checks on all string fields in API routes
- [ ] **Lockfile** — Commit a `yarn.lock` or `package-lock.json` for reproducible builds and `npm audit`
- [ ] **Search within conversation** — Find messages across branches
- [ ] **Mobile UX polish** — Improve tree panel overlay transitions and gesture support
