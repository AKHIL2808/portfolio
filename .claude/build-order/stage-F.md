# Build order: Stage F: Foundation and parity setup (F.1–F.4)

- Status: IN PROGRESS
- Progress: 2/29
- Generated: 2026-11-09
- Milestone: M0 Setup + M2 Core systems (tdd › Milestones); F.3 materials touch M3 (see Open questions)
- Prerequisite: none (F is the first stage): OK
- Asset budget: n/a (test scene only; Act 0 pre-loading-screen download ≤ 1.5 MB applies from Stage 0)
- Sources: CLAUDE.md; .claude/rules/blender.md; .claude/rules/web.md; plan › Order of work, › Blender-to-web parity rules, › Foundation (F.1–F.4); tdd › Tech stack, › Architecture, › Project structure, › Core systems (1–10), › Shaders and VFX catalog (ToonMaterial, InkOutline, rules for every shader), › Asset pipeline, › Export settings and formats, › Performance, › Accessibility checklist, › Testing and deployment, › Milestones (M0, M2)

> How to use: build items **in order**. For a `/B` item: `/create-spec <unit> blender` → `/blender-shot <unit>` → `/approve-shot <unit>` → `/ship-shot`.
> For a `/W` item: `/create-spec <unit> web` → implement → `/test-shot <unit>` → `/review-shot <unit>` → `/ship-shot`.
> Tick `- [ ]` → `- [x]` only after the item's *Done when* passes. Re-run `/build-order F` to see progress.
>
> Stage F note: F.2 items build tooling and a test scene, not story shots. `/approve-shot` applies only to F.2/B.07 (test-cube stills used as the first parity reference).

## 1. F.1 · Project setup

- [x] **F.1/W.01: Git repository, Git LFS and folder skeleton** · `Infra`
  - Build: `git init` (the folder is not a repo yet), `.gitattributes` with LFS for `.blend`, `.png`, `.exr` and raw textures/audio; `.gitignore` (node_modules, `.next`, `.env.local`, Blender `*.blend1`); empty folders from the TDD Project structure, each with `.gitkeep`: `blender/{library,characters,scenes,scripts,renders}`, `raw-assets/`, `content/`, `shots/`, `public/{models,textures,vat,audio,icons}`, `tests/{unit,e2e}`; `raw-assets/LICENSES.md` with its table header
  - Files: .gitattributes, .gitignore, blender/, raw-assets/LICENSES.md, content/, shots/, public/, tests/
  - Depends on: none
  - Source: plan › Foundation › F.1 (folders, Git LFS); tdd › Project structure; CLAUDE.md › Architecture, Critical rules (Git LFS, licenses)
  - Done when: `git lfs track` lists `.blend`, `.png`, `.exr`; every folder in the TDD Project structure exists; `git status` is clean after the first commit

- [x] **F.1/W.02: Next.js + TypeScript strict + Tailwind, stack installed and pinned** · `Infra`
  - Build: Next.js App Router with TypeScript `strict`, Tailwind CSS, ESLint (React hooks rules, no unused code); install the latest stable of every library in the CLAUDE.md › Preferred libraries table (three, @react-three/fiber, drei, postprocessing, gsap, lenis, zustand, zod, howler, detect-gpu, resend; dev: leva, r3f-perf, vitest, @playwright/test, @lhci/cli, @gltf-transform/cli, svgo) with **exact** versions; `pnpm dev | build | typecheck | lint | test | test:e2e` scripts; `src/app/layout.tsx` and a placeholder `src/app/page.tsx`; one trivial Vitest test so `pnpm test` runs
  - Files: package.json, pnpm-lock.yaml, tsconfig.json, eslint.config.mjs, tailwind/postcss config, next.config.ts, vitest.config.ts, src/app/layout.tsx, src/app/page.tsx, tests/unit/smoke.test.ts
  - Depends on: F.1/W.01
  - Source: plan › Foundation › F.1; tdd › Tech stack; CLAUDE.md › Code style, Preferred libraries, Commands
  - Done when: no `^`/`~` ranges in package.json; `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` all pass

