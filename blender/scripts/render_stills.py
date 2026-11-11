"""Midnight to Dawn: render a shot's stills and preview (F.2/B.06).

The material the director approves (``/approve-shot``) and the reference images
the parity test compares with ``/dev/shot?shot=<id>&t=<t>``. For one shot
(marker id) and 1-3 shot-relative ``t`` values it renders:

- stills: ``blender/renders/stills/<unit-slug>/t<t:.3f>.png`` (Eevee, scene
  samples, 1920 x 1080, 8-bit RGB PNG, scene color management) with VFX proxies
  hidden, plus ``index.json`` = ``{shot, stills: [{file, t, frame}]}``;
- a preview: ``blender/renders/previews/<unit-slug>.mp4`` (H.264, 960 x 540,
  30 fps, no audio) with VFX proxies visible; a transition shot (``T01``...)
  gets 2 s on each side, clamped to the scene. A transition can be named by
  its unit (``T0→1``) or its marker (``T01``); both use the unit folder ``t0-1``.

``t`` maps to frames exactly as in ``shots/<act>.json`` (export_shots): frame =
start + t * (end - start); a fractional frame renders at that subframe. Camera
depth of field is off (the web has no blur), and the render stamp/metadata is
off so re-renders are byte-identical. Everything changed for the render is
restored; the .blend is never saved; earlier outputs are only replaced after
the new ones all rendered and checked.

Headless (exits 1 on any failure)::

    ~/Applications/blender-5.2.4-linux-x64/blender --background blender/scenes/test-cube.blend \
        --python blender/scripts/render_stills.py -- [--out-dir DIR] [--no-preview] test-1 0 0.5

Live (Blender MCP), with the scene open (a preview blocks the UI while it renders)::

    import sys; sys.path.insert(0, "<repo>/blender/scripts")
    import importlib, render_stills; importlib.reload(render_stills)
    render_stills.render("test-1", [0.5], preview=False)
"""

import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import traceback
from contextlib import contextmanager
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_glb import PROXY_PROP, check_parity  # noqa: E402  (needs the path above)
from export_shots import _shot_specs  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "blender" / "renders"
MAX_STILLS = 3
PREVIEW_PERCENT = 50
PAD_SECONDS = 2  # around transition shots
TRANSITION_RE = re.compile(r"^T\d+")
STILL_RE = re.compile(r"^t\d\.\d{3}\.png$")
STILL_SIZE = (1920, 1080)
# media_type first: setting it switches file_format by itself.
STILL_FORMAT = {
    "media_type": "IMAGE",
    "file_format": "PNG",
    "color_mode": "RGB",
    "color_depth": "8",
    "color_management": "FOLLOW_SCENE",
}
VIDEO_FORMAT = {"media_type": "VIDEO", "file_format": "FFMPEG"}
FFMPEG = {
    "format": "MPEG4",
    "codec": "H264",
    "audio_codec": "NONE",
    "constant_rate_factor": "MEDIUM",
    "ffmpeg_preset": "GOOD",
}
IMAGE_KEYS = ("media_type", "file_format", "color_mode", "color_depth", "color_management")
FFPROBE = shutil.which("ffprobe") or "/usr/bin/ffprobe"


class RenderError(RuntimeError):
    pass


def unit_slug(shot_id):
    """Root CLAUDE.md › Naming: lowercase, ``.`` ``/`` ``→`` become ``-``."""
    return re.sub(r"[./→]", "-", shot_id.lower())


def resolve(shot_id):
    """``(marker, folder slug)`` for a shot or unit id.

    Transitions are units ``T0→1`` (slug ``t0-1``) with markers ``T01``; either
    form is accepted and both give the unit's folder. Other ids are their marker.
    """
    unit = re.fullmatch(r"T(\d)(?:→|->)(\d)", shot_id)
    marker = re.fullmatch(r"T(\d)(\d)", shot_id)
    match = unit or marker
    if match:
        return f"T{match[1]}{match[2]}", f"t{match[1]}-{match[2]}"
    return shot_id, unit_slug(shot_id)


