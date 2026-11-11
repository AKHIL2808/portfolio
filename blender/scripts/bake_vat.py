"""Midnight to Dawn: bake crowd clips into vertex animation textures (F.2/B.05).

Crowds (Act 3's weak demons, Act 7's koi) aren't skinned in the browser: their
clips are baked here and played by the web VATCrowd effect in one draw call.
For one mesh and the clips named on the command line, it writes:

- ``raw-assets/vat/<name>.pos.exr``: vertex positions, per frame;
- ``raw-assets/vat/<name>.nrm.exr``: unit vertex normals, per frame;
- ``raw-assets/vat/<name>.json``: the layout (``<name>`` = object, ``_`` -> ``-``).

Layout: texel column = Blender vertex index (the crowd GLB must carry a
matching ``_vat_index`` attribute); one row per frame (several rows per frame,
``rowsPerFrame``, when there are more than 512 vertices); clips stacked in the
order given. ``rowOrder`` is ``top-down``: row 0 (the first baked frame) is the
EXR's top line, so on the web ``v = 1 - (row + 0.5) / height``.

Values: object space, Y up ``(x, z, -y)``, meters (like the GLB), RGB = xyz,
A = 1 on used texels and 0 on padding. Files: RGBA half-float EXR, ZIP, raw
linear values (no view transform), to be read as Non-Color. Max 512 x 512.

A ``_loop`` clip is frames ``[start, end)`` of its action at 30 fps (its
closing key sits one frame past the period); any other clip (a one-shot such
as ``lunge``) is ``[start, end]``, so its final pose is baked. Each clip's
metadata says ``loop: true/false``. Each action is temporarily assigned to its owner by
its slot type (KEY -> the mesh's shape keys, OBJECT -> its armature) and
everything is restored afterwards. Read-only on the scene (never saves the
.blend); refuses parity drift; writes nothing on any failure.

Headless (exits 1 on any failure)::

    ~/Applications/blender-5.2.4-linux-x64/blender --background blender/scenes/test-cube.blend \
        --python blender/scripts/bake_vat.py -- [--out-dir DIR] test_vat_blob test_vat_blob_pulse_loop

Live (Blender MCP), with the scene open::

    import sys; sys.path.insert(0, "<repo>/blender/scripts")
    import importlib, bake_vat; importlib.reload(bake_vat)
    bake_vat.bake("test_vat_blob", ["test_vat_blob_pulse_loop"])
"""

import json
import math
import os
import struct
import sys
import traceback
from contextlib import contextmanager
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import settings  # noqa: E402  (needs the path above)
from export_glb import check_parity  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "raw-assets" / "vat"
MAX_SIZE = 512  # texels per side (.claude/rules/blender.md › Budgets)
BOUNDS_DP = 4
NORMAL_TOLERANCE = 1e-3
ROW_ORDER = "top-down"
INDEX_ATTRIBUTE = "_vat_index"  # the crowd GLB's per-vertex Blender index (export_glb.py, Stage 3)
LOOP_SUFFIX = "_loop"
SPACE = "object, y-up (x, z, -y), meters"
# Set in this order: the color-depth choices depend on the file format.
EXR_SETTINGS = {
    "file_format": "OPEN_EXR",
    "color_mode": "RGBA",
    "color_depth": "16",  # half float
    "exr_codec": "ZIP",
    "color_management": "FOLLOW_SCENE",  # float images are saved raw (no view transform)
}
EXR_HALF = 1  # EXR channel pixel type
EXR_ZIP = 3  # EXR compression attribute
OWNER_TYPES = ("KEY", "OBJECT")


class BakeError(RuntimeError):
    pass


def _r(value, places):
    return round(float(value), places) + 0.0  # + 0.0 turns -0.0 into 0.0


def out_stem(name):
    return name.replace("_", "-")


def parse_args(argv):
    """``(object, [actions], out_dir or None)`` from the arguments after ``--``."""
    if "--" not in argv:
        raise ValueError("usage: ... --python bake_vat.py -- [--out-dir DIR] <object> <action> [<action> ...]")
    args = argv[argv.index("--") + 1 :]
    out_dir = None
    if args[:1] == ["--out-dir"]:
        if len(args) < 2:
            raise ValueError("--out-dir needs a directory")
        out_dir, args = Path(args[1]), args[2:]
    if len(args) < 2:
        raise ValueError(f"give an object and at least one action after --, got {args}")
    obj, actions = args[0], args[1:]
    if len(set(actions)) != len(actions):
        raise ValueError(f"duplicate action names: {actions}")
    return obj, actions, out_dir


