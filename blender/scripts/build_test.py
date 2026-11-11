"""Midnight to Dawn: the Stage F test scene (F.2/B.02).

Builds ``blender/scenes/test-cube.blend``, the fixture every remaining Stage F
item runs against:

- ``test_cube``: a 1 m cube (spin clip, custom properties, toon placeholder
  values on its material) and one sun key light. Exported to test-cube.glb.
- ``test_camera``: one camera, 4 keys (location, rotation, focal length, focus
  distance), framing two test shots split by markers.
- ``test_vat``: a small icosphere with a shape-key pulse clip, for the VAT bake.
- ``test_vfx``: a ring tagged ``vfx_proxy = True``, hidden in parity stills.

Marker properties: Blender timeline markers can't hold custom properties, so
each marker's ``mode`` / ``scrollLength`` / ``duration`` / ``camera`` live in
the scene property ``mtd_markers``, keyed by marker name.

Loops: a loop clip's closing key sits one frame past its period (spin 360° at
frame 61, pulse back to 0 at frame 31), so frames ``[start, end)`` are the
distinct frames of the loop.

Rebuild headless (starts from an empty file, writes the .blend; exits 1 on
any failure)::

    ~/Applications/blender-5.2.4-linux-x64/blender --background --factory-startup \
        --python blender/scripts/build_test.py

Live (Blender MCP), in an open session::

    import sys; sys.path.insert(0, "<repo>/blender/scripts")
    import importlib, build_test; importlib.reload(build_test); build_test.build()

``build()`` only ever removes what this script owns, so it can be re-run.
"""

import math
import sys
import traceback
from pathlib import Path

import bmesh
import bpy
from bpy_extras import anim_utils
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import settings  # noqa: E402  (needs the path above)

# --- What this script owns ----------------------------------------------------

COLL_CUBE = "test_cube"
COLL_CAMERA = "test_camera"
COLL_VAT = "test_vat"
COLL_VFX = "test_vfx"
COLLECTIONS = (COLL_CUBE, COLL_CAMERA, COLL_VAT, COLL_VFX)

OBJ_CUBE = "test_cube"
OBJ_LIGHT = "test_key_light"
OBJ_CAMERA = "test_camera"
OBJ_BLOB = "test_vat_blob"
OBJ_PROXY = "test_vfx_proxy"
OBJECTS = (OBJ_CUBE, OBJ_LIGHT, OBJ_CAMERA, OBJ_BLOB, OBJ_PROXY)

ACT_SPIN = "test_cube_spin_loop"
ACT_PULSE = "test_vat_blob_pulse_loop"
ACT_CAMERA = "test_camera_shots"
ACTIONS = (ACT_SPIN, ACT_PULSE, ACT_CAMERA)

MATERIAL = "test_flat"
WORLD = "test_world"
MARKER_PROP = "mtd_markers"

# --- Timing (30 fps from settings.py) -----------------------------------------

FRAME_START = 1
FRAME_END = 150
SPIN_PERIOD = 60  # frames: one full turn in 2 s
PULSE_PERIOD = 30  # frames: VAT clip length

# Test shots. Shot ends at the next marker, the last one at FRAME_END.
MARKERS = (
    ("test-1", 1, {"mode": "scrub", "scrollLength": 2, "camera": "main"}),
    ("test-2", 90, {"mode": "beat", "duration": 2, "camera": "main"}),
)

# --- Look (linear RGB, as stored on the shader sockets) -----------------------

WORLD_COLOR = (0.05, 0.06, 0.09)
WORLD_STRENGTH = 1.0

# Toon placeholder values, named after the web ToonMaterial / InkOutline
# uniforms without the "u" prefix (F.3/W.11 reads them from the GLB).
TOON = {
    "baseColor": [0.8, 0.32, 0.12],
    "shadeColor": [0.32, 0.1, 0.06],
    "bands": 3,
    "rim": 0.25,
    "outlineWidth": 0.02,
    "outlineColor": [0.02, 0.02, 0.03],
}

LIGHT_ENERGY = 3.0
LIGHT_ANGLE_DEG = 5.0
LIGHT_ROTATION_DEG = (45.0, 0.0, 35.0)

# --- Geometry (meters) --------------------------------------------------------

