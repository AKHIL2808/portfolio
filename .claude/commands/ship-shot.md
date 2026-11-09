---
description: Tick the build-order item, update progress, commit, push, open a PR, squash-merge, delete the branch and sync main, for one shot phase
argument-hint: "[item id], optional; read from the branch name, e.g. shot/1-5-b-racing-the-door → 1.5/B"
allowed-tools: Read, Edit, Glob, Grep, Bash(git:*), Bash(gh:*), Bash(date:*), mcp__github__create_pull_request, mcp__github__merge_pull_request, mcp__github__get_pull_request, mcp__github__get_pull_request_status
disable-model-invocation: true
---

Ship the current shot phase: tick it in its stage file, update `docs/progress.md`, commit, push, open a PR into `main`,
squash-merge it, delete the branch, and bring local `main` up to date.

User input: $ARGUMENTS

## Step 1: Identify the branch and item
```bash
git branch --show-current
```
Store this as CURRENT_BRANCH.
- If it's `main`, stop: "You're on main. /ship-shot only ships a shot branch."
- ITEM_ID: from $ARGUMENTS if given (normalize as in `/create-spec`), otherwise from the branch name
  `shot/<slug>-<title>`: match the slug against the item ids in `.claude/build-order/stage-*.md` (e.g. `1-5-b` → `1.5/B`, `t0-1-w` → `T0→1/W`, `c1-b-03` → `C1/B.03`). If neither works, ask.
- If $ARGUMENTS and the branch disagree, stop and ask which is right.
- PHASE: `B` or `W` from ITEM_ID.

## Step 2: Pre-ship checks
Stop at the first failure and say why.

1. **Spec:** Glob `.claude/specs/<slug>-*.md`. Missing: "No spec for <ITEM_ID>. Run /create-spec first."
2. **Build-order item:** find `- [ ] **<ITEM_ID>:` in its stage file. Not found: stop. Already `- [x]`: warn and continue without re-ticking.
3. **Something to ship:** `git status --porcelain` and `git log main..HEAD --oneline`. Both empty: stop: "Nothing to ship on CURRENT_BRANCH."
4. **No secrets:** the changes must not include `.env`, `.env.local`, `*.pem`, `*.key` (check `git status --porcelain` and `git diff main...HEAD --name-only`); `git check-ignore .env.local` must succeed. Otherwise stop and list them.
5. **Git LFS:** if any `.blend`, `.png`, `.exr`, `.wav` or raw texture is in the change set, `git lfs ls-files` must list it (and `.gitattributes` must track the type). Otherwise stop: "Large binary not in Git LFS: <paths>. Run `git lfs track` for the type and re-add the files."
6. **Phase gate:**
   - **B:** `blender/renders/APPROVALS.md` has a row for the unit dated after the last change to its build script, and (for exporting shots) `shots/<act>.json` contains the shot id. Missing: stop: "<unit> isn't approved. Run /approve-shot <unit>." Never ship an unapproved Blender phase.
   - **W:** ask: "Did `/test-shot <unit>` report ✅ VERIFIED and `/review-shot <unit>` report no 🚧 items, with nothing changed since? (yes / no: run the test runner now / cancel)"
     - yes: continue · run the test runner now: invoke `mtd-test-runner` for ITEM_ID and continue only on **VERIFIED** · cancel or no answer: stop.
7. **GitHub access:** GitHub MCP tools if connected, else the `gh` CLI if `gh auth status` succeeds. Neither: stop: "No GitHub access: connect the GitHub MCP (run /mcp) or install and log in to the gh CLI (`gh auth login`)."

## Step 3: Tick the item and update progress (on the branch)
This goes **into the PR**, so `main` never gets a direct commit.
1. In the stage file, change `- [ ] **<ITEM_ID>:` to `- [x] **<ITEM_ID>:`.
2. Recount top-level items; update `Progress: <done>/<total>` and `Status: NOT STARTED | IN PROGRESS | COMPLETED (<date +%F>)`.
3. **If this completes the stage**: in root `CLAUDE.md` › Build status, set the stage's Status to `Done (<date>)`.
4. `docs/progress.md`: under › done add `<ITEM_ID>: <title> (<date>)`; under › next put the next unticked item; move any resolved open issues out of › open issues.
5. Report: "✓ Ticked <ITEM_ID>: Stage <S> progress <done>/<total> (<status>)"

## Step 4: Generate the commit message
Run `git diff --staged`, `git diff`, `git status --porcelain`, `git log main..HEAD --oneline`, and read the spec's Overview.

Conventional Commit:
- `feat`: a new playable shot or capability · `fix`: bug fix · `art`: Blender phase (scene, character, render, export) · `test`: tests only · `chore`: tooling, CI, config · `docs`: documentation only
- Lowercase, no period, under 72 characters, ending with the item id in parentheses
- Describe what the film or site can now do, not which file changed

