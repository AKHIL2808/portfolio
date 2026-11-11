# Spec: F.2/B.03: `export_glb.py` (Blender)

- Build-order item: `F.2/B.03` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-2-b-03-export-glb-py`
- Mode: n/a (export tooling, no shot)
- Created: 2026-11-11

## Director's view
None. This is a Foundation item, not a story shot.

Plan › Foundation › F.2: "`export_glb.py`: chosen collections with custom properties, clips, shape keys, lights."
TDD › Asset pipeline step 7: "Export: `export_glb.py` (models and clips) … then `pnpm assets` to optimize."

## Overview
`export_glb.py` is the only way 3D leaves Blender for the web. All assets flow `blender/` → `raw-assets/` → `scripts/optimize-assets.mjs` → `public/`.

It runs headless on a saved scene and exports each collection named on the command line to `raw-assets/models/<name>.glb`. The GLB carries everything the browser needs from that collection:
- meshes with modifiers applied, in +Y-up meters;
- custom properties as glTF `extras`, on objects and on materials (the toon values F.3/W.11 reads);
- every action as an animation clip;
- shape keys as morph targets;
- lights in the glTF "Standard" lighting mode.

It doesn't optimize anything: meshopt and KTX2 are `pnpm assets` (F.2/B.07). It writes raw, uncompressed GLBs.

This item proves it on the test scene: `test_cube` → `raw-assets/models/test-cube.glb`. Later, `pnpm blender:export <act>` (F.2/B.07) calls it with each act's collection list.

## Depends on
- F.2/B.02: Test scene — cube, camera, markers: ✅ ticked (PR #8). Input `blender/scenes/test-cube.blend`, collection `test_cube`, which holds:
  - the cube `test_cube`, with object prop `mtd_kind`;
  - the material `test_flat`, with the 6 toon props;
  - the action `test_cube_spin_loop`, frames 1–61, closing key one frame past the 60-frame period;
  - the sun light `test_key_light`.
- F.2/B.01: `settings.py` ✅ (parity check before export).
- Machine: official Blender 5.2.4 LTS at `~/Applications/blender-5.2.4-linux-x64/blender` (its bundled glTF exporter add-on); `gltf-transform` CLI in `node_modules/.bin` (pinned at F.1/W.02, run with `pnpm exec gltf-transform`).
- Hand-offs recorded at F.2/B.02 (docs/progress.md):
  - Turn on custom-property export, or F.3/W.11 sees no toon values.
  - Clips are frames `[start, end)` with the closing key one frame past the period.

## Scene and file
- Script: `blender/scripts/export_glb.py` (new). Output: `raw-assets/models/test-cube.glb` (new, Git LFS: `*.glb` is tracked).
- Command line:

  ```
  $B --background blender/scenes/<scene>.blend --python blender/scripts/export_glb.py -- <collection> [<collection> …]
  ```

  Collections come after `--`. Each collection is exported to its own GLB, named with `_` → `-` (`test_cube` → `test-cube.glb`; see Open questions).
- Read-only on the scene. It never saves the `.blend`, and it fails if `settings.apply()` would change anything: a scene whose parity settings drifted isn't exported.
- Exits 1 on any failure: missing collection, empty collection, parity drift, export error. It uses the same pattern as `settings.py`, because Blender exits 0 on an uncaught exception.
- Idempotent: re-exporting overwrites the GLB.
- No collections, objects or `act<N>_origin` offsets are created.

## Export settings (glTF exporter, values read and validated, not trusted)

| Requirement | Exporter setting (exact names verified in the plan phase) |
|---|---|
| Only the chosen collection | Objects of that collection and its child collections |
| Not exported | Objects tagged `vfx_proxy = True` (Blender-only timing stand-ins); cameras (camera data goes to `shots/<act>.json` via F.2/B.04) |
| Format | `.glb`, no Draco or meshopt (optimization is `pnpm assets`) |
| +Y up | Y-up on |
| Modifiers applied | Apply modifiers on |
| Custom properties | Extras on (objects and materials) |
| All actions as clips | Animation mode "Actions"; clip names = Blender action names; clip time starts at 0 |
| Shape keys | Morph targets and their animation on |
| Lights | Punctual lights on, lighting mode "Standard" |
| Textures | Kept as in the `.blend` (none in the test scene; KTX2 is `pnpm assets`) |

## Objects and assets
None created. The exported test GLB must hold:
- the mesh `test_cube` (12 tris), with `extras.mtd_kind = "test"`;
- the material `test_flat`, with `extras` `baseColor`, `shadeColor`, `bands`, `rim`, `outlineWidth`, `outlineColor`;
- the directional light `test_key_light`;
- one animation `test_cube_spin_loop` of 2.0 s (frames 1 → 61 at 30 fps).

## Characters and clips
No characters. One clip: `test_cube_spin_loop`. Its closing key at 2.0 s equals the pose at 0 s, so a three.js `LoopRepeat` wraps with no doubled frame.

## Camera and markers
None (camera data is F.2/B.04).

## Lighting and look
One sun light exported as a glTF directional light in Standard lighting mode. Parity settings untouched; `settings.apply()` is only used as a drift check.

## VFX proxies
`vfx_proxy = True` objects are never written to a GLB. None are in `test_cube` today; the rule is enforced by the script and checked by a probe.

## Stills and preview
None (F.2/B.07).

## Export
`raw-assets/models/test-cube.glb` from `test_cube`. F.2/B.07 wires this into `pnpm blender:export <act>` and optimizes it to `public/models/test-cube.glb`.

## Build session (what `/blender-shot F.2/B.03` does)
1. Write `blender/scripts/export_glb.py`. The exporter options' exact names and enum values are read from the installed glTF add-on, not guessed.
2. Live: run the export through the Blender MCP on the open `test-cube.blend`, and look at the result (`gltf-transform inspect`).
3. Headless: export `test_cube` from `blender/scenes/test-cube.blend`.
4. `pnpm exec gltf-transform inspect raw-assets/models/test-cube.glb` shows the mesh, the material, the animation `test_cube_spin_loop` and the light. Extras are checked from the GLB's JSON chunk (see Open questions).
5. Negative checks, each exiting 1:
   - an unknown collection name;
   - no collection given;
   - a scratch copy of the scene with fps changed (parity drift).
6. Re-run the export: the GLB is overwritten, the content is the same, and the `.blend` is unchanged (no save, no `.blend1`).
7. `mtd-blender-reviewer`.

## Rules for implementation
- Live check through the Blender MCP; the final state saved in `export_glb.py`; runs headless
- Read-only on the scene; `settings.apply()` used only as a parity check (non-empty changes → fail)
- Enum identifiers and option names read from the exporter's RNA, never hard-coded blindly
- Names: output file = collection name with `_` → `-`; clip names = action names
- Never hand-edit the exported GLB; fix in Blender and re-export
- Python only from Blender's bundled interpreter; no new npm or pip packages

## Definition of done
- [ ] Headless export of `test_cube` writes a GLB whose cube extras, clip and light are readable by `gltf-transform inspect`
- [ ] `blender --background … --python blender/scripts/export_glb.py -- test_cube` runs with no errors (official binary), exit 0; failures exit 1
- [ ] `mtd-blender-reviewer` reports no 🚧 items
- [ ] Stills and preview: n/a for this item; no approval row
- [ ] Exported: `raw-assets/models/test-cube.glb` (Git LFS); no shot JSON in this item (F.2/B.04)
- [ ] `docs/progress.md` updated; `F.2/B.03` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- `export_shots.py`, `bake_vat.py`, `render_stills.py` (F.2/B.04–B.06)
- `pnpm blender:export`, `optimize-assets.mjs`, meshopt and KTX2 (F.2/B.07)
- Loading the GLB in the browser (F.3)

## Open questions
1. ✅ **Output file name:** (resolved 2026-11-11, director: yes, as proposed) proposed: the collection name with `_` → `-` (`test_cube` → `test-cube.glb`, matching the stage file). Later acts use the same rule (e.g. `act1_shaft` → `act1-shaft.glb`).
2. ✅ **Clip names:** (resolved 2026-11-11, director: yes, as proposed) the TDD lists clips without the character prefix (e.g. `fall_loop`), while actions are named `<character>_<move>` (e.g. `akhilesh_fall_loop`). Proposed: keep the full action name as the clip name, so clip names are unique across GLBs and match Blender exactly. The web hook (`useClip`) refers to them by full name.
3. ✅ **What's never exported:** (resolved 2026-11-11, director: yes, as proposed) proposed: cameras (shot data goes through F.2/B.04) and objects tagged `vfx_proxy = True`, in every GLB.
4. ✅ **Parity drift check:** (resolved 2026-11-11, director: yes, as proposed) proposed: before exporting, run `settings.apply()` and fail if it reports any change. The `.blend` is never saved by the export, so the check can't silently "fix" a scene.
5. ✅ **Checking extras:** (resolved 2026-11-11, director: yes, as proposed) `gltf-transform inspect` lists meshes, materials, animations and lights, but may not print `extras`. Proposed: check extras by reading the GLB's JSON chunk with a small Python standard-library script (in the scratchpad, no new dependency). Use `inspect` for the rest of the *Done when*.
6. ✅ **Raw GLBs in git:** (resolved 2026-11-11, director: yes, as proposed) proposed: commit `raw-assets/models/test-cube.glb` (Git LFS), as the stage file's *Files* line lists it. That keeps a reviewable record of each export, and `pnpm assets` can run without Blender. It's small: one cube, so a few KB of LFS.
