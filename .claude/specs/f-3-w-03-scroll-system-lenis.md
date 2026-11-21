# Spec: F.3/W.03: Scroll system — Lenis + ScrollTrigger (Web)

- Build-order item: `F.3/W.03` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-3-w-03-scroll-system-lenis`
- Mode: n/a (core system, no shot)
- Approved render: n/a (F.3 has no `/B` item; nothing renders)
- Created: 2026-11-22

## Director's view
None. This is a Foundation item, not a story shot.

Plan › Foundation › F.3: "Lenis + ScrollTrigger with lock/unlock; input (hold, swipe, click, keys); audio cues; asset manager; quality tiers."

tdd › Core systems › 5 (Scroll system):
- "Lenis provides smooth scrolling and drives ScrollTrigger: `lenis.on('scroll', ScrollTrigger.update)` and GSAP's ticker calls `lenis.raf`."
- "`lockScroll()` / `unlockScroll()` wrap `lenis.stop()` / `lenis.start()` for beats and gates."
- "Keyboard: Space and Arrow Down advance; Arrow Up goes back within an act."

tdd › Mobile: "Touch scrolling uses Lenis with touch smoothing off, so it feels native."

tdd › Core systems › 2: "Beat behavior: when scroll reaches a beat, scrolling is locked (`lenis.stop()`), the beat plays, then scrolling unlocks." (The lock is used by W.04; beat playback isn't built here.)

## Overview
This item turns the page into the scroll track the Director (W.04) reads:
- **Smooth scroll:** Lenis smooths the mouse wheel. Touch stays native (no touch smoothing), and Lenis drops smoothing on its own when the visitor prefers reduced motion.
- **Lenis drives ScrollTrigger:** every Lenis scroll calls `ScrollTrigger.update`, and Lenis's `raf` runs on `gsap.ticker`. The same clock steps the time system (W.02), so scroll, GSAP and slow motion advance together. Lenis runs on the ticker's real time, so slow motion never slows scrolling.
- **Lock and unlock:** `lockScroll()` / `unlockScroll()` stop and restart Lenis for beats and gates. When locked, the wheel, touch and keyboard don't move the page.
- **Keyboard:** Space and Arrow Down advance to the next stop, and Arrow Up goes back to the previous one, never past the start of the current act. Until the Director supplies shot stops and act bounds (W.04), a stop is one screen height and the act is the whole page.
- **Smoke test:** a dev-only page `/dev/scroll` runs the system, and a Playwright smoke test proves lock, unlock and keyboard advance in a real browser.

It also adds the first test for the W.02 rule "scrub shots aren't slowed": a `scrub: true` ScrollTrigger keeps up with scroll at time scale 0.05.

## Depends on
- F.3/W.01: Store and shot data types: ✅ ticked (PR #14). The scroll system writes no store fields. The smoke page calls `useStore.getState().setTimeScale` for the slow-motion check.
- F.3/W.02: Time system: ✅ ticked (PR #15). It provides `installTimeSystem()` on `gsap.ticker` and the rules in `src/experience/systems/time/timeSystem.ts`: ScrollTrigger uses `scrub: true`, not a numeric scrub, and HUD transitions use CSS.
- Packages already installed and pinned:
  - `lenis` 1.3.27, with options `autoRaf`, `smoothWheel` (default true), `syncTouch` (default false) and `respectReducedMotion` (default true), plus `stop()`, `start()`, `isStopped`, `scrollTo(target, { immediate, lock, … })`, `on('scroll')`, `on('virtual-scroll')`, `raf(timeMs)` and `destroy()`. Its CSS is at `lenis/dist/lenis.css`; `.lenis-stopped` sets `overflow: clip`.
  - `gsap` 3.15.1 with `gsap/ScrollTrigger`.
  - `@playwright/test` 1.65.0.
- `playwright.config.ts` currently only sets `testDir: "./tests/e2e"` ("F.4/W.03 adds the viewport, base URL, web server and parity settings").
- ⚠ **Environment:** no Playwright browser is installed (`~/.cache/ms-playwright` doesn't exist). The smoke test needs `pnpm exec playwright install chromium` (Open questions 6).

## Shot data
None. No shot entries change, and no events or gates are added.

## Components and systems
New folder `src/experience/systems/scroll/`:

- **`keys.ts`**: pure keyboard logic. No DOM globals, Lenis or GSAP, so Vitest can test it.
  - `keyAction(e)`: reads `{ key, code, repeat, altKey, ctrlKey, metaKey, shiftKey, target }` and returns `"next" | "prev" | null`.
    - **Next:** Space (`" "`) and `ArrowDown`. **Prev:** `ArrowUp`.
    - **Ignored** (Open questions 5):
      - any modifier key;
      - `repeat` for Space;
      - a target that is editable (`input`, `textarea`, `select`, `contenteditable`);
      - for Space only, a target that Space already activates (`button`, `a[href]`, `summary`, `[role=button]`, `[role=link]`, `[role=checkbox]`…), so Tab + Space on the HUD still works.
  - `nextStop(stops, current, direction, range)`: the first stop strictly after (or before) `current` within `range`, clamped to `range`. With no stops, it moves one step (the viewport height) and is still clamped to `range`.
- **`scrollLock.ts`**: lock bookkeeping over a minimal `{ stop(): void; start(): void }` target, so it's testable with a fake.
  - Locks are **reason-keyed** (Open questions 2): `lock(reason = "default")` / `unlock(reason = "default")`.
  - The page is locked while any reason is held. It stops on the first reason and starts when the last one is released.
  - Unlocking a reason that isn't held does nothing.
  - `isLocked()` reports the state.
- **`scrollSystem.ts`**: the one shared Lenis instance and its wiring. Module scope has no side effects.
  - `installScrollSystem()` is client-only, idempotent, and returns an uninstall function. It:
    - registers ScrollTrigger (`gsap.registerPlugin(ScrollTrigger)`);
    - creates `new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, respectReducedMotion: true })`;
    - connects `lenis.on("scroll", ScrollTrigger.update)`;
    - adds one stable `gsap.ticker` listener `(time) => lenis.raf(time * 1000)`;
    - adds one `keydown` listener on `window` that runs `keyAction`. When the page isn't locked, it calls `preventDefault()` and scrolls to the next stop with `lenis.scrollTo`.

    Uninstall reverses all of it in reverse order and calls `lenis.destroy()`.
  - `lockScroll(reason?)` / `unlockScroll(reason?)`: the TDD's API, backed by `scrollLock.ts`. Calls made before install are remembered and applied when Lenis is created.
  - `setScrollStops(provider)`: W.04 sets a function that returns `{ stops: readonly number[]; range: { start: number; end: number } }` in pixels, from the current act's shots. Default: no stops, range = the whole page (`0 … lenis.limit`).
  - `getScroll()`: the current Lenis scroll in pixels, for W.04 and the tests.
  - It doesn't call `gsap.ticker.lagSmoothing(0)` (Open questions 4).
- **`index.ts`**: re-exports `installScrollSystem`, `lockScroll`, `unlockScroll`, `isScrollLocked`, `setScrollStops`, `getScroll`.

Other files:
- **`src/app/globals.css`**: add `@import "lenis/dist/lenis.css";`. It's harmless on `/cv`, because the rules only apply under Lenis's `html.lenis` class.
- **`src/app/dev/scroll/page.tsx`** + **`ScrollSmoke.tsx`** (`"use client"`): a dev-only smoke page.
  - In production, `page.tsx` calls `notFound()` (Open questions 3).
  - The page is 5 screens tall, with a marker at each screen.
  - On mount it calls `installTimeSystem()` and `installScrollSystem()`, and both are cleaned up on unmount.
  - Buttons: **Lock**, **Unlock**, and **Slow motion** (`setTimeScale(0.05)`).
  - A `scrub: true` ScrollTrigger over the page writes its progress to `data-progress`.
  - A status element shows `data-scroll` (rounded px) and `data-locked`. Status text updates on Lenis `scroll` events (not per frame), so React state isn't set per frame.
  - No 3D and no `<Canvas>`.
- **`playwright.config.ts`**: the minimum the smoke test needs (Open questions 3):
  - `webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true }`;
  - `use: { baseURL: "http://localhost:3000" }`;
  - one `chromium` project.

  F.4/W.03 still adds the viewport, parity and other settings.
- **`package.json`**: remove `--pass-with-no-tests` from `test:e2e`, now that the first e2e spec exists. `docs/progress.md` lists this ("Remove `--pass-with-no-tests` … once the first e2e spec exists"). Check `tests/unit/foundation.test.ts`'s script assertions still pass.

## VFX
None.

## Content
None.

## Accessibility and fallbacks
- **Keyboard path:** Space / Arrow Down advance and Arrow Up goes back, as in tdd › 5. Page Up, Page Down, Home and End keep the browser's default (Lenis follows the native scroll).
- **Keys aren't stolen:** typing in inputs, Space on a focused button or link, and key combinations with modifiers all behave natively.
- **Reduced motion:** Lenis's `respectReducedMotion` (default true) turns smoothing off and makes `scrollTo` instant, so keyboard advance jumps instead of gliding.
- **Mobile:** `syncTouch: false`, so touch scrolling is native. Lenis's wheel smoothing doesn't apply to touch.
- **When locked:** `.lenis-stopped` sets `overflow: clip`, so the wheel, touch, scrollbar and native keys can't move the page, and the advance keys do nothing. This lets the input system (W.07) use Space for hold gates while the page is locked.
- No flashing; nothing visual beyond the dev page.

## Budgets
- No assets or rendering.
- Per frame: one `lenis.raf` call on `gsap.ticker`, and `ScrollTrigger.update` only on scroll events. No allocations added by this code in either; Lenis and ScrollTrigger internals are theirs.
- No React state per frame. The dev page updates its status from Lenis `scroll` events, never from `useFrame` or rAF.

## Files to change / Files to create

**Create**
- `src/experience/systems/scroll/keys.ts`: pure key → action mapping and next/previous stop math.
- `src/experience/systems/scroll/scrollLock.ts`: reason-keyed lock over a `{ stop, start }` target.
- `src/experience/systems/scroll/scrollSystem.ts`: Lenis + ScrollTrigger + ticker + keyboard wiring; `installScrollSystem`, `lockScroll`, `unlockScroll`, `isScrollLocked`, `setScrollStops`, `getScroll`.
- `src/experience/systems/scroll/index.ts`: public exports.
- `src/app/dev/scroll/page.tsx`: dev-only route (404 in production).
- `src/app/dev/scroll/ScrollSmoke.tsx`: client smoke page.
- `tests/unit/scroll.test.ts`: key mapping, stop math, lock bookkeeping, install/uninstall with fakes.
- `tests/e2e/scroll.spec.ts`: Playwright smoke test.

**Change**
- `src/app/globals.css`: import Lenis CSS.
- `playwright.config.ts`: `webServer`, `baseURL`, chromium project.
- `package.json`: `test:e2e` without `--pass-with-no-tests`.
- `docs/progress.md`: at ship time (remove the resolved `--pass-with-no-tests` note).

## New dependencies
No new dependencies. The Playwright chromium browser is a download, not a package (Open questions 6).

## Rules for implementation
- TypeScript strict, no `any`; no act code.
- `keys.ts` and `scrollLock.ts` import no DOM globals, Lenis or GSAP.
- `scrollSystem.ts`:
  - module scope is side-effect free (no `window` access at import);
  - `installScrollSystem` is idempotent and StrictMode-safe (install → cleanup → install leaves one Lenis, one ticker listener and one keydown listener).
- No React `setState` per frame; the scroll system writes nothing to the store. `actProgress` is the Director's job (W.04).
- Don't change `gsap.ticker.lagSmoothing`.
- ScrollTriggers created anywhere use `scrub: true`, never a numeric scrub (W.02 rule).
- The dev page must not be reachable in production builds.
- `/` and `src/app/layout.tsx` still don't import the 3D or animation stack (the `foundation.test.ts` guard). Only `/dev/scroll` imports Lenis and GSAP.

## Tests
Commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e`. No parity, stitch or budget tests apply.

