# Spec: F.2/B.04: `export_shots.py` (Blender)

- Build-order item: `F.2/B.04` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-2-b-04-export-shots-py`
- Mode: n/a (export tooling, no shot)
- Created: 2026-11-11

## Director's view
None. This is a Foundation item, not a story shot.

Plan › Foundation › F.2: "`export_shots.py`: camera keys, focal length, focus distance, markers → `shots/<act>.json`, merging existing events by shot id."
TDD › Core systems › 2: "`blender/scripts/export_shots.py` samples the camera at every keyframe and writes `shots/<act>.json` in the format above, so the browser plays exactly the framing approved in Blender. Events and gates are added in the JSON after export and preserved on re-export (the script merges by shot id)."

## Overview
`export_shots.py` turns an act's Blender camera into shot data the web Director plays:
- Timeline markers split the camera action into shots.
- The scene property `mtd_markers` gives each shot its `mode`, `scrollLength` or `duration`, and `camera`.
- The camera is sampled at each Blender key (not per frame) into `CameraKey { t, pos, target, fov, roll, ease }`, plus focus distance.

The result is written to `shots/<act>.json`. Events and gates that were added by hand are **merged by shot id**, so a re-export never drops them.

This is the only path for camera work into the browser: framing is never re-authored in code (CLAUDE.md › Critical rules).

Proven on the test scene, which produces `shots/test.json` with:
- `test-1`: scrub, frames 1–90;
- `test-2`: beat, frames 90–150.

F.3/W.01 (store and zod schema), F.3/W.04 (Director), F.3/W.06 (camera rig) and F.4/W.02 (stitch) all read this file.

## Depends on
- F.2/B.02: Test scene — cube, camera, markers: ✅ ticked (PR #8). It provides:
  - `blender/scenes/test-cube.blend`, with scene camera `test_camera`;
  - one action `test_camera_shots` with two slots: object (location, rotation) and camera data (`lens`, `dof.focus_distance`);
  - keys at frames 1, 45, 90 and 150;
  - markers `test-1`@1 and `test-2`@90;
  - `mtd_markers` = `{test-1: {mode: scrub, scrollLength: 2, camera: main}, test-2: {mode: beat, duration: 2, camera: main}}`;
  - frame range 1–150 at 30 fps.
- F.2/B.01: `settings.py` ✅: parity drift check, same as F.2/B.03.
- F.2/B.03: `export_glb.py` ✅: same CLI and failure patterns (`--` args, `--out-dir`, read-only, exit 1, write to a temp file then move into place).
- Hand-offs recorded at F.2/B.02:
  - read `mtd_markers` with `.to_dict()`;
  - each shot's first and last key sit on marker frames (1, 90), and the last shot ends at `scene.frame_end` (150).
- Machine: official Blender 5.2.4 LTS at `~/Applications/blender-5.2.4-linux-x64/blender`.

## Scene and file
- Script: `blender/scripts/export_shots.py` (new). Output: `shots/test.json` (new).
- Command line:

  ```
  $B --background blender/scenes/<scene>.blend --python blender/scripts/export_shots.py -- [--out-dir DIR] <act>
  ```

  `<act>` names the file (`test` → `shots/test.json`; later `act1` → `shots/act1.json`).
- Read-only on the scene: never saves the `.blend`; fails on parity drift (`settings.apply()` would change something, so it's reverted, then the script fails).
- Exits 1 on any failure (Blender exits 0 on an uncaught exception).
- No collections, objects or `act<N>_origin` offsets are created.

## What it exports

**Shots** (in timeline order):
- One shot per timeline marker that has an entry in `mtd_markers`.
- A shot runs from its marker's frame to the next marker's frame. The last shot ends at `scene.frame_end`.
- `t = (frame − start) / (end − start)`.
- Fails on:
  - a marker without an `mtd_markers` entry, or an `mtd_markers` entry without a marker;
  - two markers on one frame;
  - a missing scene camera;
  - an invalid `mode` (`scrub` needs `scrollLength`, `beat` needs `duration`) or an invalid `camera` (`main` or `pov`);
  - a beat whose `duration` doesn't match its frame span at 30 fps.

**Keys** (per shot):
- The camera is sampled at the union of every keyframe on the camera's action, across both slots (object and camera data), that lies inside the shot.
- The shot's start and end frames are always included, so `t` = 0 and `t` = 1 always exist.
- Keys are sorted by `t`.

**`CameraKey`**, converted to three.js conventions (meters, Y up):

| Field | From Blender |
|---|---|
| `t` | shot-relative 0..1 |
| `pos` | camera world position, Blender Z-up → Y-up: `(x, z, −y)` |
| `target` | position + forward × focus distance (the point the camera looks at), same conversion |
| `fov` | **vertical** field of view in degrees, from focal length, sensor and the 16:9 render aspect, because three.js `PerspectiveCamera.fov` is vertical |
| `roll` | degrees around the view axis, relative to world up (0 for the test camera) |
| `ease` | GSAP ease name for the segment from this key to the next, mapped from the Blender key interpolation (see Open questions) |
| `focus` | focus distance in meters (see Open questions) |

**Merge with an existing file:**
- Exported fields (`mode`, `scrollLength` / `duration`, `camera`, `keys`) are always replaced from Blender.
- Each shot's `events` are kept as they are, matched by shot id.
- The file's top-level `gates` are kept as they are.
- A shot id in the file that no longer exists in Blender stops the export: the script fails and lists the ids, so hand-added events are never silently dropped.

**Point markers** (Open question 7): an `mtd_markers` entry `{"kind": "marker"}` makes a marker a point inside a shot, exported as `markers: [{id, shot, t}]` (file shape `{act, fps, shots, markers, gates}`).

**Output:**
- Stable, deterministic JSON: 2-space indent, fixed field order, rounded numbers (positions 4 decimals, angles 3), trailing newline.
- Written to a temp file and moved into place only after it re-reads and validates.

## Objects and assets
None.

## Characters and clips
None.

## Camera and markers
None created. Reads the existing camera, markers and `mtd_markers` (see *What it exports*).

## Lighting and look
None. Parity settings are only checked, never changed.

## VFX proxies
None.

## Stills and preview
None (F.2/B.07).

## Export
`shots/test.json` with `test-1` and `test-2`:
- `test-1`: keys at t = 0, ≈0.494 (frame 45) and 1.
- `test-2`: keys at t = 0 and 1.

F.2/B.07 wires this into `pnpm blender:export <act>`.

## Build session (what `/blender-shot F.2/B.04` does)
1. Write `blender/scripts/export_shots.py`.
2. Live: run it through the Blender MCP on the open `test-cube.blend`, writing to the scratchpad, and show the JSON.
3. Headless: export `test` from `blender/scenes/test-cube.blend` → `shots/test.json`.
4. Check the output:
   - both shots;
   - keys sorted 0 → 1;
   - every key's `target` is the cube centre in Y-up (0, 0.5, 0);
   - `pos` matches Blender's camera at each key frame;
   - `fov` matches Blender's lens.
5. Merge test:
   - hand-add an event (e.g. `{ "t": 0.5, "type": "custom", "payload": { "probe": true } }`) to `test-1` and a gate to `gates`;
   - re-export: both are unchanged, and the camera keys are re-written.
6. Negative checks (scratch copies), each exiting 1:
   - a marker without `mtd_markers`;
   - a beat whose duration doesn't match its frames;
   - fps drift;
   - a shot in the JSON that's missing from Blender;
   - no act argument.
7. Re-export twice: byte-identical, and the `.blend` is unchanged.
8. `mtd-blender-reviewer`.

## Rules for implementation
- Live check through the Blender MCP; the final state saved in `export_shots.py`; runs headless
- Read-only on the scene; parity drift check as in `export_glb.py`; exit 1 on failure
- Never hand-edit camera keys in `shots/`; only `events` and `gates` are hand-edited, and they survive re-export
- Enum identifiers (interpolation, sensor fit) read from RNA, not trusted blindly
- Python only from Blender's bundled interpreter; no new packages

## Definition of done
- [ ] `shots/test.json` has both test shots with keys sorted by `t` from 0 to 1; a hand-added event survives a re-export unchanged
- [ ] `blender --background … --python blender/scripts/export_shots.py -- test` runs with no errors (official binary), exit 0; failures exit 1
- [ ] `mtd-blender-reviewer` reports no 🚧 items
- [ ] Stills and preview: n/a for this item; no approval row
- [ ] Exported: `shots/test.json` has both shots with keys sorted by `t` 0 → 1
- [ ] `docs/progress.md` updated; `F.2/B.04` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- The zod schema and TypeScript types for this file (F.3/W.01)
- Playing it (F.3/W.04 Director, F.3/W.06 camera rig)
- POV cameras attached to a head bone (first used with a character; the test shots are `main` only)
- `bake_vat.py`, `render_stills.py`, pnpm commands (F.2/B.05–B.07)

## Open questions
1. ✅ **File shape:** (resolved 2026-11-11, director: yes, as proposed) TDD › Core systems shows `Shot` and `Gate` types but not the file around them, and `gates` need a home that isn't a shot. Proposed:

   ```json
   { "act": "test", "fps": 30, "shots": [Shot, …], "gates": [Gate, …] }
   ```

   `shots` is in timeline order; `gates` starts empty and is hand-edited; gate events reference gates by id. F.3/W.01's zod schema follows this.
2. ✅ **Focus distance:** (resolved 2026-11-11, director: yes, as proposed) the TDD's `CameraKey` has no focus field, but the plan and stage file require focus distance. Proposed: add an optional `focus` (meters) to `CameraKey`. F.3/W.01 adds it to the type and schema.
3. ✅ **Coordinate conversion:** (resolved 2026-11-11, director: yes, as proposed) proposed: the exporter writes three.js conventions directly: Y-up `(x, z, −y)` and a **vertical** `fov` in degrees. The web then uses keys as-is, with no conversion code.
4. ✅ **Ease mapping:** (resolved 2026-11-11, director: yes, as proposed) Blender's Bézier ease between keys has no exact GSAP equivalent. Proposed mapping, for the segment from each key to the next:
   - `LINEAR` → `"none"`
   - `CONSTANT` → `"steps(1)"`
   - `BEZIER` → `"power1.inOut"`
   - anything else fails.

   The last key's `ease` is omitted. Parity stills are taken at key frames, where both sides are exact.
5. ✅ **Shots removed in Blender:** (resolved 2026-11-11, director: yes, as proposed) proposed: if the existing JSON has a shot id that Blender no longer has, the export fails and lists it, rather than dropping its events. Delete the shot from the JSON by hand when that's intended.
6. ✅ **Beat duration check:** (resolved 2026-11-11, director: yes, as proposed) proposed: a beat's `duration` must equal its frame span ÷ 30 (to within one frame), or the export fails. Blender is the source of truth for timing.
7. ✅ **Point markers** (decided 2026-11-11, director, from the reviewer's finding): some plan markers aren't shot starts (`T01-handoff`, `T23-dark`, clash cuts `4R<n>-C1..C3`).
   - An `mtd_markers` entry of exactly `{"kind": "marker"}` makes a marker a named point inside a shot. It doesn't split shots.
   - Point markers are exported as a top-level `markers: [{id, shot, t}]` list, always replaced from Blender.
   - The file shape becomes `{act, fps, shots, markers, gates}`.
8. ✅ **Build changes after review** (director, 2026-11-11):
   - **Hard cuts:** a camera jump at a shot boundary fails the export ("hard cuts between shots aren't supported by export_shots yet"). A cut convention is decided when the first story cut needs one.
   - **Camera channels only:** only the camera's transform, lens, sensor and focus channels are sampled. Any other animation on the camera (visibility, custom properties) is ignored, and channels that hold still don't count toward the segment ease. Animated lens shift fails.
   - **Depth of field:** it's no longer required. Only the focus distance is exported, and stills should render without visible blur (F.2/B.06), because the web has no blur effect.

