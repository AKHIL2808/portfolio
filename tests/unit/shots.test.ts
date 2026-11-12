// F.3/W.01: shot data. Every shots/*.json parses; the schema rejects unsorted keys,
// t outside 0–1, unknown cue names and gates that don't exist (tdd › Testing › Shot data).
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ShotFile } from "@/experience/director/types";
import { parseShotFile, ShotFileSchema } from "@/lib/schemas";

const root = fileURLToPath(new URL("../../", import.meta.url));
const SHOT_FILES = readdirSync(`${root}shots`)
  .filter((f) => f.endsWith(".json"))
  .sort();
const load = (file: string): unknown => JSON.parse(readFileSync(`${root}shots/${file}`, "utf8"));

const base = parseShotFile(load("test.json"), "shots/test.json");

const at = <T>(xs: readonly T[], i: number): T => {
  const x = xs[i];
  if (x === undefined) throw new Error(`no element [${i}]`);
  return x;
};
const fixture = (mutate: (f: ShotFile) => void): unknown => {
  const f = structuredClone(base);
  mutate(f);
  return f;
};
const pushRaw = (xs: readonly unknown[], item: unknown): void => {
  (xs as unknown[]).push(item);
};
const expectIssue = (input: unknown, path: (string | number)[]): void => {
  const result = ShotFileSchema.safeParse(input);
  expect(result.success, "fixture should fail").toBe(false);
  const paths = result.error?.issues.map((i) => i.path) ?? [];
  expect(paths, JSON.stringify(result.error?.issues)).toContainEqual(path);
};

describe("shots/*.json files", () => {
  it("includes the test scene", () => {
    expect(SHOT_FILES).toContain("test.json");
  });

  it.each(SHOT_FILES)("shots/%s parses", (file) => {
    expect(() => parseShotFile(load(file), `shots/${file}`)).not.toThrow();
  });

  it("test.json has test-1 (scrub, 3 keys) then test-2 (beat, 2 keys)", () => {
    expect(base.act).toBe("test");
    const [s1, s2] = base.shots;
    expect(s1).toMatchObject({ id: "test-1", mode: "scrub", scrollLength: 2, camera: "main" });
    expect(s1?.keys).toHaveLength(3);
    expect(s2).toMatchObject({ id: "test-2", mode: "beat", duration: 2, camera: "main" });
    expect(s2?.keys).toHaveLength(2);
  });

  it("gate ids are unique across all shot files", () => {
    const ids = SHOT_FILES.flatMap((f) => parseShotFile(load(f), `shots/${f}`).gates.map((g) => g.id));
    expect(new Set(ids).size, `duplicate gate ids in ${JSON.stringify(ids)}`).toBe(ids.length);
  });
});

describe("ShotFileSchema accepts", () => {
  it("valid events, gates and markers", () => {
    const input = fixture((f) => {
      const s1 = at(f.shots, 0);
      pushRaw(s1.events, { t: 0.1, type: "sound", payload: { cue: "taiko" } });
      pushRaw(s1.events, { t: 0.2, type: "timeScale", payload: { to: 0.05, ramp: 0.3 } });
      pushRaw(s1.events, { t: 0.3, type: "title", payload: { text: "anything" } });
      pushRaw(s1.events, { t: 0.4, type: "gate", payload: { id: "test-hold" } });
      pushRaw(f.gates, { id: "test-hold", kind: "hold", holdMs: 3000, autoResolveMs: null });
      pushRaw(f.gates, { id: "test-click", kind: "click", autoResolveMs: 4000 });
      pushRaw(f.markers, { id: "T01-handoff", shot: "test-1", t: 0.5 });
    });
    const result = ShotFileSchema.safeParse(input);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });
});

type Case = [name: string, input: unknown, path: (string | number)[]];

const key = (f: ShotFile, shot: number, k: number) => at(at(f.shots, shot).keys, k);