- [ ] **F.1/W.03: Project docs in Markdown + progress log** · `Content`
  - Build: convert the three PDFs to `docs/plan.md`, `docs/tdd.md`, `docs/screenplay.md` (headings, tables and code blocks kept readable); create `docs/progress.md` (Done / Next / Open issues); keep the PDFs as originals
  - Files: docs/plan.md, docs/tdd.md, docs/screenplay.md, docs/progress.md
  - Depends on: F.1/W.01
  - Source: plan › Foundation › F.1 (CLAUDE.md, docs/tdd.md, docs/plan.md, docs/progress.md); plan › Working with Claude Code; tdd › Build plan for Claude Code (docs/screenplay.md)
  - Done when: each `.md` contains every section heading of its PDF (spot-checked: plan › Foundation, tdd › Core systems, screenplay Act 1); progress.md exists with the three sections

- [ ] **F.1/W.04: Blender MCP connected to Claude Code** · `Infra`
  - Build: confirm the Blender MCP server answers (`get_addon_status`, `get_scene_info`); record the Blender version in docs/progress.md
  - Files: docs/progress.md
  - Depends on: F.1/W.03
  - Source: plan › Foundation › F.1 (Blender MCP); tdd › Milestones › M0
  - Done when: the MCP creates an object in an open Blender file, it is visible via `look`, and it is removed again; Blender version logged

- [ ] **F.1/W.05: CI and Vercel preview deploys** · `Infra`
  - Build: GitHub Actions workflow running typecheck, lint and unit tests on every push (e2e and Lighthouse jobs added when F.4 / Stage Z provide them); GitHub repo connected to Vercel, `main` = production, other branches = previews; branch protection so a failing check blocks merging into `main`; `.env.example` (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, empty values)
  - Files: .github/workflows/ci.yml, .env.example
  - Depends on: F.1/W.02
  - Source: plan › Foundation › F.1 (CI, Vercel); tdd › Testing and deployment › Deployment 1–3; tdd › Milestones › M0; CLAUDE.md › Critical rules (Secrets)
  - Done when: CI is green on a pushed branch; that branch has a working Vercel preview URL; a deliberately failing check blocks the merge

## 2. F.2 · Blender settings and scripts

- [ ] **F.2/B.01: `settings.py` parity settings** · `Blender`
  - Build: one function every scene script calls first: meters (unit scale 1), 30 fps, 1920 × 1080 at 100%, view transform AgX, look none, exposure 0, gamma 1, display sRGB; Eevee preview settings; helpers for sRGB vs Non-Color texture spaces and a fixed-seed helper; enum identifiers read from `bl_rna`, never hard-coded
  - Files: blender/scripts/settings.py
  - Depends on: F.1/W.04
  - Source: plan › Foundation › F.2 (settings.py); plan › Blender-to-web parity rules; .claude/rules/blender.md › Parity settings, Script rules
  - Done when: `blender --background --python blender/scripts/settings.py` on a factory-startup file sets every value above (printed and asserted); running it twice changes nothing

- [ ] **F.2/B.02: Test scene — cube, camera, markers** · `Blender`
  - Build: `build_test.py` (calls settings.py first, idempotent): collection `test_cube` with a cube using a placeholder flat material and custom properties, one key light, one animated camera with ≥ 3 keys (focal length and focus distance keyed), markers for two test shots with custom properties (`mode: scrub` + `scrollLength`, `mode: beat` + `duration`), a small animated mesh for the VAT check; saved to `blender/scenes/test-cube.blend`
  - Files: blender/scripts/build_test.py, blender/scenes/test-cube.blend
  - Depends on: F.2/B.01
  - Source: plan › Foundation › F.4 Done when ("a test cube scene"); tdd › Milestones › M0 ("export scripts run headless on an empty test scene"), M2 ("a test scene with a moving camera and markers")
  - Done when: `blender --background --python blender/scripts/build_test.py` rebuilds the scene from scratch; running it twice leaves no duplicates

- [ ] **F.2/B.03: `export_glb.py`** · `Export`
  - Build: exports chosen collections to `raw-assets/models/<name>.glb`: +Y up, modifiers applied, custom properties (extras), all actions as clips, shape keys, lights with glTF lighting mode Standard; collection list passed as arguments
  - Files: blender/scripts/export_glb.py, raw-assets/models/test-cube.glb
  - Depends on: F.2/B.02
  - Source: plan › Foundation › F.2 (export_glb.py); tdd › Export settings and formats; plan › Parity rules (Scale and axes, Character lights)
  - Done when: headless export of `test_cube` writes a GLB whose cube extras, clip and light are readable by `gltf-transform inspect`

