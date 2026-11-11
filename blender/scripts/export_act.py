"""Midnight to Dawn: export everything an act's scene declares (F.2/B.07).

Run by ``pnpm blender:export <act>`` (scripts/blender.mjs) inside the act's
``.blend``. The scene property ``mtd_export`` (set by the act's build script)
says what leaves Blender::

    {"glb": [<collection>, ...], "vat": [{"object": <mesh>, "clips": [<action>, ...]}, ...]}

Shots are always exported. In order: export_glb.py (``raw-assets/models``),
export_shots.py (``shots/<act>.json``, hand-added events and gates merged),
bake_vat.py (``raw-assets/vat``).

Every check runs first, then every export is written into a staging folder;
only when all steps succeeded are the files moved into place, one by one
(temp name + rename). A failed check or step names the step, exits 1 and
writes nothing to the repo. Raw files of collections or VAT objects removed
from ``mtd_export`` aren't deleted (remove them by hand). The .blend is never
saved.

Headless::

    ~/Applications/blender-5.2.4-linux-x64/blender --background --factory-startup --python-exit-code 1 \
        blender/scenes/test-cube.blend --python blender/scripts/export_act.py -- test
"""

import os
import shutil
import sys
import tempfile
import traceback
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bake_vat  # noqa: E402  (needs the path above)
import export_glb  # noqa: E402
import export_shots  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
EXPORT_PROP = "mtd_export"
DESTINATIONS = {
    "models": REPO / "raw-assets" / "models",
    "shots": REPO / "shots",
    "vat": REPO / "raw-assets" / "vat",
}


class ActExportError(RuntimeError):
    pass


def parse_args(argv):
    if "--" not in argv:
        raise ValueError("usage: ... --python export_act.py -- <act>")
    args = argv[argv.index("--") + 1 :]
    if len(args) != 1 or not export_shots.ACT_RE.match(args[0]):
        raise ValueError(f"give exactly one act name matching {export_shots.ACT_RE.pattern}, got {args}")
    return args[0]


def _unique_names(values, what):
    if not isinstance(values, list) or not all(isinstance(v, str) and v for v in values):
        raise ActExportError(f"{EXPORT_PROP}: {what} must be a list of names, got {values!r}")
    if len(set(values)) != len(values):
        raise ActExportError(f"{EXPORT_PROP}: duplicate {what}: {values}")
    return values


def export_list(scene):
    """The validated ``mtd_export`` of ``scene``."""
    stored = scene.get(EXPORT_PROP)
    if stored is None:
        raise ActExportError(f"scene has no {EXPORT_PROP!r}; set it in the act's build script")
    data = stored.to_dict() if hasattr(stored, "to_dict") else dict(stored)
    if set(data) != {"glb", "vat"}:
        raise ActExportError(f"{EXPORT_PROP} must have exactly 'glb' and 'vat', got {sorted(data)}")
    glb = _unique_names(data["glb"], "glb collections")
    vat = data["vat"]
    if not isinstance(vat, list):
        raise ActExportError(f"{EXPORT_PROP}: vat must be a list, got {vat!r}")
    for entry in vat:
        if not isinstance(entry, dict) or set(entry) != {"object", "clips"}:
            raise ActExportError(f"{EXPORT_PROP}: each vat entry is exactly {{object, clips}}, got {entry!r}")
        if not isinstance(entry["object"], str) or not entry["object"]:
            raise ActExportError(f"{EXPORT_PROP}: vat object must be a name, got {entry['object']!r}")
        if not _unique_names(entry["clips"], f"clips of {entry['object']}"):
            raise ActExportError(f"{EXPORT_PROP}: {entry['object']} has no clips")
    _unique_names([e["object"] for e in vat], "vat objects")
    return glb, vat


def _check_scene_file(act):
    name = Path(bpy.data.filepath).name
    if not (name == f"{act}.blend" or (name.startswith(f"{act}-") and name.endswith(".blend"))):
        raise ActExportError(f"the open file {name!r} isn't act {act!r}'s scene ({act}.blend or {act}-*.blend)")


def _check_names(glb, vat):
    missing = [f"collection {c}" for c in glb if c not in bpy.data.collections]
    for entry in vat:
        if entry["object"] not in bpy.data.objects:
            missing.append(f"object {entry['object']}")
        missing += [f"action {a}" for a in entry["clips"] if a not in bpy.data.actions]
    if missing:
        raise ActExportError(f"{EXPORT_PROP} names things that don't exist: {missing}")


def _publish(staging):
    """Move every staged file into its destination (temp name + replace, same filesystem)."""
    moved = []
    for kind, dest in DESTINATIONS.items():
        source = staging / kind
        if not source.is_dir():
            continue
        dest.mkdir(parents=True, exist_ok=True)
        for path in sorted(source.iterdir()):
            tmp = dest / f".{path.name}.tmp"
            shutil.copyfile(path, tmp)
            os.replace(tmp, dest / path.name)
            moved.append(dest / path.name)
    return moved


def export_act(act):
    """Export ``act`` from the open scene; returns the published paths. Never saves the .blend."""
    scene = bpy.context.scene
    step = "checks"
    _check_scene_file(act)
    glb, vat = export_list(scene)
    export_glb.check_parity(scene)
    _check_names(glb, vat)
    staging = Path(tempfile.mkdtemp(prefix=f"export_act-{act}-"))
    try:
        existing = DESTINATIONS["shots"] / f"{act}.json"
        (staging / "shots").mkdir()
        if existing.exists():  # so export_shots merges the hand-added events and gates
            shutil.copyfile(existing, staging / "shots" / existing.name)
        try:
            step = "export_glb"
            if glb:
                export_glb.export(glb, staging / "models")
            step = "export_shots"
            export_shots.export(act, staging / "shots")
            step = "bake_vat"
            for entry in vat:
                bake_vat.bake(entry["object"], entry["clips"], staging / "vat")
        except Exception as err:
            raise ActExportError(f"step {step} failed: {err}") from err
        return _publish(staging)
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def _main():
    if not bpy.app.background:
        raise RuntimeError("run headless (--background) through `pnpm blender:export <act>`")
    act = parse_args(sys.argv)
    for path in export_act(act):
        print(f"export_act: wrote {path.relative_to(REPO)}")


if __name__ == "__main__":
    # Blender exits 0 on an uncaught exception in --python, so exit 1 explicitly.
    try:
        _main()
    except Exception:
        traceback.print_exc()
        print("export_act: FAILED")
        sys.exit(1)
