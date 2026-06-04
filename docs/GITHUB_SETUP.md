# GitHub Repository Setup — UI Steps

> **Status:** ✅ All steps below are now COMPLETE. This file is preserved for reference / future contributors onboarding new repos.
>
> **Completed on:** 2026-06-04 by Sahil (via `gh api` + `gh repo edit` from local)

---

## Summary of what was done

| Step | Action | Status |
|------|--------|--------|
| 1 | Default branch changed `add-technical-prd-...` → `main` | ✅ Done (via GitHub UI) |
| 2 | Legacy branch `add-technical-prd-17419036079162435053` deleted | ✅ Done (`git push origin --delete`) |
| 3 | `main` branch protection rules applied | ✅ Done (`gh api PUT /branches/main/protection`) |
| 4 | `dev` branch protection rules applied | ✅ Done (`gh api PUT /branches/dev/protection`) |
| 5 | CODEOWNERS file present and active | ✅ Done (file already existed) |
| 6 | "Live branches" table in CONTRIBUTING.md updated | ✅ Done |

---

## Current state (verified)

```text
$ gh api repos/Saleheen-Akhtar/digital-twin-fm/branches | jq '.[] | {name, protected}'

[
  { "name": "dev",  "protected": true },
  { "name": "main", "protected": true }
]
```

### `main` protection (verified)

- Required PR reviews: **0** (solo-dev MVP mode — change to 1+ when adding collaborators)
- Dismiss stale approvals: true
- Require code owner review: false (auto-enabled when collaborators are added)
- Required status checks: `ci` (strict, up-to-date)
- Required linear history: true
- Allow force pushes: false
- Allow deletions: false
- Enforce admins: true

> **Note for solo dev mode:** With `required_approving_review_count: 0`, the author can merge their own PR after CI passes. This is the right setting for a one-person MVP. When you add collaborators (`@Akshay`, `@Sumanth`, `@Sudhanva`), bump this back to `1` so the team has a real review step.

### `dev` protection (verified)

- Required PR reviews: **0** (same solo-dev MVP mode as `main`)
- Dismiss stale approvals: true
- Required status checks: `ci` (strict, up-to-date)
- Allow force pushes: false
- Allow deletions: false
- Enforce admins: false (admins can self-merge for hotfixes)

---

## How this was set up (commands used)

```bash
# 1. Verify gh is authenticated
gh auth status

# 2. Delete legacy default branch
git push origin --delete add-technical-prd-17419036079162435053

# 3. Apply main protection (current state: solo-dev mode, 0 approvals, 1 ci check)
gh api -X PUT repos/Saleheen-Akhtar/digital-twin-fm/branches/main/protection \
  -F required_pull_request_reviews[required_approving_review_count]=0 \
  -F required_pull_request_reviews[dismiss_stale_reviews]=true \
  -F required_pull_request_reviews[require_code_owner_reviews]=false \
  -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]=ci \
  -F required_linear_history=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F enforce_admins=true \
  -F restrictions=null

# 4. Apply dev protection (current state: solo-dev mode, 0 approvals, 1 ci check, admins can self-merge)
gh api -X PUT repos/Saleheen-Akhtar/digital-twin-fm/branches/dev/protection \
  -F required_pull_request_reviews[required_approving_review_count]=0 \
  -F required_pull_request_reviews[dismiss_stale_reviews]=true \
  -F required_pull_request_reviews[require_code_owner_reviews]=false \
  -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]=ci \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F enforce_admins=false \
  -F restrictions=null

# 5. Verify
gh api repos/Saleheen-Akhtar/digital-twin-fm/branches | jq '.[] | {name, protected}'
```

---

## Future maintenance

### Adding a new branch protection rule
```bash
gh api -X PUT repos/Saleheen-Akhtar/digital-twin-fm/branches/<name>/protection \
  -F required_pull_request_reviews[required_approving_review_count]=0 \
  -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]=ci \
  -F restrictions=null
```

### Disabling protection temporarily (e.g., for an emergency hotfix)
```bash
gh api -X DELETE repos/Saleheen-Akhtar/digital-twin-fm/branches/main/protection
# Do the hotfix
gh api -X PUT repos/Saleheen-Akhtar/digital-twin-fm/branches/main/protection \
  -F required_pull_request_reviews[required_approving_review_count]=0 \
  -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]=ci \
  -F enforce_admins=true \
  -F restrictions=null
# (re-apply the full rule)
```

### Adding a new collaborator
1. GitHub UI: Settings → Collaborators → Add people
2. Update `CODEOWNERS` if they should own a domain

### Adding a new branch type (e.g., `release/*`)
1. Update `CONTRIBUTING.md` §"Branch Strategy"
2. Optionally add a protection rule
3. Announce in team chat

---

## CI / status checks

✅ **Done.** The `ci` workflow is defined at `.github/workflows/ci.yml` and runs `pnpm install → pnpm build → pnpm test` on every push and PR. It was first registered on `dev` via PR #1 (squash-merged on 2026-06-04) and re-registered on `main` via PR #3 (the baseline run). It is now a required status check on both `main` and `dev`.

### What `ci` runs

- `pnpm install --frozen-lockfile`
- `pnpm build` (turborepo)
- `pnpm lint` (non-blocking, until ESLint config is finalized)
- `pnpm test`
- `pnpm --filter @digital-twin-fm/api-gateway exec tsc --noEmit` (typecheck; will expand to all workspaces as they're added)

### Modifying the CI workflow

1. Edit `.github/workflows/ci.yml` on a feature branch
2. Open a PR against `dev`
3. The PR will trigger a new `ci` run with your changes
4. Once green and merged, the new workflow is live

### Bumping the workflow

If you add new `jobs:` or change step names, GitHub may re-evaluate the `ci` context. If PRs start failing with "Required status check not found", push an empty commit to `main` to register a fresh `ci` run with the new workflow.