def _parse_t(text):
    try:
        t = float(text)
    except ValueError as err:
        raise ValueError(f"t {text!r} isn't a number") from err
    if not math.isfinite(t) or not 0.0 <= t <= 1.0:
        raise ValueError(f"t {text!r} must be in 0..1")
    if round(t, 3) != t:
        raise ValueError(f"t {text!r} has more than 3 decimals (file names and /dev/shot use 3)")
    return t


def _check_ts(ts):
    if not 1 <= len(ts) <= MAX_STILLS:
        raise ValueError(f"give 1-{MAX_STILLS} stills, got {len(ts)}")
    if len({f"{t:.3f}" for t in ts}) != len(ts):
        raise ValueError(f"duplicate t values: {ts}")


def parse_args(argv):
    """``(shot_id, [t], out_dir or None, preview)`` from the arguments after ``--``."""
    if "--" not in argv:
        raise ValueError("usage: ... --python render_stills.py -- [--out-dir DIR] [--no-preview] <shot id> <t> [<t> <t>]")
    args = argv[argv.index("--") + 1 :]
    out_dir, preview = None, True
    while args and args[0].startswith("--"):
        if args[0] == "--out-dir" and len(args) > 1:
            out_dir, args = Path(args[1]), args[2:]
        elif args[0] == "--no-preview":
            preview, args = False, args[1:]
        else:
            raise ValueError(f"unknown option {args[0]!r}")
    if len(args) < 2:
        raise ValueError(f"give a shot id and 1-{MAX_STILLS} t values after --, got {args}")
    ts = [_parse_t(a) for a in args[1:]]
    _check_ts(ts)
    return args[0], ts, out_dir, preview


def _check_enums():
    wanted = (
        (bpy.types.ImageFormatSettings, STILL_FORMAT),
        (bpy.types.ImageFormatSettings, VIDEO_FORMAT),
        (bpy.types.FFmpegSettings, FFMPEG),
    )
    for struct_type, values in wanted:
        props = struct_type.bl_rna.properties
        for key, value in values.items():
            if key not in props:
                raise RenderError(f"{struct_type.__name__} has no {key!r}")
            items = [item.identifier for item in props[key].enum_items]
            if items and value not in items:  # some lists are filled at run time
                raise RenderError(f"{struct_type.__name__}.{key}: {value!r} not in {items}")


def plan(scene, shot_id, ts):
    """``(stills [(t, frame)], preview (start, end))`` for a shot, from the shot data rules."""
    specs, points = _shot_specs(scene)
    if any(name == shot_id for name, _frame in points):
        raise RenderError(f"{shot_id!r} is a point marker, not a shot")
    spec = next((s for s in specs if s[0] == shot_id), None)
    if spec is None:
        raise RenderError(f"no shot {shot_id!r}; shots are {[s[0] for s in specs]}")
    _id, start, end, _meta = spec
    stills = [(t, start + t * (end - start)) for t in sorted(ts)]
    first, last = start, end
    if TRANSITION_RE.match(shot_id):
        pad = PAD_SECONDS * scene.render.fps
        first, last = max(scene.frame_start, start - pad), min(scene.frame_end, end + pad)
    return stills, (first, last)


def _proxies():
    """Objects tagged ``vfx_proxy`` and every object parented under them."""
    found = {}
    for obj in bpy.data.objects:
        if obj.get(PROXY_PROP):
            for part in (obj, *obj.children_recursive):
                found[part.name] = part
    return list(found.values())


