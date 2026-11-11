"""Midnight to Dawn: export the camera's shots to shots/<act>.json (F.2/B.04).

The only path for camera work into the browser. Timeline markers split the
scene camera's action into shots; the scene property ``mtd_markers`` (markers
can't hold custom properties) gives each shot its ``mode``, ``scrollLength`` or
``duration`` and ``camera``. The camera is sampled at each Blender key (plus
each shot's start and end), never per frame, into ``CameraKey`` objects already
in three.js conventions:

    { t, pos, target, fov, roll, focus, ease }

- ``t``: 0..1 within the shot; ``pos`` / ``target``: meters, Y up ``(x, z, -y)``;
  ``target`` = position + forward * focus distance.
- ``fov``: vertical field of view in degrees (three.js PerspectiveCamera.fov),
  from the camera's projection at 1920 x 1080; ``roll``: degrees around the
  view axis relative to world up.
- ``ease``: GSAP ease of the segment to the next key (LINEAR -> "none",
  CONSTANT -> "steps(1)", BEZIER -> "power1.inOut"); the last key has none.
  Bezier is an approximation between keys; poses match exactly at keys.

File: ``{ "act", "fps", "shots": [Shot...], "markers": [{id, shot, t}...],
"gates": [Gate...] }``. A marker whose ``mtd_markers`` entry is
``{"kind": "marker"}`` (e.g. ``T01-handoff``) is a named point inside a shot,
listed in ``markers``, and doesn't split shots. On re-export the camera fields
and ``markers`` are replaced from Blender, while each shot's hand-added
``events`` (by shot id) and the top-level ``gates`` are kept. A shot id in the
file that Blender no longer has stops the export, so no event is ever dropped.

Read-only on the scene (never saves the .blend); refuses parity drift; writes
nothing on any failure.

Headless (exits 1 on any failure)::

    ~/Applications/blender-5.2.4-linux-x64/blender --background blender/scenes/test-cube.blend \
        --python blender/scripts/export_shots.py -- [--out-dir DIR] test

Live (Blender MCP), with the scene open::

    import sys; sys.path.insert(0, "<repo>/blender/scripts")
    import importlib, export_shots; importlib.reload(export_shots); export_shots.export("test")
"""

import json
import math
import os
import re
import sys
import traceback
from pathlib import Path

import bpy
from bpy_extras import anim_utils
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_glb import check_parity  # noqa: E402  (needs the path above)

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "shots"
MARKER_PROP = "mtd_markers"
MODES = {"scrub": "scrollLength", "beat": "duration"}
CAMERAS = ("main", "pov")
POINT_KIND = "marker"  # mtd_markers entry {"kind": "marker"}: a named point in time, not a shot
EASES = {"LINEAR": "none", "CONSTANT": "steps(1)", "BEZIER": "power1.inOut"}
# Only these camera channels shape the shot; any other animation on the camera
# (visibility, custom properties) is ignored.
CAMERA_PATHS = {
    "location", "rotation_euler", "rotation_quaternion", "rotation_axis_angle", "scale",
    "delta_location", "delta_rotation_euler", "delta_rotation_quaternion", "delta_scale",
    "lens", "sensor_width", "sensor_height", "dof.focus_distance",
}  # fmt: skip
FORBIDDEN_PATHS = {"shift_x", "shift_y"}  # three.js has no lens shift
POS_DP = 4  # t, pos, target, focus
ANG_DP = 3  # fov, roll
KEY_EPS = 1e-4  # frames
BOUNDARY_EPS = 1e-3  # frames: how far before a shot boundary the "held" pose is sampled
POSE_TOLERANCE = (1e-3, 1e-2, 1e-3)  # meters, degrees, meters: a larger change at a boundary is a cut
FOV_TOLERANCE = 1e-3  # degrees, projection matrix vs sensor formula
ACT_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
# Keep in sync with the shots schema in src/lib/schemas.ts (F.3/W.01).
TOP_KEYS = ("act", "fps", "shots", "markers", "gates")
SHOT_KEYS = {"id", "mode", "scrollLength", "duration", "camera", "keys", "events"}