- [ ] **F.2/B.04: `export_shots.py`** · `Export`
  - Build: samples the camera at every Blender key (not per frame) → `CameraKey { t, pos, target, fov, roll, ease }` with focus distance; markers split shots, marker custom properties set `mode`, `scrollLength`/`duration`, camera `main|pov`; writes `shots/<act>.json` in the TDD Shot format; **merges** existing `events` and gates by shot id
  - Files: blender/scripts/export_shots.py, shots/test.json
  - Depends on: F.2/B.02
  - Source: plan › Foundation › F.2 (export_shots.py); tdd › Core systems › 2 Shot data format; .claude/rules/blender.md › Script rules
  - Done when: `shots/test.json` has both test shots with keys sorted by `t` from 0 to 1; a hand-added event survives a re-export unchanged

- [ ] **F.2/B.05: `bake_vat.py`** · `Export`
  - Build: animated mesh → position + normal VAT textures (≤ 512 × 512 per clip set, half-float EXR or 16-bit PNG, Non-Color) + JSON metadata (frame count, fps, bounds, clip ranges) into `raw-assets/vat/`
  - Files: blender/scripts/bake_vat.py, raw-assets/vat/
  - Depends on: F.2/B.02
  - Source: plan › Foundation › F.2 (bake_vat.py); tdd › Export settings and formats (Crowd animations); .claude/rules/blender.md › Budgets (VAT)
  - Done when: the test scene's animated mesh bakes headless; texture size and color space match the rules; metadata frame count equals the action length at 30 fps

- [ ] **F.2/B.06: `render_stills.py` (stills + preview)** · `Export`
  - Build: renders 1–3 key frames of a shot by marker id (Eevee, 1920 × 1080, VFX proxies hidden) to `blender/renders/stills/<unit-slug>/`, and the shot's preview (VFX proxies visible, transitions ±2 s) to `blender/renders/previews/<unit-slug>.mp4`, as `/approve-shot` expects
  - Files: blender/scripts/render_stills.py
  - Depends on: F.2/B.02
  - Source: plan › Foundation › F.2 (render_stills.py); plan › The parity test step 1; .claude/commands/approve-shot.md (preview path)
  - Done when: headless run on the test scene writes stills at the requested frames and a playable mp4; objects tagged as VFX proxies are absent from stills

- [ ] **F.2/B.07: pnpm commands + `optimize-assets.mjs`; test-cube stills approved** · `Export`
  - Build: `pnpm blender:export <act>` (export_glb + export_shots + bake_vat, headless), `pnpm blender:stills <shot>`, `pnpm assets` (`scripts/optimize-assets.mjs`: gltf-transform meshopt + KTX2, VAT copied without KTX2, `raw-assets/` → `public/`); render the test-cube stills and have them approved
  - Files: package.json, scripts/optimize-assets.mjs, public/models/test-cube.glb, blender/renders/stills/test/, blender/renders/APPROVALS.md
  - Stills: test-cube shot start, middle
  - Depends on: F.2/B.03, F.2/B.04, F.2/B.05, F.2/B.06, F.1/W.02
  - Source: plan › Foundation › F.2 (Commands); tdd › Asset pipeline step 7, › Export settings and formats; tdd › Milestones › M0
  - Done when: all three commands run headless on the test scene from a clean checkout; `public/models/test-cube.glb` is meshopt-compressed; test-cube stills approved by the director (row in blender/renders/APPROVALS.md)

## 3. F.3 · Core web systems

- [ ] **F.3/W.01: Store and shot data types** · `Web`
  - Build: Zustand `AppState` (actId, actProgress, timeScale, quality, muted, reducedMotion, gates, visitedPillars, defeatedRanks; goToAct, setTimeScale, resolveGate); `ActId`, `Shot`, `CameraKey`, `ShotEvent`, `Gate`, `ActModule` types; zod schema for `shots/*.json`
  - Files: src/store/useStore.ts, src/lib/schemas.ts, src/experience/director/types.ts, tests/unit/shots.test.ts
  - Depends on: F.1/W.02, F.2/B.04
  - Source: plan › Foundation › F.3 (Store); tdd › Core systems › 1, 2, 10; tdd › Testing (Shot data)
  - Done when: `shots/test.json` parses; Vitest rejects unsorted keys, `t` outside 0–1, unknown cue names and gates that don't exist