`tests/unit/scroll.test.ts` (Vitest, node):
1. **`keyAction`:**
   - Space and Arrow Down → `next`; Arrow Up → `prev`; other keys → `null`;
   - any modifier → `null`; a repeating Space → `null`;
   - an `input` / `textarea` / `select` / contenteditable target → `null` for all three keys;
   - a `button` or `a[href]` target → `null` for Space, but arrows still work.
2. **`nextStop`:**
   - with stops: next and previous are strictly past `current`;
   - it stays at the end and start of `range` and never leaves it ("Arrow Up goes back within an act");
   - with no stops: one step of the viewport height, clamped;
   - `current` exactly on a stop moves to the following one.
3. **`scrollLock`** with a fake `{ stop, start }`:
   - one lock stops once; a second reason doesn't stop again;
   - releasing one of two reasons stays locked; releasing the last starts once;
   - unlocking an unheld reason does nothing;
   - the default reason works with no-argument calls (`lockScroll()` / `unlockScroll()`).
4. **Install/uninstall** (`lenis` mocked with `vi.mock`, `gsap.ticker.add/remove` spied, `window` stubbed):
   - installing twice creates one Lenis and adds one ticker listener and one keydown listener;
   - the ticker listener calls `lenis.raf(time × 1000)`;
   - `on("scroll", ScrollTrigger.update)` is wired;
   - uninstall removes them and calls `destroy()`;
   - a lock made before install is applied when Lenis is created.

