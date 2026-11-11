// Midnight to Dawn: optimize raw-assets/ into public/ (F.2/B.07).
//
//   pnpm assets [--raw-dir raw-assets] [--public-dir public]
//
// - raw-assets/models/*.glb -> public/models/*.glb through the pinned gltf-transform
//   CLI, step by step (not `optimize`, whose defaults simplify meshes and merge or
//   rename nodes the web relies on):
//     dedup (materials kept apart by name) -> prune (empty nodes, attributes and
//     solid textures kept) -> KTX2 when the GLB has textures (UASTC for *face* and
//     data textures, ETC1S for colour) -> meshopt.
//   Every optimized GLB is checked against its raw file: names, extras, materials,
//   clips, lights and morph targets must survive.
// - raw-assets/vat/* -> public/vat/* copied byte for byte (never KTX2: VAT needs
//   the precision).
// - public files whose raw source is gone are removed (never .gitkeep), except when
//   a raw folder is empty: then nothing is removed unless --prune is given.
// All-or-nothing: every input is checked and every GLB is built and verified in a
// scratch folder outside public/ first; only then is anything written to public/.
// Leftover temp files from an interrupted run are swept at the start. A failure
// exits 1. --raw-dir / --public-dir must be inside the repo unless --allow-outside.

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  lstatSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const GLTF_CLI = join(REPO, "node_modules", "@gltf-transform", "cli", "bin", "cli.js");
const GLTF_VERSION = "4.5.1";
const KEEP = ".gitkeep";
const DATA_SLOTS = "{normalTexture,occlusionTexture,metallicRoughnessTexture}";
const VAT_FILE = /\.(json|exr|png)$/;
const KTX_MIN = [4, 4];
const USAGE = "usage: pnpm assets [--raw-dir DIR] [--public-dir DIR] [--allow-outside] [--prune]";

class AssetError extends Error {}

function fail(message) {
  throw new AssetError(message); // caught in run(): finally blocks still clean up
}

function parseArgs(argv) {
  const opts = { raw: join(REPO, "raw-assets"), public: join(REPO, "public"), allowOutside: false, prune: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--raw-dir" && argv[i + 1]) opts.raw = resolve(argv[(i += 1)]);
    else if (argv[i] === "--public-dir" && argv[i + 1]) opts.public = resolve(argv[(i += 1)]);
    else if (argv[i] === "--allow-outside") opts.allowOutside = true;
    else if (argv[i] === "--prune") opts.prune = true;
    else fail(`unknown option ${argv[i]}; ${USAGE}`);
  }
  if (!opts.allowOutside) {
    for (const dir of [opts.raw, opts.public]) {
      const rel = relative(REPO, dir);
      if (rel === "" || rel.startsWith("..") || rel.startsWith(sep)) fail(`${dir} is outside the repo; pass --allow-outside to use it`);
    }
  }
  return opts;
}

function readGlbJson(path) {
  const data = readFileSync(path);
  if (data.length < 20 || data.toString("latin1", 0, 4) !== "glTF") fail(`${path} isn't a GLB`);
  const length = data.readUInt32LE(12);
  if (data.readUInt32LE(16) !== 0x4e4f534a) fail(`${path}: first chunk isn't JSON`);
  return JSON.parse(data.toString("utf8", 20, 20 + length));
}

function onPath(command) {
  return (process.env.PATH || "").split(delimiter).some((dir) => existsSync(join(dir, command)));
}

/** Fail unless KTX-Software's `ktx` (4.4 or newer) is installed; gltf-transform needs it for KTX2. */
function checkKtx(textured) {
  const what = `${textured.join(", ")} ${textured.length === 1 ? "has" : "have"} textures`;
  if (!onPath("ktx")) fail(`${what}: install KTX-Software 4.4 or newer (the "ktx" command) for KTX2 compression`);
  const result = spawnSync("ktx", ["--version"], { encoding: "utf8" });
  const match = /v?(\d+)\.(\d+)/.exec(`${result.stdout || ""}${result.stderr || ""}`);
  const version = match ? [Number(match[1]), Number(match[2])] : null;
  if (!version || version[0] < KTX_MIN[0] || (version[0] === KTX_MIN[0] && version[1] < KTX_MIN[1])) {
    fail(`${what}: KTX-Software ${match ? match[0] : "(unknown version)"} is too old; install 4.4 or newer`);
  }
}

