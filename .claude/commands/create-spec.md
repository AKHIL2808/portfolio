---
description: Create a spec file and branch for one phase (blender or web) of one shot or build-order unit, e.g. /create-spec 1.5 blender
argument-hint: "<unit> <blender|web>, e.g. 1.5 blender · T0→1 web · 3K-D blender · C1/B.03 · F.3/W.02"
allowed-tools: Read, Write, Glob, Grep, Bash(git:*), Bash(pdftotext:*), Bash(ls:*), Bash(date:*)
---

You are the director's technical lead starting work on **one phase of one build-order unit** of
Midnight to Dawn (see `.claude/build-order/stage-*.md`). Always follow the root `CLAUDE.md`, plus
`.claude/rules/blender.md` for the Blender phase or `.claude/rules/web.md` for the web phase.

User input: $ARGUMENTS

This command **writes a spec only**. It does not touch Blender and does not write code.

## Step 1: Check the working directory is clean
Run `git status --porcelain`. If it prints anything, stop and tell the user which files are dirty and ask
them to commit or stash first. DO NOT CONTINUE until it's clean.
If this isn't a git repository yet (only possible before F.1), say so; continue without Steps 4–6 only if the
target item is an `F.1` item, otherwise stop.

## Step 2: Parse the arguments
From $ARGUMENTS extract:

1. `unit`: the shot or unit id, normalized to the naming in root `CLAUDE.md`:
   - `1.5`, `t0-1` / `T01` / `T0->1` → `T0→1`, `3k-a` → `3K-A`, `3ho-d` → `3Ho-D`, `4r6-d` → `4R6-D`, `5k1-b` → `5K1-B`, `c1`, `f.3`, `z.2`.
2. `phase`: `blender` (`b`, `B`) or `web` (`w`, `W`, `code`). If the input already contains it (`1.5/B`, `C1/B.03`, `F.3/W.02`), take it from there, with its `.nn` sub-item.
   If the phase is missing, show the usage line from `argument-hint` and stop.
3. `item_id`: `<unit>/<B|W>[.<nn>]`, e.g. `1.5/B`, `C1/B.03`.
4. `stage`: from the unit: `F.*` → `F`, `C*`/`CP` → `C`, `Z.*` → `Z`, otherwise the stage file whose items contain `item_id` (Grep `.claude/build-order/stage-*.md`); for act shots this is usually the leading digit, but transitions follow the plan's placement (e.g. `T2→3` → stage 2, `3.5` → stage 4, `5.7` → stage 6).
5. `stage_file`: `.claude/build-order/stage-<stage>.md`.
6. `shot_title`: from the stage file item title (e.g. "Racing the Door").
7. `slug`: `item_id` lowercased with `.` `/` `→` → `-`, e.g. `1-5-b`, `t0-1-w`, `c1-b-03`.
8. `title_slug`: kebab-case of `shot_title`, `a-z0-9-` only, max 30 chars, e.g. `racing-the-door`.
9. `branch_name`: `shot/<slug>-<title_slug>`, e.g. `shot/1-5-b-racing-the-door`.
10. `spec_path`: `.claude/specs/<slug>-<title_slug>.md`.

If you can't work these out, ask the user before going on.

## Step 3: Check the item is valid and ready
Read `stage_file`. If it doesn't exist, stop and tell the user to run `/build-order <stage>` first.

Find the item block that starts with `- [ ] **<item_id>:` or `- [x] **<item_id>:`.
- **Not found:** stop and list the IDs in the file that start with `<unit>/`.
- **Already ticked:** warn that it's completed and stop.
- **Stage file says `Status: COMPLETED`:** warn and stop.
- **`Depends on` items not yet ticked:** list them as ⚠, ask whether to continue anyway or build the dependency first. Only continue on a clear yes.
- **Web phase gate (hard):** for a `/W` item whose unit has a `/B` item, the `/B` item must be ticked **and** `blender/renders/APPROVALS.md` must have a row for the unit. If either is missing, stop:
  "<unit> isn't approved in Blender yet. Blender first: finish <unit>/B with /blender-shot and /approve-shot."
  Also check the exports exist (`shots/<act>.json` contains the shot id; the GLBs the shot needs are in `public/models/`). Missing exports: stop and point to `pnpm blender:export <act>` and `pnpm assets`.

Glob `.claude/specs/<slug>-*.md`. If a spec already exists, show its path and stop unless the user says to replace it.

## Step 4: Check the branch name isn't taken
`git branch --list` and `git branch -r --list`. If `branch_name` exists, add `-01`, `-02` …

