// Midnight to Dawn: the scroll system (F.3/W.03, tdd › Core systems › 5, › Mobile).
// One shared Lenis instance drives ScrollTrigger (lenis.on("scroll", ScrollTrigger.update))
// and runs on gsap.ticker, the same clock as the time system.
//
// Rules for everything built on top of this:
// - Module scope is side-effect free: Lenis is only constructed in installScrollSystem().
// - Lenis gets the ticker's real time, so slow motion never slows scrolling.
// - gsap.ticker.lagSmoothing is left at GSAP's default (the time system relies on it).
// - ScrollTriggers use `scrub: true`, never a numeric scrub (see systems/time/timeSystem.ts).
// - Touch stays native (syncTouch: false); Lenis drops smoothing for prefers-reduced-motion.
// - Keyboard advance starts from lenis.targetScroll, so a second press mid-glide re-targets
//   the same stop and a held Arrow Down steps one stop per arrival instead of racing.
// - Nothing here writes to the store: actProgress is the Director's job (W.04).
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { keyAction, nextStop, type ScrollRange } from "./keys";
import { createScrollLock } from "./scrollLock";

export interface ScrollStops {
  stops: readonly number[]; // px, e.g. the current act's shot starts
  range: ScrollRange; // px, the current act's bounds
}
export type ScrollStopsProvider = () => ScrollStops;

const lock = createScrollLock();
const NO_STOPS: readonly number[] = [];
let lenis: Lenis | null = null;
let offScroll: (() => void) | null = null;
let provider: ScrollStopsProvider | null = null; // null: one screen per stop, whole page

// Stable references, so the ticker and window listeners can be removed.
const onTick = (time: number): void => {
  lenis?.raf(time * 1000); // ticker time is real seconds; Lenis wants ms
};

const onKeyDown = (e: KeyboardEvent): void => {
  const current = lenis;
  if (!current) return;
  const action = keyAction(e);
  // Locked: do nothing (and don't swallow the key: the input system may want Space).
  if (action === null || lock.isLocked() || current.isStopped) return;
  e.preventDefault();
  const { stops, range } = provider ? provider() : { stops: NO_STOPS, range: { start: 0, end: current.limit } };
  current.scrollTo(nextStop(stops, current.targetScroll, action, range, window.innerHeight));
};

function uninstallScrollSystem(): void {
  if (!lenis) return;
  window.removeEventListener("keydown", onKeyDown);
  gsap.ticker.remove(onTick);
  lock.detach();
  offScroll?.();
  offScroll = null;
  lenis.destroy();
  lenis = null;
}

/**
 * Creates Lenis and wires it to ScrollTrigger, gsap.ticker and the keyboard. Client only.
 * Idempotent; returns the uninstall function (StrictMode-safe: install → cleanup → install).
 */
export function installScrollSystem(): () => void {
  if (!lenis) {
    gsap.registerPlugin(ScrollTrigger);
    lenis = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, respectReducedMotion: true });
    offScroll = lenis.on("scroll", ScrollTrigger.update);
    lock.attach(lenis);
    gsap.ticker.add(onTick);
    window.addEventListener("keydown", onKeyDown);
  }
  return uninstallScrollSystem;
}

/** Stops scrolling (wheel, touch, keys) until every reason is released. */
export function lockScroll(reason?: string): void {
  lock.lock(reason);
}

export function unlockScroll(reason?: string): void {
  lock.unlock(reason);
}

export function isScrollLocked(): boolean {
  return lock.isLocked();
}

/** The Director (W.04) supplies the current act's stops and bounds; null restores the default. */
export function setScrollStops(next: ScrollStopsProvider | null): void {
  provider = next;
}

/** Current scroll position in px (0 before install). */
export function getScroll(): number {
  return lenis?.scroll ?? 0;
}

/** Tests only: uninstall, release every lock and restore the default stops. */
export function resetScrollSystem(): void {
  uninstallScrollSystem();
  lock.reset();
  provider = null;
}
