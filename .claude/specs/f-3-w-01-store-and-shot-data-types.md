# Spec: F.3/W.01: Store and shot data types (Web)

- Build-order item: `F.3/W.01` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-3-w-01-store-and-shot-data-types`
- Mode: n/a (core system, no shot)
- Approved render: n/a (F.3 has no `/B` item; the shot data it validates comes from `test-1`, approved 2026-11-12, first row of `blender/renders/APPROVALS.md`)
- Created: 2026-11-12

## Director's view
None. This is a Foundation item, not a story shot.

Plan › Foundation › F.3: "Store, Director (act registry, scrub shots, beat shots, gates), camera rig (main + POV), `useActFrame` with time scale."

Stage file Build: "Zustand `AppState` (actId, actProgress, timeScale, quality, muted, reducedMotion, gates, visitedPillars, defeatedRanks; goToAct, setTimeScale, resolveGate); `ActId`, `Shot`, `CameraKey`, `ShotEvent`, `Gate`, `ActModule` types; zod schema for `shots/*.json`"

## Overview
This item lays the typed base that every other F.3 system builds on:
- **The Zustand store** (`AppState`, tdd › Core systems › 10). It holds the current act, the act's progress, time scale, quality tier, mute, reduced motion, gate states, visited Pillars and defeated Ranks, plus the three actions `goToAct`, `setTimeScale` and `resolveGate`.
- **The data types** the Director plays (tdd › Core systems › 1, 2): `ActId`, `ActModule`, `Shot`, `CameraKey`, `ShotEvent`, `Gate`.
- **A zod schema for `shots/*.json`.** `shots/<act>.json` is the only path for camera work from Blender into the browser. The schema makes a bad hand edit or exporter drift fail the unit tests (and so CI), instead of failing as a silent camera jump at runtime.

Nothing renders yet. The Director (F.3/W.04), time system (F.3/W.02), scroll system (F.3/W.03), camera rig (F.3/W.06) and test harness (F.4) all import these types and this store.

## Depends on
- F.1/W.02: Next.js + TypeScript strict + Tailwind, stack installed and pinned: ✅ ticked. It provides `zustand` 5.1.0, `zod` 4.6.7, `vitest` 5.1.0, the `@/*` → `src/*` alias (tsconfig + `vitest.config.mts`), `resolveJsonModule`, `noUncheckedIndexedAccess`.
- F.2/B.04: `export_shots.py`: ✅ ticked. It defines the file this schema validates (decisions in `.claude/specs/f-2-b-04-export-shots-py.md` › Open questions 1–7):
  - file shape `{ act, fps, shots, markers, gates }` (`TOP_KEYS`);
  - shot keys exactly `{ id, mode, scrollLength?, duration?, camera, keys, events }` (`SHOT_KEYS`);
  - `CameraKey { t, pos, target, fov, roll, focus, ease? }`: Y-up three.js coordinates, **vertical** `fov` in degrees, `roll` in degrees, `focus` in meters (> 0). The last key of each shot has no `ease`;
  - `ease` is one of `"none"` (LINEAR), `"steps(1)"` (CONSTANT), `"power1.inOut"` (BEZIER);
  - point markers `markers: [{ id, shot, t }]`, always replaced from Blender;
  - `gates` top-level and hand-edited; gate events reference gates by id;
  - a beat's `duration` = frame span ÷ 30; `fps` is 30.
- No system, VFX or character is needed.

## Shot data
No shot entries change. `shots/test.json` as exported (F.2/B.04, re-exported at test-1/B) must parse unchanged:

| Shot | Mode | Length | Camera | Keys | Events |
|---|---|---|---|---|---|
| `test-1` | scrub | `scrollLength: 2` | main | 3 (t 0 → 0.4944 → 1) | none |
| `test-2` | beat | `duration: 2` | main | 2 (t 0 → 1) | none |

`act: "test"`, `fps: 30`, `markers: []`, `gates: []`.

**Events and gates to add:** none. Negative cases (unsorted keys, bad `t`, unknown cue, missing gate) are fixtures inside the test file, never edits to `shots/test.json`.

### Schema rules (`ShotFileSchema` in `src/lib/schemas.ts`)
Objects are **strict** (unknown keys rejected, so a typo in a hand edit fails), matching the exporter's `TOP_KEYS` / `SHOT_KEYS`.

- **File:**
  - `act`: an `ActId` or `"test"` (see Open questions 1);
  - `fps`: the literal `30`;
  - `shots`: at least 1, shot ids unique within the file;
  - `markers`: `{ id, shot, t }`, where `shot` names a shot in this file and `t` is in 0–1;
  - `gates`: `Gate[]`, gate ids unique.
- **Shot:**
  - `mode: "scrub"` requires `scrollLength` > 0 and has no `duration`;
  - `mode: "beat"` requires `duration` > 0 and has no `scrollLength`;
  - `camera` is `"main" | "pov"`.
- **Keys:**
  - at least 2;
  - each `t` in 0–1, **strictly increasing**, the first exactly 0 and the last exactly 1 ("keys sorted by `t` from 0 to 1");
  - `pos` and `target` are finite `Vec3`;
  - `fov` in (0, 180);
  - `roll` finite;
  - `focus` > 0;
  - `ease`, when present, one of the three exporter values.
- **Events:**
  - `t` in 0–1;
  - `type` is one of `sound | title | timeScale | shake | gate | custom`;
  - payload by type:
    - `sound` → `{ cue }`, where `cue` is in the cue registry ("unknown cue names" rejected);
    - `gate` → `{ id }`, where `id` exists in this file's `gates` ("gates that don't exist" rejected);
    - `timeScale` → `{ to: number in (0, 1], ramp?: number ≥ 0 }` (tdd example `{ to: 0.05, ramp: 0.3 }`);
    - `title`, `shake`, `custom` → `Record<string, unknown>` until the systems that read them define them.
- **Gate:**
  - `{ id, kind: "hold" | "swipe" | "click" | "read", holdMs?, autoResolveMs: number | null }`;
  - `holdMs` > 0 is required for `hold` and not allowed for other kinds;
  - `autoResolveMs` is null or > 0.

Cross-field checks (sorted keys, gate references, unique ids, marker → shot) are done in `superRefine`, with an error path that names the shot id and the key or event index. A failure then reads like `shots/test.json › test-1 › keys[2].t`.

## Components and systems
No components. Files under `src/`:

- **`src/lib/schemas.ts`**: zod schemas `Vec3Schema`, `CameraKeySchema`, `ShotEventSchema`, `ShotSchema`, `GateSchema`, `ShotFileSchema`, plus `CUE_NAMES` (the cue registry) and `parseShotFile(json, fileName)`.
  - It's shared with the later `content/` and `/api/contact` schemas, so it imports only `zod`: no React, three.js or store.
- **`src/experience/director/types.ts`**: `ActId`, `ActModule`, `AssetManifest` (placeholder, see Open questions 3).
  - It re-exports `Shot`, `CameraKey`, `ShotEvent`, `Gate`, `ShotFile` as `z.infer` of the schemas, so the types and the validator can't drift apart.
  - `ActModule` exactly as tdd › Core systems › 1: `{ id, menuLabel, shots, Scene: React.ComponentType, assets, onEnter?, onExit? }`.
- **`src/store/useStore.ts`**: `useStore = create<AppState>()(…)`, with `AppState` exactly as tdd › Core systems › 10:

| Field | Initial | Notes |
|---|---|---|
| `actId` | `"act0"` | |
| `actProgress` | `0` | 0..1 |
| `timeScale` | `1` | |
| `quality` | `"high"` | F.3/W.10 replaces it with the detect-gpu tier at startup |
| `muted` | `false` | F.3/W.08 restores it from `localStorage` |
| `reducedMotion` | `false` | set from `prefers-reduced-motion` later (F.3/W.12 / Z) |
| `gates` | `{}` | `Record<string, 'pending' \| 'done'>` |
| `visitedPillars` | `[]` | |
| `defeatedRanks` | `[]` | |

  Actions:
  - `goToAct(id)` sets `actId` and resets `actProgress` to 0. Only the Director calls it (CLAUDE.md: "The Director is the only thing that changes the current act"). Wipes, mounting and loading are F.3/W.05.
  - `setTimeScale(to, rampSeconds?)` sets `timeScale = to` at once. The ramp tween and GSAP sync are F.3/W.02, which replaces the body but keeps the signature. It rejects `to` ≤ 0 or non-finite (dev `console.error`, no change).
  - `resolveGate(id)` sets `gates[id] = 'done'` with a new object (immutable update, so selectors fire).

- **Store rules:**
  - no per-frame setters here; frame-loop readers use `useStore.getState()`, DOM overlays use selectors (tdd › 10);
  - no `persist` middleware: mute persistence belongs to the audio system (F.3/W.08);
  - no fields beyond the TDD list: later items add their own (e.g. W.04 an `actProgress` setter, W.09 load progress) in the item that needs them.

## VFX
None.

## Content
None. `content/*.ts` and its schemas are tdd › M1, out of scope for Stage F. `src/lib/schemas.ts` is created here and gains content schemas later.

## Accessibility and fallbacks
None at runtime (no UI). The store carries `reducedMotion` and `muted` for the systems that act on them.

## Budgets
None. No assets, no rendering. `zustand` and `zod` are already in the bundle plan. The store and schema are tiny, but `src/lib/schemas.ts` must stay free of three.js/React imports so `/cv` and `/api/contact` can import it later without pulling in the 3D stack.

## Files to change / Files to create

**Create**
- `src/lib/schemas.ts`: zod shot-file schemas, `CUE_NAMES`, `parseShotFile`.
- `src/experience/director/types.ts`: `ActId`, `ActModule`, `AssetManifest`, and the `z.infer` shot types.
- `src/store/useStore.ts`: the Zustand `AppState` store.
- `tests/unit/shots.test.ts`:
  - every `shots/*.json` parses;
  - the rejection cases from Done when (fixtures).
- `tests/unit/store.test.ts`: initial state and the three actions (not in the stage file's Files list; proposed, see Open questions 5).

**Delete**
- `src/lib/.gitkeep`, `src/store/.gitkeep`, `src/experience/director/.gitkeep` (the folders now have files).

**Change**
- `docs/progress.md`: at ship time.

## New dependencies
No new dependencies.

## Rules for implementation
- TypeScript strict, no `any` (use `unknown` + zod), no unused exports; `noUncheckedIndexedAccess` is on, so index access is checked.
- Shot types come from `z.infer`; don't hand-write duplicate interfaces.
- `src/lib/schemas.ts` imports only `zod`.
- Never edit camera keys in `shots/*.json`; this item edits no shot file at all.
- The store holds no per-frame state writes; readers in `useFrame` use `useStore.getState()`.
- zod 4 API (`z.strictObject`, `z.discriminatedUnion`, `superRefine` / `check`); error paths name the shot id.
- No act code, no Director logic, no time ramp: those are W.02–W.05.

## Tests
Commands: `pnpm test` (Vitest), `pnpm typecheck`, `pnpm lint`. No Playwright, parity, stitch or budget tests apply (no rendering).

`tests/unit/shots.test.ts`:
1. **Real files:** every `shots/*.json` (found by glob, so later acts are covered automatically) passes `parseShotFile`. `shots/test.json` gives `test-1` scrub (3 keys) and `test-2` beat (2 keys).
2. **Gate ids across files:** gate ids are unique across all shot files (the store's `gates` record is keyed by id).
3. **Rejects** (each a fixture derived from `shots/test.json`, asserting the error path):
   - unsorted keys (`t` 0, 0.6, 0.4, 1) and duplicate `t`;
   - `t` < 0 or > 1 on a key, an event and a marker; first key ≠ 0, last key ≠ 1;
   - a `sound` event with an unknown cue (`{ cue: "not-a-cue" }`);
   - a `gate` event whose `id` isn't in `gates`;
   - scrub without `scrollLength` / beat without `duration` / beat with `scrollLength`;
   - an unknown top-level or shot key (typo);
   - an unknown `ease`; `focus` ≤ 0;
   - a `hold` gate without `holdMs`, a `click` gate with `holdMs`;
   - duplicate shot ids; a marker naming a missing shot.
4. **Accepts:** a fixture with a valid `sound` event (registry cue), a `gate` event + matching gate, and a `timeScale` event.

`tests/unit/store.test.ts` (proposed):
- the initial state matches the table above;
- `goToAct` sets the act and resets progress;
- `setTimeScale` sets the value and ignores `0` / `NaN`;
- `resolveGate` marks done and returns a new `gates` object;
- state is reset between tests.

## Definition of done
- [ ] `shots/test.json` parses; Vitest rejects unsorted keys, `t` outside 0–1, unknown cue names and gates that don't exist
- [ ] Parity ≥ 0.90 on every listed still; stitch with the previous shot has no jump: n/a (no rendering; parity starts at F.4/W.03)
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green
- [ ] Within tier budgets on High and Lite: n/a (no assets)
- [ ] Verified by `mtd-test-runner` (`/test-shot F.3/W.01`); `/review-shot F.3/W.01` has no 🚧 items
- [ ] `docs/progress.md` updated; `F.3/W.01` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- `useActFrame` and the time-scale ramp / GSAP sync (F.3/W.02), Lenis and scroll lock (F.3/W.03).
- Director, act registry, `Experience.tsx`, playing shots (F.3/W.04); gates' runtime, mounting, loading, quick-menu jumps (F.3/W.05).
- Camera interpolation (F.3/W.06), input (W.07), audio sprite and mute persistence (W.08), asset manifest contents (W.09), detect-gpu tier (W.10).
- `content/*.ts` schemas and `/cv` (tdd › M1), `/api/contact` schema (Act 7).
- Any change to `blender/scripts/export_shots.py` or `shots/test.json`.

## Open questions
1. ✅ **The test act's id.** (resolved 2026-11-12, director: yes, as proposed) `shots/test.json` has `act: "test"`, and F.3/W.04 must play "the test act" through the Director, but tdd's `ActId` is `act0`–`act7` only (stage F Open questions: test act "outside `act0…act7`").
   **Proposed:** `StoryActId = 'act0' … 'act7'` and `ActId = StoryActId | 'test'`. The registry includes the `test` act only outside production (decided in W.04). The shot-file schema accepts any `ActId`.
2. ✅ **Cue registry.** (resolved 2026-11-12, director: yes, as proposed) The docs name no master cue list. tdd uses `taiko` and `taiko-double`, and the plan names cues only in prose (heartbeat, inhale, clack, chime…).
   **Proposed:** `CUE_NAMES` in `src/lib/schemas.ts` starts with only the TDD's `taiko` and `taiko-double`. Each act's web item adds the cues its sound events use, in the same PR. F.3/W.08's sprite map must cover every registered name (W.08 test). No names are invented here.
3. ✅ **`AssetManifest`** (resolved 2026-11-12, director: yes, as proposed) is used by `ActModule` but defined by the asset manager (F.3/W.09).
   **Proposed:** a placeholder `interface AssetManifest { models: readonly string[]; textures: readonly string[]; vat: readonly string[]; audio: readonly string[] }` (URLs under `public/`, matching the `public/` folders). W.09 may refine it.
4. ✅ **`timeScale` payload bounds.** (resolved 2026-11-12, director: yes, as proposed) **Proposed:** `to` in (0, 1] (slow motion only; tdd: "1 = normal, 0.05 = deep slow motion"), `ramp` ≥ 0 seconds. A stopped-time gate (plan 4R<n> "time stopped") would then use a tiny value, not 0. Confirm, or allow `to = 0`.
5. ✅ **Store unit test.** (resolved 2026-11-12, director: yes, as proposed) The stage file's Files list only names `tests/unit/shots.test.ts`.
   **Proposed:** add `tests/unit/store.test.ts` for the actions (tdd › Testing › Systems covers "gate resolution").
6. ✅ **`form` gate kind.** (resolved 2026-11-12, director: yes, as proposed) Plan › Act 7 says "Form gate", but tdd's `Gate.kind` has no `form`.
   **Proposed:** keep the TDD's four kinds now. Act 7 maps it to `click` (Send) or adds `form` to the TDD first. Not blocking.
7. ✅ **Initial `quality`.** (resolved 2026-11-12, director: yes, as proposed) **Proposed:** `"high"` until W.10's detect-gpu result is set at startup (no frame renders before that, so a wrong guess never shows).
