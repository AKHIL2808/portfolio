"""Midnight to Dawn: export collections to raw GLBs (F.2/B.03).

The only way 3D leaves Blender for the web: each collection named on the
command line becomes ``raw-assets/models/<name with _ -> ->.glb``, carrying
meshes (modifiers applied, +Y up, meters), custom properties as glTF extras
(objects and materials), every exported object's action as a clip (sampled per
frame, starting at 0 s), shape keys as morph targets, and lights in glTF's
"Standard" lighting mode (photometric: a 3 W/m² sun becomes 2049 lux).

Never exported: cameras (shot data goes through export_shots.py) and objects
tagged ``vfx_proxy = True``. No compression here: meshopt and KTX2 are
``pnpm assets``.

Read-only on the scene: it never saves the .blend, and it refuses to export a
scene whose parity settings (settings.py) have drifted.

Headless (exits 1 on any failure)::

    ~/Applications/blender-5.2.4-linux-x64/blender --background blender/scenes/test-cube.blend \
        --python blender/scripts/export_glb.py -- [--out-dir DIR] test_cube [<collection> ...]

Live (Blender MCP), with the scene open::

    import sys; sys.path.insert(0, "<repo>/blender/scripts")
    import importlib, export_glb; importlib.reload(export_glb); export_glb.export(["test_cube"])
"""

import json
import logging
import os
import struct
import sys
import traceback
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import settings  # noqa: E402  (needs the path above)

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "raw-assets" / "models"
PROXY_PROP = "vfx_proxy"
_EXPORTER_LOGGERS = ("glTFImporter", "glTFImporter_errors")  # the add-on logs export messages here too
# Exporter version whose option names, defaults and logger names were probed
# (F.2/B.03). A different version fails until the probes are re-run.
TESTED_GLTF_ADDON = (5, 2)

# Every option set explicitly: several exporter defaults are wrong for us
# (lights, apply modifiers, extras, slide to zero and current frame are off by
# default). Names and enum values are validated against the exporter's RNA.
EXPORT_OPTIONS = {
    "export_format": "GLB",
    # Filters: the `collection` argument chooses the objects; nothing else filters.
    "use_selection": False,
    "use_visible": False,
    "use_renderable": False,
    "use_active_collection": False,
    "use_active_scene": False,
    "export_hierarchy_full_collections": False,
    # Content
    "export_cameras": False,
    "export_lights": True,
    "export_import_convert_lighting_mode": "SPEC",  # "Standard"
    "export_yup": True,
    "export_apply": True,
    "export_extras": True,
    "export_materials": "EXPORT",
    "export_image_format": "AUTO",
    # Animation: every exported object's action as a clip, sampled per frame
    # (unsampled, a 0 -> 360 deg spin collapses to two identical keys).
    "export_animations": True,
    "export_animation_mode": "ACTIONS",
    "export_anim_slide_to_zero": True,
    "export_force_sampling": True,
    "export_frame_range": False,
    "export_current_frame": True,  # rest pose from the frame we pin (frame_start)
    "export_morph": True,
    "export_morph_normal": True,
    "export_morph_animation": True,
    # No compression (pnpm assets does meshopt + KTX2)
    "export_draco_mesh_compression_enable": False,
    "export_meshopt_compression_enable": False,
    "export_use_gltfpack": False,
    # Housekeeping
    "will_save_settings": False,
    "check_existing": False,
}


def out_name(collection_name):
    return collection_name.replace("_", "-") + ".glb"


def parse_args(argv):
    """``(names, out_dir or None)`` from the arguments after ``--``."""
    if "--" not in argv:
        raise ValueError("usage: ... --python export_glb.py -- [--out-dir DIR] <collection> [...]")
    args = argv[argv.index("--") + 1 :]
    out_dir = None
    if args[:1] == ["--out-dir"]:
        if len(args) < 2:
            raise ValueError("--out-dir needs a directory")
        out_dir, args = Path(args[1]), args[2:]
    if not args:
        raise ValueError("no collection names given after --")
    if len(set(args)) != len(args):
        raise ValueError(f"duplicate collection names: {args}")
    files = [out_name(n) for n in args]
    if len(set(files)) != len(files):
        raise ValueError(f"collection names map to the same file: {dict(zip(args, files))}")
    return args, out_dir


