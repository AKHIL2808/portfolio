// Midnight to Dawn: pure time-scale ramp clock (F.3/W.02).
// No React, GSAP or store. The clock is one plain object, mutated in place, so
// stepping it each frame allocates nothing.

export interface TimeClock {
  scale: number; // live value
  from: number; // value the current ramp started at
  to: number; // value the current ramp ends at
  elapsed: number; // real seconds into the ramp
  duration: number; // ramp length in real seconds; 0 = idle (a ramp runs while elapsed < duration)
}

// Float sums like 30 × 0.01 land at 0.29999…; that still counts as the end of a 0.3 s ramp.
const DONE_EPSILON = 1e-9;

/** Same curve as gsap's "power1.inOut" (tests compare the two). */
export function power1InOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;
}

export function createTimeClock(initial = 1): TimeClock {
  return { scale: initial, from: initial, to: initial, elapsed: 0, duration: 0 };
}

/**
 * Starts a ramp from the current value (even mid-ramp, so there is never a jump)
 * to `to` over `seconds` of real time. No ramp, 0 or invalid seconds: instant.
 */
export function rampTo(clock: TimeClock, to: number, seconds = 0): void {
  if (!(seconds > 0) || clock.scale === to) {
    clock.scale = to;
    clock.from = to;
    clock.to = to;
    clock.elapsed = 0;
    clock.duration = 0;
    return;
  }
  clock.from = clock.scale;
  clock.to = to;
  clock.elapsed = 0;
  clock.duration = seconds;
}

/** Advances a running ramp by real seconds and returns the live value. Allocates nothing. */
export function stepClock(clock: TimeClock, realDeltaSeconds: number): number {
  if (clock.elapsed >= clock.duration || !(realDeltaSeconds > 0)) return clock.scale;
  clock.elapsed += realDeltaSeconds;
  if (clock.elapsed >= clock.duration - DONE_EPSILON) {
    clock.elapsed = clock.duration;
    clock.scale = clock.to;
  } else {
    clock.scale = clock.from + (clock.to - clock.from) * power1InOut(clock.elapsed / clock.duration);
  }
  return clock.scale;
}
