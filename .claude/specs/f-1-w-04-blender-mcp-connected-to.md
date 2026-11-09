# Spec: F.1/W.04: Blender MCP connected to Claude Code (Web)

- Build-order item: `F.1/W.04` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-1-w-04-blender-mcp-connected-to`
- Mode: n/a (infrastructure, no shot)
- Approved render: n/a (F.1 has no `/B` item)
- Created: 2026-11-09

## Director's view
None. This is a Foundation item. Plan › F.1 bullet this item covers (docs/plan.md › Foundation › F.1 Project setup): "Blender MCP connected to Claude Code; confirm it can create an object in an open file."

TDD › Milestones › M0 (Blender phase is done when): "Blender MCP connected to Claude Code; `blender/` folders, Git LFS, export scripts run headless on an empty test scene."
TDD › Asset pipeline › Claude Code + Blender: "Live: a Blender MCP server lets Claude Code create and adjust objects, materials, rigs and keyframes in your open Blender session while you watch and give feedback. Reproducible: every change made live is also saved as a `bpy` script in `blender/scripts/` …"

## Overview
Every `/B` item from F.2 on is built live in your open Blender through the Blender MCP, and then saved to a `bpy` script. This item proves that link works end to end before any real Blender work depends on it. It does five things:
- Confirms the MCP server answers.
- Reads the Blender version and the add-on status.
- Creates one throwaway object in the open file, looks at it, then removes it, leaving the file as it was.
- Records the Blender version and the MCP setup in `docs/progress.md`, so later sessions know what they're running against.

No Blender file is saved and no `bpy` script is written; that starts in F.2/B.01 (`settings.py`).

## Depends on
- F.1/W.03: Project docs in Markdown + progress log: ✅ ticked (PR #3); `docs/progress.md` exists.
- **On the machine (checked 2026-11-09, read-only):**
  - Blender **5.2.2 LTS** at `/usr/bin/blender`.
  - The `blender` MCP server is registered in your **user-level** Claude Code config (`~/.claude.json` › `mcpServers.blender`), as `uvx blender-mcp` over stdio.
  - The repo has no project `.mcp.json`.
  - Claude Code lists these Blender MCP tools: `get_addon_status`, `get_scene_info`, `execute_blender_code`, `look`, `search_assets`, `import_asset`, `generate_3d`, `disable_telemetry`, `record_trajectory_feedback`.
- **Needs you during the build:**
  - Blender open with the Blender MCP add-on enabled and its server started. The add-on side isn't visible from here until Blender is running.
  - An open file. A new, unsaved General file is fine and preferred.

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
None.

## The connection check (what the build session does)
All steps go through the Blender MCP; nothing is saved to disk inside Blender.
1. `get_addon_status`: Blender version, the add-on version, and which asset libraries and generators are on. Record the Blender and add-on versions.
2. `get_scene_info`: note the open file's name, or that it's unsaved, and its object list, so we can prove it's unchanged at the end.
3. `execute_blender_code`: create one object named `MTD_mcp_check`, a UV sphere at (0, 0, 1) with a material whose Base Color is set on the Principled BSDF node, found by type and never by name (MCP rules). Keep its name in a variable; touch nothing else.
4. `look`: view the scene with a small `max_size`. You and I confirm the sphere is visible.
5. `execute_blender_code`: delete `MTD_mcp_check`, its mesh data and its material (no orphan data left).
6. `get_scene_info` again: the object list matches step 2 exactly.
7. Write the results to `docs/progress.md`: Blender version, add-on version, MCP server command (`uvx blender-mcp`, user-scope config), date, and "create / look / remove: OK".

## Files to change / Files to create
- `docs/progress.md`:
  - A new `## Environment` section (or an extension of the existing `### Environment` under Open issues), recording:
    - Blender 5.2.2 LTS (`/usr/bin/blender`)
    - Blender MCP add-on version (read in step 1)
    - Claude Code MCP server: `uvx blender-mcp`, user-scope config
    - date checked
  - "Next" set to F.1/W.05.
  - Done gets the W.04 line at `/ship-shot`.
- `.claude/specs/f-1-w-04-blender-mcp-connected-to.md`: this spec, with the check results filled in.
- Nothing in `blender/`. No `.blend`, no script, no render.