CUBE_SIZE = 1.0
BLOB_LOCATION = (1.5, 0.0, 0.0)
BLOB_RADIUS = 0.4
BLOB_SUBDIVISIONS = 3  # bmesh value: 3 = 320 tris / 162 verts
BLOB_PULSE_SCALE = 1.35  # radial scale of the "pulse" shape key
RING_SEGMENTS = 24
RING_OUTER = 1.0
RING_INNER = 0.85
RING_HEIGHT = 0.05

# --- Camera -------------------------------------------------------------------

CAM_TARGET = (0.0, 0.0, 0.5)  # cube center
# (frame, position, focal length mm). Rotation looks at CAM_TARGET with roll 0;
# focus distance = distance to CAM_TARGET.
CAMERA_KEYS = (
    (1, (3.2, -4.2, 2.4), 35.0),
    (45, (0.8, -5.0, 1.5), 50.0),
    (90, (-3.4, -3.8, 1.8), 35.0),
    (150, (-2.5, -2.5, 4.5), 28.0),
)

SCENE_PATH = Path(__file__).resolve().parents[1] / "scenes" / "test-cube.blend"


# --- Helpers ------------------------------------------------------------------


def _enum_id(rna_struct, prop, wanted):
    """``wanted`` if this Blender offers it for ``rna_struct.prop``, else fail loudly."""
    choices = [item.identifier for item in rna_struct.bl_rna.properties[prop].enum_items]
    if wanted not in choices:
        raise RuntimeError(f"{rna_struct.__name__}.{prop}: {wanted!r} not in {choices}")
    return wanted


def _by_type(nodes, node_type):
    node = next((n for n in nodes if n.type == node_type), None)
    if node is None:
        raise RuntimeError(f"no {node_type} node in {[n.type for n in nodes]}")
    return node


def _input(node, identifier):
    return next(i for i in node.inputs if i.identifier == identifier)


def _fcurves(action, slot):
    return anim_utils.action_get_channelbag_for_slot(action, slot).fcurves


def _collection(scene, name):
    coll = bpy.data.collections.new(name)
    scene.collection.children.link(coll)
    return coll


def _object(coll, name, data):
    obj = bpy.data.objects.new(name, data)
    coll.objects.link(obj)
    return obj


def _mesh_from_bmesh(name, bm):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def _remove_data(data):
    """Remove an object's mesh / light / camera datablock (a mesh takes its shape keys)."""
    if isinstance(data, bpy.types.Mesh):
        bpy.data.meshes.remove(data)
    elif isinstance(data, bpy.types.Light):
        bpy.data.lights.remove(data)
    elif isinstance(data, bpy.types.Camera):
        bpy.data.cameras.remove(data)


def _loop(action, slot, interpolation=None):
    """Make an action loop: optional key interpolation, Cycles modifier, cyclic flag."""
    cycles = _enum_id(bpy.types.FModifier, "type", "CYCLES")
    for fcurve in _fcurves(action, slot):
        if interpolation:
            for key in fcurve.keyframe_points:
                key.interpolation = interpolation
        fcurve.modifiers.new(cycles)
    action.use_cyclic = True


# --- Build steps --------------------------------------------------------------


def clear_owned(scene):
    """Remove everything this script owns (and nothing else). Returns a count."""
    removed = 0
    objects = {o for name in COLLECTIONS if (c := bpy.data.collections.get(name)) for o in c.objects}
    objects |= {bpy.data.objects[name] for name in OBJECTS if name in bpy.data.objects}
    for obj in objects:
        data = obj.data
        bpy.data.objects.remove(obj)
        removed += 1
        if data is not None and data.users == 0:
            _remove_data(data)
    for name in COLLECTIONS:
        if name in bpy.data.collections:
            bpy.data.collections.remove(bpy.data.collections[name])
            removed += 1
    for name in ACTIONS:
        if name in bpy.data.actions:
            bpy.data.actions.remove(bpy.data.actions[name])
            removed += 1
    if MATERIAL in bpy.data.materials:
        bpy.data.materials.remove(bpy.data.materials[MATERIAL])
        removed += 1
    if WORLD in bpy.data.worlds:
        bpy.data.worlds.remove(bpy.data.worlds[WORLD])
        removed += 1
    owned_markers = {name for name, _frame, _props in MARKERS}
    for marker in [m for m in scene.timeline_markers if m.name in owned_markers]:
        scene.timeline_markers.remove(marker)
        removed += 1
    if MARKER_PROP in scene:
        del scene[MARKER_PROP]
        removed += 1
    return removed