class ExportError(RuntimeError):
    pass


def _r(value, places):
    return round(float(value), places) + 0.0  # + 0.0 turns -0.0 into 0.0


def _yup(v, places=POS_DP):
    return [_r(v.x, places), _r(v.z, places), _r(-v.y, places)]


def parse_args(argv):
    """``(act, out_dir or None)`` from the arguments after ``--``."""
    if "--" not in argv:
        raise ValueError("usage: ... --python export_shots.py -- [--out-dir DIR] <act>")
    args = argv[argv.index("--") + 1 :]
    out_dir = None
    if args[:1] == ["--out-dir"]:
        if len(args) < 2:
            raise ValueError("--out-dir needs a directory")
        out_dir, args = Path(args[1]), args[2:]
    if len(args) != 1:
        raise ValueError(f"give exactly one act name after --, got {args}")
    if not ACT_RE.match(args[0]):
        raise ValueError(f"act name {args[0]!r} must match {ACT_RE.pattern}")
    return args[0], out_dir


def _check_enums():
    """The identifiers this script relies on exist in this Blender."""
    wanted = (
        (bpy.types.Keyframe, "interpolation", EASES.keys()),
        (bpy.types.Camera, "sensor_fit", ("AUTO", "HORIZONTAL", "VERTICAL")),
        (bpy.types.Camera, "type", ("PERSP",)),
        (bpy.types.FCurve, "extrapolation", ("CONSTANT",)),
    )
    for struct, prop, ids in wanted:
        have = [item.identifier for item in struct.bl_rna.properties[prop].enum_items]
        missing = [i for i in ids if i not in have]
        if missing:
            raise ExportError(f"{struct.__name__}.{prop}: {missing} not in {have}")


def _all_fcurves(cam):
    """Every F-curve across the camera's object slot and its camera-data slot."""
    curves = []
    for owner in (cam, cam.data):
        anim = owner.animation_data
        if anim and anim.action and anim.action_slot:
            bag = anim_utils.action_get_channelbag_for_slot(anim.action, anim.action_slot)
            if bag:
                curves.extend(bag.fcurves)
    return curves


def _fcurves(cam):
    """The F-curves that shape the camera (transform, lens, sensor, focus)."""
    return [fc for fc in _all_fcurves(cam) if fc.data_path in CAMERA_PATHS]


def _camera(scene):
    """The scene camera, checked for everything the web rig can't reproduce."""
    cam = scene.camera
    if cam is None or cam.type != "CAMERA":
        raise ExportError("the scene has no camera")
    data = cam.data
    problems = []
    if data.type != "PERSP":
        problems.append(f"type {data.type} (only perspective)")
    if cam.parent:
        problems.append(f"parented to {cam.parent.name!r}")
    if len(cam.constraints):
        problems.append("has constraints (bake them into keys)")
    if abs(data.shift_x) > 1e-9 or abs(data.shift_y) > 1e-9:
        problems.append("lens shift isn't zero")
    if any(fc.data_path in FORBIDDEN_PATHS for fc in _all_fcurves(cam)):
        problems.append("lens shift is animated")
    # Depth of field may be on or off: only the focus distance is exported (the
    # web has no blur effect, so stills should render without visible blur).
    if data.dof.focus_object:
        problems.append("focus object set (key focus distance instead)")
    for owner in (cam, data):
        anim = owner.animation_data
        if anim and len(anim.nla_tracks):
            problems.append(f"{owner.name}: NLA tracks")
        if anim and len(anim.drivers):
            problems.append(f"{owner.name}: drivers")
    for fcurve in _fcurves(cam):
        if len(fcurve.modifiers):
            problems.append(f"{fcurve.data_path}: F-curve modifiers")
        if fcurve.extrapolation != "CONSTANT":
            problems.append(f"{fcurve.data_path}: extrapolation {fcurve.extrapolation}")
    if problems:
        raise ExportError(f"camera {cam.name!r}: " + "; ".join(problems))
    return cam


