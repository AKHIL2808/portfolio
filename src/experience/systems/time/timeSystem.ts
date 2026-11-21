// Midnight to Dawn: the time system (F.3/W.02, tdd › Core systems › 4).
// One shared time-scale clock, stepped on gsap.ticker in real time, with
// gsap.globalTimeline.timeScale() kept equal to it so beat timelines slow down too.
//
// Rules for everything built on top of this:
// - Animate scene things with useActFrame, never useFrame with raw delta. Real-time
//   exceptions (1.7 StrokeReveal) use useActFrame's third argument and say so in a comment.
// - Frame code reads the live value with getTimeScale(). useStore.getState().timeScale
//   is the target, which differs from the live value during a ramp.
// - Scrub shots: the camera follows scroll progress directly. ScrollTrigger uses
//   `scrub: true` (Lenis does the smoothing on gsap.ticker, which isn't scaled), never a
//   numeric scrub: that creates a global-timeline tween that slow motion would stretch.
// - GSAP is for scene and beat animation; anything on the global timeline slows with the
//   scene. Things that must keep real time don't use GSAP tweens: this ramp (stepped from
//   the ticker), gate auto-resolve timers (setTimeout), HUD/overlay transitions such as
//   the ink wipe, reduced-motion crossfades and the menu (CSS transitions).
import { gsap } from "gsap";
import { createTimeClock, rampTo, stepClock } from "./clock";

// Plain module state: importing this file doesn't touch gsap.ticker.
const clock = createTimeClock(1);
let synced = 1; // last value pushed to gsap.globalTimeline
let installed = false;

function syncGsap(): void {
  if (clock.scale !== synced) {
    synced = clock.scale;
    gsap.globalTimeline.timeScale(synced);
  }
}

/** The live time scale (moves during a ramp). */
export function getTimeScale(): number {
  return clock.scale;
}

/** Ramps to `to` over `seconds` of real time (instant without). Inputs are validated by the store action. */
export function rampTimeScale(to: number, seconds?: number): void {
  rampTo(clock, to, seconds);
  syncGsap(); // an instant change reaches GSAP now, before the next tick
}

/** One step of the time system: advance the ramp and keep GSAP in sync. */
export function tickTimeSystem(realDeltaSeconds: number): void {
  stepClock(clock, realDeltaSeconds);
  syncGsap();
}

// Stable reference, so gsap.ticker.remove works. deltaTime is in ms (already lag-smoothed by GSAP).
const onTick = (_time: number, deltaTimeMs: number): void => {
  tickTimeSystem(deltaTimeMs / 1000);
};

function uninstallTimeSystem(): void {
  if (!installed) return;
  gsap.ticker.remove(onTick);
  installed = false;
}

/**
 * Starts stepping the clock on gsap.ticker. Idempotent; returns the uninstall function.
 * No reference count: any uninstall removes the one listener, which matches React
 * StrictMode's install → cleanup → install.
 */
export function installTimeSystem(): () => void {
  if (!installed) {
    gsap.ticker.add(onTick);
    installed = true;
  }
  return uninstallTimeSystem;
}

/** Tests only: uninstall and return to scale 1, GSAP included. */
export function resetTimeSystem(): void {
  uninstallTimeSystem();
  rampTo(clock, 1, 0);
  synced = 1;
  gsap.globalTimeline.timeScale(1);
}