## Step 5: Switch to main and pull the latest
```
git checkout main
git pull origin main
```
(Skip the pull if there's no `origin` yet.) If the pull fails or conflicts, stop and report it.

## Step 6: Create and switch to the branch
```
git checkout -b <branch_name>
```

## Step 7: Research before writing
Only use facts these contain; **never invent** shots, camera moves, clips, effects, cues or content fields.
- Root `CLAUDE.md` (naming, critical rules) and the phase rules file.
- The whole `stage_file`: the item's Mode, Director, Build, Files, Stills, VFX, Depends on, Source, Done when, plus the stage's **Open questions** (carry any that affect this item).
- **docs/plan.md** (or its PDF via `pdftotext -layout`): this unit's full section: Director's view (Camera, Action, Sound, Visitor), Build in Blender, Code and Test lists, plus the neighbouring shots it stitches to, and › Blender-to-web parity rules.
- **docs/tdd.md** (or its PDF): › Scene specs › this act, › Characters, › Asset pipeline and › Export settings (Blender phase); › Core systems, › Shot data format, › Shaders and VFX catalog, › Performance, › Accessibility and, if relevant, › Content data model and › Contact backend (web phase).
- **docs/screenplay.md** (or its PDF): this shot's lines, for intent and sound.
- What already exists:
  - Blender phase: `blender/scripts/*.py` (especially `settings.py` and the act's `build_*.py`), `blender/library/`, the act's `.blend`, `blender/renders/APPROVALS.md`, the specs of the previous shot.
  - Web phase: `shots/<act>.json` (this shot's exported keys and markers), `src/experience/acts/<act>/`, `src/experience/{director,systems,vfx,materials,characters,ui}/`, `src/store/useStore.ts`, `content/*.ts`, `package.json`, `tests/`.
  - Every file in `.claude/specs/`, so this spec doesn't duplicate or contradict an earlier one.

## Step 8: Write the spec
Use the structure for the phase. Write "None" in a section rather than leaving it out.

### Blender phase spec
---
# Spec: <item_id>: <shot_title> (Blender)

- Build-order item: `<item_id>` in `<stage_file>` (stage <stage>)
- Branch: `<branch_name>`
- Mode: <Beat · N s | Scrub · scroll a–b% | Scrub + gates …>
- Created: <YYYY-MM-DD>

## Director's view
Camera, Action, Sound, Visitor, copied from the plan word for word, plus the one-line "Director:" intent.

## Overview
One paragraph: what this shot adds to the scene, why it sits here, and which shots stitch into and out of it.

## Depends on
Items (IDs + titles) and whether each is ticked; library pieces, characters and clips it reuses.

## Scene and file
`.blend` file, the build script to create or extend (`blender/scripts/build_<act>.py` or a bridge script), the collections to add (`act<N>_<thing>`), and the `act<N>_origin` offsets involved.

## Objects and assets
Each object, kit piece or prop: new or reused, triangle count vs budget, origin/hinge, material (`MTD_Toon`, baked, emissive), texture size and color space.

## Characters and clips
Each character in shot, the actions to create or reuse (`<character>_<move>`, `_loop` suffix), shape keys, sword-tip or head bones, budgets from the Characters table.

## Camera and markers
Camera moves key by key (start/end poses, focal length, focus distance, roll), cuts, the timeline markers (`<shot id>`, hand-off markers) and their custom properties (`mode`, `scrollLength`, `duration`, `timeScale`).

## Lighting and look
Palette from the color script, bake set, real lights (count, purpose), parity settings touched (should be none).

## VFX proxies
Each effect that can't export (particles, ribbons, ripples, bursts): the proxy used for timing and framing, and that it's hidden in stills.

## Stills and preview
The stills the plan lists (what moment, frame number or shot-relative `t`), the preview `.mp4` range (for transitions: 2 s each side), output paths under `blender/renders/`.

## Export
What `pnpm blender:export <act>` must produce for this shot: GLB collections, clips, shot entry in `shots/<act>.json` (merged by id), VAT, seed files.

## Rules for implementation
- Build live through the Blender MCP; the final state saved in the build script; the scene rebuilds headless
- Script calls `settings.py` first, is idempotent, fixed seeds, nodes looked up by type
- Names: collections `act<N>_<thing>`, actions `<character>_<move>`, markers = shot ids
- Budgets from `.claude/rules/blender.md`; parity settings never changed per shot
- Original designs only; any third-party asset is CC0/royalty-free and logged in `raw-assets/LICENSES.md`
- Plus every shot-specific constraint from the sources and Open questions

## Definition of done
- [ ] The item's own **Done when** from `<stage_file>`, word for word
- [ ] `blender --background --python blender/scripts/<script>.py` rebuilds the scene with no errors
- [ ] `mtd-blender-reviewer` reports no 🚧 items
- [ ] Stills and preview rendered; **director approved** (row in `blender/renders/APPROVALS.md`)
- [ ] Exported; `shots/<act>.json` has the shot with keys sorted by `t` 0→1
- [ ] `docs/progress.md` updated; `<item_id>` ticked in `<stage_file>`

## Out of scope
Neighbouring shots, web code, real VFX (browser only), anything for later stages.

## Open questions
Gaps or conflicts, each with a proposed answer. "None" if none.
---

### Web phase spec
---
# Spec: <item_id>: <shot_title> (Web)

- Build-order item: `<item_id>` in `<stage_file>` (stage <stage>)
- Branch: `<branch_name>`
- Mode: <…>
- Approved render: <row from blender/renders/APPROVALS.md: date, stills>
- Created: <YYYY-MM-DD>

## Director's view
Copied from the plan word for word.

## Overview
One paragraph: what the browser must play, what the visitor does, and the shots it stitches to.

## Depends on
Items and whether ticked; systems, VFX and characters it needs that must already exist.

## Shot data
This shot's entry in `shots/<act>.json` as exported (mode, scrollLength/duration, camera, key count), and the **events and gates to add** (`{ t, type, payload }`, gate `{ id, kind, holdMs, autoResolveMs }`) with the cue names.

## Components and systems
Files under `src/experience/` to create or change, and which system each uses (Director, camera rig, time, scroll, input, audio, assets, quality, store fields).

## VFX
Each effect from the TDD catalog, its uniforms and what drives them, and its Lite-tier behaviour. Nothing outside the catalog.

## Content
`content/*.ts` fields read, and the zod schema they go through. "None" if the shot shows no portfolio text.

## Accessibility and fallbacks
Keyboard path for every interaction, live-region text, reduced-motion behaviour, mobile portrait framing, flash limits.

## Budgets
The act's asset budget, the tier budgets this shot stresses (draw calls, triangles, skinned characters, particles, lanterns), and how it stays within them on High and Lite.

## Files to change / Files to create
Every file with a one-line purpose.

## New dependencies
Each new package with why, and ⚠ that it must be approved first (root `CLAUDE.md` › Preferred libraries). "No new dependencies" if none.

## Rules for implementation
- TypeScript strict, no `any`; no act imports another act
- Inside `useFrame`: no allocations, no setState; `useStore.getState()`; animate via `useActFrame`
- Camera from shot data only; never re-author framing in code (fix it in Blender)
- Readable text as HTML via `<Html transform occlude>`; portfolio text only from `content/`
- Instance repeats, VAT for crowds, LOD for characters, dispose on unmount
- Plus every shot-specific constraint from the sources and Open questions

## Tests
Exact test files and cases from the plan's Test list: parity (`tests/e2e/shots/<slug>.spec.ts`, stills vs `/dev/shot`, ≥ 0.90), stitch, shot-data Vitest, interaction by mouse/touch/keyboard, budget check on High and Lite. Name the commands.

## Definition of done
- [ ] The item's own **Done when** from `<stage_file>`, word for word
- [ ] Parity ≥ 0.90 on every listed still; stitch with the previous shot has no jump
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green
- [ ] Within tier budgets on High and Lite
- [ ] Verified by `mtd-test-runner` (`/test-shot`); `/review-shot` has no 🚧 items
- [ ] `docs/progress.md` updated; `<item_id>` ticked in `<stage_file>`

## Out of scope
Neighbouring shots, Blender changes (framing/timing problems go back to `<unit>/B`), later stages.

## Open questions
Each with a proposed answer. "None" if none.
---

## Step 9: Save the spec
Save it to `spec_path`. Don't commit it, and don't change any other file.

## Step 10: Report to the user
```
Item:      <item_id>: <shot_title> (<Blender|Web>)
Branch:    <branch_name>
Spec file: <spec_path>
Warnings:  <dependency/approval warnings, or "none">
```
Then tell the user:
- Blender phase: "Review the spec, then enter Plan Mode (Shift+Tab twice) and approve a plan. Then run `/blender-shot <unit>` to build it live in Blender."
- Web phase: "Review the spec, then enter Plan Mode (Shift+Tab twice) to plan the implementation. When it's built, run `/test-shot <unit>` and `/review-shot <unit>`."

Don't print the full spec in chat unless asked.
