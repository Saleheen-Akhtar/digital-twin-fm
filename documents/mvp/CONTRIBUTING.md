# Contributing — Digital Twin FM

> Read this before writing any code. It covers everything from branching to code review to release.

---

## Table of Contents

- [Before You Start](#before-you-start)
- [Branch Strategy](#branch-strategy)
- [Branch Protection Rules](#branch-protection-rules)
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
- Read [MVP_SCOPE.md](./MVP_SCOPE.md) — what is included/excluded in the first version
- Check [FILE_STRUCTURE.md](./FILE_STRUCTURE.md) — where everything lives
- Check [API_CONTRACTS.md](./API_CONTRACTS.md), [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), and [REALTIME_EVENTS.md](./REALTIME_EVENTS.md) before changing API/data flows
- For security-sensitive work, read [SECURITY.md](./SECURITY.md)
- For feature scope and priorities, refer to [TECHNICAL_PRD.md](./TECHNICAL_PRD.md)

If your change touches multiple services or adds a new pattern, discuss it with the team before writing code.

---

## Branch Strategy

```
main        ← production, protected, deploys to prod
dev         ← integration, protected, auto-deploys to staging
feature/*   ← all new work branches off dev
fix/*       ← bug fixes branch off dev
chore/*     ← tooling, deps, config
docs/*      ← documentation-only changes
```

**Never commit directly to `main` or `dev`.**

### Live branches (current state)

| Branch | Status | Purpose |
|--------|--------|---------|
| `main` | Active, protected | Production. Tag releases here. |
| `dev` | Active, protected | Integration. All feature PRs land here first. |

### Branch naming

```bash
feature/<domain>/<short-description>    # feature/alerts/push-notifications
fix/<domain>/<short-description>        # fix/monitoring/chart-flicker
chore/<short-description>               # chore/upgrade-drizzle
docs/<short-description>                # docs/update-api-contracts
```

Keep names lowercase, hyphen-separated, and descriptive.

---

## Branch Protection Rules

These rules are enforced at the GitHub repository level (Settings → Branches → Branch protection rules).

### `main` protection

- Require pull request before merging
- Require approvals: **1**
- Dismiss stale pull request approvals when new commits are pushed
- Require review from Code Owners
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Require linear history (no merge commits)
- Allow force pushes: **disabled**
- Allow deletions: **disabled**

### `dev` protection

- Require pull request before merging
- Require approvals: **1**
- Require status checks to pass before merging
- Allow force pushes: **disabled**
- Allow deletions: **disabled**

### CODEOWNERS

A `CODEOWNERS` file at the repo root auto-assigns reviewers based on the files a PR touches. See the [Domain Ownership](#domain-ownership) section for the current owners. At least one code owner must approve before merge.

---

## Workflow

```text
1. Pull latest dev
   git checkout dev && git pull

2. Create your branch from dev
   git checkout -b feature/alerts/push-notifications

3. Make changes + write tests

4. Run all checks locally (must pass before pushing)
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build

5. Push and open a PR against dev
   git push -u origin feature/alerts/push-notifications

6. Address review comments

7. Squash merge into dev once approved

8. Periodically, dev is merged into main via a release PR
```

### Release flow (dev → main)

When `dev` is stable and ready for production:

1. Open a PR titled `release: v0.X.0` from `dev` → `main`
2. Get 1 approval from a code owner of the merged code
3. After merge, tag the release: `git tag -a v0.X.0 -m "Release v0.X.0"`
4. Push the tag: `git push origin v0.X.0`

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
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

```markdown
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
- If you disagree with feedback, discuss — don't silently ignore
- Keep the PR up to date with `dev` (rebase, don't merge)

### As a reviewer

- Review within **1 business day** of being requested
- Approve only when you're genuinely happy with the code
- Use labels: `nit:` for minor style points, `blocker:` for things that must change, `question:` for clarifications
- Focus on correctness, maintainability, and consistency — not personal preference
### Merge rules

- Minimum **1 approval** required; merges into `main` must include approval from a code owner of the changed files
- All CI checks must be green
- **Squash merge** into `dev` — keep history clean
- Delete the branch after merge

---

## Domain Ownership

If your change touches a domain you don't own, loop in the owner as a reviewer.

| Domain / Path | Primary Owner | Secondary Owner |
|---|---|---|
| `apps/web/app/building-overview/` | Akshay | Sahil |
| `apps/web/app/digital-twin/` | Akshay | Sahil |
| `apps/web/app/monitoring/` | Sumanth | Akshay |
| `apps/web/app/alerts/` | Sumanth | Akshay |
| `apps/web/app/maintenance/` | Sahil | Sumanth |
| `apps/web/app/ai-copilot/` | Sudhanva | Sahil |
| `apps/web/app/executive-dashboard/` | Sahil | Akshay |
| `apps/api-gateway/` | Sahil | Sudhanva |
| `apps/ingestion-service/` | Sumanth | Sahil |
| `apps/ai-service/` | Sudhanva | Sumanth |
| `packages/db/` | Sahil | Sudhanva |
| `packages/ui/` | Akshay | Sahil |
| `packages/types/` | Sahil | All |
| `docs/`, `documents/` | Sahil | All |
| `docker-compose.yml`, `Dockerfile*` | Sahil | Sumanth |
| `.github/`, CI/CD workflows | Sahil | — |

Changes to `packages/db`, `packages/ui`, or anything under `apps/api-gateway/` affect every service — these need extra care and should get **2+ approvals** when possible (see `CODEOWNERS` for assigned reviewers).

### CODEOWNERS file

These ownership rules are encoded in the repo-root `CODEOWNERS` file. GitHub uses it to auto-assign reviewers and to enforce required reviews. If your team changes, update both this table and the `CODEOWNERS` file.