Good: `art: door tunnel races upward with 12 locking doors (1.5/b)` · `feat: name writes stroke by stroke on the door in slow motion (1.7/w)`
Bad: `feat: update build_act1.py`

Trailer on a blank line after the subject:
```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Step 5: Commit
```bash
git add -A
git status --porcelain       # re-check: no .env / key files, binaries in LFS
git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
If a pre-commit hook fails, stop and show its output. Never `--no-verify`.
Report: "✓ Committed: <subject>"

## Step 6: Push
```bash
git push -u origin CURRENT_BRANCH
```
Report: "✓ Pushed: CURRENT_BRANCH"

## Step 7: Create the PR (CURRENT_BRANCH → main)
Title: `<ITEM_ID>: <shot title> (<Blender|Web>)`, e.g. `1.5/B: Racing the Door (Blender)`.

Body:
```markdown
## What this PR does
<one paragraph from the spec's Overview>

Build-order item: `<ITEM_ID>` in `<stage file>`: Stage <S> progress <done>/<total> (<status>)
Spec: `<spec path>`

## Director's view
<Camera / Action / Sound / Visitor from the spec, 4 lines>

## Changes
<one bullet per changed file (git diff main...HEAD --name-status), with a one-line description>

## Blender phase (B only)
Approved: <APPROVALS.md row: date, stills, preview> · Script: <path> · Exported: <shot json, GLBs + sizes>

## Web phase (W only)
Parity: <score per still> · Stitch: <from → to> · Budgets: <High / Lite numbers> · VFX: <effects used>

## Definition of done
<the spec's Definition of done, every item [x]>

## How to check
B: open `blender/renders/previews/<unit-slug>.mp4`, or `blender --background --python blender/scripts/<script>.py` to rebuild.
W: `pnpm dev`, open `/dev/shot?shot=<unit>&t=0.5` and `/dev/stitch?from=<prev>&to=<unit>`, then `pnpm test && pnpm test:e2e`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Use the GitHub MCP `create_pull_request`, or `gh pr create --base main --head CURRENT_BRANCH --title "<title>" --body-file <tmp file>`.
If PR creation fails, stop. **Never** merge without a PR.
Report: "✓ PR created: <PR URL>"

## Step 8: Wait for CI
- gh: `gh pr checks <PR> --watch --fail-fast` · MCP: poll `get_pull_request_status`.
- Any failing check: stop and show it. Don't merge.
- No checks configured yet (before F.1's CI item): say so and continue.
- Note: Vercel posts a preview deployment link on the PR; mention it in the summary for real-phone testing.

Report: "✓ CI green" (or "– No CI checks configured")

## Step 9: Squash-merge
MCP `merge_pull_request` with `merge_method: squash`, or `gh pr merge <PR> --squash --subject "<commit subject> (#<PR number>)"`.
On failure (conflicts, protection), stop. Don't force anything.
Report: "✓ PR merged to main (squash)"

## Step 10: Delete the remote branch
`git push origin --delete CURRENT_BRANCH` (already gone = done).
Report: "✓ Remote branch deleted"

## Step 11: Switch to main and pull
`git checkout main && git pull origin main`
Report: "✓ Switched to main: up to date"

## Step 12: Delete the local branch
`git branch -D CURRENT_BRANCH && git fetch --prune` (`-D` because squash merges don't keep the branch commits).
Report: "✓ Local branch deleted"

## Step 13: Confirm and show what's next
Read the stage file on `main`: confirm `<ITEM_ID>` is `- [x]` and the header matches Step 3; find the **next unticked item**.

## Final summary
```
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
/ship-shot complete: <ITEM_ID> — <title>
✓ Ticked: Stage <S> <done>/<total> (<status>)
✓ Committed: <subject>
✓ Pushed, PR created, CI green, squash-merged: <PR URL>
✓ Preview deploy: <Vercel URL or "n/a">
✓ Branches deleted, main up to date
Next: /create-spec <next unit> <blender|web>  (<next title>)
      or "✅ Stage <S> officially completed. Next: /build-order <next stage>"
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
```
After a `/B` ship, the next step is usually `/create-spec <same unit> web`. Stage order: F → C → 0 → 1 → … → 7 → Z.

## Rules
- Never commit to `main`; the tick and progress updates go into the PR
- Never ship a Blender phase without a director approval row
- Always squash-merge, never merge if PR creation or CI fails
- Always delete the remote and local branch after merging
- Never `--force`, `--no-verify`, or push to `main`
- Never commit `.env*` (except `.env.example`) or key files; binaries go through Git LFS
- If any step fails, stop and report which steps finished, so the user can resume safely