`tests/e2e/scroll.spec.ts` (Playwright, chromium, `/dev/scroll`):
1. **Lock stops scroll, unlock resumes it:**
   - the wheel scrolls (`data-scroll` grows);
   - after **Lock**, `data-locked="true"`, and wheel and Arrow Down leave `data-scroll` unchanged;
   - after **Unlock**, the wheel scrolls again.
2. **Keyboard advance:**
   - from the top, Space moves about one screen (± a few px);
   - Arrow Down moves one more;
   - Arrow Up goes back one;
   - Arrow Up at the top stays at 0.
3. **Keys aren't stolen:** with the Lock button focused, Space activates it (`data-locked="true"`) and doesn't scroll.
4. **Scrub isn't slowed:**
   - after **Slow motion** (time scale 0.05), Arrow Down moves the page;
   - within ~1 s of the scroll settling, the `scrub: true` ScrollTrigger's `data-progress` matches the scroll position (`scroll / limit`, ± 0.02);
   - this proves scroll isn't stretched by slow motion (W.02 open issue).
5. **Reduced motion:** with `page.emulateMedia({ reducedMotion: "reduce" })`, Arrow Down lands on the next stop within one frame or two.

## Definition of done
- [ ] lock stops scroll and unlock resumes it; keyboard advance works; verified in a Playwright smoke test
- [ ] Parity ≥ 0.90 on every listed still; stitch with the previous shot has no jump: n/a (no rendering)
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green
- [ ] Within tier budgets on High and Lite: n/a (no assets)
- [ ] Verified by `mtd-test-runner` (`/test-shot F.3/W.03`); `/review-shot F.3/W.03` has no 🚧 items
- [ ] `docs/progress.md` updated; `F.3/W.03` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- **Scroll lengths per act,** one ScrollTrigger per act → `actProgress`, and shot stops and act bounds from shot data: F.3/W.04 (Director). It calls `setScrollStops`.
- **Beat lock/play/unlock and the 2× "hard scroll" rule:** F.3/W.04. Note for W.04: Lenis is stopped during a beat, so the hard-scroll signal has to come from raw `wheel`/`touchmove` events (or Lenis `virtual-scroll`, if it still fires when stopped; check). The scroll system doesn't provide it here.
- **Gates and the Space hold:** F.3/W.05 and F.3/W.07. Quick-menu jumps: F.3/W.05.
- **`Experience.tsx`:** F.3/W.04.
- **Other Playwright settings** (viewport, parity, screenshots, CI e2e): F.4/W.03. CI still doesn't run e2e; `foundation.test.ts` asserts that.

