# GitHub Repository Setup — One-Time UI Steps

> **Purpose:** Capture the GitHub UI clicks required to align the repo with `CONTRIBUTING.md`. These cannot be done from the terminal/CI — they require an authenticated admin session in the GitHub web UI.
>
> **Owner:** Sahil (repo admin)
>
> **Time required:** ~10 minutes total

---

## Prerequisites

- [ ] Admin access to https://github.com/Saleheen-Akhtar/digital-twin-fm
- [ ] The 4 collaborators in `CODEOWNERS` are GitHub users with usernames: `@Saleheen-Akhtar`, `@Akshay`, `@Sumanth`, `@Sudhanva` (verify or rename in `CODEOWNERS` first)

---

## Step 1 — Change the default branch to `main` (REQUIRED FIRST)

**Why:** The repo's default branch is still the legacy auto-generated `add-technical-prd-17419036079162435053`. The current `main` and `dev` branches exist but are not the default. We need `main` to be the default before we can delete the old one.

1. Open: **https://github.com/Saleheen-Akhtar/digital-twin-fm/settings/branches**
2. Under **"Default branch"**, click the **switch** icon (⇄)
3. Choose `main` from the dropdown
4. Click **Update**
5. Confirm by typing the repo name
6. Wait for GitHub to finish (~30 seconds)

✅ Verify: the URL still works, and `git remote show origin | grep "HEAD branch"` shows `HEAD branch: main`.

---

## Step 2 — Delete the legacy default branch

**Why:** Once the default is changed, the old branch can be safely removed.

### Option A — GitHub UI

1. Open: **https://github.com/Saleheen-Akhtar/digital-twin-fm/branches**
2. Find `add-technical-prd-17419036079162435053` in the list
3. Click the trash icon 🗑️ on the right
4. Confirm deletion

### Option B — Terminal (if `gh` is authenticated)

```bash
gh repo edit Saleheen-Akhtar/digital-twin-fm --default-branch main
git push origin --delete add-technical-prd-17419036079162435053
```

✅ Verify: `git branch -r` should no longer show the legacy branch.

---

## Step 3 — Add branch protection rule for `main`

**Why:** Documented in `CONTRIBUTING.md` §"Branch Protection Rules". Prevents accidental force-pushes and direct commits to production.

1. Open: **https://github.com/Saleheen-Akhtar/digital-twin-fm/settings/branches**
2. Click **Add rule** (or **Add classic protection rule** in new UI)
3. **Branch name pattern:** `main`
4. Enable these checkboxes:

   - ☑ **Require a pull request before merging**
     - ☑ **Require approvals:** `1`
     - ☑ **Dismiss stale pull request approvals when new commits are pushed**
     - ☑ **Require review from Code Owners**
   - ☑ **Require status checks to pass before merging**
     - ☑ **Require branches to be up to date before merging**
     - *(Add `ci` / `test` / `lint` checks once GitHub Actions are configured)*
   - ☑ **Require linear history** (no merge commits)
   - ☐ **Allow force pushes:** UNCHECKED
   - ☐ **Allow deletions:** UNCHECKED

5. Click **Create** (or **Save changes**)

---

## Step 4 — Add branch protection rule for `dev`

1. Same page as Step 3 → **Add rule**
2. **Branch name pattern:** `dev`
3. Enable:

   - ☑ **Require a pull request before merging**
     - ☑ **Require approvals:** `1`
   - ☑ **Require status checks to pass before merging**
   - ☐ **Allow force pushes:** UNCHECKED
   - ☐ **Allow deletions:** UNCHECKED

4. Click **Create**

---

## Step 5 — Enable CODEOWNERS requirement (optional, for stricter review)

**Why:** Ensures the owners listed in `CODEOWNERS` are auto-requested as reviewers.

1. Open: **https://github.com/Saleheen-Akhtar/digital-twin-fm/settings/branches**
2. Scroll to **"Require approval from code owners"** (or it's part of Step 3 if you enabled "Require review from Code Owners")
3. Enable

---

## Step 6 — Verify the live branches match `CONTRIBUTING.md`

After completing all steps, run from the repo root:

```bash
git fetch --all --prune
git branch -a
git remote show origin | grep "HEAD branch"
```

Expected output:

```text
* dev
  main
  remotes/origin/main
  remotes/origin/dev

HEAD branch: main
```

If any `feature/*`, `fix/*`, `chore/*`, or `docs/*` branch is currently open, it will also appear — that's expected.

---

## Step 7 — Update the "Live branches" table in `CONTRIBUTING.md`

After Step 2, edit the table in `documents/mvp/CONTRIBUTING.md` to remove the "To be removed" row:

```diff
| `main` | Active | Production. Tag releases here. |
| `dev` | Active | Integration. All feature PRs land here first. |
-| `add-technical-prd-17419036079162435053` | To be removed | Legacy auto-generated GitHub default branch. |
```

Open a PR with this one-line cleanup.

---

## Post-setup checklist

- [ ] `git remote show origin` shows `HEAD branch: main`
- [ ] `main` and `dev` both have branch protection rules
- [ ] `CODEOWNERS` file is in repo root
- [ ] Legacy `add-technical-prd-...` branch is deleted
- [ ] Collaborators (`@Akshay`, `@Sumanth`, `@Sudhanva`) have been added as collaborators in repo settings (Settings → Collaborators)
- [ ] PR template is configured (Settings → Pull requests → suggest a template, then commit `.github/PULL_REQUEST_TEMPLATE.md` — see `CONTRIBUTING.md` §"Pull Requests")

---

## Future maintenance

- **Adding a new branch type?** Update both this file and `CONTRIBUTING.md` §"Branch Strategy" so the docs stay in sync.
- **Adding a new collaborator?** Add them to `CODEOWNERS` AND invite them in Settings → Collaborators.
- **Renaming a branch?** Update the "Live branches" table in `CONTRIBUTING.md`.