def _shot_specs(scene):
    """``([(id, start, end, meta)], [(id, frame)])``: shots and point markers, validated.

    A marker whose ``mtd_markers`` entry is ``{"kind": "marker"}`` (a hand-off or
    cut point inside a shot, e.g. ``T01-handoff``) doesn't split shots.
    """
    stored = scene.get(MARKER_PROP)
    if stored is None:
        raise ExportError(f"scene has no {MARKER_PROP!r} property")
    meta_all = stored.to_dict() if hasattr(stored, "to_dict") else dict(stored)
    markers = sorted(scene.timeline_markers, key=lambda m: m.frame)
    if not markers:
        raise ExportError("no timeline markers")
    names = [m.name for m in markers]
    frames = [m.frame for m in markers]
    if len(set(names)) != len(names):
        raise ExportError(f"duplicate marker names: {names}")
    if len(set(frames)) != len(frames):
        raise ExportError(f"two markers on one frame: {list(zip(names, frames))}")
    missing = [n for n in names if n not in meta_all]
    orphans = [n for n in meta_all if n not in names]
    if missing or orphans:
        raise ExportError(f"markers without {MARKER_PROP}: {missing}; {MARKER_PROP} without markers: {orphans}")
    for marker in markers:
        if marker.frame >= scene.frame_end:
            raise ExportError(f"marker {marker.name!r} at {marker.frame} isn't before frame_end {scene.frame_end}")
        if marker.camera:
            raise ExportError(f"marker {marker.name!r} is bound to a camera; use {MARKER_PROP} 'camera' instead")
        if not isinstance(meta_all[marker.name], dict):
            raise ExportError(f"{marker.name}: {MARKER_PROP} entry must be a dict, got {meta_all[marker.name]!r}")
    points = []
    for marker in markers:
        meta = meta_all[marker.name]
        if "kind" in meta:
            if meta != {"kind": POINT_KIND}:
                raise ExportError(f"{marker.name}: a point marker is exactly {{'kind': '{POINT_KIND}'}}, got {meta}")
            points.append((marker.name, marker.frame))
    shot_markers = [m for m in markers if "kind" not in meta_all[m.name]]
    if not shot_markers or shot_markers[0].frame != scene.frame_start:
        first = shot_markers[0].name if shot_markers else None
        raise ExportError(f"the first shot marker ({first!r}) must sit on frame_start {scene.frame_start}")
    fps = scene.render.fps / scene.render.fps_base
    specs = []
    for i, marker in enumerate(shot_markers):
        start = marker.frame
        end = shot_markers[i + 1].frame if i + 1 < len(shot_markers) else scene.frame_end
        meta = meta_all[marker.name]
        mode = meta.get("mode")
        if mode not in MODES:
            raise ExportError(f"{marker.name}: mode {mode!r} not in {list(MODES)}")
        if meta.get("camera") not in CAMERAS:
            raise ExportError(f"{marker.name}: camera {meta.get('camera')!r} not in {list(CAMERAS)}")
        allowed = {"mode", "camera", MODES[mode]}
        if set(meta) != allowed:
            raise ExportError(f"{marker.name}: {mode} needs exactly {sorted(allowed)}, got {sorted(meta)}")
        value = meta[MODES[mode]]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
            raise ExportError(f"{marker.name}: {MODES[mode]} must be a positive number, got {value!r}")
        if mode == "beat" and abs(value * fps - (end - start)) > 1:
            raise ExportError(
                f"{marker.name}: duration {value} s is {value * fps:g} frames, but the shot spans {end - start}"
            )
        specs.append((marker.name, start, end, meta))
    return specs, points


