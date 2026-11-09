---
description: Build one shot's Blender phase live through the Blender MCP from its spec, save it to the bpy build script, prove a headless rebuild, and run the Blender reviewer
argument-hint: "<unit>, e.g. 1.5 · T0→1 · 3K-D · C1/B.03"
allowed-tools: Read, Write, Edit, Glob, Grep, Agent, Bash(git status:*), Bash(git diff:*), Bash(git branch:*), Bash(blender --background:*), Bash(blender --version:*), Bash(ls:*), Bash(date:*), mcp__blender__get_addon_status, mcp__blender__get_scene_info, mcp__blender__execute_blender_code, mcp__blender__look, mcp__blender__search_assets, mcp__blender__import_asset
---

Build the **Blender phase** of the unit in $ARGUMENTS, following its spec exactly, while the director watches.
This command builds and self-checks. It does **not** render the approval preview, approve, or export: that's `/approve-shot`.

If no argument is provided, stop and say:
"Please provide a shot or unit. Usage: /blender-shot <unit>, e.g. /blender-shot 1.5"

## Pre-flight check

Stop at the first failure and say why.

1. **Normalize** the unit and item id as in `/create-spec` (`1.5` → `1.5/B`; `C1/B.03` stays as is).
2. **Spec:** Glob `.claude/specs/<slug>-*.md` for the `/B` item. None: "No Blender spec for <item_id>. Run /create-spec <unit> blender first." More than one: ask which.
3. **Build-order item:** find `- [ ] **<item_id>:` in its stage file. Missing: stop. Ticked: warn and stop unless the user says this is a rework (a rejected render or a framing fix).
4. **Branch:** `git branch --show-current` should start with `shot/<slug>`. If not, warn and continue.
5. **Plan approved:** ask "Has the plan for <item_id> been approved in Plan Mode? (yes / no)". Only continue on yes.
6. **Blender is connected:** call `get_addon_status` and `get_scene_info`. If the MCP isn't reachable, stop: "Blender MCP isn't connected. Open Blender with the MCP add-on running, then re-run /blender-shot <unit>." Note the Blender version.
7. **Right file:** the open scene must be the spec's `.blend` (or empty if the spec creates it). If another file is open, ask before going on; never discard unsaved work in it.

---

## Step 1: Build live, in small steps

Read the spec, `.claude/rules/blender.md`, `blender/scripts/settings.py` and the act's build script (if they exist).

Work through the spec's sections in this order, one small step per `execute_blender_code` call, and `look` after each visible change so the director can follow along:
1. Settings: run `settings.py` (or confirm it's applied). Never change parity settings for one shot.
2. Objects and assets (reuse `blender/library/` first; hinges at the hinge).
3. Characters and clips (`<character>_<move>`, `_loop` for loops, 30 fps, root motion removed).
4. Camera keys, cuts and markers named with the shot id, with their custom properties.
5. Lighting and look, matching the act's color script.
6. VFX proxies for timing and framing.

After each step, give one line of status ("door tunnel placed, 12 doors, 1.6k tris each") and pause for feedback whenever the spec's Director's view leaves a visual choice open. Apply feedback before continuing.

**Asset rules:** `search_assets` / `import_asset` only for CC0/royalty-free libraries, and log each one in `raw-assets/LICENSES.md`. `generate_3d` is not allowed here: it may cost the user credits. Ask the user first if a generated model is really needed, and then run it yourself only after an explicit yes.

## Step 2: Save everything to the script

Every live change must end up in the script named in the spec's *Scene and file* section (`blender/scripts/build_<act>.py`, a bridge or a character script):
- Add or update the function for this shot (e.g. `build_shot_1_5()`), called from the script's main in shot order.
- Idempotent: it clears and rebuilds only its own collections (`act<N>_<thing>`); re-running never duplicates objects.
- Fixed seeds; nodes by type; no localized names; no hard-coded enum identifiers.
- Save the `.blend` from the script's last step (`bpy.ops.wm.save_as_mainfile`).

## Step 3: Prove the headless rebuild

```bash
blender --background --python blender/scripts/<script>.py
```
It must exit 0 with no Python traceback. Then reopen the result through the MCP (or `get_scene_info`) and confirm the shot's collections, actions, markers and camera keys are present. If the rebuild differs from the live scene, fix the script, not the scene, and re-run.

## Step 4: Blender review

Invoke the **mtd-blender-reviewer** subagent with:
- The item id, shot title, spec path and the build-order item block (Mode, Director, Build, Files, Stills, Done when)
- The script(s) changed (`git diff` + untracked paths) and the headless rebuild output
- Instruction: "Review this shot's Blender build against the spec, the plan's Director's view and `.claude/rules/blender.md`: script reproducibility, naming, budgets, parity settings, markers and camera keys, hinges, VFX proxies, licenses. Use only the read-only Blender MCP tools (`get_scene_info`, `look`). Don't change the scene or any file."

Wait for it to finish. If it reports 🚧 items, show them, fix them (in the script first, then the live scene), re-run Step 3, and invoke the reviewer again. At most 3 rounds; after that, stop and ask the director.

## Step 5: Report

```
Blender build: <item_id>: <shot_title>
Spec:     <spec path>
Script:   <script path>  (headless rebuild ✅)
Built:    <objects / clips / camera keys / markers, one line each>
Budgets:  <tris, bones, textures vs limits>
Review:   <reviewer verdict, and any 💡 items left>
Next:     /approve-shot <unit>  (renders the stills and preview for your approval)
```

## Rules
- Never tick the build-order item, record an approval, render the approval preview or export here
- Never hand-edit GLBs or `shots/*.json`
- Never change `settings.py` parity values for one shot; if the spec seems to need it, stop and ask
- A framing or timing change the director asks for is made in Blender and saved to the script, every time
- Don't commit; `/ship-shot` does that after approval