def build_world(scene):
    world = bpy.data.worlds.new(WORLD)
    background = _by_type(world.node_tree.nodes, "BACKGROUND")
    _input(background, "Color").default_value = (*WORLD_COLOR, 1.0)
    _input(background, "Strength").default_value = WORLD_STRENGTH
    scene.world = world
    return world


def build_material():
    mat = bpy.data.materials.new(MATERIAL)
    bsdf = _by_type(mat.node_tree.nodes, "BSDF_PRINCIPLED")
    _input(bsdf, "Base Color").default_value = (*TOON["baseColor"], 1.0)
    for key, value in TOON.items():
        mat[key] = value
    return mat


def build_cube(scene, mat):
    coll = _collection(scene, COLL_CUBE)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=CUBE_SIZE)
    bmesh.ops.translate(bm, vec=(0.0, 0.0, CUBE_SIZE / 2), verts=bm.verts)  # origin at the base
    mesh = _mesh_from_bmesh(OBJ_CUBE, bm)
    mesh.materials.append(mat)
    cube = _object(coll, OBJ_CUBE, mesh)
    cube["mtd_kind"] = "test"

    action = bpy.data.actions.new(ACT_SPIN)
    cube.animation_data_create().action = action
    cube.rotation_euler.z = 0.0
    cube.keyframe_insert("rotation_euler", index=2, frame=FRAME_START)
    cube.rotation_euler.z = 2 * math.pi
    cube.keyframe_insert("rotation_euler", index=2, frame=FRAME_START + SPIN_PERIOD)
    cube.rotation_euler.z = 0.0
    _loop(action, cube.animation_data.action_slot, _enum_id(bpy.types.Keyframe, "interpolation", "LINEAR"))
    return coll


def build_light(coll):
    light = bpy.data.lights.new(OBJ_LIGHT, type=_enum_id(bpy.types.Light, "type", "SUN"))
    light.energy = LIGHT_ENERGY
    light.angle = math.radians(LIGHT_ANGLE_DEG)
    obj = _object(coll, OBJ_LIGHT, light)
    obj.location = (0.0, 0.0, 5.0)
    obj.rotation_euler = [math.radians(a) for a in LIGHT_ROTATION_DEG]
    return obj


