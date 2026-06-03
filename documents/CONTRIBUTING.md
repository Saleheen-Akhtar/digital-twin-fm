# Contributing — Digital Twin FM

> Read this before writing any code. It covers everything from branching to code review to release.

---

## Table of Contents

- [Before You Start](#before-you-start)
- [Branch Strategy](#branch-strategy)
- [Workflow](#workflow)
- [Commit Messages](#commit-messages)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Requests](#pull-requests)
- [Code Review](#code-review)
- [Domain Ownership](#domain-ownership)

---

## Before You Start

- Read the [README.md](./README.md) — setup, running services, environment variables
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) — system design and service boundaries
- Check [FILE_STRUCTURE.md](./FILE_STRUCTURE.md) — where everything lives
- For feature scope and priorities, refer to [documents/TECHNICAL_PRD.md](./documents/TECHNICAL_PRD.md)

If your change touches multiple services or adds a new pattern, discuss it with the team before writing code.

---

## Branch Strategy

```
main        ← production only, protected
dev         ← integration branch, auto-deploys to staging
feature/*   ← all new work branches off dev
fix/*       ← bug fixes branch off dev
chore/*     ← tooling, deps, config
```

**Never commit directly to `main` or `dev`.**

### Branch naming

```bash
feature/<domain>/<short-description>    # feature/alerts/push-notifications
fix/<domain>/<short-description>        # fix/monitoring/chart-flicker
chore/<short-description>               # chore/upgrade-drizzle
```

---

## Workflow

```
1. Pull latest dev
   git checkout dev && git pull

2. Create your branch
   git checkout -b feature/alerts/push-notifications

3. Make changes + write tests

4. Run all checks locally (must pass before pushing)
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build

5. Push and open a PR against dev

6. Address review comments

7. Squash merge into dev once approved
```

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

feat(alerts):     add push notification on critical alert
fix(monitoring):  resolve chart re-render on stale data
chore:            upgrade drizzle-orm to 0.31
docs:             update ARCHITECTURE.md with Kafka future plan
test(ai-service): add unit tests for anomaly detector
refactor(db):     extract sensor query helpers
```

**Types:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`

Keep the subject line under 72 characters. No period at the end.

---

## Code Standards

### TypeScript

- **No `any`** — use types from `@repo/types` or define locally
- Strict mode is enforced — `noImplicitAny`, `strictNullChecks`
- All API request/response shapes validated with Zod DTOs in api-gateway

### Frontend

- Default to **Server Components** — add `'use client'` only when needed (WebSocket, Zustand, user interaction)
- **Server state** via React Query; **UI state** via Zustand (one slice per domain)
- Never import across feature domains directly — always go through the domain's `index.ts`
- No magic colour values — use tokens from `@repo/ui/src/tokens.ts`
- No hardcoded spacing — use Tailwind utility classes (`p-4`, `gap-2`, etc.)

### Backend

- One controller per domain — keep controllers thin, logic in services
- Validate all inputs via Zod DTO before they reach the service layer
- Never write raw SQL — use Drizzle query builder; raw SQL only in migration files

### General

- No commented-out code in PRs
- No `console.log` left in production code — use the shared logger
- Keep functions small and single-purpose

---

## Testing

### Frontend (Jest + React Testing Library)

```bash
pnpm --filter web test
```

- Unit test hooks and service functions
- Component tests for anything with conditional rendering or user interaction
- No need to test pure presentational components

### Backend (Jest)

```bash
pnpm --filter api-gateway test
```

- Unit test service layer logic
- Integration tests for critical API routes

### AI Service (Pytest)

```bash
cd apps/ai-service && pytest
```

- Unit test anomaly detection and prediction models
- Mock LLM calls in tests — never hit real APIs in CI

### Coverage

No hard coverage threshold enforced yet, but every new feature should ship with tests for its core logic.

---

## Pull Requests

- Keep PRs **small and focused** — one feature or fix per PR
- Fill in the PR template completely
- Link the related issue or PRD section if applicable
- Add screenshots or a short Loom for any UI changes
- Mark as **Draft** if it's not ready for review

### PR template

```
## What
Brief description of what this PR does.

## Why
Why is this change needed? Link to PRD section or issue.

## How
Key implementation decisions worth calling out.

## Testing
How did you test this? Any manual steps the reviewer should follow?

## Screenshots (if UI change)
```

---

## Code Review

### As an author

- Respond to all comments before re-requesting review
- If you disagree with feedback, discuss — don't silently ignore it
- Keep the PR up to date with `dev` (rebase, don't merge)

### As a reviewer

- Review within **1 business day** of being requested
- Approve only when you're genuinely happy with the code
- Use labels: `nit:` for minor style points, `blocker:` for things that must change, `question:` for clarifications
- Focus on correctness, maintainability, and consistency — not personal preference

### Merge rules

- Minimum **1 approval** required
- All CI checks must be green
- **Squash merge** into `dev` — keep history clean
- Delete the branch after merge

---

## Domain Ownership

If your change touches a domain you don't own, loop in the owner as a reviewer.

| Domain | Owner |
|---|---|
| `building-overview/` | Akshay |
| `digital-twin/` | Akshay |
| `monitoring/` | Sumanth |
| `alerts/` | Sumanth |
| `maintenance/` | Sahil |
| `ai-copilot/` | Sudhanva |
| `executive-dashboard/` | Shared |
| `api-gateway/` | Shared |
| `packages/db` | Shared |
| `packages/ui` | Shared |

Changes to `packages/db` or `packages/ui` affect every service — these need extra care and at least 2 approvals.
