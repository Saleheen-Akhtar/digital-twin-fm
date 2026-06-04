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

- Required PR reviews: 1
- Dismiss stale approvals: true
- Require code owner review: true
- Required status checks: `ci` (strict, up-to-date)
- Required linear history: true
- Allow force pushes: false
- Allow deletions: false
- Enforce admins: true

### `dev` protection (verified)

- Required PR reviews: 1
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

# 3. Apply main protection
gh api -X PUT repos/Saleheen-Akhtar/digital-twin-fm/branches/main/protection \
  -F required_pull_request_reviews[required_approving_review_count]=1 \
  -F required_pull_request_reviews[dismiss_stale_reviews]=true \
  -F required_pull_request_reviews[require_code_owner_reviews]=true \
  -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]=ci \
  -F required_linear_history=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F enforce_admins=true \
  -F restrictions=null

# 4. Apply dev protection (looser — admins can self-merge)
gh api -X PUT repos/Saleheen-Akhtar/digital-twin-fm/branches/dev/protection \
  -F required_pull_request_reviews[required_approving_review_count]=1 \
  -F required_pull_request_reviews[dismiss_stale_reviews]=true \
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
  -F required_pull_request_reviews[required_approving_review_count]=1 \
  -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]=ci \
  -F restrictions=null
```

### Disabling protection temporarily (e.g., for an emergency hotfix)
```bash
gh api -X DELETE repos/Saleheen-Akhtar/digital-twin-fm/branches/main/protection
# Do the hotfix
gh api -X PUT repos/Saleheen-Akhtar/digital-twin-fm/branches/main/protection \
  -F required_pull_request_reviews[required_approving_review_count]=1 \
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

The `ci` status check referenced in the protection rules needs to be defined. This is the next setup step (not yet done):

1. Create `.github/workflows/ci.yml` with at least:
   ```yaml
   name: ci
   on: [push, pull_request]
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20 }
         - run: pnpm install
         - run: pnpm build
         - run: pnpm test
   ```
2. Push to a feature branch, open a PR — the first run will register the `ci` check name with GitHub
3. From then on, the `ci` check will be a required status check on `main` and `dev`