## Open questions
1. ✅ **What "advance" moves by.** (resolved 2026-11-22, director: yes, as proposed) tdd says Space/Arrow Down "advance" and Arrow Up goes back "within an act", but not by how much.
   **Proposed:** to the next/previous **stop**. W.04 sets the stops (shot starts) and the current act's bounds through `setScrollStops`. Until then, a stop is one screen height and the act is the whole page. Arrow Up never goes before the act's start.
2. ✅ **Overlapping locks.** (resolved 2026-11-22, director: yes, as proposed) A beat and a gate can overlap (1.7 is "Beat + read gate"). With a plain stop/start, the beat ending would unlock the page while the gate is still open.
   **Proposed:** reason-keyed locks (`lockScroll("beat")`, `lockScroll("gate:1.7")`). The page stays locked until every reason is released. No-argument calls use a `"default"` reason, so the TDD's `lockScroll()` / `unlockScroll()` still work.
3. ✅ **Where the smoke test runs.** (resolved 2026-11-22, director: yes, as proposed) `/` has no scroll system until `Experience.tsx` (W.04), and the `/dev/*` pages are F.4's.
   **Proposed:**
   - a small dev-only page `/dev/scroll` (404 in production via `notFound()` when `NODE_ENV === "production"`);
   - the minimum Playwright config to serve it (`webServer: pnpm dev`, `baseURL`, chromium);
   - F.4/W.03 extends that config rather than replacing it.