@contextmanager
def _render_state(scene):
    """Save every render setting this script touches; DOF and stamps off; restore all."""
    if scene.camera is None:
        raise RenderError("the scene has no camera")
    render, image, ffmpeg = scene.render, scene.render.image_settings, scene.render.ffmpeg
    stamp_keys = [p.identifier for p in render.bl_rna.properties if p.identifier.startswith("use_stamp")]
    saved = {
        "image": {k: getattr(image, k) for k in IMAGE_KEYS},
        "ffmpeg": {k: getattr(ffmpeg, k) for k in FFMPEG},
        "render": {k: getattr(render, k) for k in ("filepath", "use_file_extension", "resolution_percentage", *stamp_keys)},
        "frames": (scene.frame_start, scene.frame_end, scene.frame_current, scene.frame_subframe),
        "hide_render": {o.name: o.hide_render for o in _proxies()},
        "dof": {c.name: c.dof.use_dof for c in bpy.data.cameras},
    }
    try:
        for camera in bpy.data.cameras:  # every camera: shots may switch cameras; the web has no blur
            camera.dof.use_dof = False
        for key in stamp_keys:
            setattr(render, key, False)  # no date / time / path metadata: byte-identical re-renders
        yield saved
    finally:
        for key in IMAGE_KEYS:  # media_type, then file_format, then the rest
            setattr(image, key, saved["image"][key])
        for key, value in saved["ffmpeg"].items():
            setattr(ffmpeg, key, value)
        for key, value in saved["render"].items():
            setattr(render, key, value)
        for name, hidden in saved["hide_render"].items():
            bpy.data.objects[name].hide_render = hidden
        for name, use_dof in saved["dof"].items():
            bpy.data.cameras[name].dof.use_dof = use_dof
        scene.frame_start, scene.frame_end = saved["frames"][:2]
        scene.frame_set(saved["frames"][2], subframe=saved["frames"][3])


def _set_all(target, values):
    for key, value in values.items():
        setattr(target, key, value)


def _png_header(path):
    data = Path(path).read_bytes()[:33]
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise RenderError(f"{path} isn't a PNG")
    width, height, depth, color_type = struct.unpack(">IIBB", data[16:26])
    return width, height, depth, color_type


def render_still(scene, frame, path):
    for obj in _proxies():
        obj.hide_render = True
    _set_all(scene.render.image_settings, STILL_FORMAT)
    scene.render.resolution_percentage = 100
    whole = math.floor(frame)
    scene.frame_set(whole, subframe=frame - whole)
    scene.render.filepath = str(path)
    scene.render.use_file_extension = True
    bpy.ops.render.render(write_still=True)
    if not path.exists():
        raise RenderError(f"the render of frame {frame:g} wrote no {path.name}")
    header = _png_header(path)
    if header != (*STILL_SIZE, 8, 2):  # 8-bit RGB
        raise RenderError(f"{path.name}: PNG is {header}, not {(*STILL_SIZE, 8, 2)}")


def probe_mp4(path, frames, size):
    """Fail unless ffprobe reads an H.264 yuv420p 30 fps video of ``frames`` frames and ``size``, without audio."""
    if not Path(FFPROBE).exists():
        raise RenderError("ffprobe not found: install ffmpeg, or render with --no-preview")
    result = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,pix_fmt",
         "-of", "json", str(path)],
        capture_output=True, text=True, timeout=120, check=False,
    )  # fmt: skip
    if result.returncode != 0:
        raise RenderError(f"ffprobe can't read {path.name}: {result.stderr.strip()}")
    streams = json.loads(result.stdout).get("streams", [])
    video = [s for s in streams if s.get("codec_type") == "video"]
    got = {
        "streams": [s.get("codec_type") for s in streams],
        "codec": video[0].get("codec_name") if video else None,
        "size": (video[0].get("width"), video[0].get("height")) if video else None,
        "rate": video[0].get("r_frame_rate") if video else None,
        "frames": int(video[0].get("nb_frames", -1)) if video else None,
        "pix_fmt": video[0].get("pix_fmt") if video else None,
    }
    want = {"streams": ["video"], "codec": "h264", "size": size, "rate": "30/1", "frames": frames, "pix_fmt": "yuv420p"}
    if got != want:
        raise RenderError(f"{path.name}: {got} isn't {want}")