def point_markers(specs, points):
    """``[{id, shot, t}]``: each point marker with the shot it sits in and its t there."""
    out = []
    for name, frame in points:
        inside = next((s for s in specs if s[1] < frame < s[2]), None)
        if inside is None:
            raise ExportError(f"point marker {name!r} at frame {frame} isn't inside any shot")
        shot_id, start, end, _meta = inside
        out.append({"id": name, "shot": shot_id, "t": _r((frame - start) / (end - start), POS_DP)})
    return out


def key_frames(fcurves, start, end):
    """Every keyframe inside [start, end], plus start and end, sorted and de-duplicated."""
    frames = {float(start), float(end)}
    for fcurve in fcurves:
        for key in fcurve.keyframe_points:
            if start - KEY_EPS <= key.co.x <= end + KEY_EPS:
                frames.add(min(max(float(key.co.x), start), end))
    unique = []
    for frame in sorted(frames):
        if not unique or frame - unique[-1] > KEY_EPS:
            unique.append(frame)
    return unique


def vertical_fov(evaluated, scene, depsgraph):
    """Vertical field of view in degrees, cross-checked against the sensor formula."""
    render = scene.render
    matrix = evaluated.calc_matrix_camera(
        depsgraph,
        x=render.resolution_x,
        y=render.resolution_y,
        scale_x=render.pixel_aspect_x,
        scale_y=render.pixel_aspect_y,
    )
    fov = math.degrees(2 * math.atan(1 / matrix[1][1]))
    data = evaluated.data
    aspect_x = render.resolution_x * render.pixel_aspect_x
    aspect_y = render.resolution_y * render.pixel_aspect_y
    fit = data.sensor_fit
    if fit == "AUTO":  # the sensor width spans the larger side
        fit = "HORIZONTAL" if aspect_x >= aspect_y else "VERTICAL"
        sensor = data.sensor_width
    else:
        sensor = data.sensor_width if fit == "HORIZONTAL" else data.sensor_height
    if fit == "HORIZONTAL":
        half = math.atan(sensor / 2 / data.lens)
        formula = math.degrees(2 * math.atan(math.tan(half) * aspect_y / aspect_x))
    else:
        formula = math.degrees(2 * math.atan(sensor / 2 / data.lens))
    if abs(fov - formula) > FOV_TOLERANCE:
        raise ExportError(f"fov mismatch: projection {fov:.4f} vs sensor formula {formula:.4f}")
    return fov


def roll_deg(forward, up):
    """Roll around the view axis, relative to world up (sign as three.js lookAt + rotateZ)."""
    plane_up = Vector((0.0, 0.0, 1.0)) - forward * forward.z  # world up projected onto the image plane
    if plane_up.length < 1e-4:
        return None  # looking straight up or down: roll is undefined
    plane_up.normalize()
    return math.degrees(math.atan2(-forward.dot(plane_up.cross(up)), plane_up.dot(up)))


def _holds(key, after):
    """True if the curve stays at one value from ``key`` to ``after``."""
    values = [key.co.y, after.co.y]
    if key.interpolation == "BEZIER":
        values += [key.handle_right.y, after.handle_left.y]
    return max(values) - min(values) < 1e-9


def ease_for(fcurves, frame):
    """GSAP ease of the segment starting at ``frame`` (from the key that starts it on each curve)."""
    found = set()
    for fcurve in fcurves:
        keys = fcurve.keyframe_points
        index = None
        for i, key in enumerate(keys):
            if key.co.x <= frame + KEY_EPS:
                index = i
        if index is not None and index < len(keys) - 1:
            key, after = keys[index], keys[index + 1]
            if _holds(key, after):
                continue  # this channel doesn't move on the segment: its interpolation doesn't matter
            found.add(key.interpolation)
    if not found:
        return EASES["LINEAR"]  # nothing moves: any ease is exact
    if len(found) > 1:
        raise ExportError(f"camera keys at frame {frame:g} mix interpolations {sorted(found)}; use one")
    interpolation = found.pop()
    if interpolation not in EASES:
        raise ExportError(f"interpolation {interpolation} at frame {frame:g} has no GSAP ease; use {list(EASES)}")
    return EASES[interpolation]