## New dependencies
No new npm dependencies. The MCP server (`blender-mcp` via `uvx`) and the Blender add-on are already set up on your machine at user level; this item doesn't add or change them (see Open question 1).

## Rules for implementation
- Only the throwaway `MTD_mcp_check` object, mesh and material are created, and all three are removed in the same session. The open file must end exactly as it started. Never save the file.
- Look shader nodes up by **type**, set material colors on node inputs (not `diffuse_color`), and read enum identifiers instead of hard-coding them (MCP server instructions; `.claude/rules/blender.md` › Script rules).
- Don't call `generate_3d`, `import_asset` or `search_assets`. They can cost credits or bring in third-party assets, and every third-party asset needs a license row in `raw-assets/LICENSES.md` (CLAUDE.md › Original art only). They're out of scope here.
- Don't change Blender preferences, render settings or units. Parity settings are set once, in F.2/B.01 `settings.py`.
- No secrets or machine paths beyond the Blender binary path go into the repo.

## Tests
No automated test: the check needs your running Blender, which CI and the test runner can't reach. The verification is the seven steps above, done live, with outputs pasted into the spec's Results section:
- Step 1 returns a Blender version (expected 5.2.x).
- Step 4's image shows the sphere.
- Step 6's object list equals step 2's.
- `pnpm typecheck && pnpm lint && pnpm test` stay green. Only `docs/progress.md` changes, and `tests/unit/docs-structure.test.ts` checks its section order (Done, Next, Open issues), so any new section must keep that order. A new `## Environment` section should go **after** Open issues, or the existing `### Environment` subsection should be extended instead (see Open question 3).

## Definition of done
- [ ] the MCP creates an object in an open Blender file, it is visible via `look`, and it is removed again; Blender version logged
- [ ] The scene's object list after the check equals the list before it; the file was not saved
- [ ] `docs/progress.md` records Blender version, add-on version, MCP server command and date
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green
- [ ] `/test-shot` and `/review-shot` skipped (no code; see Open question 4)
- [ ] `docs/progress.md` updated; `F.1/W.04` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- `settings.py` and any Blender script (F.2/B.01), the test scene (F.2/B.02), the export scripts (F.2/B.03–B.07).
- Installing or upgrading Blender, the add-on, or `uv`.
- CI and Vercel (F.1/W.05).
- Any asset import or AI generation.

## Open questions
1. ~~Commit a project `.mcp.json`?~~ Resolved 2026-11-10: no; kept at user level, command recorded in `docs/progress.md` › Environment.
2. ~~Telemetry.~~ Resolved 2026-11-10: disabled via `disable_telemetry` (done first, before any other Blender call).
3. ~~Where the version goes.~~ Resolved: existing `### Environment` subsection under Open issues.
4. ~~Test and review.~~ Resolved: skipped; verified live (see Results).
5. ~~Latest stable?~~ Resolved: stay on Blender 5.2.2 LTS; upgrade only before F.2 if the director wants, never mid-build.

## Results (2026-11-10)

| Step | Call | Result |
|---|---|---|
| Telemetry | `disable_telemetry` (moved first: the tool collects prompts, code and screenshots) | "Data collection is now OFF" |
| 1 | `get_addon_status` | Blender **5.2.2 LTS**; add-on **1.8**, protocol 15/15, up to date; libraries polyhaven / sketchfab / polypizza off; generators tripo / hunyuan3d / hyper3d / meshy off; telemetry_consent false |
| 2 | baseline | file `(unsaved)`; objects `Camera, Cube, Light`; meshes `Cube`; materials `Dots Stroke, Material` |
| 3 | create | `MTD_mcp_check` object + mesh + material, UV sphere (512 faces) at (0, 0, 1); Principled BSDF found by type, Base Color socket by identifier |
| 4 | `look` (three-quarter, material shading, 512 px) | orange sphere visible on top of the default cube |
| 5 | remove | `leftover: False` (object, mesh, material all removed) |
| 6 | after | objects `Camera, Cube, Light`; meshes `Cube`; materials `Dots Stroke, Material` — identical to the baseline; file still unsaved |