def _check_enums():
    props = bpy.types.ImageFormatSettings.bl_rna.properties
    for key, value in EXR_SETTINGS.items():
        items = [item.identifier for item in props[key].enum_items]
        if items and value not in items:  # some lists are filled at run time
            raise BakeError(f"ImageFormatSettings.{key}: {value!r} not in {items}")


def _mesh(name):
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise BakeError(f"no object {name!r}")
    if obj.type != "MESH":
        raise BakeError(f"{name!r} is a {obj.type}, not a mesh")
    if obj.name not in bpy.context.view_layer.objects or not obj.visible_get():
        raise BakeError(
            f"{name!r} is hidden (eye or monitor icon, or an excluded collection), so it may not be "
            "evaluated; unhide it in the scene and save"
        )
    if obj.mode != "OBJECT":
        raise BakeError(f"switch {name!r} to Object mode before baking")
    return obj


def _owners(obj):
    """Who can play a clip on this mesh: its shape keys (KEY) and its armature (OBJECT)."""
    armature = next((m.object for m in obj.modifiers if m.type == "ARMATURE" and m.object), None)
    return {"KEY": obj.data.shape_keys, "OBJECT": armature}


def _slot_for(obj, action, owners):
    """``(owner, slot)`` that plays ``action`` on ``obj``."""
    matches = [
        (owners[s.target_id_type], s)
        for s in action.slots
        if s.target_id_type in OWNER_TYPES and owners[s.target_id_type] is not None
    ]
    if len(matches) > 1:
        named = [(o, s) for o, s in matches if getattr(s, "name_display", None) == o.name]
        matches = named if len(named) == 1 else matches
    if len(matches) != 1:
        kinds = [s.target_id_type for s in action.slots]
        raise BakeError(
            f"action {action.name!r} (slots {kinds}) has no single slot for {obj.name!r}: "
            "KEY plays on its shape keys, OBJECT on its armature"
        )
    return matches[0]


def _check_owner(owner):
    anim = owner.animation_data
    if anim is None:
        return
    if len(anim.nla_tracks):
        raise BakeError(f"{owner.name!r} has NLA tracks; bake from a plain action")
    if anim.action_blend_type != "REPLACE" or abs(anim.action_influence - 1.0) > 1e-9:
        raise BakeError(f"{owner.name!r}: action blend must be Replace at influence 1")


def _clip_frames(action):
    """``(frames, loop)``: ``[start, end)`` for a ``_loop`` action, ``[start, end]`` otherwise."""
    start, end = action.frame_range
    if abs(start - round(start)) > 1e-6 or abs(end - round(end)) > 1e-6 or end <= start:
        raise BakeError(f"action {action.name!r} range {start}..{end} must be whole frames, end after start")
    loop = action.name.endswith(LOOP_SUFFIX)
    last = int(round(end)) if loop else int(round(end)) + 1  # a loop's closing key repeats its first frame
    return list(range(int(round(start)), last)), loop


def layout(vertex_count, clip_frames):
    """``(width, rows_per_frame, height)`` for the stacked clips; fails past 512 x 512."""
    width = min(vertex_count, MAX_SIZE)
    rows_per_frame = math.ceil(vertex_count / width)
    height = sum(clip_frames) * rows_per_frame
    if height > MAX_SIZE:
        raise BakeError(
            f"{sum(clip_frames)} frames x {rows_per_frame} rows = {height} rows, over {MAX_SIZE}; "
            "shorten the clips or split the clip set"
        )
    return width, rows_per_frame, height


@contextmanager
def _assigned(owners):
    """Restore every owner's action and slot (and drop animation data created here)."""
    saved = []
    for owner in {o for o in owners.values() if o is not None}:
        anim = owner.animation_data
        saved.append((owner, anim is not None, anim.action if anim else None, anim.action_slot if anim else None))
    try:
        yield
    finally:
        for owner, had_anim, action, slot in saved:
            if not had_anim:
                if owner.animation_data:
                    owner.animation_data_clear()
                continue
            owner.animation_data.action = action
            if action is not None and slot is not None:
                owner.animation_data.action_slot = slot


def _assign(owner, action, slot, owners):
    """Play ``action`` on ``owner`` only."""
    for other in owners.values():
        if other is not None and other != owner and other.animation_data:
            other.animation_data.action = None
    anim = owner.animation_data or owner.animation_data_create()
    anim.action = action
    anim.action_slot = slot


def _yup(values):
    return np.stack([values[:, 0], values[:, 2], -values[:, 1]], axis=1)