def render_preview(scene, first, last, path, hide_render):
    for name, hidden in hide_render.items():
        bpy.data.objects[name].hide_render = hidden  # stand-ins back as authored: visible in previews
    _set_all(scene.render.image_settings, VIDEO_FORMAT)
    _set_all(scene.render.ffmpeg, FFMPEG)
    scene.render.resolution_percentage = PREVIEW_PERCENT
    scene.frame_start, scene.frame_end = int(first), int(last)
    scene.render.filepath = str(path)  # ends in .mp4, so nothing is appended
    scene.render.use_file_extension = True
    bpy.ops.render.render(animation=True)
    if not path.exists():
        raise RenderError(f"the preview render wrote no {path.name}")
    size = tuple(round(v * PREVIEW_PERCENT / 100) for v in STILL_SIZE)
    probe_mp4(path, int(last) - int(first) + 1, size)


def write_index(path, shot_id, stills):
    data = {"shot": shot_id, "stills": [{"file": f"t{t:.3f}.png", "t": t, "frame": round(frame, 4)} for t, frame in stills]}
    tmp = path.with_name("index.tmp.json")
    try:
        tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        if json.loads(tmp.read_text(encoding="utf-8")) != data:
            raise RenderError("index.json re-read doesn't match")
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def render(shot_id, ts, out_dir=None, preview=True):
    """Render a shot's stills (and preview); returns ``{stills, index, preview}``. Never saves the .blend."""
    ts = [float(t) for t in ts]
    for t in ts:
        _parse_t(repr(t))
    _check_ts(ts)
    scene = bpy.context.scene
    out_dir = Path(out_dir) if out_dir else OUT_DIR
    check_parity(scene)  # before any setting changes (it checks resolution_percentage too)
    _check_enums()
    shot_id, slug = resolve(shot_id)
    stills, (first, last) = plan(scene, shot_id, ts)
    if preview and not Path(FFPROBE).exists():
        raise RenderError("ffprobe not found: install ffmpeg, or render with --no-preview")

    still_dir = out_dir / "stills" / slug
    preview_path = out_dir / "previews" / f"{slug}.mp4"
    still_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{slug}.tmp-", dir=still_dir.parent))
    tmp_mp4 = preview_path.with_name(f"{slug}.tmp.mp4")
    try:
        with _render_state(scene) as saved:
            for t, frame in stills:
                render_still(scene, frame, staging / f"t{t:.3f}.png")
            if preview:
                tmp_mp4.parent.mkdir(parents=True, exist_ok=True)
                render_preview(scene, first, last, tmp_mp4, saved["hide_render"])
        # Everything rendered and checked: move the new stills in, then the
        # index, then drop stills the new set no longer has.
        still_dir.mkdir(parents=True, exist_ok=True)
        new_names = {f"t{t:.3f}.png" for t, _frame in stills}
        for name in sorted(new_names):
            os.replace(staging / name, still_dir / name)
        write_index(still_dir / "index.json", shot_id, stills)
        for old in still_dir.iterdir():
            if STILL_RE.match(old.name) and old.name not in new_names:
                old.unlink()
        if preview:
            os.replace(tmp_mp4, preview_path)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
        tmp_mp4.unlink(missing_ok=True)
    return {
        "stills": [still_dir / f"t{t:.3f}.png" for t, _frame in stills],
        "frames": [frame for _t, frame in stills],
        "index": still_dir / "index.json",
        "preview": preview_path if preview else None,
        "preview_frames": (first, last) if preview else None,
    }


def _main():
    if not bpy.app.background:
        raise RuntimeError("run headless (--background); in a live session call render() instead")
    shot_id, ts, out_dir, preview = parse_args(sys.argv)
    result = render(shot_id, ts, out_dir, preview)
    print(f"render_stills: wrote {[str(p) for p in result['stills']]} (frames {result['frames']})")
    if result["preview"]:
        print(f"render_stills: wrote {result['preview']} (frames {result['preview_frames'][0]}-{result['preview_frames'][1]})")


if __name__ == "__main__":
    # Blender exits 0 on an uncaught exception in --python, so exit 1 explicitly.
    try:
        _main()
    except Exception:
        traceback.print_exc()
        print("render_stills: FAILED")
        sys.exit(1)
