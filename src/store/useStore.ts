// Midnight to Dawn: global app state (F.3/W.01, tdd › Core systems › 10).
// Frame-loop code reads useStore.getState() (no re-render); DOM overlays use selectors.
// No per-frame setters live here.
import { create } from "zustand";
import type { ActId } from "@/experience/director/types";
// Not the barrel: that would pull R3F and three into the store.
import { rampTimeScale } from "@/experience/systems/time/timeSystem";

export interface AppState {
  actId: ActId;
  actProgress: number; // 0..1
  timeScale: number; // target: 1 = normal, 0.05 = deep slow motion (live value: getTimeScale())
  quality: "high" | "medium" | "lite";
  muted: boolean;
  reducedMotion: boolean;
  gates: Record<string, "pending" | "done">;
  visitedPillars: string[];
  defeatedRanks: string[];
  // actions
  goToAct: (id: ActId) => void;
  setTimeScale: (to: number, rampSeconds?: number) => void;
  resolveGate: (id: string) => void;
}

export const useStore = create<AppState>()((set) => ({
  actId: "act0",
  actProgress: 0,
  timeScale: 1,
  quality: "high", // F.3/W.10 sets the detect-gpu tier at startup
  muted: false, // F.3/W.08 restores it from localStorage
  reducedMotion: false,
  gates: {},
  visitedPillars: [],
  defeatedRanks: [],

  // Only the Director calls this. Wipes, mounting and loading are F.3/W.05.
  goToAct: (id) => set({ actId: id, actProgress: 0 }),

  // The store holds the TARGET, written once per call; the time system ramps the live
  // value (and GSAP) over rampSeconds of real time. Frame code reads getTimeScale().
  setTimeScale: (to, rampSeconds) => {
    const badRamp = rampSeconds !== undefined && (!Number.isFinite(rampSeconds) || rampSeconds < 0);
    if (!Number.isFinite(to) || to <= 0 || badRamp) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`setTimeScale: invalid value ${to} (ramp ${rampSeconds}), ignored`);
      }
      return;
    }
    set({ timeScale: to });
    rampTimeScale(to, rampSeconds);
  },

  // A new object, so selectors on `gates` fire.
  resolveGate: (id) => set((s) => ({ gates: { ...s.gates, [id]: "done" } })),
}));
