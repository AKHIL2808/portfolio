---
description: Render one shot's stills and preview, ask the director to approve them against the screenplay, then record the approval and export. The only way a shot reaches the web
argument-hint: "<unit>, e.g. 1.5 · T0→1 · 3K-D"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(git status:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(~/Applications/blender-5.2.4-linux-x64/blender --background:*), Bash(pnpm blender:stills:*), Bash(pnpm blender:export:*), Bash(pnpm assets:*), Bash(pnpm test:*), Bash(ls:*), Bash(date:*), mcp__blender__get_scene_info, mcp__blender__look
disable-model-invocation: true
---

Render the approval material for the unit in $ARGUMENTS, put it in front of the director, and act on the decision.
**Only the user approves.** Never infer approval from silence, from a good-looking still, or from the reviewer's verdict.

If no argument is provided, stop and say:
"Please provide a shot or unit. Usage: /approve-shot <unit>, e.g. /approve-shot 1.5"

## Pre-flight check

Stop at the first failure and say why.

1. **Normalize** the unit to its `/B` item id (as in `/create-spec`). The `<slug>` below is the item slug; `<unit-slug>` is the unit slug (root CLAUDE.md › Naming).
2. **Spec:** `.claude/specs/<slug>-*.md` for the `/B` item. Missing: "No Blender spec. Run /create-spec <unit> blender first."
3. **Build-order item** found and not ticked (ticked: warn; continue only if the user is re-approving after a change).
4. **Built:** `/blender-shot` has run: the build script contains this shot's function, and the shot's marker exists (`get_scene_info`, or grep the script). If not: "Run /blender-shot <unit> first."
5. **Rebuild is current:** `~/Applications/blender-5.2.4-linux-x64/blender --background --factory-startup --python blender/scripts/<script>.py` exits 0 (the official Blender, or `$BLENDER_BIN`), so what's rendered is what the script builds.

---

## Step 1: Render

```bash
pnpm blender:stills <unit> <t> [<t> <t>]   # the t values from the spec's Stills and preview section
```
(`pnpm blender:stills` finds the scene that holds the shot. Without pnpm, run `~/Applications/blender-5.2.4-linux-x64/blender --background --factory-startup <scene>.blend --python blender/scripts/render_stills.py -- <unit> <t…>`.)

- Stills: exactly the moments the spec's *Stills and preview* section lists, Eevee, 1920 × 1080, VFX proxies hidden, to `blender/renders/stills/<unit-slug>/`.
- Preview: the shot (transitions: with 2 s on each side) to `blender/renders/previews/<unit-slug>.mp4`, VFX proxies visible.
- Check every expected file exists and isn't empty.

## Step 2: Present for approval

Show each still (Read the PNG so it displays), and give the preview path for the director to play.
Next to them, print the plan's Director's view for the shot (Camera, Action, Sound, Visitor) and a short checklist:
- framing and camera move match the Director's view
- timing matches the mode (beat seconds / scrub range), and lands where the next shot needs it
- color matches the act's color script
- characters read clearly; nothing clips; hinges and cuts behave
- budgets (from the `/blender-shot` report)

Then ask exactly:
"Approve <unit> — <shot title>? (approve / changes: <what to change> / reject)"

Wait for the answer. Don't continue without one.

## Step 3a: On **changes** or **reject**
- Write the director's notes into the spec under a new `## Director's notes (<date>)` section, word for word.
- Add a line to `docs/progress.md` › open issues: `<unit>: render changes requested: <notes>`.
- Do **not** record approval, export or tick anything.
- Say: "Noted. Run /blender-shot <unit> to apply the changes, then /approve-shot <unit> again."
- Stop.

## Step 3b: On **approve**

1. **Record the approval** in `blender/renders/APPROVALS.md` (create it with this header if it's missing):
   ```
   | Shot | Title | Date | Stills | Preview | Script | Commit | Notes |
   |---|---|---|---|---|---|---|---|
   ```
   Add one row: unit, title, `date +%F`, still paths, preview path, script path, `git rev-parse --short HEAD`, any remarks the director made. Never edit an older row; a re-approval adds a new one.
2. **Act render:** if this is the act's last `/B` shot, remind the director that `blender/renders/act<N>.mp4` (the whole act) should be rendered and approved before the act's web phase moves past this shot (docs/tdd.md › Asset pipeline step 6).
3. **Export:**
   ```bash
   pnpm blender:export <act>     # export_glb.py + export_shots.py + bake_vat.py
   pnpm assets                   # raw-assets → public (meshopt + KTX2)
   ```
   Then check: `shots/<act>.json` has the shot id with keys sorted by `t` 0 → 1 and the events/gates that were there before still present (merge by shot id); the GLBs the spec lists exist in `public/models/` and are within the act's asset budget. If `pnpm test` exists, run the shot-data tests.
   If export fails or drops existing events, stop and report it; the approval row stays, but nothing is ticked.
4. **Progress:** add to `docs/progress.md` › done: `<unit>/B approved and exported (<date>)`, and › next: `<unit>/W`.

## Step 4: Report

```
Approved:  <unit> — <shot title> (<date>)
Stills:    <paths>
Preview:   <path>
Exported:  shots/<act>.json (<n> keys), <glb paths> (<sizes> / budget <act budget>)
Next:      /ship-shot   then   /create-spec <unit> web
```

## Rules
- Only an explicit "approve" from the user counts
- Never edit stills or previews after approval; re-render and re-approve instead
- Never hand-edit the exported GLB or shot keys
- Don't tick the build-order item or commit here; `/ship-shot` does that
