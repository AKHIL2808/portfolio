# Spec: F.2/B.02: Test scene — cube, camera, markers (Blender)

- Build-order item: `F.2/B.02` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-2-b-02-test-scene-cube-camera-markers`
- Mode: n/a (test scene). It holds two test shots: one **scrub** (`scrollLength`) and one **beat** (`duration`)
- Created: 2026-11-11

## Director's view
None. This is a Foundation item, not a story shot.

Plan › Foundation › F.4 Done when: "a test cube scene exports from Blender, plays in the browser through the Director, and passes the parity test."
TDD › Milestones › M0: "export scripts run headless on an empty test scene"; M2: "A test scene with a moving camera and markers exports to valid shot JSON".

## Overview
The test scene is the fixture every remaining Stage F item runs against, so it has to contain one of everything those items need:

| Later item | Needs from this scene |
|---|---|
| F.2/B.03 `export_glb.py` | A `test_cube` collection whose cube has custom properties (extras), an action (clip) and a light |
| F.2/B.04 `export_shots.py` | One animated camera with ≥ 3 keys (focal length and focus distance keyed) and markers for two shots with their properties |
| F.2/B.05 `bake_vat.py` | A small animated mesh with an action |
| F.2/B.06 `render_stills.py` | An object tagged as a VFX proxy, so stills can prove it's hidden (see Open questions) |
| F.2/B.07 | The scene its test-cube stills come from (start and middle of the test-cube shot) |
| F.3 / F.4 web items | Two test shots (scrub and beat) to play, stitch and parity-check; cube material values to read (F.3/W.11) |

Nothing stitches into or out of it; it's never part of the story.

## Depends on
- F.2/B.01: `settings.py` parity settings: ✅ ticked (PR #7). `build_test.py` imports it and calls `settings.apply()` first.
- Machine: official Blender 5.2.4 LTS at `~/Applications/blender-5.2.4-linux-x64/blender` (docs/progress.md › Environment). Never `/usr/bin/blender`.
- Library pieces, characters, clips: none (`blender/library/` is empty).

## Scene and file
- Script: `blender/scripts/build_test.py` (new). File: `blender/scenes/test-cube.blend` (new, Git LFS: `*.blend` is tracked).
- Script order:
  1. Add its own folder to `sys.path`, `import settings`, `settings.apply()`.
  2. Clear only what it owns (see below).
  3. Build the scene.
  4. Save the `.blend`.
- Collections (stage open question proposes the `test_` prefix in place of `act<N>_`; see Open questions):
  - `test_cube`: cube and key light; the only collection exported to `test-cube.glb` (F.2/B.03).
  - `test_camera`: the camera.
  - `test_vat`: the VAT test mesh (baked by F.2/B.05, not part of the GLB).
  - `test_vfx`: the VFX proxy.
- What it owns, removed and rebuilt on every run:
  - Those four collections and their objects.
  - Their meshes, materials, lights and cameras.
  - Its actions.
  - Its two markers.
  - The `mtd_markers` scene property.
  - The world `test_world`.

  It never deletes anything else, so re-running leaves no duplicates (`.001` names) and no orphan data.
- Frame range 1–150 at 30 fps (from `settings.py`). No `act<N>_origin` offsets (the test scene sits at the world origin).

## Objects and assets
| Object | Collection | Geometry / triangles | Origin | Material / data |
|---|---|---|---|---|
| `test_cube` | `test_cube` | 1 m cube, 12 tris | Base center at (0, 0, 0) (origin at the base, transforms applied) | `test_flat`: placeholder flat material, Base Color set on the Principled BSDF found by type |
| `test_key_light` | `test_cube` | Sun light | n/a | One key light. Strength and angle chosen live, then saved in the script |
| `test_vat_blob` | `test_vat` | Icosphere, 320 tris, 162 verts (bmesh `subdivisions=3`; the UI calls this level 2) | Base, beside the cube | `test_flat`; shape key `pulse` |
| `test_vfx_proxy` | `test_vfx` | Ring (circle mesh), < 100 tris | n/a | Custom property `vfx_proxy = True` (see Open questions) |

Custom properties on the cube (prove extras export at F.2/B.03, and give F.3/W.11 values to read):
- On the **object**: `mtd_kind = "test"`.
- On the **material** `test_flat`: toon placeholder values named after the web uniforms, without the `u` prefix:
  - `baseColor` (RGB)
  - `shadeColor` (RGB)
  - `bands` (int, 3)
  - `rim` (float)
  - `outlineWidth` (meters)
  - `outlineColor` (RGB)

  These are values only; no `MTD_Toon` node group in this item (see Open questions).

World: background color set on the Background node, found by type, so stills don't depend on the factory world.

No textures, so no color-space choices in this item.

## Characters and clips
No characters. Actions (`<thing>_<move>`, loops end `_loop`), all keyed at 30 fps:
- `test_cube_spin_loop`: cube rotates 360° about Z, linear: 0° at frame 1, 360° at frame 61 (closing key one frame past the 60-frame period, so frames [1, 61) are the loop's 60 distinct frames). The GLB clip for F.2/B.03.
- `test_vat_blob_pulse_loop`: shape key `pulse` 0 → 1 → 0 at frames 1 → 16 → 31 (frames [1, 31) = 30 distinct frames; the VAT source for F.2/B.05; frame count = 30).
- `test_camera_shots`: the camera action (below).

## Camera and markers
- One camera `test_camera`. Depth of field on, so focus distance is a real keyed value.
- Keyed directly on location and rotation, with no constraints (nothing to bake). The script computes each rotation with a look-at toward the cube, so `export_shots.py` can derive `target` as position + forward × focus distance.
- Keys (exact poses tuned live and saved in the script):

| Frame | Shot / t | Pose idea | Focal length | Focus distance |
|---|---|---|---|---|
| 1 | `test-1` t = 0 | Front-right, slightly high, cube centered | 35 mm | to the cube |
| 45 | `test-1` t = 0.5 | Front, lower (pulled back to 5 m after the live check: the first pose cropped the cube) | 50 mm | to the cube |
| 90 | `test-1` t = 1 / `test-2` t = 0 | Front-left | 35 mm | to the cube |
| 150 | `test-2` t = 1 | High three-quarter view | 28 mm | to the cube |

  Four keys (the requirement is ≥ 3). The frame-90 key is shared by both shots, so the boundary has no jump (F.4/W.02 stitch check). Roll stays 0, and there are no cuts.
- Markers (named with the test shot ids; see Open questions):
  - `test-1` at frame 1: `mode: "scrub"`, `scrollLength: 2`, `camera: "main"`.
  - `test-2` at frame 90: `mode: "beat"`, `duration: 2` (60 frames = 90 → 150), `camera: "main"`.
  - The last shot ends at the scene's `frame_end` (150).
- **Marker properties:** Blender 5.2 timeline markers can't hold custom properties. Checked headless: `TypeError: id properties not supported for this type`. So the properties go in a scene custom property `mtd_markers = { "test-1": {...}, "test-2": {...} }`, keyed by marker name. `export_shots.py` reads them from there (see Open questions).

## Lighting and look
- No story palette (test scene). Flat placeholder colors, one sun key light, world background a flat color.
- No bake.
- Parity settings untouched: `settings.apply()` only.

## VFX proxies
`test_vfx_proxy` (a ring, tagged `vfx_proxy = True`). It's visible in the viewport and the preview; F.2/B.06 must hide it in stills. It has no real effect behind it.

## Stills and preview
None in this item. F.2/B.07 renders the test-cube stills (start and middle of `test-1`) to `blender/renders/stills/test/` for approval.

## Export
None in this item. F.2/B.03–B.05 export from this scene:
- `raw-assets/models/test-cube.glb` from `test_cube`.
- `shots/test.json` with `test-1` and `test-2`.
- VAT from `test_vat_blob`.

## Build session (what `/blender-shot F.2/B.02` does)
1. Open a new empty file in the official Blender.
2. Live, one small step per MCP call with a `look` after each:
   1. `settings.apply()`
   2. The `test_cube` collection: cube, material and custom properties, light
   3. The cube spin action
   4. The VAT blob and its shape-key action
   5. The VFX proxy
   6. Camera keys
   7. Markers and `mtd_markers`

   You can adjust framing and the light while watching.
3. Write the final state to `blender/scripts/build_test.py`.
4. Headless: `$B --background --factory-startup --python blender/scripts/build_test.py` writes `blender/scenes/test-cube.blend`. Run it twice, then count objects, actions, markers and materials: they're identical and there are no `.001` names.
5. Reopen the saved `.blend` live and check the collections, actions, markers and camera keys are present.
6. `mtd-blender-reviewer`.

## Rules for implementation
- Build live through the Blender MCP; the final state saved in `build_test.py`; the scene rebuilds headless
- `settings.apply()` first; idempotent (clears only what it owns); nodes looked up by type; enum identifiers read, not hard-coded; material colors on node inputs, never `diffuse_color`
- If the script ever randomizes anything, it uses `settings.seed_all(<fixed seed>)` and records the seed (nothing random is planned)
- Origins at the base, transforms applied, 1 unit = 1 m
- Headless failures exit non-zero (same pattern as `settings.py`: `sys.exit(1)` on exception)
- Original, primitive-only geometry; no third-party assets

## Definition of done
- [ ] `blender --background --python blender/scripts/build_test.py` rebuilds the scene from scratch; running it twice leaves no duplicates
- [ ] `blender --background --python blender/scripts/build_test.py` rebuilds the scene with no errors (official binary, with `--factory-startup`)
- [ ] `mtd-blender-reviewer` reports no 🚧 items
- [ ] Stills and preview: n/a for this item (F.2/B.07 renders and approves the test-cube stills); no approval row
- [ ] Export: n/a in this item (F.2/B.03–B.05 export from this scene)
- [ ] `docs/progress.md` updated; `F.2/B.02` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- Export, VAT and render scripts (F.2/B.03–B.06); pnpm commands and approval (F.2/B.07)
- The `MTD_Toon` node group and Solidify outline as library assets (tdd › M3, Stage C)
- Any web code; any story shot

## Open questions
1. ✅ **Test scene naming** (resolved 2026-11-11, director: yes, as proposed) (stage open question): `build_test.py`, `blender/scenes/test-cube.blend`, collections `test_cube` / `test_camera` / `test_vat` / `test_vfx`, `shots/test.json`, stills in `blender/renders/stills/test/`. Proposed: confirm as is. The `test_` prefix stands in for `act<N>_` because the test scene isn't an act.
2. ✅ **Test shot ids:** (resolved 2026-11-11, director: yes, as proposed) proposed `test-1` (scrub, `scrollLength` 2) and `test-2` (beat, `duration` 2 s). Confirm the ids and values.
3. ✅ **Marker properties:** (resolved 2026-11-11, director: yes, as proposed) markers can't hold custom properties in Blender 5.2. Proposed: a scene custom property `mtd_markers` keyed by marker name. Every act scene uses the same pattern, and `export_shots.py` (F.2/B.04) reads it. This is a project-wide convention, so it also needs a one-line note in `.claude/rules/blender.md` › Script rules (made in this item).
4. ✅ **MTD_Toon library vs F.3 materials** (resolved 2026-11-11, director: yes, as proposed) (stage open question): proposed no `MTD_Toon` node group or outline in F.2. The cube's placeholder material carries the toon values as material custom properties (`baseColor`, `shadeColor`, `bands`, `rim`, `outlineWidth`, `outlineColor`), so F.3/W.11 can read them from the GLB. The visual toon match is checked in Stage C (C1, tdd › M3).
5. ✅ **VFX proxy tag:** (resolved 2026-11-11, director: yes, as proposed) F.2/B.06 needs "objects tagged as VFX proxies" in the test scene, but B.02's Build line doesn't list one. Proposed: include `test_vfx_proxy` here, with the tag as an object custom property `vfx_proxy = True`. That's the convention every act scene follows.
6. ✅ **Skinned test mesh for F.3/W.11:** (resolved 2026-11-11, director: yes, as proposed) F.3/W.11 must work "on an instanced and a skinned test mesh". Proposed: not in this scene; the web test builds a small skinned mesh in code. If you'd rather it come from Blender, add a 2-bone bar with a bend clip to `test_cube` here.
7. ✅ **Camera rotation keys:** (resolved 2026-11-11, director: yes, as proposed) proposed keying rotation directly, with no Track To constraint, so nothing needs baking and `target` is derived from position + forward × focus distance. Confirm `export_shots.py` may rely on that.
