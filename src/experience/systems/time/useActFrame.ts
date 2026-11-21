// Midnight to Dawn: the scaled frame hook (F.3/W.02, tdd › Core systems › 4).
// Every animated scene thing uses this instead of useFrame, so slow motion reaches it.
// `delta` (third argument) is real time, for the few things the plan keeps unslowed
// (e.g. 1.7 StrokeReveal); code that uses it says why in a comment.
import { useFrame, type RootState } from "@react-three/fiber";
import { getTimeScale } from "./timeSystem";

export type ActFrameCallback = (state: RootState, scaledDelta: number, delta: number) => void;

export function useActFrame(callback: ActFrameCallback, renderPriority?: number): void {
  // One closure per render (R3F keeps the latest in a ref); the frame body allocates nothing.
  useFrame((state, delta) => callback(state, delta * getTimeScale(), delta), renderPriority);
}
