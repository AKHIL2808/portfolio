# Progress log

Stage F: 13/29 · updated by `/ship-shot` at the end of every item.

## Done

- F.1/W.01: Git repository, Git LFS and folder skeleton (2026-11-09, PR #1)
- F.1/W.02: Next.js + TypeScript strict + Tailwind, stack installed and pinned (2026-11-09, PR #2)
- F.1/W.03: Project docs in Markdown + progress log (2026-11-09, PR #3)
- F.1/W.04: Blender MCP connected to Claude Code (2026-11-10, PR #4)
- F.1/W.05: CI and Vercel preview deploys (2026-11-10, PR #6; merge block is soft via `/ship-shot` until Z.6)
- F.2/B.01: `settings.py` parity settings (2026-11-11): `settings.apply()` sets meters, 30 fps, 1920×1080, AgX, Eevee 64/16 samples; `set_color_space()` and `seed_all()` helpers; headless check exits 1 on any failure
- F.2/B.02: Test scene — cube, camera, markers (2026-11-11): `build_test.py` → `blender/scenes/test-cube.blend` with a spinning cube + sun (`test_cube`), 4-key camera, shots `test-1` (scrub, 2) and `test-2` (beat, 2 s), a pulsing VAT blob and a tagged VFX ring; marker properties live in scene property `mtd_markers`
- F.2/B.03: `export_glb.py` (2026-11-11): exports named collections to `raw-assets/models/<name>.glb` (+Y up, modifiers applied, extras, clips sampled per frame from 0 s, morphs, Standard-mode lights); never exports cameras or `vfx_proxy` objects; refuses parity drift, exporter warnings and failed GLB checks (exit 1); `raw-assets/models/test-cube.glb`
- F.2/B.04: `export_shots.py` (2026-11-11): splits the scene camera at markers into shots (`mtd_markers`), samples each Blender key into Y-up `CameraKey`s with vertical fov, roll, focus and ease; merges hand-added events and gates by shot id; `{"kind": "marker"}` entries become named points; `shots/test.json`
- F.2/B.05: `bake_vat.py` (2026-11-11): bakes named clips of one mesh into half-float RGBA ZIP EXRs (positions, normals; object space, Y-up, column = Blender vertex index, rows top-down) + JSON layout (`frameCount`, `fps`, bounds, clips with `loop`, `indexAttribute`); `raw-assets/vat/test-vat-blob.*`
- F.2/B.06: `render_stills.py` (stills + preview) (2026-11-11): renders 1–3 stills of a shot at shot-relative `t` (subframes honoured; 1920 × 1080 PNG, VFX proxies and their children hidden, DOF off, byte-identical re-renders) + `index.json`, and an H.264 preview (960 × 540, proxies as authored, transitions ±2 s); transitions accept `T0→1` or `T01` → folder `t0-1`
- test-1/B approved and exported (2026-11-12): test-cube stills `blender/renders/stills/test-1/t0.000.png`, `t0.500.png` + preview `previews/test-1.mp4`; first row in `blender/renders/APPROVALS.md` (the first parity reference, F.4/W.03)
- F.2/B.07: pnpm commands + `optimize-assets.mjs`; test-cube stills approved (2026-11-12): `pnpm blender:export <act>` (scene property `mtd_export` → `export_act.py`, all checks before any write), `pnpm blender:stills <shot> <t…>` (finds the shot's scene), `pnpm assets` (dedup → prune → KTX2 when textured → meshopt, verified against the raw GLB, VAT copied; all-or-nothing); Blender via `BLENDER_BIN` (official 5.2.x, `--disable-autoexec`); proven from a clean checkout. **F.2 complete.**
- F.3/W.01: Store and shot data types (2026-11-12): Zustand `AppState` exactly as tdd › 10 (`src/store/useStore.ts`; `setTimeScale` sets at once until W.02); `ActId` (act0–act7 + dev `test`), `ActModule`, placeholder `AssetManifest` and shot types inferred from zod (`src/experience/director/types.ts`); strict `ShotFileSchema` + `parseShotFile` mirroring `export_shots.py` (`src/lib/schemas.ts`, imports only zod): keys 0→1 strictly increasing, `t` in 0–1, cue registry `CUE_NAMES` (`taiko`, `taiko-double`; each act adds its cues), gate events must name a gate in the file, errors as `file › shot id › path`

## Next

- F.3/W.02: Time system — `useActFrame` and time scale

## Open issues

### From the F.3/W.01 review (no blockers; for later items)

- Optional fixes not applied: `resolveGate` no-op when already done; fold the ramp case into the `setTimeScale` test and rename the store key-set test (it must be updated whenever an item adds a store field); `ActModule.shots` as `readonly`; comment that `StoryActId` is the type for the menu/registry; polish (export `Vec3`, `key` helper return type, pair the 0–1 reject cases, split `formatPath`, note the import guard only sees `from` imports, an id character pattern).
- Title-card / shake / custom systems: replace `AnyPayload` with strict payload schemas in the same PR; render title text only as React text (no `dangerouslySetInnerHTML` / `innerHTML`); `custom` handlers come from a fixed registry.
- F.3/W.05 gates: components select one gate (`useStore(s => s.gates[id])`), not the whole object; check existence with `Object.hasOwn`.
- F.3/W.03/W.04: don't write `actProgress` to the store at 60 Hz; keep the exact value in a ref for the frame loop and write the store rarely.
- F.3/W.04/W.06: import each `shots/<act>.json` inside its act's dynamic chunk; parse once at act load; build camera curves then, never per frame.
- Act 7 contact schema: its own clearly marked section in `schemas.ts`; don't reuse the shot-file error formatter; never echo validation issues in the API response.

### Stage F open questions (`.claude/build-order/stage-F.md`)

- Parity image comparison: similarity ≥ 0.90 needs an image-diff library (e.g. pixelmatch + pngjs, or SSIM); none is approved yet. Needed by F.4/W.03.
- KTX-Software (`ktx` ≥ 4.4) isn't installed: needed only once a GLB has textures (first in Stage C); `pnpm assets` stops with an install message until then. Installing it is a system change: ask the director first. CI doesn't run `pnpm assets`.

### From the F.1/W.02 review (optional suggestions, not applied)

- `AGENTS.md` is generated by `next dev` (Next 16 agent notes) and is committed; decide keep or git-ignore.
- pnpm `onlyBuiltDependencies` allowlist to limit install scripts (supply-chain hardening), or move to pnpm 10.
- Dev-only advisory: `basic-ftp` (high) via `@lhci/cli` → lighthouse → puppeteer; `glob`/`minimatch` (moderate) via `@gltf-transform/cli` and the lint tooling. `pnpm audit --prod` is clean.
- `r3f-perf` 7.2.3 pulls its own `@react-three/drei` 9.122.0 (React 18 / R3F 8 peers): check it works when first used in F.3/F.4; fall back to `renderer.info` if not.
- Load leva and r3f-perf only in development (dynamic import behind a dev check, or only on `/dev/*`).
- Load `<Experience/>` lazily through a small client wrapper (F.3/W.04).
- Remove `--pass-with-no-tests` from `test:e2e` once the first e2e spec exists (F.4/W.03).
- Smaller test clean-ups: duplicate pin check in `smoke.test.ts` / `foundation.test.ts`, brittle lockfile-format test, widen the "no 3D on `/`" import guard.
- No security headers or CSP until Act 7, so no public production deploy before then; add `poweredByHeader: false` with the headers.

### From the F.1/W.03 docs conversion (decisions for the director; details in each doc's "Conversion notes")

- `ElementTrail` is used by the plan (3.5 / T3→4, P.D, R.C) and the TDD's Act 3 scene spec, but is not one of the 16 effects in the TDD's VFX catalog table: add it to the catalog or map it to an existing effect before Act 3.
- TDD Scene specs › Act 4 lists demon clips `reveal`, `attack`, `hit`, `death`; the plan's Cast build lists `reveal`, `power_cast`, `attack`, `hit`, `freeze` (the plan wins on content).
- TDD Characters table says Pillars are "up to 4" on screen; plan 3.4 and Act 5 K.C use all six at LOD0 (within the High tier's 6).
- TDD Project structure names `OutlineMaterial`; the catalog and CLAUDE.md name it `InkOutline`.
- Screenplay 4.A titles The Endless Inbox "Upper Rank Three"; the plan's Rank list puts it at Rank Six.
- Screenplay "How each shot becomes code" mentions Theatre.js and MeshLine, which aren't in the approved library list (the TDD wins).

### From F.1/W.05 (CI and Vercel)

- Merges are blocked only by `/ship-shot` (it refuses on any failing check): the repo is private on GitHub's free plan, so required-check rulesets aren't available. Add a ruleset requiring `checks` on `main` when the repo goes public at Z.6.
- Git LFS bandwidth: GitHub free tier is 1 GB storage and 1 GB/month; every Vercel build pulls LFS files (CI skips them). Watch usage from F.2 on.
- Prove a served LFS asset is the real file, not a pointer: `public/models/test-cube.glb` landed in F.2/B.07, but preview deploys sit behind Vercel Deployment Protection, so check it in a logged-in browser (`/models/test-cube.glb` must start with `glTF`) or when F.3 first loads it.
- PR branches run CI twice (once for `push`, once for `pull_request`); fine for now, revisit if Actions minutes get tight.
- GitHub notice: `ubuntu-latest` moves to Ubuntu 26 from 2026-10-19; nothing to do unless a run breaks.

### From the F.2/B.01 review (optional suggestions, not applied)

- Pin more look-affecting render settings in `settings.py` (film `filter_size`, Eevee ray tracing / fast GI, `use_hdr_view`) once the web side exists to match against.
- `pnpm blender:*` scripts (F.2/B.07) must call the official Blender (e.g. a `BLENDER_BIN` env var), never Fedora's `/usr/bin/blender`; consider a note in `.claude/rules/blender.md` and CLAUDE.md Commands.
- `seed_all()` seeds NumPy's legacy global generator; later scripts should prefer the returned `random.Random` stream or `numpy.random.default_rng(seed)`, and set Blender node/modifier seeds explicitly.

### From the F.2/B.03 review (hand-offs)

- F.3: lights arrive in glTF photometric units (Standard mode: a 3 W/m² sun exports as intensity 2049 lux); materials export `doubleSided: true` while Blender backface culling is off; ToonMaterial reads `extras` RGB values as 3-number arrays and `bands` as a number.
- C1 (first character): outline Solidify modifiers must not be baked into the GLB (`export_apply` applies every modifier; the browser draws InkOutline itself): switch them off during export or tag them; the exporter doesn't apply modifiers on meshes with shape keys, so bake those in the build script.
- C1: `export_glb.py` only checks the active object / shape-key action per object; extend the clip check to NLA-track and armature actions when one rig carries many clips.
- C1: rigs export their rest pose from `frame_start`: key a neutral pose there, or export with `pose_position = 'REST'`.
- `export_glb.py` pins the glTF add-on to 5.2 (`TESTED_GLTF_ADDON`); after a Blender upgrade, re-run the F.2/B.03 probes (incl. the warning-capture probe) before bumping it.

### From the F.2/B.04 review (hand-offs)

- F.3/W.01: `shots/*.json` is `{ act, fps, shots, markers, gates }`; `CameraKey` has an extra optional `focus` (meters) not in the TDD type (update the TDD interface too); keys strictly ascending from t 0 to 1, `ease` absent on each shot's last key; `scrollLength` for scrub and `duration` for beat; `markers: [{id, shot, t}]` are named points (`{"kind": "marker"}` entries in Blender). Keep `TOP_KEYS` / `SHOT_KEYS` in `export_shots.py` in sync with the zod schema.
- F.3/W.06: `pos` / `target` are already Y-up meters and `fov` is already the vertical angle (three.js `PerspectiveCamera.fov`) for 16:9; widen it for mobile portrait, don't recompute it. `target` = position + forward × focus, so don't treat `focus` as a subject distance. `power1.inOut` only approximates Blender's Bézier between keys: take parity stills at key times.
- Hard cuts between shots fail the export for now; decide a cut convention when the first story cut needs one. Stills should render without depth-of-field blur (F.2/B.06).
- Before Stage 3: `pov` shots have no Blender authoring path yet (the exporter always samples `scene.camera`).

### From the F.2/B.05 review (hand-offs)

- Web `VATCrowd` (Stage 3 / Act 7): load with three's `EXRLoader`, `NoColorSpace`, `NearestFilter`, no mipmaps, no `flipY`, half-float type; texel `u = (col + 0.5) / width`, `v = 1 − (row + 0.5) / height` (`rowOrder: top-down`); a unit test should check one known row. Each clip carries `loop`; one-shots include their last pose.
- Stage 3 crowd GLB: `export_glb.py` must write the `_vat_index` vertex attribute (Blender vertex index; glTF splits and reorders vertices) and fail if it's missing on a VAT mesh.
- Stage 3 / C: test the armature-driven bake (OBJECT slot on the armature) with the first weak demon; crowd meshes smooth-shaded, origin at the feet, no topology-changing modifiers (Solidify outlines, Subdivision); an ~800-vertex demon uses 2 rows per frame, so ≈ 256 frames total per 512-row texture (split the clip set if more).

### From the F.2/B.06 review (hand-offs)

- F.4/W.03: the parity helper reads `stills/<unit-slug>/index.json` (`shot` = marker id for `/dev/shot?shot=`, each still's `file`, `t`, `frame`); stills are 1920 × 1080; previews are 960 × 540 and aren't parity references.
- A full render (2 stills + 90-frame preview) takes about 1.5 min on this machine; a killed run can leave a `.<slug>.tmp-*` folder under `blender/renders/stills/` (safe to delete).

### From the F.2/B.07 reviews (hand-offs)

- F.3: GLBs are meshopt-compressed with `KHR_mesh_quantization` required: install `MeshoptDecoder` (drei `useGLTF` does; a raw `GLTFLoader` needs `.setMeshoptDecoder`). A mesh may sit under an unnamed holder node and mesh-node transforms aren't the authored values: find objects with `getObjectByName` and traverse under them. The VAT index attribute is `_VAT_INDEX` in the GLB (three lower-cases it to `_vat_index`). The first textured GLB also needs a KTX2 transcoder (`useKTX2` / `KTX2Loader`).
- Stage C (before C1): run one real KTX2 pass (ETC1S + UASTC, check `etc1s` skips textures already in KTX2, colour vs Non-Color); re-check `verify()` on a skinned GLB with LODs.
- Raw files of collections or VAT objects removed from a scene's `mtd_export` stay in `raw-assets/` (and `pnpm assets` keeps publishing them): delete them by hand until an ownership list exists.
- `pnpm blender:stills` opens every scene to find a shot; once there are many heavy scenes, add a marker index or an act-prefix lookup (`--scene` skips the search today).
- `BLENDER_BIN` must never come from a repo `.env` or CI input (it's executed).

### Environment

- CI: GitHub Actions workflow `CI`, job `checks` (frozen install, typecheck, lint, unit tests) on every push and every PR into `main`; actions pinned by SHA; Node from `.nvmrc` (22).
- Vercel project `portfolio`: production `main` → https://portfolio-chi-ten-ogbpwcpzyp.vercel.app/ ; every other branch gets a preview URL (behind Vercel Deployment Protection: log in to Vercel to view, also on a phone); Git LFS on; Node.js 22.x; no env vars yet (Act 7 adds `RESEND_API_KEY`, `CONTACT_TO_EMAIL`).
- Blender **5.2.4 LTS, official blender.org build** at `~/Applications/blender-5.2.4-linux-x64/blender` (menu entry "Blender 5.2.4 LTS (official)"), installed 2026-11-11 for F.2/B.01. Use it for live and headless work. The Fedora package (`/usr/bin/blender`, 5.2.2) is linked against OCIO 2.4.2, which can't load Blender's OCIO 2.5 config, so it offers only the `Standard` view transform (no AgX) and must not be used for parity work. Blender MCP add-on 1.8 (protocol 15, up to date); Claude Code MCP server `uvx blender-mcp`, user-scope in `~/.claude.json` (recreate with `claude mcp add blender -- uvx blender-mcp`; update the add-on with `uvx mcp-for-blender install-addon`).
- MCP check 2026-11-10: create / look / remove OK in an unsaved General file, scene unchanged afterwards (F.1/W.04).
- Blender MCP telemetry disabled (2026-11-10); asset libraries (Poly Haven, Sketchfab, Poly Pizza) and 3D generators are all off.
- The shell prints a zoxide configuration warning on every command (harmless; set `_ZO_DOCTOR=0` or move the zoxide init to the end of `~/.zshrc`).
- A stray `~/package-lock.json` outside the repo made Turbopack guess the wrong root; `turbopack.root` is pinned in `next.config.ts`.