def sample_frame(scene, obj, frame, vertex_count):
    """Y-up float32 positions and unit vertex normals of the evaluated mesh at ``frame``."""
    scene.frame_set(frame)
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        if len(mesh.vertices) != vertex_count:
            modifiers = [f"{m.name} ({m.type})" for m in obj.modifiers if m.show_viewport]
            raise BakeError(
                f"{obj.name!r} has {len(mesh.vertices)} vertices at frame {frame}, not {vertex_count}: a modifier "
                f"changes the topology (active: {modifiers}). Bake only deforming modifiers (armature, shape "
                "keys); apply or disable others; the outline is the web InkOutline, not a Solidify hull"
            )
        positions = np.empty(vertex_count * 3, dtype=np.float32)
        normals = np.empty(vertex_count * 3, dtype=np.float32)
        mesh.vertices.foreach_get("co", positions)
        mesh.vertex_normals.foreach_get("vector", normals)
    finally:
        evaluated.to_mesh_clear()
    return _yup(positions.reshape(-1, 3)), _yup(normals.reshape(-1, 3))


def bake_clips(scene, obj, plan, owners):
    """``(positions[F, V, 3], normals[F, V, 3], clips)`` for every clip in ``plan``."""
    vertex_count = len(obj.data.vertices)
    positions, normals, clips = [], [], []
    frame, subframe = scene.frame_current, scene.frame_subframe
    start = 0
    try:
        with _assigned(owners):
            for action, owner, slot, frames, loop in plan:
                _assign(owner, action, slot, owners)
                clip_pos, clip_nrm = zip(*(sample_frame(scene, obj, f, vertex_count) for f in frames))
                clip_pos, clip_nrm = np.stack(clip_pos), np.stack(clip_nrm)
                if not (np.isfinite(clip_pos).all() and np.isfinite(clip_nrm).all()):
                    raise BakeError(f"{action.name!r}: non-finite values")
                lengths = np.linalg.norm(clip_nrm, axis=2)
                if np.abs(lengths - 1.0).max() > NORMAL_TOLERANCE:
                    raise BakeError(f"{action.name!r}: zero-length normals (degenerate faces?)")
                if len(frames) > 1 and np.allclose(clip_pos, clip_pos[0]):
                    raise BakeError(f"{action.name!r} doesn't move {obj.name!r}; is it the right action?")
                positions.append(clip_pos)
                normals.append(clip_nrm)
                clips.append({"name": action.name, "start": start, "frames": len(frames), "loop": loop})
                start += len(frames)
    finally:
        scene.frame_set(frame, subframe=subframe)
    return np.concatenate(positions), np.concatenate(normals), clips


def texture(values, width, rows_per_frame, height):
    """Flat float32 RGBA pixels (Blender's bottom-up order) with row 0 = first frame at the top."""
    tex = np.zeros((height, width, 4), dtype=np.float32)
    index = np.arange(values.shape[1])
    rows, cols = index // width, index % width
    for f in range(values.shape[0]):
        tex[f * rows_per_frame + rows, cols, :3] = values[f]
        tex[f * rows_per_frame + rows, cols, 3] = 1.0
    return tex[::-1].ravel()


def exr_header(path):
    """``{channels, compression, size}`` from an EXR file's header (standard library only)."""
    data = Path(path).read_bytes()
    if struct.unpack_from("<I", data, 0)[0] != 20000630:
        raise BakeError(f"{path} isn't an EXR")
    pos, header = 8, {}
    while data[pos] != 0:
        name_end = data.index(b"\0", pos)
        name = data[pos:name_end].decode()
        type_end = data.index(b"\0", name_end + 1)
        size = struct.unpack_from("<i", data, type_end + 1)[0]
        value = data[type_end + 5 : type_end + 5 + size]
        pos = type_end + 5 + size
        if name == "channels":
            channels, c = [], 0
            while value[c] != 0:
                end = value.index(b"\0", c)
                channels.append((value[c:end].decode(), struct.unpack_from("<i", value, end + 1)[0]))
                c = end + 1 + 16
            header["channels"] = channels
        elif name == "compression":
            header["compression"] = value[0]
        elif name == "dataWindow":
            x0, y0, x1, y1 = struct.unpack("<4i", value)
            header["size"] = (x1 - x0 + 1, y1 - y0 + 1)
    return header


