// F.3/W.02: time system. Ramp values over time, GSAP sync, useActFrame scaling,
// no allocations in the frame callback, and the store's setTimeScale wiring
// (tdd › Core systems › 4).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { RenderCallback, RootState } from "@react-three/fiber";
import { gsap } from "gsap";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useFrameMock = vi.hoisted(() => vi.fn<(cb: RenderCallback, priority?: number) => null>(() => null));
vi.mock("@react-three/fiber", () => ({ useFrame: useFrameMock }));

import { createTimeClock, power1InOut, rampTo, stepClock } from "@/experience/systems/time/clock";
import {
  getTimeScale,
  installTimeSystem,
  rampTimeScale,
  resetTimeSystem,
  tickTimeSystem,
} from "@/experience/systems/time/timeSystem";
import { useActFrame, type ActFrameCallback } from "@/experience/systems/time/useActFrame";
import { useStore } from "@/store/useStore";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string): string => readFileSync(`${root}${rel}`, "utf8");

const at = <T>(xs: readonly T[], i: number): T => {
  const x = xs[i];
  if (x === undefined) throw new Error(`no element [${i}]`);
  return x;
};

/** Registers through the hook outside React: useFrame is mocked, so nothing renders. */
function register(cb: ActFrameCallback, priority?: number): RenderCallback {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- useFrame is mocked; registers without rendering
  useActFrame(cb, priority);
  const frame = useFrameMock.mock.calls.at(-1)?.[0];
  if (!frame) throw new Error("useFrame was not called");
  return frame;
}

/** The listener the time system passed to gsap.ticker.add. */
function tickerListener(add: { mock: { calls: Parameters<typeof gsap.ticker.add>[] } }) {
  const listener = add.mock.calls[0]?.[0];
  if (typeof listener !== "function") throw new Error("gsap.ticker.add was not called with a listener");
  return listener;
}

const state = {} as RootState;

beforeEach(() => {
  resetTimeSystem();
  useStore.setState(useStore.getInitialState(), true);
  useFrameMock.mockClear();
});

afterEach(() => {
  resetTimeSystem();
  vi.restoreAllMocks();
});

describe("clock: ramp values over time", () => {
  it("ramps 1 → 0.05 over 0.3 s, monotonically, ending exactly on 0.05", () => {
    const c = createTimeClock(1);
    rampTo(c, 0.05, 0.3);
    let prev = 1;
    for (let i = 1; i <= 30; i++) {
      const v = stepClock(c, 0.01);
      if (i < 30) {
        expect(v, `step ${i}`).toBeLessThan(prev);
        expect(v).toBeGreaterThan(0.05);
        expect(v).toBeLessThan(1);
      }
      prev = v;
    }
    expect(c.scale).toBe(0.05);
    for (let i = 0; i < 10; i++) stepClock(c, 0.01);
    expect(c.scale).toBe(0.05);
  });

  it("is at the midpoint halfway through (power1.inOut at 0.5)", () => {
    const c = createTimeClock(1);
    rampTo(c, 0.05, 0.3);
    expect(stepClock(c, 0.15)).toBeCloseTo(0.525, 12);
  });

  it.each([0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1])("power1InOut(%s) matches gsap's power1.inOut", (t) => {
    expect(power1InOut(t)).toBeCloseTo(gsap.parseEase("power1.inOut")(t), 12);
  });

  it.each([
    ["no ramp", undefined],
    ["0 s", 0],
    ["negative seconds", -1],
  ])("is instant with %s", (_name, seconds) => {
    const c = createTimeClock(1);
    rampTo(c, 0.2, seconds);
    expect(c.scale).toBe(0.2);
    expect(stepClock(c, 0.1)).toBe(0.2);
  });

  it("retargeting mid-ramp starts from the current value, with no jump", () => {
    const c = createTimeClock(1);
    rampTo(c, 0.05, 0.3);
    let prev = 1;
    let maxJump = 0;
    for (let i = 0; i < 15; i++) {
      const v = stepClock(c, 0.01);
      maxJump = Math.max(maxJump, Math.abs(v - prev));
      prev = v;
    }
    const mid = c.scale;
    rampTo(c, 1, 0.4);
    expect(c.scale).toBe(mid);
    expect(c.from).toBe(mid);
    for (let i = 0; i < 40; i++) {
      const v = stepClock(c, 0.01);
      maxJump = Math.max(maxJump, Math.abs(v - prev));
      prev = v;
    }
    expect(c.scale).toBe(1);
    // The steepest step of either ramp: 0.95 or (1 − mid) over 0.3 / 0.4 s at 100 steps/s.
    expect(maxJump).toBeLessThan(0.07);
  });

  it("a step past the end of the ramp lands exactly on the target", () => {
    const c = createTimeClock(1);
    rampTo(c, 0.05, 0.3);
    stepClock(c, 0.1);
    expect(stepClock(c, 5)).toBe(0.05);
    expect(c.scale).toBe(0.05);
  });
});

