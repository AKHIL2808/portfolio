// Midnight to Dawn: Director data types (F.3/W.01, tdd › Core systems › 1, 2).
// Shot types are inferred from the zod schemas so the types and the validator can't drift apart.
import type { ComponentType } from "react";
import type { z } from "zod";
import type {
  ActIdSchema,
  CameraKeySchema,
  GateSchema,
  MarkerSchema,
  ShotEventSchema,
  ShotFileSchema,
  ShotSchema,
  STORY_ACT_IDS,
} from "@/lib/schemas";

export type StoryActId = (typeof STORY_ACT_IDS)[number];
/** `act0`–`act7` plus the dev-only `test` act. */
export type ActId = z.infer<typeof ActIdSchema>;
export type CameraKey = z.infer<typeof CameraKeySchema>;
export type ShotEvent = z.infer<typeof ShotEventSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type Gate = z.infer<typeof GateSchema>;
export type Marker = z.infer<typeof MarkerSchema>;
export type ShotFile = z.infer<typeof ShotFileSchema>;

/** Files an act preloads, as URLs under public/. Placeholder until the asset manager (F.3/W.09). */
export interface AssetManifest {
  models: readonly string[];
  textures: readonly string[];
  vat: readonly string[];
  audio: readonly string[];
}

export interface ActModule {
  id: ActId;
  menuLabel: string; // "Home", "About", "Skills"…
  shots: Shot[]; // loaded from shots/<act>.json
  Scene: ComponentType; // the act's 3D content
  assets: AssetManifest; // files to preload
  onEnter?: () => void;
  onExit?: () => void;
}