def sample_key(scene, cam, frame, start, end):
    """One CameraKey (without ``ease``) at a possibly fractional frame."""
    whole = math.floor(frame)
    scene.frame_set(int(whole), subframe=frame - whole)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = cam.evaluated_get(depsgraph)
    world = evaluated.matrix_world
    rotation = world.to_quaternion()
    position = world.translation.copy()
    forward = rotation @ Vector((0.0, 0.0, -1.0))
    up = rotation @ Vector((0.0, 1.0, 0.0))
    focus = evaluated.data.dof.focus_distance
    if focus <= 0:
        raise ExportError(f"focus distance {focus} at frame {frame:g} must be positive")
    roll = roll_deg(forward, up)
    if roll is None:
        raise ExportError(f"camera looks straight up or down at frame {frame:g}; roll is undefined")
    return {
        "t": (frame - start) / (end - start),
        "pos": position,
        "target": position + forward * focus,
        "fov": vertical_fov(evaluated, scene, depsgraph),
        "roll": roll,
        "focus": focus,
    }


def _same_pose(a, b):
    pos_tol, fov_tol, focus_tol = POSE_TOLERANCE
    return (
        (a["pos"] - b["pos"]).length <= pos_tol
        and (a["target"] - b["target"]).length <= pos_tol
        and abs(a["fov"] - b["fov"]) <= fov_tol
        and abs((a["roll"] - b["roll"] + 180.0) % 360.0 - 180.0) <= fov_tol
        and abs(a["focus"] - b["focus"]) <= focus_tol
    )


def collect_shots(scene, cam, specs):
    """Shots with sampled keys, in timeline order. Restores the current frame."""
    fcurves = _fcurves(cam)
    frame, subframe = scene.frame_current, scene.frame_subframe
    shots = []
    try:
        for index, (shot_id, start, end, meta) in enumerate(specs):
            if index < len(specs) - 1:
                # A shot ends on the next shot's first frame. If the camera jumps
                # there (a hard cut), that frame isn't this shot's last pose.
                held = sample_key(scene, cam, end - BOUNDARY_EPS, start, end)
                landed = sample_key(scene, cam, end, start, end)
                if not _same_pose(held, landed):
                    raise ExportError(
                        f"the camera jumps at the boundary between {shot_id!r} and {specs[index + 1][0]!r} "
                        f"(frame {end}); hard cuts between shots aren't supported by export_shots yet"
                    )
            frames = key_frames(fcurves, start, end)
            keys, previous_roll = [], None
            for i, f in enumerate(frames):
                raw = sample_key(scene, cam, f, start, end)
                roll = raw["roll"]
                if previous_roll is not None:  # unwrap so roll never spins the long way
                    roll += 360.0 * round((previous_roll - roll) / 360.0)
                previous_roll = roll
                key = {
                    "t": _r(raw["t"], POS_DP),
                    "pos": _yup(raw["pos"]),
                    "target": _yup(raw["target"]),
                    "fov": _r(raw["fov"], ANG_DP),
                    "roll": _r(roll, ANG_DP),
                    "focus": _r(raw["focus"], POS_DP),
                }
                if i < len(frames) - 1:
                    key["ease"] = ease_for(fcurves, f)
                keys.append(key)
            ts = [k["t"] for k in keys]
            if len(keys) < 2 or ts[0] != 0.0 or ts[-1] != 1.0 or any(b <= a for a, b in zip(ts, ts[1:])):
                raise ExportError(f"{shot_id}: keys must run strictly from t 0 to 1, got {ts}")
            shot = {"id": shot_id, "mode": meta["mode"]}
            shot[MODES[meta["mode"]]] = meta[MODES[meta["mode"]]]
            shot["camera"] = meta["camera"]
            shot["keys"] = keys
            shots.append(shot)
    finally:
        scene.frame_set(frame, subframe=subframe)
    return shots