const rejects: Case[] = [
  // keys sorted by t from 0 to 1
  [
    "unsorted keys (0, 0.6, 0.4, 1)",
    fixture((f) => {
      const s1 = at(f.shots, 0);
      key(f, 0, 1).t = 0.6;
      s1.keys.splice(2, 0, { ...key(f, 0, 1), t: 0.4 });
    }),
    ["shots", 0, "keys", 2, "t"],
  ],
  ["duplicate t", fixture((f) => void (key(f, 0, 1).t = 0)), ["shots", 0, "keys", 1, "t"]],
  ["first key t ≠ 0", fixture((f) => void (key(f, 0, 0).t = 0.1)), ["shots", 0, "keys", 0, "t"]],
  ["last key t ≠ 1", fixture((f) => void (key(f, 0, 2).t = 0.9)), ["shots", 0, "keys", 2, "t"]],
  ["only one key", fixture((f) => void at(f.shots, 1).keys.pop()), ["shots", 1, "keys"]],
  // t outside 0–1
  ["key t > 1", fixture((f) => void (key(f, 0, 1).t = 1.5)), ["shots", 0, "keys", 1, "t"]],
  ["key t < 0", fixture((f) => void (key(f, 0, 1).t = -0.1)), ["shots", 0, "keys", 1, "t"]],
  [
    "event t > 1",
    fixture((f) => pushRaw(at(f.shots, 0).events, { t: 1.2, type: "title", payload: {} })),
    ["shots", 0, "events", 0, "t"],
  ],
  [
    "marker t < 0",
    fixture((f) => pushRaw(f.markers, { id: "m", shot: "test-1", t: -0.1 })),
    ["markers", 0, "t"],
  ],
  [
    "event t < 0",
    fixture((f) => pushRaw(at(f.shots, 0).events, { t: -0.2, type: "title", payload: {} })),
    ["shots", 0, "events", 0, "t"],
  ],
  [
    "marker t > 1",
    fixture((f) => pushRaw(f.markers, { id: "m", shot: "test-1", t: 1.2 })),
    ["markers", 0, "t"],
  ],
  [
    "unknown event type",
    fixture((f) => pushRaw(at(f.shots, 0).events, { t: 0.5, type: "explode", payload: {} })),
    ["shots", 0, "events", 0, "type"],
  ],
  [
    "timeScale ramp < 0",
    fixture((f) => pushRaw(at(f.shots, 0).events, { t: 0.5, type: "timeScale", payload: { to: 0.5, ramp: -1 } })),
    ["shots", 0, "events", 0, "payload", "ramp"],
  ],
  ["no shots", fixture((f) => void (f.shots.length = 0)), ["shots"]],
  ["scrollLength = 0", fixture((f) => void Object.assign(at(f.shots, 0), { scrollLength: 0 })), ["shots", 0, "scrollLength"]],
  ["scrub with duration", fixture((f) => void Object.assign(at(f.shots, 0), { duration: 2 })), ["shots", 0]],
  ["unknown camera", fixture((f) => void Object.assign(at(f.shots, 0), { camera: "side" })), ["shots", 0, "camera"]],
  ["fov = 0", fixture((f) => void (key(f, 0, 0).fov = 0)), ["shots", 0, "keys", 0, "fov"]],
  ["focus < 0", fixture((f) => void (key(f, 0, 0).focus = -1)), ["shots", 0, "keys", 0, "focus"]],
  ["roll not finite", fixture((f) => void (key(f, 0, 0).roll = Number.NaN)), ["shots", 0, "keys", 0, "roll"]],
  [
    "unknown gate kind (form)",
    fixture((f) => pushRaw(f.gates, { id: "g", kind: "form", autoResolveMs: null })),
    ["gates", 0, "kind"],
  ],
  [
    "swipe gate with holdMs",
    fixture((f) => pushRaw(f.gates, { id: "g", kind: "swipe", holdMs: 1000, autoResolveMs: null })),
    ["gates", 0],
  ],
  [
    "hold gate with holdMs = 0",
    fixture((f) => pushRaw(f.gates, { id: "g", kind: "hold", holdMs: 0, autoResolveMs: null })),
    ["gates", 0, "holdMs"],
  ],
  // unknown cue names
  [
    "unknown cue",
    fixture((f) => pushRaw(at(f.shots, 0).events, { t: 0.5, type: "sound", payload: { cue: "not-a-cue" } })),
    ["shots", 0, "events", 0, "payload", "cue"],
  ],
  // gates that don't exist
  [
    "gate event whose gate is missing",
    fixture((f) => pushRaw(at(f.shots, 0).events, { t: 0.5, type: "gate", payload: { id: "nope" } })),
    ["shots", 0, "events", 0, "payload", "id"],
  ],
  [
    "timeScale to = 0",
    fixture((f) => pushRaw(at(f.shots, 0).events, { t: 0.5, type: "timeScale", payload: { to: 0 } })),
    ["shots", 0, "events", 0, "payload", "to"],
  ],
  [
    "timeScale to > 1",
    fixture((f) => pushRaw(at(f.shots, 0).events, { t: 0.5, type: "timeScale", payload: { to: 1.5 } })),
    ["shots", 0, "events", 0, "payload", "to"],
  ],
  // mode fields
  [
    "scrub without scrollLength",
    fixture((f) => void Reflect.deleteProperty(at(f.shots, 0), "scrollLength")),
    ["shots", 0, "scrollLength"],
  ],
  [
    "beat without duration",
    fixture((f) => void Reflect.deleteProperty(at(f.shots, 1), "duration")),
    ["shots", 1, "duration"],
  ],
  ["beat with scrollLength", fixture((f) => void Object.assign(at(f.shots, 1), { scrollLength: 2 })), ["shots", 1]],
  ["unknown mode", fixture((f) => void Object.assign(at(f.shots, 0), { mode: "loop" })), ["shots", 0, "mode"]],
  // typos in hand edits
  ["shot key typo", fixture((f) => void Object.assign(at(f.shots, 0), { scrolLength: 2 })), ["shots", 0]],
  ["unknown top-level key", fixture((f) => void Object.assign(f, { gate: [] })), []],
  // camera key fields
  [
    "unknown ease",
    fixture((f) => void Object.assign(key(f, 0, 0), { ease: "ease-in" })),
    ["shots", 0, "keys", 0, "ease"],
  ],
  ["focus = 0", fixture((f) => void (key(f, 0, 0).focus = 0)), ["shots", 0, "keys", 0, "focus"]],
  ["fov = 180", fixture((f) => void (key(f, 0, 0).fov = 180)), ["shots", 0, "keys", 0, "fov"]],
  // file fields
  ["fps 24", fixture((f) => void Object.assign(f, { fps: 24 })), ["fps"]],
  ["act9", fixture((f) => void Object.assign(f, { act: "act9" })), ["act"]],
  // gates
  [
    "hold gate without holdMs",
    fixture((f) => pushRaw(f.gates, { id: "g", kind: "hold", autoResolveMs: null })),
    ["gates", 0, "holdMs"],
  ],
  [
    "click gate with holdMs",
    fixture((f) => pushRaw(f.gates, { id: "g", kind: "click", holdMs: 3000, autoResolveMs: null })),
    ["gates", 0],
  ],
  [
    "autoResolveMs = 0",
    fixture((f) => pushRaw(f.gates, { id: "g", kind: "read", autoResolveMs: 0 })),
    ["gates", 0, "autoResolveMs"],
  ],
  // cross-field
  ["duplicate shot id", fixture((f) => void (at(f.shots, 1).id = "test-1")), ["shots", 1, "id"]],
  [
    "duplicate gate id",
    fixture((f) => {
      pushRaw(f.gates, { id: "g", kind: "read", autoResolveMs: null });
      pushRaw(f.gates, { id: "g", kind: "click", autoResolveMs: null });
    }),
    ["gates", 1, "id"],
  ],
  [
    "marker on a missing shot",
    fixture((f) => pushRaw(f.markers, { id: "m", shot: "test-9", t: 0.5 })),
    ["markers", 0, "shot"],
  ],
];

describe("ShotFileSchema rejects", () => {
  it.each(rejects)("%s", (_name, input, path) => {
    expectIssue(input, path);
  });
});

describe("parseShotFile error messages", () => {
  it("names the file, the shot id and the path", () => {
    const input = fixture((f) => void (key(f, 0, 2).t = 0.9));
    expect(() => parseShotFile(input, "shots/test.json")).toThrow("shots/test.json › test-1 › keys[2].t");
  });

  it("names file-level paths", () => {
    const input = fixture((f) => void Object.assign(f, { fps: 24 }));
    expect(() => parseShotFile(input, "shots/test.json")).toThrow("shots/test.json › fps");
  });
});

describe("src/lib/schemas.ts", () => {
  it("imports only zod (shared with /cv and /api/contact)", () => {
    const source = readFileSync(`${root}src/lib/schemas.ts`, "utf8");
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(specifiers).toEqual(["zod"]);
  });
});
