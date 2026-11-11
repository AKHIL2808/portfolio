# Spec: F.2/B.01: `settings.py` parity settings (Blender)

- Build-order item: `F.2/B.01` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-2-b-01-settings-py-parity-settings`
- Mode: n/a (tooling, no shot)
- Created: 2026-11-11

## Director's view
None. This is a Foundation item, not a story shot.

Plan › Foundation › F.2 bullet this item covers: "`settings.py`: meters, 30 fps, 1920 × 1080, AgX, Eevee preview settings; every scene script calls it first."

Plan › Blender-to-web parity rules: "Every shot in the browser must look the same as its Blender render, so both sides share these settings, set once in the Foundation and never changed per shot."

## Overview
`settings.py` is the single place the Blender side of the parity rules is set. Every later scene script (`build_test.py` in F.2/B.02, every `build_<act|bridge|character>.py`) calls it first, and `render_stills.py` relies on it for the parity stills. It does three things:
- Applies the scene settings: meters, 30 fps, 1920 × 1080 at 100 %, AgX color management, Eevee as the preview engine.
- Offers small helpers the other scripts reuse: set an image to sRGB or Non-Color, and a fixed-seed helper.
- When run directly, applies the settings, prints every value and asserts it, so a headless run proves it.

It doesn't stitch to any shot. F.2/B.02 (test scene) is the first script that calls it.

## Depends on
- F.1/W.04: Blender MCP connected to Claude Code: ✅ ticked (PR #4).
- Machine: **official Blender 5.2.4 LTS** at `~/Applications/blender-5.2.4-linux-x64/blender` (OCIO 2.5, AgX available); Blender MCP add-on 1.8 from the shared `~/.config/blender/5.2/`. The Fedora `/usr/bin/blender` 5.2.2 can't be used: its OCIO 2.4.2 can't load the bundled 2.5 config, so it falls back to `Standard` only (checked live and headless, 2026-11-11). All commands below use the official binary.
- Library pieces, characters, clips: none.

## Scene and file
- Script: `blender/scripts/settings.py` (new). No `.blend` is saved by this item.
- Importable module, with one public entry point (proposed name `apply(scene=None)`) that every scene script calls first.
  - Scene scripts import it by adding `blender/scripts/` to `sys.path` from `__file__`, so it works headless and from any working directory.
- Run directly (`if __name__ == "__main__"`): apply to the current scene, print each value, assert each value, then apply a second time and assert nothing changed.
- Collections, `act<N>_origin` offsets: none.

## Settings to apply (from the stage file Build line and the parity rules)

| Area | Value | Notes |
|---|---|---|
| Units | Metric, unit scale 1.0, length unit meters | `scene.unit_settings` |
| Frame rate | 30 fps, `fps_base` 1.0 | |
| Resolution | 1920 × 1080, 100 %, pixel aspect 1 : 1 | |
| View transform | AgX | |
| Look | None | |
| Exposure / gamma | 0 / 1 | |
| Display device | sRGB | |
| Render engine | Eevee | Identifier read from `bl_rna` (it has changed across Blender versions); assign inside `try/except TypeError` |
| Eevee preview settings | See Open questions | Fixed sample count so stills are repeatable |

Rules for the values:
- Every enum identifier (view transform, look, display device, engine, unit system, length unit, color spaces) is read from `bl_rna` / the available enum items and matched, never typed in as a bare string the script trusts. If the wanted item isn't available, the script fails loudly with the list it found.
- `apply()` returns what it changed (empty on a second run), which is how "running twice changes nothing" is proven.

## Helpers
- **Texture color space:** `set_color_space(image, kind)` with `kind` `"color"` → sRGB, `"data"` → Non-Color (normal, roughness, stroke-order, VAT). Color-space names read from the image's `colorspace_settings` enum items.
- **Fixed seed:** `seed_all(seed)` seeds Python's `random` and NumPy (bundled with Blender) and returns a `random.Random(seed)` for scripts that want their own stream. Later scripts (scatter, VAT test mesh) use it; the seeds they use are saved for the web where the parity rules ask.

## Objects and assets
None.

## Characters and clips
None.

## Camera and markers
None. (Resolution and fps here are what every camera and marker later relies on.)

## Lighting and look
- Color management only: AgX, look None, exposure 0, gamma 1, sRGB display. These are the parity settings; after this item they are never changed per shot.
- No lights, no bake set.

## VFX proxies
None.

## Stills and preview
None. This item renders nothing (F.2/B.07 renders the first parity stills).

## Export
None. Nothing for `pnpm blender:export`; no GLB, no shot JSON, no VAT.

## Build session (what `/blender-shot F.2/B.01` does)
1. Write `blender/scripts/settings.py`.
2. Live: run `apply()` in the open Blender through the Blender MCP (`execute_blender_code`) and read the values back, so you can see them set in the UI (Output and Color Management panels).
3. Headless: `~/Applications/blender-5.2.4-linux-x64/blender --background --factory-startup --python blender/scripts/settings.py` prints every value, all asserts pass, and the second apply reports no changes. Exit code 0.
4. Negative check: the script exits non-zero if an assert fails (e.g. temporarily asking for a wrong value in a scratch copy, not in the committed file).
5. `mtd-blender-reviewer` reviews the script.

## Rules for implementation
- Build live through the Blender MCP; the final state saved in the script; it runs headless
- Idempotent; fixed seeds via the seed helper; nodes looked up by type; enum identifiers read, never hard-coded
- Material colors (when later scripts use any) on shader node inputs, never `diffuse_color`
- Parity settings live only here; no scene script overrides them
- Python only from Blender's bundled interpreter; no extra pip packages
- Original designs only; no third-party assets in this item

## Definition of done
- [ ] `blender --background --python blender/scripts/settings.py` on a factory-startup file sets every value above (printed and asserted); running it twice changes nothing
- [ ] `blender --background --factory-startup --python blender/scripts/settings.py` exits 0 with no errors
- [ ] `mtd-blender-reviewer` reports no 🚧 items
- [ ] Stills and preview: n/a for this item (the stage note puts `/approve-shot` only at F.2/B.07); no approval row
- [ ] Export: n/a (no shot data)
- [ ] `docs/progress.md` updated; `F.2/B.01` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- The test scene, camera, markers and VAT mesh (F.2/B.02).
- Export, VAT and render scripts (F.2/B.03–B.06), pnpm commands (F.2/B.07).
- `MTD_Toon` node group and outline (stage open question; not part of this item).
- Web-side parity settings (`AgXToneMapping`, color spaces in three.js: F.3).

## Open questions
1. ✅ **Eevee preview settings** (resolved 2026-11-11, director): Eevee as the engine, render samples 64, viewport samples 16, motion blur off, film filter default, transparent film off; no bloom or other post (compositor effects aren't exportable).
2. ✅ **Factory startup** (resolved 2026-11-11, director): the headless check runs with `--factory-startup` so user preferences and add-ons can't change the result. This affects only that one command's run; the Blender MCP add-on stays installed and loads normally in the Blender you open.
3. ✅ **Entry point and import pattern** (resolved 2026-11-11, director): `settings.apply()`, imported via `sys.path` from the calling script's folder.
4. ✅ **Seeds** (resolved 2026-11-11, director): no global default seed; each script passes its own fixed seed and records it.
5. **Stage open questions:** none of the stage's open questions affect this item (MTD_Toon, image-diff library, test-scene naming, approval row, preview mp4 and KTX-Software belong to later F items).
