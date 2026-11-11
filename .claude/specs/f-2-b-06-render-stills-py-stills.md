# Spec: F.2/B.06: `render_stills.py` (stills + preview) (Blender)

- Build-order item: `F.2/B.06` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-2-b-06-render-stills-py-stills` (title slug cut at a word boundary to stay within 30 characters)
- Mode: n/a (render tooling, no shot)
- Created: 2026-11-11

## Director's view
None. This is a Foundation item, not a story shot.

Plan › Foundation › F.2: "`render_stills.py`: renders a shot's key frames for the parity test."
Plan › The parity test, step 1: "`pnpm blender:stills <shot>` renders 1–3 key frames (Eevee, 1920 × 1080, VFX proxies hidden)."
`.claude/commands/approve-shot.md` › Step 1:
- Stills: exactly the moments the spec's *Stills and preview* section lists, Eevee, 1920 × 1080, VFX proxies hidden, to `blender/renders/stills/<unit-slug>/`.
- Preview: the shot (transitions: with 2 s on each side) to `blender/renders/previews/<unit-slug>.mp4`, VFX proxies visible.

## Overview
`render_stills.py` makes the material you approve and the reference images the parity test compares against.

**What it does:** given a shot's marker id, it runs headless on the saved scene and renders:
1. **Stills:** 1–3 moments of the shot, given as shot-relative `t`, the same `t` the browser's `/dev/shot?shot=<id>&t=<t>` freezes at. They're Eevee renders at 1920 × 1080 with VFX proxies hidden, saved to `blender/renders/stills/<unit-slug>/`, plus a small `index.json` listing each still's `t` and frame.
2. **Preview:** the whole shot, plus 2 s on each side for transitions, as an H.264 `.mp4` with VFX proxies visible, saved to `blender/renders/previews/<unit-slug>.mp4`.

**Where it's used:**
- `/approve-shot` runs it through `pnpm blender:stills <shot>` (wired in F.2/B.07).
- The F.4/W.03 parity helper reads the stills and their `t`.

**This item** proves it on the test scene. The first real stills, the test-cube shot's start and middle, are rendered and approved in F.2/B.07.

## Depends on
- F.2/B.02: Test scene: ✅ ticked (PR #8). It provides:
  - `blender/scenes/test-cube.blend`, with markers `test-1`@1 and `test-2`@90, and `frame_end` 150;
  - the VFX proxy `test_vfx_proxy` (`vfx_proxy = True`, a ring around the cube);
  - the camera `test_camera`, with DOF on.
- F.2/B.04 `export_shots.py` ✅:
  - shot ranges and `t` are reused from `_shot_specs` (so `t` means exactly what `shots/<act>.json` means; point markers don't split shots);
  - decision 8: stills render without depth-of-field blur, because the web has no blur effect.
- F.2/B.01 `settings.py` ✅ (Eevee 64 samples, AgX, 1920 × 1080, 30 fps); `export_glb.check_parity`.
- Machine: official Blender 5.2.4 LTS; `/usr/bin/ffprobe` for checking the mp4.

## Scene and file
- Script: `blender/scripts/render_stills.py` (new). No `.blend` changes, and no render outputs committed in this item (see Open questions).
- Command line:

  ```
  $B --background blender/scenes/<scene>.blend --python blender/scripts/render_stills.py -- [--out-dir DIR] [--no-preview] <shot id> <t> [<t> <t>]
  ```

  - `<shot id>` is the marker name, e.g. `test-1`, `1.5` or `T01`.
  - 1–3 values of `t`, each in 0..1.
  - `--out-dir` replaces `blender/renders` (for tests).
- Read-only on the scene: it never saves the `.blend`. Everything it changes for the render is restored in `finally`:
  - proxy `hide_render`;
  - camera DOF;
  - the output format;
  - the file path;
  - the frame range and the frame.
- Fails (exit 1) on:
  - parity drift;
  - an unknown shot id, or a point marker given instead of a shot;
  - `t` outside 0..1, or more than 3 stills;
  - a render that produces no file;
  - an mp4 that `ffprobe` can't read.

## What it renders

| Output | Rule |
|---|---|
| Still frames | frame = shot start + `t` × (shot end − start), the same mapping as `export_shots.py`. A fractional frame renders at that subframe (e.g. `test-1` t 0.5 → frame 45.5). |
| Stills | PNG, RGB 8-bit, 1920 × 1080 at 100 %, scene color management (AgX, sRGB), Eevee with the `settings.py` samples. Objects with `vfx_proxy = True` hidden. Camera DOF off. |
| Still names | `stills/<unit-slug>/t<t:.3f>.png` (e.g. `t0.000.png`, `t0.500.png`), plus `stills/<unit-slug>/index.json` = `{ shot, stills: [{ file, t, frame }] }`. A re-render replaces the folder's PNGs and `index.json`. |
| Preview range | the shot's frames; for a transition shot (id like `T01`, matching `T\d+`), 2 s (60 frames) on each side, clamped to the scene range. |
| Preview | FFmpeg MPEG-4, H.264, 30 fps, no audio, VFX proxies **visible**, camera DOF off. Proposed 50 % resolution (960 × 540) for speed (see Open questions). |
| Unit slug | the shot id lowercased with `.` `/` `→` → `-` (root CLAUDE.md › Naming): `test-1` → `test-1`, `1.5` → `1-5`. |

## Objects and assets
None created. Uses the test scene: the cube, the light, the camera, and the proxy ring (`test_vfx_proxy`, which must be absent from stills and present in the preview).

## Characters and clips
None.

## Camera and markers
None created. It reads markers and `mtd_markers` via `export_shots._shot_specs`.

## Lighting and look
Scene look as built (AgX, Eevee 64 samples). Parity settings are only checked. DOF is temporarily off, as decided in F.2/B.04.

## VFX proxies
`vfx_proxy = True` objects: hidden in stills, visible in the preview, restored afterwards.

## Stills and preview
This item renders only for verification, into the scratchpad (`--out-dir`):
- `test-1` at t 0 and 0.5 (frames 1 and 45.5);
- the `test-1` preview (frames 1–90).

The approved test-cube stills come in F.2/B.07.

## Export
None (rendering only).

## Build session (what `/blender-shot F.2/B.06` does)
1. Write `blender/scripts/render_stills.py`.
2. Live: render one still through the Blender MCP into the scratchpad. Look at it, and confirm the scene is restored.
3. Headless: `-- --out-dir <scratch> test-1 0 0.5`. Check:
   - two 1920 × 1080 PNGs and `index.json`;
   - the ring is absent from both stills, compared with a render that has the proxy visible;
   - the frames are 1 and 45.5;
   - the mp4 plays: `ffprobe` shows H.264, 30 fps and 90 frames;
   - the ring is visible in the preview (look at a frame).
4. A transition-style probe: a temporary marker renamed `T99` shows the ±2 s padding, clamped to the scene range.
5. Negative checks, each exiting 1:
   - an unknown shot;
   - `t` 1.5;
   - four stills;
   - a point marker;
   - fps drift.
6. The `.blend` is unchanged; a re-render gives the same files (pixel-identical PNGs).
7. `mtd-blender-reviewer`.

## Rules for implementation
- Live check through the Blender MCP; the final state saved in `render_stills.py`; runs headless
- Read-only on the scene; parity drift check; everything restored in `finally`; exit 1 on failure
- Shot ranges and `t` come from `export_shots._shot_specs`, never a second implementation
- Enum identifiers (file format, codec, container) read from RNA, never hard-coded blindly
- Python only from Blender's bundled interpreter; `ffprobe` only for verification; no new packages

## Definition of done
- [ ] Headless run on the test scene writes stills at the requested frames and a playable mp4; objects tagged as VFX proxies are absent from stills
- [ ] `blender --background … --python blender/scripts/render_stills.py -- test-1 0 0.5` runs with no errors (official binary), exit 0; failures exit 1
- [ ] `mtd-blender-reviewer` reports no 🚧 items
- [ ] Stills and preview: rendered for verification only; approval happens in F.2/B.07; no approval row
- [ ] Export: n/a
- [ ] `docs/progress.md` updated; `F.2/B.06` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- `pnpm blender:stills`, `pnpm blender:export`, `pnpm assets` (F.2/B.07)
- Approving any still (F.2/B.07 for the test cube, `/approve-shot` for story shots)
- The parity comparison itself (F.4/W.03); the act-wide preview `blender/renders/act<N>.mp4`

## Open questions
1. ✅ **How stills are chosen:** (resolved 2026-11-11, director: yes, as proposed) proposed: as shot-relative `t` values on the command line (`… test-1 0 0.5`), because that's exactly what `/dev/shot?t=` takes. `/approve-shot` passes the moments the shot's spec lists. A fractional frame renders at that subframe, so Blender and the browser freeze at the same instant.
2. ✅ **Folder per shot:** (resolved 2026-11-11, director: yes, as proposed) proposed: stills go to `blender/renders/stills/<unit-slug of the shot id>/`, so the test-cube shot's stills land in `stills/test-1/`. F.2/B.07's *Files* line says `stills/test/`; update it to `stills/test-1/` when B.07 is specced.
3. ✅ **Still names and manifest:** (resolved 2026-11-11, director: yes, as proposed) proposed: `t<t:.3f>.png` plus `index.json` (`shot`, and each still's `file`, `t` and `frame`), so the parity helper (F.4/W.03) reads `t` from data, not from file names.
4. ✅ **No depth-of-field blur in renders:** (resolved 2026-11-11, director: yes, as proposed) proposed: camera DOF is off for stills and preview, because the browser can't reproduce blur (F.2/B.04 decision 8). Restored afterwards.
5. ✅ **Preview size:** (resolved 2026-11-11, director: yes, as proposed) proposed: 960 × 540 (50 %), H.264, scene samples, to keep previews quick and small in Git LFS. The full 1920 × 1080 is reserved for stills. Say if you want full-size previews.
6. ✅ **Transitions:** (resolved 2026-11-11, director: yes, as proposed) proposed: a shot whose id matches `T\d+` (e.g. `T01`) gets 2 s of padding on each side of its preview, clamped to the scene's frame range. Its stills still use the shot's own `t`.
7. ✅ **No renders committed in this item:** (resolved 2026-11-11, director: yes, as proposed) proposed: verification renders go to the scratchpad. The first committed renders (Git LFS) are the approved test-cube stills in F.2/B.07.
