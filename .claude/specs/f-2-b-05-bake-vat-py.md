# Spec: F.2/B.05: `bake_vat.py` (Blender)

- Build-order item: `F.2/B.05` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-2-b-05-bake-vat-py`
- Mode: n/a (export tooling, no shot)
- Created: 2026-11-11

## Director's view
None. This is a Foundation item, not a story shot.

Plan › Foundation › F.2: "`bake_vat.py`: animated mesh → VAT textures + metadata."
TDD › Export settings and formats: "Crowd animations (VAT) | Position + normal textures from `bake_vat.py` | Kept as half-float EXR or 16-bit PNG, not KTX2 (needs precision) | Max 512 × 512 per clip set".

## Overview
Crowds can't be skinned characters: there are up to 200 weak demons in Act 3 and a koi school in Act 7. So their animation is baked into **vertex animation textures (VAT)**:
- one texture of vertex positions;
- one of vertex normals;
- a JSON file describing the layout.

The web `VATCrowd` effect (TDD catalog) reads them to animate one instanced mesh in a single draw call.

`bake_vat.py` runs headless on a saved scene. It plays each named clip of one mesh frame by frame, reads the evaluated mesh, and writes `raw-assets/vat/<name>.pos.exr`, `<name>.nrm.exr` and `<name>.json`.

It's proven on the test scene's pulsing ball: `test_vat_blob` with its 30-frame `test_vat_blob_pulse_loop`. The first real uses are the weak demons (`swarm_loop`, `lunge`, `freeze`; plan › Cast build) and the koi (`swim_loop`).

## Depends on
- F.2/B.02: Test scene — cube, camera, markers: ✅ ticked (PR #8). It provides:
  - `test_vat_blob` (collection `test_vat`): an icosphere with 162 verts / 320 tris, origin at the base, placed at (1.5, 0, 0);
  - shape key `pulse`, grown from the base;
  - action `test_vat_blob_pulse_loop` on its shape keys: keys at 1 → 16 → 31; the closing key one frame past the 30-frame period, so the loop is frames [1, 31) = 30 distinct frames.
- F.2/B.01 `settings.py` ✅ (parity drift check); F.2/B.03 `export_glb.py` ✅ (`check_parity`, CLI and failure patterns: `--`, `--out-dir`, read-only, temp file then move into place, exit 1).
- Machine: official Blender 5.2.4 LTS at `~/Applications/blender-5.2.4-linux-x64/blender`.

## Scene and file
- Script: `blender/scripts/bake_vat.py` (new). Outputs (new, `*.exr` in Git LFS):
  - `raw-assets/vat/test-vat-blob.pos.exr`;
  - `raw-assets/vat/test-vat-blob.nrm.exr`;
  - `raw-assets/vat/test-vat-blob.json`.
- Command line:

  ```
  $B --background blender/scenes/<scene>.blend --python blender/scripts/bake_vat.py -- [--out-dir DIR] <object> <action> [<action> …]
  ```

  The clips are baked in the order given, into one texture set. Output name = object name with `_` → `-`.
- Read-only on the scene: it never saves the `.blend`. Each clip's action is assigned to its owner for the bake (shape keys, the object, or its armature, by the action's slot type), and the original assignments and frame are restored in `finally`.
- Fails (exit 1, nothing written) on:
  - parity drift;
  - an unknown object or action;
  - an object that isn't a mesh;
  - a vertex count that changes between frames;
  - a texture that would exceed 512 × 512.
- No collections, objects or `act<N>_origin` offsets are created.

## What it bakes

| Item | Rule |
|---|---|
| Frames | Each clip is frames `[start, end)` of its action, sampled once per frame at 30 fps (closing key one frame past the period, as in `.claude/rules/blender.md`). The test clip: 1–30, so **30 frames**. |
| Values | Evaluated mesh per frame (shape keys, modifiers, armature applied), in **object space**, converted to Y-up `(x, z, −y)` like the GLB. Positions in meters; normals are unit vertex normals. |
| Layout | Texel column = Blender vertex index; one row per frame when the vertex count ≤ 512, otherwise several rows per frame (`rowsPerFrame`). Clips are stacked in order. Width ≤ 512 and height ≤ 512, or fail. The test: 162 × 30. |
| Format | Two RGBA **half-float EXR** files (RGB = xyz, A = 1), lossless ZIP compression, color space **Non-Color**. |
| Metadata | `{ object, vertexCount, fps, width, height, rowsPerFrame, frameCount, bounds: { min, max }, clips: [{ name, start, frames, row }], position, normal, space }`. `frameCount` = total baked frames (30 for the test = the action length at 30 fps); `bounds` = min/max position over all frames (Y-up). |

## Objects and assets
None created. Reads `test_vat_blob` (162 verts; weak-demon budget 1.5k tris, so ~750–800 verts → 2 rows per frame, still within 512 × 512 for three short clips).

## Characters and clips
No characters. One clip: `test_vat_blob_pulse_loop` (30 frames).

## Camera and markers
None.

## Lighting and look
None. Parity settings are only checked.

## VFX proxies
None.

## Stills and preview
None (F.2/B.07).

## Export
- `raw-assets/vat/test-vat-blob.{pos.exr, nrm.exr, json}`.
- F.2/B.07 runs this inside `pnpm blender:export <act>`, and `pnpm assets` copies `raw-assets/vat/` to `public/vat/` without KTX2 (TDD).

## Build session (what `/blender-shot F.2/B.05` does)
1. Write `blender/scripts/bake_vat.py`.
2. Live: bake `test_vat_blob test_vat_blob_pulse_loop` through the Blender MCP on the open `test-cube.blend` into the scratchpad. Show the metadata, and confirm the scene is unchanged.
3. Headless: bake into `raw-assets/vat/`.
4. Check the output:
   - the EXR sizes are 162 × 30, half-float, RGBA;
   - the metadata has `frameCount` 30 and `fps` 30, plus its bounds and clip ranges;
   - a few texels match Blender's evaluated vertex positions and normals at those frames (read back in Blender);
   - row 0 equals the rest pose, and row 15 is the full pulse.
5. Negative checks, each exiting 1 with nothing written:
   - an unknown object;
   - an unknown action;
   - an object that isn't a mesh (`test_cube` is a mesh, so use `test_camera`);
   - fps drift;
   - a clip that would exceed 512 rows.
6. Re-bake: identical files; the `.blend` is unchanged.
7. `mtd-blender-reviewer`.

## Rules for implementation
- Live check through the Blender MCP; the final state saved in `bake_vat.py`; runs headless
- Read-only on the scene; parity drift check via `export_glb.check_parity`; exit 1 on failure; temp files moved into place only after they validate
- Budgets: max 512 × 512 per clip set, half-float EXR, Non-Color (`.claude/rules/blender.md` › Budgets)
- Enum identifiers read from RNA; Python only from Blender's bundled interpreter; no new packages

## Definition of done
- [ ] The test scene's animated mesh bakes headless; texture size and color space match the rules; metadata frame count equals the action length at 30 fps
- [ ] `blender --background … --python blender/scripts/bake_vat.py -- test_vat_blob test_vat_blob_pulse_loop` runs with no errors (official binary), exit 0; failures exit 1
- [ ] `mtd-blender-reviewer` reports no 🚧 items
- [ ] Stills and preview: n/a for this item; no approval row
- [ ] Exported: `raw-assets/vat/test-vat-blob.*` (EXR in Git LFS)
- [ ] `docs/progress.md` updated; `F.2/B.05` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- The crowd mesh's own GLB and the web `VATCrowd` shader (first used in Stage 3 / Act 7)
- `render_stills.py` and the pnpm commands (F.2/B.06, F.2/B.07)
- Weak demon and koi models and clips (Stage C)

## Open questions
1. ✅ **File format:** (resolved 2026-11-11, director: yes, as proposed) the rules allow half-float EXR or 16-bit PNG. Proposed: **half-float EXR** (RGBA, ZIP). Browsers decode 16-bit PNGs down to 8 bits, which would lose the precision VAT needs. three.js reads EXR with its own `EXRLoader` (part of three, so no new dependency).
2. ✅ **Vertex mapping:** (resolved 2026-11-11, director: yes, as proposed) the glTF exporter splits and reorders vertices (seams, normals), so the web can't rely on GLB vertex order. Proposed: texel column = **Blender vertex index**. When a crowd mesh is first exported (Stage 3 / Act 7), `export_glb.py` adds a vertex attribute (e.g. `_vat_index`) that `VATCrowd` reads. Nothing is added to the test scene now.
3. ✅ **Absolute positions, not offsets:** (resolved 2026-11-11, director: yes, as proposed) proposed: store object-space positions (Y-up), so the shader needs no rest-pose attribute; half-float precision is ~1 mm at the 1–2 m scale of crowd meshes. `bounds` is recorded for culling and for any future 16-bit PNG fallback.
4. ✅ **Clips on the command line:** (resolved 2026-11-11, director: yes, as proposed) proposed: the object and the action names are given explicitly (`-- <object> <action> …`). Each action is assigned to its owner (shape keys, the object or its armature) by its slot type for the bake, and the original assignments are restored.
5. ✅ **Smooth normals only:** (resolved 2026-11-11, director: yes, as proposed) proposed: per-vertex normals. Flat-shaded crowd meshes would need per-corner normals, so the weak demon and koi are modeled smooth-shaded (a note for Stage C).
6. ✅ **File names:** (resolved 2026-11-11, director: yes, as proposed) proposed: `raw-assets/vat/<object _→->.pos.exr`, `.nrm.exr` and `.json`, so the test bake is `test-vat-blob.*`. The metadata names its two textures relative to itself.