/** Remove temp files an interrupted run may have left in a public folder. */
function sweepLeftovers(dir) {
  if (!existsSync(dir)) return [];
  const leftovers = readdirSync(dir).filter((f) => f.startsWith(".optimize-") || f.endsWith(".tmp"));
  for (const f of leftovers) rmSync(join(dir, f), { recursive: true, force: true });
  return leftovers.map((f) => join(dir, f));
}

function gltf(args) {
  const result = spawnSync(process.execPath, [GLTF_CLI, ...args], { encoding: "utf8" });
  if (result.status !== 0) fail(`gltf-transform ${args[0]} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function listFiles(dir) {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f !== KEEP && !f.startsWith(".")).sort() : [];
}

function sameBytes(a, b) {
  return existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b));
}

function stable(value) {
  return JSON.stringify(value ?? null);
}

/** Fail unless the optimized GLB still has everything the web reads from the raw one. */
function verify(name, raw, out) {
  const problems = [];
  const used = out.extensionsUsed || [];
  if (!used.includes("EXT_meshopt_compression")) problems.push("EXT_meshopt_compression not used");
  if ((raw.images || []).length && !used.includes("KHR_texture_basisu")) problems.push("textures not KTX2");
  const named = (nodes) => (nodes || []).filter((n) => n.name).map((n) => n.name).sort();
  if (stable(named(raw.nodes)) !== stable(named(out.nodes))) {
    problems.push(`named nodes changed: ${stable(named(raw.nodes))} -> ${stable(named(out.nodes))}`);
  }
  for (const node of out.nodes || []) {
    if (!node.name && (node.extras || node.children || node.mesh === undefined)) {
      problems.push("an unnamed node that isn't a plain mesh holder appeared");
    }
  }
  const byName = (list) => Object.fromEntries((list || []).filter((x) => x.name).map((x) => [x.name, x.extras]));
  if (stable(byName(raw.nodes)) !== stable(byName(out.nodes))) problems.push("node extras changed");
  if (stable(byName(raw.materials)) !== stable(byName(out.materials))) problems.push("materials or their extras changed");
  if (stable((raw.scenes || []).map((s) => s.extras)) !== stable((out.scenes || []).map((s) => s.extras))) {
    problems.push("scene extras changed");
  }
  const clips = (g) => (g.animations || []).map((a) => [a.name, a.channels.length]).sort();
  if (stable(clips(raw)) !== stable(clips(out))) problems.push(`clips changed: ${stable(clips(raw))} -> ${stable(clips(out))}`);
  const lights = (g) => ((g.extensions || {}).KHR_lights_punctual?.lights || []).map((l) => l.name).sort();
  if (stable(lights(raw)) !== stable(lights(out))) problems.push("lights changed");
  const morphs = (g) =>
    Object.fromEntries((g.meshes || []).map((m) => [m.name, [m.primitives.map((p) => (p.targets || []).length), m.extras?.targetNames ?? null]]));
  if (stable(morphs(raw)) !== stable(morphs(out))) problems.push("morph targets changed");
  if (problems.length) fail(`${name}: ${problems.join("; ")}`);
}

function optimizeGlb(source, target, scratch) {
  mkdirSync(scratch, { recursive: true });
  const steps = [
    ["dedup", "--materials", "false"],
    ["prune", "--keep-leaves", "true", "--keep-attributes", "true", "--keep-solid-textures", "true"],
  ];
  if ((readGlbJson(source).images || []).length) {
    steps.push(["uastc", "--pattern", "*face*"], ["uastc", "--slots", DATA_SLOTS], ["etc1s"]);
  }
  steps.push(["meshopt"]);
  let input = source;
  steps.forEach(([command, ...flags], i) => {
    const output = join(scratch, `step${i}.glb`);
    gltf([command, input, output, ...flags]);
    input = output;
  });
  verify(target, readGlbJson(source), readGlbJson(input));
  return input;
}

function publish(built, target) {
  if (sameBytes(built, target)) return "unchanged";
  const tmp = `${target}.tmp`;
  copyFileSync(built, tmp);
  renameSync(tmp, target);
  return "written";
}

function staleFiles(dir, keepNames, filter) {
  return listFiles(dir).filter((file) => filter(file) && !keepNames.has(file)).map((file) => join(dir, file));
}

function checkNoSymlinks(dir, files) {
  const links = files.filter((f) => lstatSync(join(dir, f)).isSymbolicLink());
  if (links.length) fail(`symlinks aren't published: ${links.map((f) => join(dir, f)).join(", ")}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rawModels = join(opts.raw, "models");
  const rawVat = join(opts.raw, "vat");
  const outModels = join(opts.public, "models");
  const outVat = join(opts.public, "vat");
  for (const dir of [rawModels, rawVat]) if (!existsSync(dir)) fail(`no ${dir}; run pnpm blender:export <act> first`);
  if (!existsSync(GLTF_CLI)) fail("gltf-transform isn't installed; run pnpm install");
  const version = gltf(["--version"]).trim();
  if (version !== GLTF_VERSION) fail(`gltf-transform is ${version}, expected the pinned ${GLTF_VERSION}`);

  // Check every input before writing anything.
  const models = listFiles(rawModels);
  const strays = models.filter((f) => !f.endsWith(".glb"));
  if (strays.length) fail(`only .glb files belong in ${rawModels}: ${strays.join(", ")}`);
  checkNoSymlinks(rawModels, models);
  const vatFiles = listFiles(rawVat);
  const vatStrays = vatFiles.filter((f) => !VAT_FILE.test(f));
  if (vatStrays.length) fail(`only .json, .exr and .png files belong in ${rawVat}: ${vatStrays.join(", ")}`);
  checkNoSymlinks(rawVat, vatFiles);
  const textured = [];
  for (const file of models) {
    const json = readGlbJson(join(rawModels, file));
    if ((json.extensionsUsed || []).includes("EXT_meshopt_compression")) fail(`${file} is already compressed; re-export it`);
    if ((json.images || []).length) textured.push(file);
  }
  if (textured.length) checkKtx(textured);

  // Stale files: a raw folder that's empty is more likely a mistake than a wish
  // to delete everything, so then nothing is removed unless --prune is given.
  const stale = [];
  const kept = [];
  for (const [dir, names, filter, rawCount] of [
    [outModels, new Set(models), (f) => f.endsWith(".glb"), models.length],
    [outVat, new Set(vatFiles), () => true, vatFiles.length],
  ]) {
    const files = staleFiles(dir, names, filter);
    (rawCount === 0 && !opts.prune ? kept : stale).push(...files);
  }

  const swept = [...sweepLeftovers(outModels), ...sweepLeftovers(outVat)];
  const scratch = mkdtempSync(join(tmpdir(), "mtd-optimize-"));
  const rows = [];
  try {
    // Build and verify every GLB before anything is written to public/.
    const built = models.map((file, i) => [file, optimizeGlb(join(rawModels, file), join(outModels, file), join(scratch, String(i)))]);
    mkdirSync(outModels, { recursive: true });
    mkdirSync(outVat, { recursive: true });
    for (const [file, path] of built) {
      const status = publish(path, join(outModels, file));
      rows.push([`models/${file}`, statSync(join(rawModels, file)).size, statSync(join(outModels, file)).size, status]);
    }
    for (const file of vatFiles) {
      const status = publish(join(rawVat, file), join(outVat, file));
      rows.push([`vat/${file}`, statSync(join(rawVat, file)).size, statSync(join(outVat, file)).size, status]);
    }
    for (const path of stale) unlinkSync(path);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  for (const [name, before, after, status] of rows) {
    console.log(`assets: ${name.padEnd(32)} ${String(before).padStart(9)} B -> ${String(after).padStart(9)} B  ${status}`);
  }
  for (const path of swept) console.log(`assets: removed leftover ${path}`);
  for (const path of stale) console.log(`assets: removed stale ${path}`);
  for (const path of kept) console.log(`assets: kept ${path} (its raw folder is empty; pass --prune to remove)`);
}

try {
  main();
} catch (err) {
  console.error(`assets: ${err instanceof AssetError ? err.message : err.stack}`);
  process.exitCode = 1;
}
