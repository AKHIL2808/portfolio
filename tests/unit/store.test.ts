// F.3/W.01: Zustand store (tdd › Core systems › 10): initial state and the three actions.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/store/useStore";

beforeEach(() => {
  useStore.setState(useStore.getInitialState(), true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useStore", () => {
  it("starts with the TDD's initial state", () => {
    expect(useStore.getState()).toMatchObject({
      actId: "act0",
      actProgress: 0,
      timeScale: 1,
      quality: "high",
      muted: false,
      reducedMotion: false,
      gates: {},
      visitedPillars: [],
      defeatedRanks: [],
    });
  });

  it("goToAct sets the act and resets its progress", () => {
    useStore.setState({ actProgress: 0.7 });
    useStore.getState().goToAct("act3");
    expect(useStore.getState()).toMatchObject({ actId: "act3", actProgress: 0 });
    useStore.getState().goToAct("test");
    expect(useStore.getState().actId).toBe("test");
  });

  it.each([0.05, 1, 2])("setTimeScale(%s) sets the value", (to) => {
    useStore.getState().setTimeScale(to);
    expect(useStore.getState().timeScale).toBe(to);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("setTimeScale(%s) is ignored with an error", (to) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    useStore.getState().setTimeScale(0.5);
    useStore.getState().setTimeScale(to);
    expect(useStore.getState().timeScale).toBe(0.5);
    expect(error).toHaveBeenCalledOnce();
  });

  it("resolveGate marks the gate done with a new gates object", () => {
    const before = useStore.getState().gates;
    useStore.getState().resolveGate("g1");
    const after = useStore.getState().gates;
    expect(after).toEqual({ g1: "done" });
    expect(after).not.toBe(before);
    expect(before).toEqual({});
  });

  it("setTimeScale(to, ramp) accepts the optional ramp argument", () => {
    useStore.getState().setTimeScale(0.05, 0.3);
    expect(useStore.getState().timeScale).toBe(0.05);
  });

  it("resolveGate keeps earlier gates and replaces the object each time", () => {
    useStore.getState().resolveGate("a");
    const mid = useStore.getState().gates;
    useStore.getState().resolveGate("b");
    expect(useStore.getState().gates).toEqual({ a: "done", b: "done" });
    expect(useStore.getState().gates).not.toBe(mid);
    expect(mid).toEqual({ a: "done" });
  });

  it("has no fields beyond the TDD list and the three actions", () => {
    expect(Object.keys(useStore.getState()).sort()).toEqual(
      [
        "actId", "actProgress", "timeScale", "quality", "muted", "reducedMotion", "gates",
        "visitedPillars", "defeatedRanks", "goToAct", "setTimeScale", "resolveGate",
      ].sort(),
    );
  });

  it("resets between tests (no gate leaks from the previous test)", () => {
    expect(useStore.getState().gates).toEqual({});
  });
});