def check_parity(scene):
    """Fail if the scene's parity settings drifted; leaves the scene as it was."""
    changes = settings.apply(scene)
    if not changes:
        return
    for label, get_owner, prop, _wanted, _kind in settings.TARGETS:
        if label in changes:
            setattr(get_owner(scene), prop, changes[label][0])  # undo the fix
    raise RuntimeError(f"parity settings drifted {changes}; rebuild the scene, don't export it")


def _options():
    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    for key, value in EXPORT_OPTIONS.items():
        if key not in props:
            raise RuntimeError(f"the glTF exporter has no option {key!r}")
        prop = props[key]
        # export_format's items are filled at run time (empty here); a bad value raises TypeError at export.
        if prop.type == "ENUM" and len(prop.enum_items):
            ids = [item.identifier for item in prop.enum_items]
            if value not in ids:
                raise RuntimeError(f"glTF exporter {key}: {value!r} not in {ids}")
    return dict(EXPORT_OPTIONS)


def _layer_collection(layer_collection, collection):
    if layer_collection.collection == collection:
        return layer_collection
    for child in layer_collection.children:
        found = _layer_collection(child, collection)
        if found:
            return found
    return None


def _plan(scene, name):
    """``(keep, drop)`` objects for one collection; fails on anything that would export wrongly."""
    coll = bpy.data.collections.get(name)
    if coll is None:
        raise RuntimeError(f"no collection {name!r}; have {sorted(c.name for c in bpy.data.collections)}")
    if coll not in scene.collection.children_recursive:
        raise RuntimeError(f"collection {name!r} isn't in scene {scene.name!r}")
    layer = _layer_collection(bpy.context.view_layer.layer_collection, coll)
    if layer is None or layer.exclude:
        raise RuntimeError(f"collection {name!r} is excluded from the view layer; it would export empty")
    keep = [o for o in coll.all_objects if o.type != "CAMERA" and not o.get(PROXY_PROP)]
    drop = [o for o in coll.all_objects if o.get(PROXY_PROP)]
    if not keep:
        raise RuntimeError(f"collection {name!r} has nothing to export")
    return keep, drop


class _Warnings(logging.Handler):
    def __init__(self):
        super().__init__(level=logging.WARNING)
        self.messages = []

    def emit(self, record):
        self.messages.append(record.getMessage())


def _gltf_addon():
    """The bundled glTF add-on, checked against the version this script was proven on."""
    try:
        import io_scene_gltf2
        from io_scene_gltf2.blender.com.blender_default import BLENDER_GLTF_SPECIAL_COLLECTION
    except ImportError as err:
        raise RuntimeError(
            "the glTF 2.0 add-on (io_scene_gltf2) isn't available: enable it, and use the official "
            "Blender 5.2.4 LTS (~/Applications/blender-5.2.4-linux-x64/blender)"
        ) from err
    version = tuple(io_scene_gltf2.bl_info["version"][:2])
    if version != TESTED_GLTF_ADDON:
        raise RuntimeError(
            f"glTF add-on {version} isn't the proven {TESTED_GLTF_ADDON}: re-run the F.2/B.03 probes "
            "(including the warning-capture probe), then update TESTED_GLTF_ADDON"
        )
    return BLENDER_GLTF_SPECIAL_COLLECTION


def _active_actions(obj):
    actions = []
    if obj.animation_data and obj.animation_data.action:
        actions.append(obj.animation_data.action.name)
    keys = getattr(obj.data, "shape_keys", None)
    if keys and keys.animation_data and keys.animation_data.action:
        actions.append(keys.animation_data.action.name)
    return actions


def _read_glb_json(path):
    data = Path(path).read_bytes()
    if data[:4] != b"glTF":
        raise RuntimeError(f"{path} isn't a GLB")
    length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:  # "JSON"
        raise RuntimeError(f"{path}: first chunk isn't JSON")
    return json.loads(data[20 : 20 + length])


