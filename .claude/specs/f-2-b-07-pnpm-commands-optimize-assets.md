# Spec: F.2/B.07: pnpm commands + `optimize-assets.mjs`; test-cube stills approved (Blender)

- Build-order item: `F.2/B.07` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-2-b-07-pnpm-commands-optimize-assets` (title slug cut at a word boundary to stay within 30 characters)
- Mode: n/a (tooling + the first approval; the approved shot is `test-1`, scrub, `scrollLength` 2)
- Created: 2026-11-11

## Director's view
None. This is a Foundation item. The stills to approve show the test cube, not a story shot.

Plan › Foundation › F.2: "Commands: `pnpm blender:export <act>`, `pnpm blender:stills <shot>`, `pnpm assets`."
TDD › Asset pipeline: "All assets flow `blender/` → `raw-assets/` → `scripts/optimize-assets.mjs` → `public/`, and nothing reaches `public/` unoptimized." Step 7: "Export: `export_glb.py` (models and clips), `export_shots.py` (camera), `bake_vat.py` (crowds), then `pnpm assets` to optimize."
TDD › Export settings: GLBs → "meshopt + KTX2 (UASTC for faces, ETC1S for clothes)" / "(ETC1S)"; VAT "Kept as half-float EXR or 16-bit PNG, not KTX2 (needs precision)".

## Overview
This item closes F.2. It wires the four Blender scripts and the optimizer into the three commands the whole project uses:

| Command | Does |
|---|---|
| `pnpm blender:export <act>` | Opens the act's `.blend` headless. Runs `export_glb.py`, `export_shots.py` and `bake_vat.py` on what the scene declares. Writes `raw-assets/models/`, `shots/<act>.json` and `raw-assets/vat/`. |
| `pnpm blender:stills <shot> <t…>` | Finds the scene that holds the shot and runs `render_stills.py`. Writes stills, `index.json` and the preview under `blender/renders/`. |
| `pnpm assets` | `scripts/optimize-assets.mjs` turns `raw-assets/` into `public/`: GLBs get meshopt (and KTX2 for textures); VAT files are copied unchanged. |

It then renders the **test-cube stills** (`test-1` at its start and middle) and puts them in front of you for the project's **first approval**. That approved pair is the first parity reference (F.4/W.03).

## Depends on
- F.2/B.03 `export_glb.py` ✅, F.2/B.04 `export_shots.py` ✅, F.2/B.05 `bake_vat.py` ✅, F.2/B.06 `render_stills.py` ✅ (all on `main`).
- F.1/W.02 Next.js + pinned stack ✅: pnpm, Node 22 (`.nvmrc`), `@gltf-transform/cli` 4.5.1 (pinned devDependency).
- F.2/B.02 test scene ✅: `blender/scenes/test-cube.blend`, rebuilt by `build_test.py`.
- Machine:
  - official Blender 5.2.4 LTS at `~/Applications/blender-5.2.4-linux-x64/blender`;
  - `ffprobe` at `/usr/bin/ffprobe`;
  - **KTX-Software (`ktx`) is not installed.** The test cube has no textures, so this item doesn't need it (see Open questions).
- Hand-offs recorded earlier (docs/progress.md):
  - **B.05:** copy VAT files unchanged, never KTX2.
  - **B.06:**
    - stills need `t` values: `pnpm blender:stills <shot> <t…>`;
    - `/approve-shot`'s fallback command must pass them;
    - the folder is `stills/test-1/`, not `stills/test/`.

## Scene and file
- New:
  - `scripts/blender.mjs`: a small Node wrapper (standard library only) that finds the Blender binary and the scene, then runs the Python scripts;
  - `blender/scripts/export_act.py`: one headless Blender run that calls the three exporters from the scene's export list;
  - `scripts/optimize-assets.mjs`.
- Changed:
  - `package.json` (`blender:export`, `blender:stills`, `assets` scripts);
  - `blender/scripts/build_test.py` (adds the scene's export list) → rebuilt `blender/scenes/test-cube.blend`;
  - `.claude/commands/approve-shot.md` (fallback command passes `t`);
  - root `CLAUDE.md` › Commands (the stills command's arguments);
  - `.claude/build-order/stage-F.md` (B.07 *Files*: `stills/test-1/`).
- **What a scene exports** (see Open questions): the build script sets a scene property `mtd_export`. For the test scene:

  ```json
  { "glb": ["test_cube"], "vat": [{ "object": "test_vat_blob", "clips": ["test_vat_blob_pulse_loop"] }] }
  ```

  Shots are always exported for the act. Blender stays the single source of what leaves it, as with `mtd_markers`.
- **Act → scene file:** `blender/scenes/<act>.blend` or `blender/scenes/<act>-*.blend`, and exactly one must match (`test` → `test-cube.blend`; later `act1` → `act1-<name>.blend`).
- **Blender binary:** the `BLENDER_BIN` environment variable, defaulting to the official build path. The wrapper refuses any Blender that isn't 5.2.x, so `/usr/bin/blender` can't slip in.
- Failure in any step → non-zero exit with the step named. Nothing later runs.

## Objects and assets
No new geometry. Outputs:

| File | From |
|---|---|
| `raw-assets/models/test-cube.glb` | re-exported, byte-identical |
| `shots/test.json` | re-exported, unchanged |
| `raw-assets/vat/test-vat-blob.*` | re-baked, byte-identical |
| **`public/models/test-cube.glb`** (new, LFS) | meshopt-compressed |
| **`public/vat/test-vat-blob.{pos.exr, nrm.exr, json}`** (new; EXR in LFS) | copied unchanged |
| **`blender/renders/stills/test-1/{t0.000.png, t0.500.png, index.json}`** (new; PNG in LFS) | the stills to approve |
| **`blender/renders/previews/test-1.mp4`** (new, LFS) | the preview to watch |
| **`blender/renders/APPROVALS.md`** (new) | its first row, once you approve |

## Optimizer rules (`scripts/optimize-assets.mjs`)
- **GLBs:**
  - run the pinned `gltf-transform` CLI steps one by one: `dedup` → `prune` → (textures: `etc1s` / `uastc`) → `meshopt`;
  - **not** the all-in-one `optimize` command, which by default also simplifies meshes, joins and flattens nodes and renames things;
  - node names, extras, clips, morph targets and lights must survive, because the web reads them (F.3/W.11 extras, anchor empties, `_vat_index`).
- **Textures:** KTX2 only when a GLB has textures. If it does and `ktx` isn't installed, fail with an install message. Data textures (normal maps, Non-Color) and textures with `face` in their name use UASTC; colour textures use ETC1S (TDD).
- **VAT:** copy `raw-assets/vat/*` → `public/vat/` byte for byte.
- **Integrity:**
  - write each output to a temp file and move it into place;
  - check each optimized GLB: `EXT_meshopt_compression` used, the same node names and animation names as the raw file, extras still present;
  - remove `public/` files whose raw source no longer exists (only under `public/models` and `public/vat`), and report them.
- **Reproducible:** a re-run on unchanged input gives identical files.

## Characters and clips
None new. `test_cube_spin_loop` must still be in the optimized GLB.

## Camera and markers
None new.

## Lighting and look
Unchanged. Parity settings untouched.

## VFX proxies
`test_vfx_proxy` stays hidden in the stills (`render_stills.py`) and isn't exported (`export_glb.py`).

## Stills and preview
- **Stills:** the test-cube shot `test-1` at **t 0** (frame 1) and **t 0.5** (frame 45.5) → `blender/renders/stills/test-1/t0.000.png`, `t0.500.png`, `index.json`.
- **Preview:** `test-1` frames 1–90 → `blender/renders/previews/test-1.mp4` (960 × 540).
- **Approval:** via `/approve-shot test-1`. Only your explicit "approve" counts. It adds the first row to `blender/renders/APPROVALS.md`.

## Export
- `pnpm blender:export test` → `raw-assets/models/test-cube.glb`, `shots/test.json`, `raw-assets/vat/test-vat-blob.*`.
- `pnpm assets` → `public/models/test-cube.glb` (meshopt) and `public/vat/test-vat-blob.*`.

## Build session (what `/blender-shot F.2/B.07` does)
1. Add `mtd_export` to `build_test.py`. Rebuild the scene headless, and live in your Blender. Check that only the property changed: the other scene contents are identical (probe from F.2/B.02).
2. Write `blender/scripts/export_act.py`, `scripts/blender.mjs`, `scripts/optimize-assets.mjs` and the `package.json` scripts.
3. Run `pnpm blender:export test` and `pnpm assets`. Check that:
   - the raw outputs are byte-identical to the committed ones;
   - `public/models/test-cube.glb` uses `EXT_meshopt_compression` and keeps the node names, extras, clip and light (`gltf-transform inspect` plus a JSON-chunk check);
   - the VAT copies are byte-identical.
4. Run `pnpm blender:stills test-1 0 0.5`.
5. **Clean checkout:** in a fresh `git worktree` (LFS pulled, `pnpm install --frozen-lockfile`), run all three commands headless and compare the outputs.
6. **Negative checks**, each failing with a clear message:
   - an unknown act;
   - an unknown shot;
   - `BLENDER_BIN` pointing to a Blender that isn't 5.2;
   - a missing raw directory;
   - a textured GLB with no `ktx`, as a scratch probe.
7. `pnpm typecheck && pnpm lint && pnpm test` still green.
8. `mtd-blender-reviewer`. The `package.json` change also gets `mtd-security-reviewer`, since root CLAUDE.md asks for it when dependencies or config change. No packages are added.
9. Then `/approve-shot test-1`: you see the stills and preview and decide.

## Rules for implementation
- Never hand-edit GLBs, `shots/*.json` or `public/`; everything is regenerated by the commands
- Nothing reaches `public/` unoptimized (VAT is the documented exception: copied, never KTX2)
- **No new dependencies:** the Node scripts use the standard library and the already-pinned `gltf-transform` CLI
- `.mjs` scripts pass `pnpm lint`
- Blender only through `BLENDER_BIN` (official 5.2.x); parity drift fails the export (the exporters already check it)
- Only an explicit "approve" from you records the approval

## Definition of done
- [ ] All three commands run headless on the test scene from a clean checkout; `public/models/test-cube.glb` is meshopt-compressed; test-cube stills approved by the director (row in blender/renders/APPROVALS.md)
- [ ] `blender --background --python blender/scripts/build_test.py` rebuilds the scene with no errors (now with `mtd_export`)
- [ ] `mtd-blender-reviewer` reports no 🚧 items (and `mtd-security-reviewer` for `package.json`)
- [ ] Stills and preview rendered; **director approved** (row in `blender/renders/APPROVALS.md`)
- [ ] Exported: `shots/test.json` has both shots with keys sorted by `t` 0 → 1; `public/` has the optimized GLB and the VAT copies
- [ ] `docs/progress.md` updated; `F.2/B.07` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- Installing KTX-Software (first needed when a textured asset arrives, Stage C)
- Running Blender or the asset commands in CI (CI skips LFS and has no Blender)
- The web side reading `public/` (F.3), the parity test (F.4/W.03)
- Asset budgets per act (from Stage 0; the test scene is tiny)

## Open questions
1. ✅ **How a scene declares its exports:** (resolved 2026-11-11, director: yes, as proposed) proposed: a scene property `mtd_export` (`glb`: collections, `vat`: object + clips) set by the build script, and read by `export_act.py`. Blender stays the single source, like `mtd_markers`. A one-line rule goes into `.claude/rules/blender.md`.
2. ✅ **Act → scene file:** (resolved 2026-11-11, director: yes, as proposed) proposed: `blender/scenes/<act>.blend` or `<act>-*.blend`, exactly one match (`test` → `test-cube.blend`). Bridges (`bridge_<from>-<to>.blend`) are decided when the first transition is built.
3. ✅ **Finding a shot's scene for stills:** (resolved 2026-11-11, director: yes, as proposed) proposed: `pnpm blender:stills <shot> <t…>` opens each scene headless and lists its markers. It uses the one that has the shot, and fails if zero or several do. An optional `--scene <file>` skips the search. The root `CLAUDE.md` › Commands line becomes `pnpm blender:stills <shot> <t…>`.
4. ✅ **Which Blender:** (resolved 2026-11-11, director: yes, as proposed) proposed: the `BLENDER_BIN` environment variable, defaulting to `~/Applications/blender-5.2.4-linux-x64/blender`; the wrapper checks `--version` is 5.2.x. Documented in root `CLAUDE.md` › Commands and `docs/progress.md`. Not in `.env.example`, which is for website secrets.
5. ✅ **Optimizer steps:** (resolved 2026-11-11, director: yes, as proposed) proposed: explicit `gltf-transform` CLI steps (`dedup`, `prune`, KTX2 when textured, `meshopt`) instead of `optimize`. `optimize`'s defaults (simplify, join, flatten, instance, palette) would change geometry and rename or merge nodes that the web and parity rely on.
6. ✅ **KTX-Software:** (resolved 2026-11-11, director: yes, as proposed) proposed: not installed now (the test cube has no textures). The optimizer fails clearly if a textured GLB arrives without it. Installing it is a system change I'll ask you about at the first textured asset (Stage C). CI isn't affected.
7. ✅ **Committed outputs:** (resolved 2026-11-11, director: yes, as proposed) proposed: commit `public/models/test-cube.glb`, `public/vat/*`, the two approved stills, `index.json`, the preview and `APPROVALS.md`. Binaries go through Git LFS (`*.glb`, `*.exr`, `*.png`, `*.mp4` are already tracked). Each Vercel build pulls them, which is about 100 KB in total for the test scene. **Correction (2026-11-12):** each 1920 × 1080 still PNG is about 1.7 MB, so the committed renders are about 3.6 MB plus the 163 KB preview; the `public/` outputs are about 24 KB.
8. ✅ **A non-story row in `APPROVALS.md`** (resolved 2026-11-11, director: yes, as proposed) (stage open question): proposed: yes. The row is for unit `test-1` (title "Test cube"), so F.4/W.03 has an approved reference. Story rows start with Stage 0.
9. ✅ **Doc fixes from F.2/B.06:** (resolved 2026-11-11, director: yes, as proposed)
   - `.claude/commands/approve-shot.md` Step 1: the fallback becomes `… render_stills.py -- <shot> <t…>`, with the `t` values from the shot spec's *Stills and preview*.
   - The B.07 *Files* line changes `stills/test/` to `stills/test-1/`.
