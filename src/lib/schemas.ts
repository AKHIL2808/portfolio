// Midnight to Dawn: shared zod schemas (F.3/W.01).
// Imports only zod, so /cv and /api/contact can use this file without the 3D stack.
// The shot-file rules mirror blender/scripts/export_shots.py (TOP_KEYS, SHOT_KEYS, EASES):
// shots/<act>.json is the only path for camera work from Blender into the browser.
import { z } from "zod";

export const STORY_ACT_IDS = ["act0", "act1", "act2", "act3", "act4", "act5", "act6", "act7"] as const;
/** Story acts plus the dev-only test act (shots/test.json). */
export const ACT_IDS = [...STORY_ACT_IDS, "test"] as const;
export const ActIdSchema = z.enum(ACT_IDS);

/**
 * Cue registry: the only names a `sound` event may use.
 * Each act's web item adds the cues its sound events use, in the same PR;
 * the audio sprite (F.3/W.08) must cover every name here.
 */
export const CUE_NAMES = ["taiko", "taiko-double"] as const;

/** export_shots.py EASES: LINEAR → "none", CONSTANT → "steps(1)", BEZIER → "power1.inOut". */
export const CAMERA_EASES = ["none", "steps(1)", "power1.inOut"] as const;

// z.number() already rejects NaN and ±Infinity in zod 4.
const unit = z.number().min(0).max(1);
const id = z.string().min(1);

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const CameraKeySchema = z.strictObject({
  t: unit, // 0..1 within the shot
  pos: Vec3Schema, // Y-up, meters
  target: Vec3Schema, // point the camera looks at
  fov: z.number().gt(0).lt(180), // vertical, degrees
  roll: z.number(), // degrees
  focus: z.number().positive(), // focus distance, meters
  ease: z.enum(CAMERA_EASES).optional(), // ease to the next key; absent on the last key
});

/** At least 2 keys; `t` strictly increasing from exactly 0 to exactly 1. */
const CameraKeysSchema = z
  .array(CameraKeySchema)
  .min(2)
  .superRefine((keys, ctx) => {
    keys.forEach((key, j) => {
      const prev = j > 0 ? keys[j - 1] : undefined;
      if (j === 0 && key.t !== 0) {
        ctx.addIssue({ code: "custom", path: [j, "t"], message: `first key must have t = 0, got ${key.t}` });
      }
      if (prev && key.t <= prev.t) {
        ctx.addIssue({
          code: "custom",
          path: [j, "t"],
          message: `keys must be strictly increasing in t (${prev.t} then ${key.t})`,
        });
      }
    });
    const last = keys.length - 1;
    const lastKey = keys[last];
    if (lastKey && last > 0 && lastKey.t !== 1) {
      ctx.addIssue({ code: "custom", path: [last, "t"], message: `last key must have t = 1, got ${lastKey.t}` });
    }
  });

/** Free-form payload until the title-card, shake and custom systems define theirs. */
const AnyPayload = z.record(z.string(), z.unknown());

export const ShotEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ t: unit, type: z.literal("sound"), payload: z.strictObject({ cue: z.enum(CUE_NAMES) }) }),
  z.strictObject({ t: unit, type: z.literal("gate"), payload: z.strictObject({ id }) }),
  z.strictObject({
    t: unit,
    type: z.literal("timeScale"),
    payload: z.strictObject({ to: z.number().gt(0).max(1), ramp: z.number().min(0).optional() }),
  }),
  z.strictObject({ t: unit, type: z.enum(["title", "shake", "custom"]), payload: AnyPayload }),
]);

const shotBase = {
  id,
  camera: z.enum(["main", "pov"]),
  keys: CameraKeysSchema,
  events: z.array(ShotEventSchema),
};

export const ShotSchema = z.discriminatedUnion("mode", [
  z.strictObject({ ...shotBase, mode: z.literal("scrub"), scrollLength: z.number().positive() }), // screen heights
  z.strictObject({ ...shotBase, mode: z.literal("beat"), duration: z.number().positive() }), // seconds
]);

const autoResolveMs = z.number().positive().nullable(); // null = the visitor must act

export const GateSchema = z.discriminatedUnion("kind", [
  z.strictObject({ id, kind: z.literal("hold"), holdMs: z.number().positive(), autoResolveMs }),
  z.strictObject({ id, kind: z.enum(["swipe", "click", "read"]), autoResolveMs }),
]);

/** A named point inside a shot (hand-off markers, clash cuts); always replaced from Blender. */
export const MarkerSchema = z.strictObject({ id, shot: id, t: unit });

export const ShotFileSchema = z
  .strictObject({
    act: ActIdSchema,
    fps: z.literal(30),
    shots: z.array(ShotSchema).min(1),
    markers: z.array(MarkerSchema),
    gates: z.array(GateSchema),
  })
  .superRefine((file, ctx) => {
    const issue = (path: (string | number)[], message: string): void => {
      ctx.addIssue({ code: "custom", path, message });
    };
    const shotIds = new Set<string>();
    file.shots.forEach((shot, i) => {
      if (shotIds.has(shot.id)) issue(["shots", i, "id"], `duplicate shot id "${shot.id}"`);
      shotIds.add(shot.id);
    });
    const gateIds = new Set<string>();
    file.gates.forEach((gate, i) => {
      if (gateIds.has(gate.id)) issue(["gates", i, "id"], `duplicate gate id "${gate.id}"`);
      gateIds.add(gate.id);
    });
    file.shots.forEach((shot, i) => {
      shot.events.forEach((event, j) => {
        if (event.type === "gate" && !gateIds.has(event.payload.id)) {
          issue(["shots", i, "events", j, "payload", "id"], `gate "${event.payload.id}" is not in this file's gates`);
        }
      });
    });
    file.markers.forEach((marker, k) => {
      if (!shotIds.has(marker.shot)) {
        issue(["markers", k, "shot"], `marker "${marker.id}" names missing shot "${marker.shot}"`);
      }
    });
  });

/** The id of `shots[index]` in raw (unvalidated) input, if it has one. */
function shotIdAt(json: unknown, index: number): string | undefined {
  if (typeof json !== "object" || json === null || !("shots" in json) || !Array.isArray(json.shots)) {
    return undefined;
  }
  const shot: unknown = json.shots[index];
  if (typeof shot !== "object" || shot === null || !("id" in shot)) return undefined;
  return typeof shot.id === "string" ? shot.id : undefined;
}

/** `["shots", 0, "keys", 2, "t"]` → `test-1 › keys[2].t`; other paths → `fps`, `gates[0].id`. */
function formatPath(json: unknown, path: readonly PropertyKey[]): string {
  let rest = path;
  let head = "";
  const [first, second] = path;
  if (first === "shots" && typeof second === "number") {
    head = `${shotIdAt(json, second) ?? `shots[${second}]`} › `;
    rest = path.slice(2);
  }
  const tail = rest.map((seg, i) => (typeof seg === "number" ? `[${seg}]` : `${i > 0 ? "." : ""}${String(seg)}`)).join("");
  return head + (tail || (head ? "(shot)" : "(file)"));
}

/**
 * Parses one shots/<act>.json. Throws with every issue on its own line, as
 * `<fileName> › <shot id> › <path>: <message>`.
 */
export function parseShotFile(json: unknown, fileName: string): z.infer<typeof ShotFileSchema> {
  const result = ShotFileSchema.safeParse(json);
  if (result.success) return result.data;
  throw new Error(
    result.error.issues.map((issue) => `${fileName} › ${formatPath(json, issue.path)}: ${issue.message}`).join("\n"),
  );
}
