// Midnight to Dawn: run the Blender scripts headless (F.2/B.07).
//
//   pnpm blender:export <act>                  -> blender/scripts/export_act.py in the act's scene
//   pnpm blender:stills <shot> <t...> [--scene <file>] [--no-preview] [--out-dir <dir>]
//                                              -> blender/scripts/render_stills.py in the shot's scene
//
// Blender: $BLENDER_BIN, default ~/Applications/blender-5.2.4-linux-x64/blender
// (the official build; Fedora's /usr/bin/blender has no AgX and fails the
// parity check). Only Blender 5.2.x is accepted. The act's scene is
// blender/scenes/<act>.blend or <act>-*.blend (exactly one). A shot's scene is
// found by listing every scene's markers, unless --scene names it. Scripts
// embedded in a .blend never run (--disable-autoexec); ours run via --python.

import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const SCENES = join(REPO, "blender", "scenes");
const SCRIPTS = join(REPO, "blender", "scripts");
const DEFAULT_BLENDER = join(homedir(), "Applications", "blender-5.2.4-linux-x64", "blender");
const VERSION_RE = /^Blender 5\.2\.\d+\b/;
const ACT_RE = /^[a-z0-9][a-z0-9-]*$/;
const SCENES_TAG = "MTD_SCENES ";

function fail(message) {
  console.error(`blender: ${message}`);
  process.exit(1);
}

function blenderBin() {
  const bin = process.env.BLENDER_BIN || DEFAULT_BLENDER;
  try {
    accessSync(bin, constants.X_OK);
  } catch {
    fail(`no Blender at ${bin}; set BLENDER_BIN to the official 5.2 build`);
  }
  const result = spawnSync(bin, ["--version"], { encoding: "utf8" });
  const first = (result.stdout || "").split("\n")[0].trim();
  if (result.status !== 0 || !VERSION_RE.test(first)) {
    fail(`${bin} reports "${first || "nothing"}"; set BLENDER_BIN to the official Blender 5.2 build`);
  }
  return bin;
}

function sceneFiles() {
  return existsSync(SCENES) ? readdirSync(SCENES).filter((f) => f.endsWith(".blend")).sort() : [];
}

function runBlender(bin, scene, script, args) {
  if (!existsSync(scene)) fail(`no scene file ${scene}`); // Blender would exit 0 on a missing file
  const result = spawnSync(
    bin,
    ["--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1", scene, "--python", join(SCRIPTS, script), "--", ...args],
    { stdio: "inherit", cwd: REPO },
  );
  if (result.error) fail(`couldn't run Blender: ${result.error.message}`);
  process.exit(result.status ?? 1);
}

function exportAct(bin, args) {
  if (args.length !== 1 || !ACT_RE.test(args[0])) fail("usage: pnpm blender:export <act>");
  const act = args[0];
  const matches = sceneFiles().filter((f) => f === `${act}.blend` || (f.startsWith(`${act}-`) && f.endsWith(".blend")));
  if (matches.length !== 1) {
    fail(`act "${act}" needs exactly one scene (${act}.blend or ${act}-*.blend) in blender/scenes, found [${matches.join(", ")}]`);
  }
  runBlender(bin, join(SCENES, matches[0]), "export_act.py", [act]);
}

function markersByScene(bin, files) {
  // One Blender process opens each scene and prints its marker names.
  const expr = [
    "import bpy, json, sys",
    "out = {}",
    "for f in sys.argv[sys.argv.index('--') + 1:]:",
    "    bpy.ops.wm.open_mainfile(filepath=f, load_ui=False, use_scripts=False)",
    "    out[f] = [m.name for m in bpy.context.scene.timeline_markers]",
    `print(${JSON.stringify(SCENES_TAG)} + json.dumps(out))`,
  ].join("\n");
  const result = spawnSync(
    bin,
    ["--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1", "--python-expr", expr, "--", ...files.map((f) => join(SCENES, f))],
    { encoding: "utf8", cwd: REPO },
  );
  const line = (result.stdout || "").split("\n").find((l) => l.startsWith(SCENES_TAG));
  if (result.status !== 0 || !line) fail(`couldn't list the scenes' markers:\n${result.stderr || result.stdout}`);
  return JSON.parse(line.slice(SCENES_TAG.length));
}

function markerFor(shot) {
  // Same rule as render_stills.resolve(): a transition unit T0→1 has the marker T01.
  const unit = /^T(\d)(?:→|->)(\d)$/.exec(shot);
  return unit ? `T${unit[1]}${unit[2]}` : shot;
}

function stills(bin, args) {
  let scene = null;
  const passThrough = [];
  const rest = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--scene") {
      if (i + 1 >= args.length) fail("--scene needs a .blend file");
      scene = resolve(REPO, args[i + 1]);
      i += 1;
    } else if (args[i] === "--no-preview") {
      passThrough.push("--no-preview");
    } else if (args[i] === "--out-dir") {
      if (i + 1 >= args.length) fail("--out-dir needs a directory");
      passThrough.push("--out-dir", resolve(args[i + 1]));
      i += 1;
    } else {
      rest.push(args[i]);
    }
  }
  if (rest.length < 2) fail("usage: pnpm blender:stills <shot> <t> [<t> <t>] [--scene <file>] [--no-preview]");
  const [shot] = rest;
  if (!scene) {
    const files = sceneFiles();
    if (files.length === 0) fail("no scenes in blender/scenes");
    const marker = markerFor(shot);
    const found = Object.entries(markersByScene(bin, files))
      .filter(([, markers]) => markers.includes(marker))
      .map(([file]) => file);
    if (found.length !== 1) {
      fail(`shot "${shot}" (marker ${marker}) must be in exactly one scene; found in [${found.join(", ")}] of [${files.join(", ")}]`);
    }
    scene = found[0];
  }
  runBlender(bin, scene, "render_stills.py", [...passThrough, ...rest]);
}

const [command, ...args] = process.argv.slice(2);
if (command === "export") exportAct(blenderBin(), args);
else if (command === "stills") stills(blenderBin(), args);
else fail("usage: node scripts/blender.mjs export <act> | stills <shot> <t...>");