def write_exr(scene, pixels, width, height, path):
    """Half-float RGBA ZIP EXR of raw values; the scene's output settings are restored."""
    image = bpy.data.images.new("_bake_vat_tmp", width, height, alpha=True, float_buffer=True)
    try:
        settings.set_color_space(image, "data")
        image.pixels.foreach_set(pixels)
        fmt = scene.render.image_settings
        saved = {key: getattr(fmt, key) for key in EXR_SETTINGS}
        try:
            for key, value in EXR_SETTINGS.items():
                setattr(fmt, key, value)
            image.save_render(str(path), scene=scene)
        finally:
            for key in EXR_SETTINGS:  # file_format first, as when setting
                setattr(fmt, key, saved[key])
    finally:
        bpy.data.images.remove(image)
    header = exr_header(path)
    wanted = {"channels": [(c, EXR_HALF) for c in "ABGR"], "compression": EXR_ZIP, "size": (width, height)}
    if {k: header.get(k) for k in wanted} != wanted:
        raise BakeError(f"{path.name}: header {header} isn't {wanted}")


def metadata(obj, scene, width, height, rows_per_frame, positions, clips, stem):
    lo, hi = positions.reshape(-1, 3).min(axis=0), positions.reshape(-1, 3).max(axis=0)
    return {
        "object": obj.name,
        "vertexCount": positions.shape[1],
        "fps": scene.render.fps,
        "width": width,
        "height": height,
        "rowsPerFrame": rows_per_frame,
        "frameCount": positions.shape[0],
        "rowOrder": ROW_ORDER,
        "indexAttribute": INDEX_ATTRIBUTE,
        "bounds": {"min": [_r(v, BOUNDS_DP) for v in lo], "max": [_r(v, BOUNDS_DP) for v in hi]},
        "clips": [dict(c, row=c["start"] * rows_per_frame) for c in clips],
        "position": f"{stem}.pos.exr",
        "normal": f"{stem}.nrm.exr",
        "space": SPACE,
    }


def bake(obj_name, action_names, out_dir=None):
    """Bake ``action_names`` of ``obj_name``; returns ``(paths, metadata)``. Never saves the .blend."""
    if len(set(action_names)) != len(action_names) or not action_names:
        raise BakeError(f"give distinct action names, got {action_names}")
    scene = bpy.context.scene
    out_dir = Path(out_dir) if out_dir else OUT_DIR
    check_parity(scene)
    _check_enums()
    obj = _mesh(obj_name)
    owners = _owners(obj)
    plan = []
    for name in action_names:
        action = bpy.data.actions.get(name)
        if action is None:
            raise BakeError(f"no action {name!r}; have {sorted(a.name for a in bpy.data.actions)}")
        owner, slot = _slot_for(obj, action, owners)
        _check_owner(owner)
        plan.append((action, owner, slot, *_clip_frames(action)))
    width, rows_per_frame, height = layout(len(obj.data.vertices), [len(p[3]) for p in plan])
    if getattr(obj.data, "normals_domain", "POINT") != "POINT":
        print(f"bake_vat: warning: {obj.name!r} isn't smooth-shaded; the baked normals are smooth vertex normals")

    positions, normals, clips = bake_clips(scene, obj, plan, owners)
    stem = out_stem(obj.name)
    meta = metadata(obj, scene, width, height, rows_per_frame, positions, clips, stem)
    out_dir.mkdir(parents=True, exist_ok=True)
    final = {
        "pos": out_dir / f"{stem}.pos.exr",
        "nrm": out_dir / f"{stem}.nrm.exr",
        "json": out_dir / f"{stem}.json",
    }
    tmp = {key: path.with_name(path.name.replace(".exr", ".tmp.exr").replace(".json", ".tmp.json"))
           for key, path in final.items()}  # fmt: skip
    try:
        write_exr(scene, texture(positions, width, rows_per_frame, height), width, height, tmp["pos"])
        write_exr(scene, texture(normals, width, rows_per_frame, height), width, height, tmp["nrm"])
        text = json.dumps(meta, indent=2, allow_nan=False) + "\n"
        tmp["json"].write_text(text, encoding="utf-8")
        if json.loads(tmp["json"].read_text(encoding="utf-8")) != meta:
            raise BakeError("metadata re-read doesn't match")
        for key in final:
            os.replace(tmp[key], final[key])
    finally:
        for path in tmp.values():
            path.unlink(missing_ok=True)
    return final, meta


def _main():
    if not bpy.app.background:
        raise RuntimeError("run headless (--background); in a live session call bake() instead")
    obj, actions, out_dir = parse_args(sys.argv)
    paths, meta = bake(obj, actions, out_dir)
    print(
        f"bake_vat: wrote {paths['pos'].parent}/{out_stem(obj)}.* "
        f"({meta['width']} x {meta['height']}, {meta['frameCount']} frames, clips {[c['name'] for c in meta['clips']]})"
    )


if __name__ == "__main__":
    # Blender exits 0 on an uncaught exception in --python, so exit 1 explicitly.
    try:
        _main()
    except Exception:
        traceback.print_exc()
        print("bake_vat: FAILED")
        sys.exit(1)