describe("time system: GSAP sync", () => {
  it("installs one gsap.ticker listener, and uninstall removes it", () => {
    const add = vi.spyOn(gsap.ticker, "add");
    const remove = vi.spyOn(gsap.ticker, "remove");
    const uninstall = installTimeSystem();
    installTimeSystem();
    expect(add).toHaveBeenCalledOnce();
    const listener = tickerListener(add);
    remove.mockClear(); // gsap.ticker.add calls remove itself to avoid duplicates
    uninstall();
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(listener);
    uninstall();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("the ticker listener converts the ticker's ms delta to seconds", () => {
    const add = vi.spyOn(gsap.ticker, "add");
    installTimeSystem();
    const listener = tickerListener(add);
    rampTimeScale(0.05, 0.3);
    listener(0, 150, 1, 0);
    expect(getTimeScale()).toBeCloseTo(0.525, 12);
  });

  it("gsap.globalTimeline.timeScale() equals the live value at every step of a ramp and after it", () => {
    rampTimeScale(0.05, 0.3);
    for (let i = 0; i < 30; i++) {
      tickTimeSystem(1 / 60);
      expect(gsap.globalTimeline.timeScale(), `tick ${i}`).toBe(getTimeScale());
    }
    expect(getTimeScale()).toBe(0.05);
    expect(gsap.globalTimeline.timeScale()).toBe(0.05);
  });

  it("an instant change reaches GSAP before any tick", () => {
    rampTimeScale(0.2);
    expect(getTimeScale()).toBe(0.2);
    expect(gsap.globalTimeline.timeScale()).toBe(0.2);
  });

  it("doesn't touch GSAP while idle", () => {
    const spy = vi.spyOn(gsap.globalTimeline, "timeScale");
    for (let i = 0; i < 10; i++) tickTimeSystem(1 / 60);
    expect(spy).not.toHaveBeenCalled();
  });

  it("tweens on the global timeline run at the scaled rate", () => {
    gsap.ticker.remove(gsap.updateRoot);
    const target = { x: 0 };
    const tween = gsap.to(target, { x: 1, duration: 10, ease: "none" });
    try {
      // Measure progress differences inside one constant-scale stretch: changing the
      // global time scale re-anchors the root, so absolute positions aren't comparable.
      const rate = (scale: number): number => {
        rampTimeScale(scale);
        const base = gsap.ticker.time + 5;
        gsap.updateRoot(base);
        const p1 = tween.progress();
        gsap.updateRoot(base + 1);
        return (tween.progress() - p1) * tween.duration();
      };
      expect(rate(0.5)).toBeCloseTo(0.5, 6);
      expect(rate(1)).toBeCloseTo(1, 6);
    } finally {
      tween.kill();
      gsap.ticker.add(gsap.updateRoot);
    }
  });
});

describe("useActFrame", () => {
  it("passes (state, delta × live scale, delta) with the same state object", () => {
    const cb = vi.fn<ActFrameCallback>();
    const frame = register(cb, 2);
    expect(useFrameMock).toHaveBeenCalledOnce();
    expect(at(at(useFrameMock.mock.calls, 0), 1)).toBe(2);
    rampTimeScale(0.5);
    frame(state, 0.016);
    expect(cb).toHaveBeenCalledWith(state, 0.008, 0.016);
    expect(at(at(cb.mock.calls, 0), 0)).toBe(state);
  });

  it("scaledDelta equals delta at time scale 1", () => {
    const cb = vi.fn<ActFrameCallback>();
    register(cb)(state, 0.016);
    const [, scaledDelta, delta] = at(cb.mock.calls, 0);
    expect(scaledDelta).toBe(delta);
  });

  it("passes no render priority through as undefined", () => {
    register(vi.fn<ActFrameCallback>());
    const call = at(useFrameMock.mock.calls, 0);
    expect(call).toHaveLength(2);
    expect(call[1]).toBeUndefined();
  });

  it("uses the live value, not the store's target", () => {
    const cb = vi.fn<ActFrameCallback>();
    const frame = register(cb);
    useStore.getState().setTimeScale(0.05, 0.3);
    frame(state, 0.016);
    expect(cb).toHaveBeenCalledWith(state, 0.016, 0.016);
  });
});

describe("no allocations in the frame callback (structure)", () => {
  /** The text of `export function <name>(` up to the next line that is exactly `}`. */
  const body = (source: string, name: string): string => {
    const start = source.indexOf(`export function ${name}(`);
    expect(start, `${name} not found`).toBeGreaterThanOrEqual(0);
    const end = source.indexOf("\n}\n", start);
    return source.slice(start, end + 2);
  };
  const expectNoAllocation = (code: string, label: string): void => {
    const inner = code.slice(code.indexOf(")"));
    expect(inner, `${label}: new`).not.toMatch(/\bnew\s/);
    expect(inner, `${label}: array literal or index`).not.toContain("[");
    expect(inner, `${label}: object literal`).not.toMatch(/(?:[=(,:?]|return)\s*\{/);
    expect(inner, `${label}: nested function`).not.toMatch(/\bfunction\b/);
  };

  it("the frame function returns nothing and is registered once per call", () => {
    const frame = register(vi.fn<ActFrameCallback>());
    expect(useFrameMock).toHaveBeenCalledOnce();
    expect(frame(state, 0.016)).toBeUndefined();
  });

  it("useActFrame's frame function is one arrow with no allocation", () => {
    const source = read("src/experience/systems/time/useActFrame.ts");
    const start = source.indexOf("useFrame(");
    const end = source.indexOf(", renderPriority);", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const frame = source.slice(start + "useFrame(".length, end);
    expect(frame.match(/=>/g)).toHaveLength(1);
    expect(frame).not.toContain("{");
    expectNoAllocation(frame, "useActFrame frame");
  });

  it.each(["stepClock", "power1InOut"])("clock.ts %s allocates nothing", (name) => {
    const code = body(read("src/experience/systems/time/clock.ts"), name);
    expect(code).not.toContain("=>");
    expectNoAllocation(code, name);
  });

  it("clock.ts imports nothing from React, GSAP or the store", () => {
    expect(read("src/experience/systems/time/clock.ts")).not.toMatch(/^\s*import\b[^\n]*(react|gsap|store|three)/im);
  });
});

describe("store setTimeScale wiring", () => {
  it("sets the target at once and ramps the live value in real time", () => {
    useStore.getState().setTimeScale(0.05, 0.3);
    expect(useStore.getState().timeScale).toBe(0.05);
    expect(getTimeScale()).toBe(1);
    expect(gsap.globalTimeline.timeScale()).toBe(1);
    tickTimeSystem(0.15);
    expect(getTimeScale()).toBeCloseTo(0.525, 12);
    tickTimeSystem(0.15);
    expect(getTimeScale()).toBe(0.05);
    expect(gsap.globalTimeline.timeScale()).toBe(0.05);
  });

  it("without a ramp, the live value changes at once", () => {
    useStore.getState().setTimeScale(0.2);
    expect(useStore.getState().timeScale).toBe(0.2);
    expect(getTimeScale()).toBe(0.2);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("an invalid ramp (%s) changes nothing and logs once", (ramp) => {
    useStore.getState().setTimeScale(0.5);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    useStore.getState().setTimeScale(0.2, ramp);
    expect(useStore.getState().timeScale).toBe(0.5);
    expect(getTimeScale()).toBe(0.5);
    expect(error).toHaveBeenCalledOnce();
  });

  it.each([Number.NaN, -0.5])("an invalid target (%s) changes nothing and logs once", (to) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    useStore.getState().setTimeScale(to, 0.3);
    expect(useStore.getState().timeScale).toBe(1);
    expect(getTimeScale()).toBe(1);
    expect(error).toHaveBeenCalledOnce();
  });

  it("retargeting through the store mid-ramp keeps GSAP and the live value continuous", () => {
    useStore.getState().setTimeScale(0.05, 0.3);
    tickTimeSystem(0.15);
    const mid = getTimeScale();
    useStore.getState().setTimeScale(1, 0.4);
    expect(getTimeScale()).toBe(mid);
    expect(useStore.getState().timeScale).toBe(1);
    let prev = mid;
    for (let i = 0; i < 40; i++) {
      tickTimeSystem(0.01);
      expect(getTimeScale()).toBeGreaterThanOrEqual(prev);
      expect(gsap.globalTimeline.timeScale()).toBe(getTimeScale());
      prev = getTimeScale();
    }
    expect(getTimeScale()).toBe(1);
  });

  it("writes the store once per call, never per tick", () => {
    const listener = vi.fn();
    const unsubscribe = useStore.subscribe(listener);
    useStore.getState().setTimeScale(0.05, 0.3);
    expect(listener).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 30; i++) tickTimeSystem(0.01);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("an invalid target with a valid ramp changes nothing and logs once", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    useStore.getState().setTimeScale(0, 0.3);
    tickTimeSystem(0.3);
    expect(useStore.getState().timeScale).toBe(1);
    expect(getTimeScale()).toBe(1);
    expect(error).toHaveBeenCalledOnce();
  });
});

describe("time system: module surface", () => {
  it("index re-exports useActFrame, getTimeScale and installTimeSystem", async () => {
    const mod = await import("@/experience/systems/time");
    expect(mod.useActFrame).toBe(useActFrame);
    expect(mod.getTimeScale).toBe(getTimeScale);
    expect(mod.installTimeSystem).toBe(installTimeSystem);
  });

  it("importing the module does not touch gsap.ticker", async () => {
    vi.resetModules();
    const add = vi.spyOn(gsap.ticker, "add");
    await import("@/experience/systems/time/timeSystem");
    expect(add).not.toHaveBeenCalled();
  });

  it("the time system never writes actProgress", () => {
    const before = useStore.getState().actProgress;
    useStore.getState().setTimeScale(0.05, 0.3);
    for (let i = 0; i < 30; i++) tickTimeSystem(0.01);
    expect(useStore.getState().actProgress).toBe(before);
  });
});