def _check_glb(path, keep, drop):
    gltf = _read_glb_json(path)
    nodes = {n.get("name") for n in gltf.get("nodes", [])}
    clips = {a.get("name") for a in gltf.get("animations", [])}
    problems = []
    missing = sorted(o.name for o in keep if o.name not in nodes)
    if missing:
        problems.append(f"objects missing: {missing}")
    leaked = sorted(o.name for o in drop if o.name in nodes)
    if leaked:
        problems.append(f"vfx proxies exported: {leaked}")
    if "cameras" in gltf:
        problems.append("cameras exported")
    wanted = sorted({a for o in keep for a in _active_actions(o)})
    if not set(wanted) <= clips:
        problems.append(f"clips missing: {sorted(set(wanted) - clips)} (have {sorted(clips)})")
    unknown = sorted(c for c in clips if c not in bpy.data.actions)
    if unknown:
        problems.append(f"clips not named after actions: {unknown}")
    if problems:
        raise RuntimeError(f"{path.name}: " + "; ".join(problems))
    return {"nodes": len(nodes), "clips": sorted(clips)}


def export_collection(scene, name, out_dir, keep, drop, options):
    """Export one collection to ``out_dir``; restores every state it touches."""
    active = bpy.context.object
    if active is not None and active.mode != "OBJECT":
        raise RuntimeError(f"switch {active.name!r} to Object mode before exporting")
    path = Path(out_dir) / out_name(name)
    # Write to a temporary file and move it into place only after it passes the
    # checks, so a bad GLB never sits in raw-assets/ for `pnpm assets` to pick up.
    tmp = path.with_name(path.stem + ".tmp.glb")
    frame, subframe = scene.frame_current, scene.frame_subframe
    handler = _Warnings()
    loggers = [logging.getLogger(n) for n in _EXPORTER_LOGGERS]
    special_name = _gltf_addon()
    special = bpy.data.collections.get(special_name)
    created = special is None
    if created:
        special = bpy.data.collections.new(special_name)
    linked = [o for o in drop if o.name not in special.objects]
    try:
        for logger in loggers:
            logger.addHandler(handler)
        for obj in linked:
            special.objects.link(obj)  # the exporter skips objects in this collection
        scene.frame_set(scene.frame_start)
        kwargs = dict(options, filepath=str(tmp), collection=name)
        if bpy.context.window is None and bpy.context.window_manager.windows:
            with bpy.context.temp_override(window=bpy.context.window_manager.windows[0]):
                result = bpy.ops.export_scene.gltf(**kwargs)
        else:
            result = bpy.ops.export_scene.gltf(**kwargs)
        if result != {"FINISHED"}:
            raise RuntimeError(f"glTF export of {name!r} returned {result}")
        if handler.messages:
            raise RuntimeError(f"glTF export of {name!r} warned (something was dropped): {handler.messages}")
        summary = _check_glb(tmp, keep, drop)
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)
        for obj in linked:
            special.objects.unlink(obj)
        if created:
            bpy.data.collections.remove(special)
        for logger in loggers:
            logger.removeHandler(handler)
        scene.frame_set(frame, subframe=subframe)
    return path, summary


def export(names, out_dir=None):
    """Export each collection in ``names``; returns ``[(path, summary)]``. Never saves the .blend."""
    scene = bpy.context.scene
    out_dir = Path(out_dir) if out_dir else OUT_DIR
    check_parity(scene)
    options = _options()
    plans = {name: _plan(scene, name) for name in names}  # check every name before writing anything
    out_dir.mkdir(parents=True, exist_ok=True)
    return [export_collection(scene, name, out_dir, *plans[name], options) for name in names]


def _main():
    if not bpy.app.background:
        raise RuntimeError("run headless (--background); in a live session call export() instead")
    names, out_dir = parse_args(sys.argv)
    for path, summary in export(names, out_dir):
        print(f"export_glb: wrote {path} ({summary['nodes']} nodes, clips {summary['clips']})")


if __name__ == "__main__":
    # Blender exits 0 on an uncaught exception in --python, so exit 1 explicitly.
    try:
        _main()
    except Exception:
        traceback.print_exc()
        print("export_glb: FAILED")
        sys.exit(1)