- [ ] **F.3/W.02: Time system — `useActFrame` and time scale** · `Web`
  - Build: `useActFrame((state, scaledDelta) => …)`; `setTimeScale(to, rampSeconds)` tween; `gsap.globalTimeline.timeScale()` kept in sync; scrub shots not slowed
  - Files: src/experience/systems/time/, tests/unit/time.test.ts
  - Depends on: F.3/W.01
  - Source: plan › Foundation › F.3 (useActFrame with time scale); tdd › Core systems › 4
  - Done when: Vitest proves ramp values over time and GSAP sync; no allocations inside the hook's frame callback

- [ ] **F.3/W.03: Scroll system — Lenis + ScrollTrigger** · `Web`
  - Build: Lenis driving ScrollTrigger (`lenis.on('scroll', ScrollTrigger.update)`, GSAP ticker calls `lenis.raf`); `lockScroll()` / `unlockScroll()`; Space and Arrow Down advance, Arrow Up goes back within an act; touch smoothing off on mobile
  - Files: src/experience/systems/scroll/
  - Depends on: F.3/W.01
  - Source: plan › Foundation › F.3 (Lenis + ScrollTrigger with lock/unlock); tdd › Core systems › 5; tdd › Mobile
  - Done when: lock stops scroll and unlock resumes it; keyboard advance works; verified in a Playwright smoke test

- [ ] **F.3/W.04: Director — act registry, scrub and beat playback, events** · `Web`
  - Build: `Experience.tsx` (`<Canvas aria-hidden="true">`, Director, HUD slot) loaded client-only from `src/app/page.tsx`; ordered registry of `ActModule`s; scroll length per act and one ScrollTrigger per act → `actProgress`; scrub shots follow scroll, beat shots lock scroll, play, unlock, 2× on hard scroll; events dispatched at their `t` to audio / UI / time
  - Files: src/experience/Experience.tsx, src/experience/director/, src/app/page.tsx, tests/unit/director.test.ts
  - Depends on: F.3/W.02, F.3/W.03
  - Source: plan › Foundation › F.3 (Director: act registry, scrub shots, beat shots); tdd › Core systems › 1, 2 (Beat behavior)
  - Done when: Vitest covers act order, shot lookup by progress, beat 2× rule and event firing order; the test act plays both test shots in the browser

- [ ] **F.3/W.05: Director — gates, mounting, loading, quick-menu jumps** · `Web`
  - Build: gates (`hold|swipe|click|read`, `autoResolveMs`) pause the story until resolved; at most 2 acts mounted; next act's assets start loading at 50% progress; previous act disposed after hand-off; jumps: ink-wipe ~0.6 s, target act mounts at its start, breathing ring while loading
  - Files: src/experience/director/, tests/unit/gates.test.ts
  - Depends on: F.3/W.04
  - Source: plan › Foundation › F.3 (gates); tdd › Core systems › 1; CLAUDE.md › Architecture (Director only changes act, max 2 mounted)
  - Done when: Vitest covers gate resolution, auto-resolve timers and the 2-act mount rule; a jump between two test acts works

- [ ] **F.3/W.06: Camera rig — main + POV** · `Web`
  - Build: main `PerspectiveCamera` + POV camera (attaches to a head bone when a character exists; test parent for now); positions via `CatmullRomCurve3`, target/fov/roll with each key's ease; a cut = switching the active camera in one frame; noise shake with fading amplitude and mouse parallax added on top of the pose; refs only inside `useFrame`
  - Files: src/experience/systems/camera/
  - Depends on: F.3/W.04
  - Source: plan › Foundation › F.3 (camera rig main + POV); tdd › Core systems › 3
  - Done when: the test shots' keys reproduce Blender's camera pose at each key (position and fov within tolerance); a cut takes exactly one frame; no React state on the camera path

- [ ] **F.3/W.07: Input system** · `Web`
  - Build: hold (pointerdown→pointerup, early release drains, Space); swipe (≤ 400 ms, ≥ 25% screen width, start/end points; Enter = automatic diagonal); click (raycast on interactive objects; Tab + Enter); read (panel close or timer; Escape)
  - Files: src/experience/systems/input/, tests/unit/input.test.ts
  - Depends on: F.3/W.05
  - Source: plan › Foundation › F.3 (input: hold, swipe, click, keys); tdd › Core systems › 6
  - Done when: Vitest covers hold timing and drain, swipe detection math, and every keyboard alternative; each gate kind resolves by mouse, touch and keyboard on a test gate

