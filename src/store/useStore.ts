// Midnight to Dawn: global app state (F.3/W.01, tdd › Core systems › 10).
// Frame-loop code reads useStore.getState() (no re-render); DOM overlays use selectors.
// No per-frame setters live here.
import { create } from "zustand";
import type { ActId } from "@/experience/director/types";

export interface AppState {
  actId: ActId;
  actProgress: number; // 0..1
  timeScale: number; // 1 = normal, 0.05 = deep slow motion
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

  // Sets the value at once. F.3/W.02 replaces the body with the ramp tween and
  // GSAP sync, keeping the signature.
  setTimeScale: (to) => {
    if (!Number.isFinite(to) || to <= 0) {
      if (process.env.NODE_ENV !== "production") console.error(`setTimeScale: invalid value ${to}, ignored`);
      return;
    }
    set({ timeScale: to });
  },

  // A new object, so selectors on `gates` fire.
  resolveGate: (id) => set((s) => ({ gates: { ...s.gates, [id]: "done" } })),
}));
