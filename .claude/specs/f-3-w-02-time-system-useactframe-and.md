# Spec: F.3/W.02: Time system — `useActFrame` and time scale (Web)

- Build-order item: `F.3/W.02` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-3-w-02-time-system-useactframe-and`
- Mode: n/a (core system, no shot)
- Approved render: n/a (F.3 has no `/B` item; nothing renders)
- Created: 2026-11-13

## Director's view
None. This is a Foundation item, not a story shot.

Plan › Foundation › F.3: "Store, Director (act registry, scrub shots, beat shots, gates), camera rig (main + POV), `useActFrame` with time scale."

tdd › Core systems › 4 (Time system):
- "The store holds one `timeScale` value (1 = normal, 0.05 = deep slow motion)."
- "A shared hook `useActFrame((state, scaledDelta) => ...)` passes delta × timeScale to every animated thing: particles, ink, ash, cloth sway, characters."
- "`setTimeScale(to, rampSeconds)` tweens the value, which produces speed ramps for free. `gsap.globalTimeline.timeScale()` is kept in sync for beat timelines."
- "Scrub shots are not slowed by time scale (scroll stays in control); only the things inside the scene slow down."

How the plan uses it later (for intent, not built here):
- 1.7: "`setTimeScale(0.05, 0.3)`; `StrokeReveal` runs on real time so writing stays readable."
- 1.8: "`setTimeScale(1, 0.4)` speed ramp."
- Act 3: "`setTimeScale(0.2)`" (no ramp).
- 4R<n>: "time stopped" during the swipe gate.

## Overview
This item makes slow motion work:
- **`setTimeScale(to, rampSeconds)`** ramps the time scale smoothly from its current value to `to` over `rampSeconds` of **real** time. With no ramp (or 0), the change is instant. A new call during a ramp starts from the current value, so there is never a jump.
- **`useActFrame((state, scaledDelta, delta) => …)`** is the hook every animated thing uses instead of `useFrame`. `scaledDelta` = `delta × current time scale`. The third argument, `delta`, is the unscaled real delta, for the few things the plan keeps on real time (1.7's `StrokeReveal`).
- **GSAP stays in sync:** `gsap.globalTimeline.timeScale()` always equals the current time scale, so beat timelines slow down with the scene.
- **Scrub shots aren't slowed:** scroll stays in control. On a scrub shot the camera follows scroll progress, never `scaledDelta` or a GSAP tween (see Rules and Open questions 3).

Nothing renders yet. The Director (W.04) dispatches `timeScale` events to `setTimeScale`. Characters, VFX and particles in later acts animate through `useActFrame`.

## Depends on
- F.3/W.01: Store and shot data types: ✅ ticked (PR #14). It provides:
  - `useStore` with `timeScale` (initial 1);
  - `setTimeScale(to, rampSeconds?)`, which currently sets the value at once and rejects non-finite or ≤ 0 values with a dev `console.error`. Its comment says "F.3/W.02 replaces the body with the ramp tween and GSAP sync, keeping the signature";
  - the `timeScale` event payload `{ to: (0, 1], ramp?: ≥ 0 }` in `src/lib/schemas.ts`.
- Packages already installed and pinned: `gsap` 3.15.1, `@react-three/fiber` 9.8.2 (`useFrame(callback: (state, delta, frame?) => void, renderPriority?)`).
- Checked in node: `gsap.globalTimeline.timeScale(x)` works without a DOM; `gsap.parseEase`, `gsap.ticker.add/remove`, `gsap.ticker.lagSmoothing` and `gsap.updateRoot` exist.
- No system, VFX or character beyond these.

## Shot data
None. No shot entries change, and no events or gates are added. `timeScale` events (`{ t, type: "timeScale", payload: { to, ramp? } }`) are already validated by W.01's schema. W.04 wires them to `setTimeScale`.

## Components and systems
New folder `src/experience/systems/time/`:

- **`clock.ts`**: a pure time-scale clock. No React, no GSAP, no store.
  - `createTimeClock(initial = 1)` returns a mutable object `{ scale, from, to, elapsed, duration }` (fields set once; never reallocated).
  - `rampTo(clock, to, seconds)`:
    - `seconds` ≤ 0 or missing: `scale = to` at once;
    - otherwise: `from = scale` (the current value, even mid-ramp), `to`, `elapsed = 0`, `duration = seconds`.
  - `stepClock(clock, realDeltaSeconds)`:
    - advances `elapsed` while a ramp runs;
    - sets `scale = from + (to - from) × ease(elapsed / duration)`, clamped at the end so `scale === to` exactly when the ramp finishes;
    - returns `scale`;
    - no allocation.
  - Ease: `power1.inOut` (Open questions 1), taken once from `gsap.parseEase` or written as a plain function, never per step.
- **`timeSystem.ts`**: the one shared clock and its wiring.
  - `getTimeScale()`: the live value, read by `useActFrame` and later systems.
  - `rampTimeScale(to, seconds?)`: called by the store action.
  - `installTimeSystem()`:
    - adds one `gsap.ticker` listener that steps the clock with the ticker's real `deltaTime` (ms → s);
    - calls `gsap.globalTimeline.timeScale(scale)` only when the value changed;
    - returns an `uninstall()`;
    - safe to call twice (it's installed once).
  - W.04's `Experience.tsx` calls it. Nothing calls it in this item except the tests.
- **`useActFrame.ts`**: `useActFrame(callback, renderPriority?)` registers `useFrame((state, delta) => callback(state, delta * getTimeScale(), delta), renderPriority)`.
  - The registered frame function makes no objects, arrays or closures per frame.
  - The callback type is `(state: RootState, scaledDelta: number, delta: number) => void`.
- **`index.ts`**: re-exports `useActFrame`, `getTimeScale`, `installTimeSystem`.

Changed:
- **`src/store/useStore.ts`**:
  - `setTimeScale(to, rampSeconds)` keeps W.01's validation (finite, > 0; else dev `console.error`, no change).
  - It also rejects a non-finite or negative `rampSeconds` the same way.
  - It sets the store's `timeScale` to `to`: the store holds the **target**, written once per call, never per frame (Open questions 2).
  - Then it calls `rampTimeScale(to, rampSeconds)`.
  - No new store fields.

### Rules the time system sets for later items (documented in `timeSystem.ts`)
- Animate scene things with `useActFrame`, never `useFrame` with raw `delta`. Real-time exceptions (1.7 `StrokeReveal`) use the third argument and say so in a comment.
- Frame code reads the live value with `getTimeScale()`. `useStore.getState().timeScale` is the target, which differs during a ramp.
- **Scrub shots:** the camera follows scroll progress directly. ScrollTrigger uses `scrub: true` (smoothing comes from Lenis, whose `raf` runs on `gsap.ticker` and isn't scaled), never a numeric `scrub` value, which would create a tween on the global timeline that slow motion would stretch (W.03/W.04).
- **GSAP is for the scene.** Anything driven by GSAP slows with the scene. Things that must keep real time either avoid GSAP or set their own `timeScale`:
  - the ramp itself (it's stepped from the ticker, not tweened);
  - gate auto-resolve timers (`setTimeout` / real clock, not `gsap.delayedCall`);
  - HUD and overlay transitions: the ink wipe, the reduced-motion crossfades, the menu (CSS transitions, W.05/W.12; Open questions 3).

## VFX
None.

## Content
None.

## Accessibility and fallbacks
- No UI.
- Reduced motion doesn't disable slow motion: it slows things down rather than adding motion. Reduced-motion crossfades (0.6 s) are HUD transitions, so they stay on real time (Rules above).
- When the tab is hidden, `gsap.ticker` stops with `requestAnimationFrame`, and a ramp resumes where it was. GSAP's default lag smoothing caps the first delta after the tab returns, so a ramp doesn't jump to its end.

## Budgets
- No assets or rendering.
- Frame-loop cost: one multiply per `useActFrame` callback and one clock step per ticker tick. No allocations in either; GSAP's `timeScale()` is called only while a ramp changes the value.

## Files to change / Files to create

**Create**
- `src/experience/systems/time/clock.ts`: pure ramp clock (`createTimeClock`, `rampTo`, `stepClock`).
- `src/experience/systems/time/timeSystem.ts`: the shared clock, `getTimeScale`, `rampTimeScale`, `installTimeSystem` (gsap ticker + global timeline sync).
- `src/experience/systems/time/useActFrame.ts`: the scaled frame hook.
- `src/experience/systems/time/index.ts`: public exports.
- `tests/unit/time.test.ts`: ramp values over time, GSAP sync, hook scaling, store wiring.

**Delete**
- `src/experience/systems/.gitkeep` (the folder now has files).

**Change**
- `src/store/useStore.ts`: `setTimeScale` ramps through the time system; validates `rampSeconds`.
- `tests/unit/store.test.ts`: only if a W.01 store test conflicts with the new behaviour. Expected: none conflict, because the store still holds the target at once.
- `docs/progress.md`: at ship time.

## New dependencies
No new dependencies.

## Rules for implementation
- TypeScript strict, no `any`; no act code.
- No allocations or `setState` per frame:
  - the clock is mutated in place;
  - the store is written once per `setTimeScale` call;
  - GSAP is touched only when the value changes.
- `clock.ts` imports nothing from React, GSAP or the store, so it's testable as plain math.
- `installTimeSystem` is idempotent and returns a cleanup; module scope stays side-effect free (importing the module doesn't touch `gsap.ticker`).
- The time system never writes `actProgress` or scroll state.
- Keep the store action's signature `setTimeScale(to, rampSeconds?)`.

## Tests
Commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`. No Playwright, parity, stitch or budget tests apply (no rendering).