- [ ] **F.3/W.08: Audio system** · `Web`
  - Build: Howler audio sprite for effects; one ambience per act crossfaded over 1.5 s; cues by name from `sound` events; unlock on the Enter click (no sound before it); mute saved in `localStorage`
  - Files: src/experience/systems/audio/, tests/unit/audio.test.ts
  - Depends on: F.3/W.04
  - Source: plan › Foundation › F.3 (audio cues); tdd › Core systems › 7; tdd › Accessibility checklist
  - Done when: Vitest proves no playback before unlock, cue lookup by name, mute persistence; unknown cue names fail the shot-data test

- [ ] **F.3/W.09: Asset manager** · `Web`
  - Build: per-act `assets.ts` manifest; preload via `useGLTF.preload`, KTX2 loader, Howler; progress reported to the store; dispose geometries, materials, textures, skeletons, mixers and render targets on unmount; acts loaded with dynamic `import()`
  - Files: src/experience/systems/assets/
  - Depends on: F.3/W.05
  - Source: plan › Foundation › F.3 (asset manager); tdd › Core systems › 8; tdd › Rules 5, 6, 7
  - Done when: loading the test act reports 0→1 progress; after unmount, `renderer.info.memory` returns to its pre-mount counts

- [ ] **F.3/W.10: Quality tiers** · `Web`
  - Build: detect-gpu picks High / Medium / Lite at startup; drei `PerformanceMonitor` drops one tier after 3 s of low frame rate, applied only between shots; tier settings from tdd › Budgets per quality tier (DPR, AA, bloom resolution, frame cap 30 fps on Lite, etc.); pause the render loop when the tab is hidden
  - Files: src/experience/systems/quality/
  - Depends on: F.3/W.04
  - Source: plan › Foundation › F.3 (quality tiers); tdd › Core systems › 9; tdd › Performance › Budgets, Rule 11
  - Done when: forcing each tier applies its DPR and settings; a forced low-FPS signal mid-shot changes the tier only at the next shot boundary

- [ ] **F.3/W.11: ToonMaterial and InkOutline** · `VFX`
  - Build: `ToonMaterial` (uBaseColor, uShadeColor, uBands, uRim; 2 bands, no rim on Lite) and `InkOutline` (inverted hull, uWidth in meters, uColor, uNoise; characters only, no noise on Lite), both extending three.js materials via `onBeforeCompile` so skinning, morphs and instancing work; values read from GLB material custom properties; shaders in `*.glsl.ts`
  - VFX: ToonMaterial, InkOutline
  - Files: src/experience/materials/, src/experience/shaders/toon.glsl.ts, src/experience/shaders/outline.glsl.ts
  - Depends on: F.3/W.09, F.2/B.07
  - Source: plan › Foundation › F.3 (ToonMaterial and InkOutline matching the Blender library); tdd › Shaders and VFX catalog; plan › Parity rules (Toon, Outlines)
  - Done when: the test cube renders with both materials from its GLB custom properties; works on an instanced and a skinned test mesh; Lite variant switches bands/rim/noise (see Open questions on the Blender library)

- [ ] **F.3/W.12: HUD — QuickMenu, SkipButton, Mute, BreathRing** · `Web`
  - Build: quick menu (act labels from `menuLabel`, `/cv` one click away), skip current act, mute (reachable from the first screen), breathing ring (used by loading and jumps); keyboard focus with visible outlines; live region announcing each act name
  - Files: src/experience/ui/QuickMenu.tsx, src/experience/ui/SkipButton.tsx, src/experience/ui/Mute.tsx, src/experience/ui/BreathRing.tsx
  - Depends on: F.3/W.05, F.3/W.08
  - Source: plan › Foundation › F.3 (HUD); tdd › Accessibility checklist; CLAUDE.md › Critical rules (Recruiter-safe, Accessibility)
  - Done when: every control works by mouse and keyboard; live region announces the test act; mute visible on the first screen

## 4. F.4 · Test harness

- [ ] **F.4/W.01: `/dev/shot` page** · `Test`
  - Build: `/dev/shot?shot=<id>&t=<t>` freezes any shot at any time: VFX off, HTML hidden, fixed seed, 1920 × 1080; not reachable in production builds
  - Files: src/app/dev/shot/page.tsx
  - Depends on: F.3/W.06, F.3/W.11
  - Source: plan › Foundation › F.4; plan › The parity test step 2
  - Done when: two loads of the same `shot` and `t` give pixel-identical screenshots; production build returns 404 for `/dev/*`