4. ✅ **GSAP lag smoothing.** (resolved 2026-11-22, director: yes, as proposed) Lenis's docs suggest `gsap.ticker.lagSmoothing(0)` when driving Lenis from GSAP's ticker. W.02's time system relies on GSAP's default lag smoothing, so a ramp doesn't jump to its end after the tab comes back.
   **Proposed:** keep GSAP's default (don't call `lagSmoothing(0)`). After a long hitch, Lenis just receives a capped delta and catches up over the next frames.
5. ✅ **Which keydowns to ignore.** (resolved 2026-11-22, director: yes, as proposed) **Proposed:**
   - modifier keys;
   - a repeating Space;
   - editable targets;
   - for Space only, targets Space already activates (buttons, links, summary, ARIA buttons/links/checkboxes).

   Shift+Space, Page Up/Down, Home and End stay native.
6. ✅ **Installing the Playwright browser.** (resolved 2026-11-22, director: yes, as proposed) No browser is on this machine yet. The smoke test needs `pnpm exec playwright install chromium`, which downloads about 150 MB to `~/.cache/ms-playwright`. It's a system change, not a package.
   **Proposed:** you run it once (`! pnpm exec playwright install chromium`) before `/test-shot`. CI is unchanged, because CI doesn't run e2e yet.
7. ✅ **Removing `--pass-with-no-tests`.** (resolved 2026-11-22, director: yes, as proposed) **Proposed:** yes, in this item (the first e2e spec), as `docs/progress.md` planned. `pnpm test:e2e` then fails if the e2e folder is ever empty by mistake.