`tests/unit/time.test.ts`:
1. **Ramp values over time** (clock, stepped with fixed real deltas):
   - `rampTo(1 → 0.05, 0.3 s)`: the value is between 1 and 0.05 mid-ramp and moves monotonically; it's exactly 0.05 at 0.3 s and stays there.
   - The value at the halfway point matches `power1.inOut` at 0.5 (= the midpoint).
   - With no ramp or 0 s: instant.
   - Retargeting mid-ramp (`0.05, 0.3` then `1, 0.4` at 0.15 s) starts from the current value: no jump between consecutive steps.
   - A step larger than the remaining ramp lands exactly on `to`.
2. **GSAP sync:**
   - after `installTimeSystem()` and ticks (drive `gsap.ticker` or step through the system's tick function with fixed deltas), `gsap.globalTimeline.timeScale()` equals `getTimeScale()` at every step of a ramp and after it ends;
   - a 1 s GSAP tween on the global timeline advanced with `gsap.updateRoot` progresses at the scaled rate (e.g. half speed at 0.5);
   - `uninstall()` removes the ticker listener; installing twice adds one listener.
3. **`useActFrame` scaling** (`@react-three/fiber`'s `useFrame` mocked with `vi.mock` to capture the registered function):
   - the callback gets `(state, delta × scale, delta)` with the same `state` object;
   - at time scale 1, `scaledDelta === delta`;
   - `renderPriority` is passed through.
4. **No allocations in the frame callback:** proven by structure, since Vitest can't measure allocation reliably (Open questions 4):
   - the captured frame function is registered once per render and returns nothing;
   - a source check on `useActFrame.ts` / `clock.ts`'s step code finds no `new `, array literal or object literal inside the frame and step functions;
   - review confirms.
5. **Store wiring:**
   - `setTimeScale(0.05, 0.3)` sets the store's `timeScale` target to 0.05 at once and starts a ramp in the time system (live value still 1 before any step);
   - invalid `to` or `rampSeconds` (negative, NaN) changes neither and logs once.

Reset the shared clock and `gsap.globalTimeline.timeScale(1)` between tests.

## Definition of done
- [ ] Vitest proves ramp values over time and GSAP sync; no allocations inside the hook's frame callback
- [ ] Parity ≥ 0.90 on every listed still; stitch with the previous shot has no jump: n/a (no rendering)
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green
- [ ] Within tier budgets on High and Lite: n/a (no assets)
- [ ] Verified by `mtd-test-runner` (`/test-shot F.3/W.02`); `/review-shot F.3/W.02` has no 🚧 items
- [ ] `docs/progress.md` updated; `F.3/W.02` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- Calling `installTimeSystem()` from `Experience.tsx`, and dispatching `timeScale` shot events: F.3/W.04 (Director).
- Lenis, ScrollTrigger, scroll lock: F.3/W.03.
- Beat playback, 2× on hard scroll: F.3/W.04.
- Gate timers: F.3/W.05. Mixers and characters: Stage C. `StrokeReveal`: Act 1.
- Pausing the render loop when hidden: W.04 / Z.

## Open questions
1. ✅ **Ramp curve.** (resolved 2026-11-22, director: yes, as proposed) tdd says `setTimeScale` "tweens the value" but names no ease.
   **Proposed:** `power1.inOut`, the same ease the exporter uses for Blender's Bézier keys, so speed ramps feel like the camera's. It's applied by hand in the clock, not as a GSAP tween (a GSAP tween would be slowed by the value it's changing).
2. ✅ **What the store's `timeScale` holds during a ramp.** (resolved 2026-11-22, director: yes, as proposed) tdd: "The store holds one `timeScale` value." Writing the live value to the store every frame during a ramp would be a store write (new state object, subscribers notified) every frame.
   **Proposed:** the store holds the **target** (written once per call). The live value comes from `getTimeScale()`, which `useActFrame` and frame code read. DOM overlays that show slow motion select the target. This also keeps W.01's test "`setTimeScale(0.05, 0.3)` sets the value at once" true.
3. ✅ **GSAP global timeline vs. real-time UI.** (resolved 2026-11-22, director: yes, as proposed) tdd syncs `gsap.globalTimeline.timeScale()`, which slows **every** GSAP tween: a numeric ScrollTrigger `scrub`, the quick-menu ink wipe, HUD fades.
   **Proposed:** follow the TDD as written (the build item names `gsap.globalTimeline`) and set the rule:
   - GSAP is for scene and beat animation;
   - ScrollTrigger uses `scrub: true` (Lenis does the smoothing);
   - HUD and overlay transitions use CSS transitions;
   - real timers use `setTimeout`.

   The alternative is a dedicated scene timeline instead of the global one (a TDD change). Say if you'd prefer that.
4. ✅ **Proving "no allocations".** (resolved 2026-11-22, director: yes, as proposed) JavaScript can't count allocations reliably in Vitest (V8 optimizes them away, and heap measurements are noisy).
   **Proposed:** prove it by structure:
   - the frame function captured from a mocked `useFrame`;
   - a source check for `new`, `[…]` and `{…}` inside the frame and step functions;
   - performance review.

   No heap-measurement test.
5. ✅ **Real-time delta in `useActFrame`.** (resolved 2026-11-22, director: yes, as proposed) tdd's signature is `(state, scaledDelta)`. The plan needs real time for 1.7's `StrokeReveal`.
   **Proposed:** add the unscaled `delta` as an optional third argument. That's backward-compatible with the TDD signature, and it's better than mixing `useFrame` and `useActFrame` in one component.
6. ✅ **Where the ramp is stepped.** (resolved 2026-11-22, director: yes, as proposed) **Proposed:** on `gsap.ticker`, the same clock W.03 uses for `lenis.raf`, so the time scale, GSAP and Lenis advance together. It's one rAF apart from R3F's frame loop, so `useActFrame` may see a value up to one frame old during a ramp, which can't be seen at 0.3–0.4 s ramps.