- [ ] **F.4/W.02: `/dev/stitch` page** · `Test`
  - Build: `/dev/stitch?from=<id>&to=<id>` plays a range of shots on a loop for continuity checks; reports the longest frame time at hand-offs
  - Files: src/app/dev/stitch/page.tsx
  - Depends on: F.4/W.01
  - Source: plan › Foundation › F.4; .claude/rules/web.md › Tests per shot (Stitch)
  - Done when: the two test shots loop with no camera jump at the boundary; no frame over 50 ms at the hand-off

- [ ] **F.4/W.03: Playwright + parity test** · `Test`
  - Build: Playwright config (1920 × 1080, fixed seed); a reusable parity helper: load a still from `blender/renders/stills/<unit-slug>/`, screenshot `/dev/shot` at the same `t`, compute similarity, pass at ≥ 0.90, otherwise save a side-by-side diff image; `pnpm test:e2e` added to CI
  - Files: playwright.config.ts, tests/e2e/helpers/parity.ts, tests/e2e/shots/test.spec.ts, .github/workflows/ci.yml
  - Depends on: F.4/W.01, F.2/B.07
  - Source: plan › Foundation › F.4 (Playwright parity test); plan › The parity test step 3
  - Done when: the helper fails on a deliberately altered still and writes a diff image; e2e runs in CI (see Open questions on the image-compare library)

- [ ] **F.4/W.04: Per-act performance test** · `Test`
  - Build: Playwright test that plays an act and records FPS, draw calls and triangles (`renderer.info`) on High and Lite, checked against the tier budgets
  - Files: tests/e2e/perf/act.perf.spec.ts
  - Depends on: F.4/W.03, F.3/W.10
  - Source: plan › Foundation › F.4 (per-act performance test); tdd › Performance › Budgets, Rule 12; tdd › Milestones › M2 (60 fps with test scene)
  - Done when: the test act reports its numbers on High and Lite and fails when a budget is exceeded (checked with a forced over-budget scene)

## 5. Stage done when

- [ ] **F-DONE: a test cube scene exports from Blender, plays in the browser through the Director, and passes the parity test.**
  - Depends on: every item above
  - Source: plan › Foundation › F.4 Done when

## Out of scope for this stage

- `/dev/character` page and any character (Stage C, cast web check).
- The `MTD_Toon` node group and outline in `blender/library/` as production assets (plan places the toon material in the shared library; tdd › M3).
- `content/*.ts` files, their zod schemas and `/cv` (tdd › M1; not in plan › Foundation).
- `/api/contact`, Resend, security headers in `next.config` (Act 7 / tdd › Contact backend).
- Fallbacks (no WebGL → `/cv`, Save-Data, reduced-motion toggle), Lighthouse CI, real-device playthroughs (Stage Z / tdd › M10–M11).
- The 14 other catalog effects (built in the acts that first use them).
- All story shots and transitions (Stages 0–7).

## Open questions

- **MTD_Toon library vs F.3 materials:** plan › F.3 says ToonMaterial and InkOutline must match "the Blender library", but plan › F.2 doesn't list building `MTD_Toon` + the outline in `blender/library/` (tdd puts it in M3). Should a minimal `MTD_Toon` node group + Solidify outline be added to F.2 (e.g. in F.2/B.02) so F.3/W.11 can be parity-checked, or is F.3/W.11 checked only against custom properties now and visually in C1?
- **Parity image comparison library:** a similarity score ≥ 0.90 against a Blender still needs an image-diff library (e.g. pixelmatch + pngjs, or an SSIM package); none is on the allowed list. Playwright's `toHaveScreenshot` only compares against its own baselines. Approve a library, or write the comparison in-house?
- **Test scene naming:** the plan has no name for the test scene; this file proposes `blender/scripts/build_test.py`, `blender/scenes/test-cube.blend`, collection `test_cube`, `shots/test.json` and a dev-only test act outside `act0…act7`. Confirm.
- **Approval of the test-cube stills:** F.2/B.07 records them in `blender/renders/APPROVALS.md` so F.4/W.03 has an approved reference. Confirm that a non-story row belongs in that file.
- **Preview mp4 encoding:** `/approve-shot` expects `render_stills.py` (or a sibling) to write `previews/<unit-slug>.mp4`; plan › F.2 only names stills. Folded into F.2/B.06; confirm, and confirm ffmpeg/Blender's FFmpeg output is acceptable.
- **KTX-Software** must be installed on the machine and in CI for `pnpm assets`; it is a system tool, not an npm package.
