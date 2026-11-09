# Spec: F.1/W.05: CI and Vercel preview deploys (Web)

- Build-order item: `F.1/W.05` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-1-w-05-ci-and-vercel-preview-deploys`
- Mode: n/a (infrastructure, no shot)
- Approved render: n/a (F.1 has no `/B` item)
- Created: 2026-11-10

## Director's view
None. This is a Foundation item. Plan › F.1 bullet it covers: "CI (typecheck, lint, unit tests) and Vercel preview deploys."

TDD › Testing and deployment › Deployment:
1. GitHub repository connected to Vercel.
2. `main` branch = production; every other branch = preview deployment.
3. GitHub Actions runs the checks above; a failing check blocks merging into `main`.

TDD › Milestones › M0 (web): "Next.js + TS strict + Tailwind + stack pinned; CI green; preview deploy on Vercel."
CLAUDE.md › Critical rules › Secrets: "`RESEND_API_KEY` and `CONTACT_TO_EMAIL` only in Vercel env vars and a git-ignored `.env.local`; keep `.env.example` in sync."

## Overview
So far every PR has merged with "no checks reported", so nothing stops a broken commit reaching `main`. This item adds a GitHub Actions workflow that runs on every push and every PR. It installs from the lockfile exactly, then runs typecheck, lint and the Vitest suite. It also connects the repo to Vercel, so `main` deploys to production and every other branch gets its own preview URL to open on a real phone. Vercel must be able to read the Git LFS files (`docs/images/*.png` today, models and textures later). It also adds `.env.example` with the two secret names, and arranges for a failing check to block the merge. The e2e and Lighthouse jobs are added later, by the items that create those tests (F.4/W.03, Stage Z).

## Depends on
- F.1/W.02: Next.js + TypeScript strict + Tailwind, stack installed and pinned: ✅ ticked (PR #2). It provides the `typecheck`, `lint`, `test` scripts and `pnpm-lock.yaml`.
- **Checked 2026-11-10 (read-only):**
  - GitHub repo `AKHIL2808/portfolio` is **private** (default branch `main`) on a free plan.
    - The branch-protection API returns *"Upgrade to GitHub Pro or make this repository public to enable this feature."*
    - **So GitHub can't currently enforce "a failing check blocks the merge"** (see Open question 1).
  - `gh` is logged in (scopes `repo`, `read:org`, `gist`, `admin:public_key`).
  - Vercel CLI is not installed; there is no Vercel project yet.
  - Latest action releases: `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0, `pnpm/action-setup` v6.1.1.
  - Node 22.23.1 locally; `package.json` has `packageManager: pnpm@9.15.4`, `engines.node: ">=20.9"`.
- **Needs you:** a Vercel account, and installing the Vercel GitHub app on this repo (web dashboard, a one-time sign-in that I can't do for you).

## Shot data
None.

## Components and systems
None. No code under `src/`.

## VFX
None.

## Content
None.

## Accessibility and fallbacks
None.

## Budgets
None measured yet. The production build and the first-load bundle size are visible on each Vercel deployment from now on; the size check in CI is a later item (W.02 review suggestion).

## Files to change / Files to create
- `.github/workflows/ci.yml` (new):
  - **Triggers:** `push` on all branches and `pull_request` into `main`. `concurrency` per ref, so a new push cancels the old run.
  - **Permissions:** `contents: read` only.
  - **One job, `checks`,** on `ubuntu-latest`, `timeout-minutes: 15`:
    1. `actions/checkout` with `lfs: false`. The tests only check that the PNGs exist, and skipping LFS saves the free 1 GB/month LFS bandwidth.
    2. `pnpm/action-setup`, which reads `packageManager` from `package.json` (no version duplicated in the workflow).
    3. `actions/setup-node` with `node-version-file: .nvmrc` and `cache: pnpm`.
    4. `pnpm install --frozen-lockfile`.
    5. `pnpm typecheck`.
    6. `pnpm lint`.
    7. `pnpm test`.
  - Every third-party action is pinned to a full commit SHA, with the tag in a comment (`# v7.0.1`), resolved at build time. Supply-chain safety: a moved tag can't change what runs.
  - The job name stays stable (`checks`), because a required-check rule matches it by name.
- `.nvmrc` (new): `22`. One Node major for local, CI and Vercel.
- `.env.example` (new): `RESEND_API_KEY=` and `CONTACT_TO_EMAIL=`, names only, with a one-line comment for each, pointing to `.env.local` (git-ignored) and Vercel env vars.
- `docs/progress.md`:
  - Move the three "For F.1/W.05" open issues out (resolved), and record:
    - the Vercel project name and URLs (production and the first preview)
    - Git LFS on in Vercel
    - Node 22
    - how merges are blocked (Open question 1)
  - Set Next to F.2/B.01.
- The spec: Results section (CI run URL, preview URL, the deliberate-failure evidence).

**On Vercel (you, guided step by step; no files):**
- Import `AKHIL2808/portfolio` (framework: Next.js, auto-detected).
- Production branch `main`.
- Node.js version 22.x.
- **Git LFS: enabled** (Project › Settings › Git).
- No env vars yet; the contact route doesn't exist until Act 7.
- Install command left on auto (pnpm, from the lockfile).

## New dependencies
No new npm dependencies. The GitHub Actions used (`actions/checkout`, `actions/setup-node`, `pnpm/action-setup`) are CI tooling, not packages; they're pinned by SHA. The Vercel CLI is **not** added; everything is done through the dashboard and the GitHub app.

## Rules for implementation
- The workflow uses only the scripts that already exist; no new checks are invented. It runs exactly what CLAUDE.md lists for this stage: typecheck, lint, unit tests. `pnpm test:e2e` and Lighthouse are added by the items that create those tests (F.4/W.03, Z).
- `pnpm install --frozen-lockfile` in CI, never a plain install (from F.1/W.02 › Open issues).
- No secrets in the repo or the workflow. The workflow needs none; `.env.example` holds names only; `.gitignore` already covers `.env.local` / `.env*.local`.
- Least privilege: workflow `permissions: contents: read`; Vercel's GitHub app limited to this one repository.
- Don't change the repo's visibility or plan without your explicit decision (Open question 1).
- The deliberate-failure proof is done on a throwaway branch, never on `main`, and the branch is deleted afterwards.

## Tests
No new unit tests for the workflow itself; GitHub runs it, and that run is the test. The checks:
1. **CI green:** push this branch. The `checks` job passes, and `gh run list --branch shot/f-1-w-05-…` shows success.
2. **Preview works:** Vercel posts a preview deployment on the PR, and `curl -s <preview-url>` returns the placeholder page (`<h1>Midnight to Dawn</h1>`). The Vercel project's Git LFS setting is on, and the build log shows the LFS fetch. The served-asset proof waits for the first LFS file in `public/` (see Open question 3).
3. **A failing check blocks the merge:** on a throwaway branch `ci/failing-check-probe`, add one deliberately failing assertion, push it, and open a draft PR. CI goes red, and the merge is blocked by whichever mechanism Open question 1 settles. Then close the PR and delete the branch.
4. `pnpm typecheck && pnpm lint && pnpm test` stay green locally (only docs and config change). One unit test is added to `tests/unit/foundation.test.ts`'s package checks: `.env.example` exists, lists exactly `RESEND_API_KEY` and `CONTACT_TO_EMAIL`, and has no values. That keeps it in sync with CLAUDE.md.

## Definition of done
- [ ] CI is green on a pushed branch; that branch has a working Vercel preview URL; a deliberately failing check blocks the merge
- [ ] `.env.example` lists `RESEND_API_KEY` and `CONTACT_TO_EMAIL` with no values; tested
- [ ] Git LFS is enabled in the Vercel project; Node 22 everywhere (`.nvmrc`, CI, Vercel)
- [ ] All workflow actions pinned by SHA; workflow permissions read-only
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green
- [ ] Verified by `mtd-test-runner` (`/test-shot`); `/review-shot` has no 🚧 items (quality + **security**: it touches CI, env and deploy)
- [ ] `docs/progress.md` updated; `F.1/W.05` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- `pnpm test:e2e` and Lighthouse CI jobs (F.4/W.03 and Stage Z).
- Security headers / CSP (Act 7), Vercel env var values (Act 7, `/api/contact`).
- Custom domain, analytics, production launch (Z.6).
- Bundle-size checks in CI (W.02 review suggestion; later).
- Blender in CI (the `pnpm blender:*` scripts run locally; F.2).

## Open questions
1. **Blocking merges on a private free repo.** GitHub only enforces required status checks (branch protection or rulesets) on public repos or with GitHub Pro. Options:
   - **(a) Keep the repo private, soft block.** `/ship-shot` already refuses to merge when a check fails (its Step 8), and CI makes that check real. Nothing stops a manual merge in the GitHub UI, though.
   - **(b) Make the repo public** and add a ruleset requiring `checks` on `main`. Free, and a hard block. But the repo, including the docs and plan, becomes public; it's a portfolio, so that may be fine or even wanted.
   - **(c) GitHub Pro** (paid), then a ruleset; hard block, stays private.
   - **Proposed: (a) now.** Record it in `progress.md`, then move to (b) at launch (Z.6) when the site goes public anyway. The Done when's "blocks the merge" is then proven through `/ship-shot` refusing, and the spec says so plainly. Your call; I won't change visibility or plan without you.
2. **Run `pnpm build` in CI too?** Vercel already builds every push, and a failed build shows as a red Vercel check on the PR. Proposed: no separate build step in CI (it saves about 1 min per run), relying on Vercel's check. Revisit if Vercel and CI disagree.
3. **Proving Git LFS works on Vercel.** Nothing in `public/` is LFS-tracked yet (the only LFS files are `docs/images/*.png`, which aren't served). Proposed: turn LFS on now, and confirm it from the Vercel build log. Do the real served-asset check when the first GLB lands in `public/models/` (F.2/B.07), as an item in its Done when.
4. **LFS bandwidth.** GitHub's free LFS quota is 1 GB storage and 1 GB/month bandwidth, and each Vercel build pulls LFS files. Proposed: CI skips LFS (`lfs: false`); watch usage from F.2 on, when GLBs and renders arrive. Noted in `progress.md` › Open issues.
5. **Review.** Proposed: run `/test-shot` and `/review-shot` with quality + **security** (workflow permissions, SHA pinning, env handling, secret hygiene); performance has nothing to check.