def build_vat_blob(scene, mat):
    coll = _collection(scene, COLL_VAT)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=BLOB_SUBDIVISIONS, radius=BLOB_RADIUS)
    bmesh.ops.translate(bm, vec=(0.0, 0.0, BLOB_RADIUS), verts=bm.verts)  # origin at the base
    mesh = _mesh_from_bmesh(OBJ_BLOB, bm)
    mesh.materials.append(mat)
    blob = _object(coll, OBJ_BLOB, mesh)
    blob.location = BLOB_LOCATION

    blob.shape_key_add(name="Basis", from_mix=False)
    mesh.shape_keys.name = OBJ_BLOB  # names the action slot
    pulse = blob.shape_key_add(name="pulse", from_mix=False)
    base = Vector((0.0, 0.0, 0.0))  # grow from the base so the blob stays on the floor
    for point in pulse.data:
        point.co = base + (point.co - base) * BLOB_PULSE_SCALE

    action = bpy.data.actions.new(ACT_PULSE)
    mesh.shape_keys.animation_data_create().action = action
    for frame, value in ((FRAME_START, 0.0), (FRAME_START + PULSE_PERIOD // 2, 1.0), (FRAME_START + PULSE_PERIOD, 0.0)):
        pulse.value = value
        pulse.keyframe_insert("value", frame=frame)
    pulse.value = 0.0
    _loop(action, mesh.shape_keys.animation_data.action_slot)
    return blob


def build_vfx_proxy(scene):
    coll = _collection(scene, COLL_VFX)
    verts, faces = [], []
    for i in range(RING_SEGMENTS):
        a = 2 * math.pi * i / RING_SEGMENTS
        verts.append((RING_OUTER * math.cos(a), RING_OUTER * math.sin(a), 0.0))
        verts.append((RING_INNER * math.cos(a), RING_INNER * math.sin(a), 0.0))
    for i in range(RING_SEGMENTS):
        o0, i0 = 2 * i, 2 * i + 1
        o1, i1 = (2 * i + 2) % (2 * RING_SEGMENTS), (2 * i + 3) % (2 * RING_SEGMENTS)
        faces.append((o0, o1, i1, i0))  # counter-clockwise from above: normal +Z
    mesh = bpy.data.meshes.new(OBJ_PROXY)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    proxy = _object(coll, OBJ_PROXY, mesh)
    proxy.location = (0.0, 0.0, RING_HEIGHT)
    proxy["vfx_proxy"] = True
    return proxy


def build_camera(scene):
    coll = _collection(scene, COLL_CAMERA)
    data = bpy.data.cameras.new(OBJ_CAMERA)
    data.dof.use_dof = True
    cam = _object(coll, OBJ_CAMERA, data)

    action = bpy.data.actions.new(ACT_CAMERA)  # one action, object + camera-data slots
    cam.animation_data_create().action = action
    data.animation_data_create().action = action
    target = Vector(CAM_TARGET)
    previous = None
    for frame, position, lens in CAMERA_KEYS:
        position = Vector(position)
        to_target = target - position
        rotation = to_target.to_track_quat("-Z", "Y")  # look at target, roll 0
        # Chain from the previous key so the interpolation takes the short way round.
        euler = rotation.to_euler("XYZ", previous) if previous else rotation.to_euler("XYZ")
        previous = euler.copy()
        cam.location = position
        cam.rotation_euler = euler
        data.lens = lens
        data.dof.focus_distance = to_target.length
        cam.keyframe_insert("location", frame=frame)
        cam.keyframe_insert("rotation_euler", frame=frame)
        data.keyframe_insert("lens", frame=frame)
        data.dof.keyframe_insert("focus_distance", frame=frame)
    scene.camera = cam
    return cam


def build_markers(scene):
    for name, frame, _props in MARKERS:
        scene.timeline_markers.new(name, frame=frame)
    scene[MARKER_PROP] = {name: dict(props) for name, _frame, props in MARKERS}


def save(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    prefs = bpy.context.preferences.filepaths
    old_versions = prefs.save_version
    try:
        prefs.save_version = 0  # no .blend1 backup next to the file
        bpy.ops.wm.save_as_mainfile(filepath=str(path), check_existing=False, compress=True)
    finally:
        prefs.save_version = old_versions


def summary():
    tris = {}
    for name in (OBJ_CUBE, OBJ_BLOB, OBJ_PROXY):
        mesh = bpy.data.objects[name].data
        mesh.calc_loop_triangles()
        tris[name] = len(mesh.loop_triangles)
    scene = bpy.context.scene
    return {
        "objects": sorted(o.name for c in COLLECTIONS for o in bpy.data.collections[c].objects),
        "actions": {a: tuple(bpy.data.actions[a].frame_range) for a in ACTIONS},
        "tris": tris,
        "markers": [(m.name, m.frame) for m in sorted(scene.timeline_markers, key=lambda m: m.frame)],
        "frames": (scene.frame_start, scene.frame_end, scene.render.fps),
    }


def build(save_path=None):
    """Apply parity settings, rebuild everything this script owns, optionally save."""
    scene = bpy.context.scene
    settings.apply(scene)
    clear_owned(scene)
    scene.frame_start = FRAME_START
    scene.frame_end = FRAME_END
    build_world(scene)
    mat = build_material()
    cube_coll = build_cube(scene, mat)
    build_light(cube_coll)
    build_vat_blob(scene, mat)
    build_vfx_proxy(scene)
    build_camera(scene)
    build_markers(scene)
    scene.frame_set(FRAME_START)
    if save_path:
        save(save_path)
    return summary()


def _main():
    if not bpy.app.background:
        raise RuntimeError("run headless (--background); in a live session call build() instead")
    # The whole .blend is generated by this script: start from an empty file so
    # the factory Cube / Camera / Light never end up in it.
    bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)
    result = build(SCENE_PATH)
    for key, value in result.items():
        print(f"build_test: {key} = {value}")
    print(f"build_test: saved {SCENE_PATH}")


if __name__ == "__main__":
    # Blender exits 0 on an uncaught exception in --python, so exit 1 explicitly.
    try:
        _main()
    except Exception:
        traceback.print_exc()
        print("build_test: FAILED")
        sys.exit(1)