def load_existing(path, act):
    """The existing shots file (validated), or None."""
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise ExportError(f"{path}: not valid JSON ({err})") from err
    if not isinstance(data, dict):
        raise ExportError(f"{path}: top level must be an object")
    extra = [k for k in data if k not in TOP_KEYS]
    if extra:
        raise ExportError(f"{path}: unknown top-level keys {extra} (only {list(TOP_KEYS)})")
    if data.get("act", act) != act:
        raise ExportError(f"{path}: act {data.get('act')!r} isn't {act!r}")
    shots = data.get("shots", [])
    if not all(isinstance(data.get(k, []), list) for k in ("shots", "markers", "gates")):
        raise ExportError(f"{path}: 'shots', 'markers' and 'gates' must be lists")
    seen = set()
    for shot in shots:
        if not isinstance(shot, dict) or not isinstance(shot.get("id"), str):
            raise ExportError(f"{path}: every shot needs a string 'id'")
        if shot["id"] in seen:
            raise ExportError(f"{path}: duplicate shot id {shot['id']!r}")
        seen.add(shot["id"])
        extra = [k for k in shot if k not in SHOT_KEYS]
        if extra:
            raise ExportError(f"{path}: shot {shot['id']!r} has unknown keys {extra}")
        if not isinstance(shot.get("events", []), list):
            raise ExportError(f"{path}: shot {shot['id']!r} 'events' must be a list")
    return data


def merge(act, fps, shots, markers, existing):
    """The file to write: Blender's camera data plus the existing events and gates."""
    old_events = {}
    gates = []
    if existing:
        old_events = {s["id"]: s.get("events", []) for s in existing.get("shots", [])}
        gates = existing.get("gates", [])
        removed = sorted(set(old_events) - {s["id"] for s in shots})
        if removed:
            raise ExportError(
                f"shots {removed} are in the file but no longer in Blender; their events would be lost. "
                "Restore the markers, or delete those shots from the JSON by hand."
            )
    for shot in shots:
        shot["events"] = old_events.get(shot["id"], [])
    return {"act": act, "fps": fps, "shots": shots, "markers": markers, "gates": gates}


def write_json(path, data):
    text = json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    tmp = path.with_name(path.stem + ".tmp.json")
    try:
        tmp.write_text(text, encoding="utf-8")
        if json.loads(tmp.read_text(encoding="utf-8")) != data:
            raise ExportError(f"{tmp}: re-read doesn't match what was written")
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def export(act, out_dir=None):
    """Export the scene camera's shots to ``<out_dir>/<act>.json``. Never saves the .blend."""
    if not ACT_RE.match(act):
        raise ExportError(f"act name {act!r} must match {ACT_RE.pattern}")
    scene = bpy.context.scene
    out_dir = Path(out_dir) if out_dir else OUT_DIR
    path = out_dir / f"{act}.json"
    check_parity(scene)
    _check_enums()
    cam = _camera(scene)
    specs, points = _shot_specs(scene)
    shots = collect_shots(scene, cam, specs)
    markers = point_markers(specs, points)
    data = merge(act, scene.render.fps, shots, markers, load_existing(path, act))
    out_dir.mkdir(parents=True, exist_ok=True)
    write_json(path, data)
    return path, {s["id"]: len(s["keys"]) for s in data["shots"]}


def _main():
    if not bpy.app.background:
        raise RuntimeError("run headless (--background); in a live session call export() instead")
    act, out_dir = parse_args(sys.argv)
    path, keys = export(act, out_dir)
    print(f"export_shots: wrote {path} (keys per shot {keys})")


if __name__ == "__main__":
    # Blender exits 0 on an uncaught exception in --python, so exit 1 explicitly.
    try:
        _main()
    except Exception:
        traceback.print_exc()
        print("export_shots: FAILED")
        sys.exit(1)
