"""Midnight to Dawn: Blender-side parity settings (F.2/B.01).

The single place the Blender half of the parity rules is set (docs/plan.md ›
Blender-to-web parity rules). Every scene script calls ``apply()`` first, and
no scene script overrides these values for one shot.

Sets: metric units (scale 1, meters), 30 fps, 1920 x 1080 at 100 %, sRGB display,
AgX view transform, look None, exposure 0, gamma 1, Eevee with fixed samples
(render 64, viewport 16), no motion blur, opaque film.

Use from another script in this folder::

    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import settings
    settings.apply()

Run directly to apply, print and check every value (exits 1 on any failure)::

    ~/Applications/blender-5.2.4-linux-x64/blender --background --factory-startup \
        --python blender/scripts/settings.py

Enum identifiers are matched against what this Blender offers, never trusted
blindly: if a wanted value is missing (e.g. AgX on a Blender whose OpenColorIO
can't load its config), the script fails and lists what is available.
"""

import math
import random
import re
import sys
import traceback

import bpy

# (label, owner getter, property, wanted value, kind). Order matters: units
# system before length unit, display device before view transform before look.
# Enum wanted values are tuples of acceptable identifiers, best first.
TARGETS = (
    ("render.engine", lambda s: s.render, "engine", ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"), "enum"),
    ("units.system", lambda s: s.unit_settings, "system", ("METRIC",), "enum"),
    ("units.scale_length", lambda s: s.unit_settings, "scale_length", 1.0, "float"),
    ("units.length_unit", lambda s: s.unit_settings, "length_unit", ("METERS",), "enum"),
    ("render.fps", lambda s: s.render, "fps", 30, "int"),
    ("render.fps_base", lambda s: s.render, "fps_base", 1.0, "float"),
    ("render.resolution_x", lambda s: s.render, "resolution_x", 1920, "int"),
    ("render.resolution_y", lambda s: s.render, "resolution_y", 1080, "int"),
    ("render.resolution_percentage", lambda s: s.render, "resolution_percentage", 100, "int"),
    ("render.pixel_aspect_x", lambda s: s.render, "pixel_aspect_x", 1.0, "float"),
    ("render.pixel_aspect_y", lambda s: s.render, "pixel_aspect_y", 1.0, "float"),
    ("color.display_device", lambda s: s.display_settings, "display_device", ("sRGB",), "enum"),
    ("color.view_transform", lambda s: s.view_settings, "view_transform", ("AgX",), "enum"),
    ("color.look", lambda s: s.view_settings, "look", ("None",), "enum"),
    ("color.exposure", lambda s: s.view_settings, "exposure", 0.0, "float"),
    ("color.gamma", lambda s: s.view_settings, "gamma", 1.0, "float"),
    ("color.use_curve_mapping", lambda s: s.view_settings, "use_curve_mapping", False, "bool"),
    ("color.use_white_balance", lambda s: s.view_settings, "use_white_balance", False, "bool"),
    ("eevee.taa_render_samples", lambda s: s.eevee, "taa_render_samples", 64, "int"),
    ("eevee.taa_samples", lambda s: s.eevee, "taa_samples", 16, "int"),
    ("render.use_motion_blur", lambda s: s.render, "use_motion_blur", False, "bool"),
    ("render.film_transparent", lambda s: s.render, "film_transparent", False, "bool"),
)

_PROBE = "__mtd_probe__"

# Texture color spaces (parity rules › Texture spaces).
_COLOR_SPACES = {
    "color": ("sRGB",),  # base color / albedo
    "data": ("Non-Color",),  # normal, roughness, stroke-order, VAT
}


def _enum_choices(owner, prop):
    """Identifiers this Blender accepts for an enum property.

    ``bl_rna`` under-reports dynamic enums (engine, view transform, look,
    display device, length unit) with a placeholder such as 'NONE', so the
    list from the TypeError of a rejected probe assignment wins when there is
    one. The value is left unchanged.
    """
    rna_choices = [item.identifier for item in owner.bl_rna.properties[prop].enum_items]
    original = getattr(owner, prop)
    try:
        setattr(owner, prop, _PROBE)
    except TypeError as err:
        message = str(err)
        if "not found in" in message:
            accepted = re.findall(r"'([^']*)'", message.split("not found in", 1)[1])
            if accepted:
                return list(dict.fromkeys(accepted))
    else:  # never expected; restore the original so no bogus value is left behind
        setattr(owner, prop, original)
        raise RuntimeError(f"{prop}: probe value was accepted")
    return rna_choices


def _match_enum(owner, prop, wanted, label):
    """First wanted identifier that is available (exact, then case-insensitive)."""
    choices = _enum_choices(owner, prop)
    for candidate in wanted:
        if candidate in choices:
            return candidate
    lowered = {c.lower(): c for c in choices}
    for candidate in wanted:
        if candidate.lower() in lowered:
            return lowered[candidate.lower()]
    raise RuntimeError(f"{label}: none of {list(wanted)} is available; this Blender offers {choices}")


def _same(current, value, kind):
    if kind == "float":
        return math.isclose(current, value, rel_tol=0.0, abs_tol=1e-6)
    return current == value


def _set(owner, prop, value, kind, label, changes):
    current = getattr(owner, prop)
    if _same(current, value, kind):
        return
    try:
        setattr(owner, prop, value)
    except TypeError as err:
        raise RuntimeError(f"{label}: could not set {value!r}: {err}") from err
    changes[label] = (current, getattr(owner, prop))


def _resolved_targets(scene):
    """(label, owner, prop, value, kind) with enum values resolved for this Blender."""
    for label, get_owner, prop, wanted, kind in TARGETS:
        owner = get_owner(scene)
        value = _match_enum(owner, prop, wanted, label) if kind == "enum" else wanted
        yield label, owner, prop, value, kind


def apply(scene=None):
    """Apply every parity setting to ``scene`` (default: the current scene).

    Returns ``{label: (old, new)}`` for each value it changed, so a second call
    returns ``{}``. Raises RuntimeError if a wanted value isn't available.
    """
    scene = scene or bpy.context.scene
    changes = {}
    # Resolve and set one at a time: later enums (view transform, look) depend
    # on earlier ones (display device, view transform).
    for label, owner, prop, value, kind in _resolved_targets(scene):
        _set(owner, prop, value, kind, label, changes)
    return changes


def read_back(scene=None):
    """Current value of every parity setting, keyed by label."""
    scene = scene or bpy.context.scene
    return {label: getattr(get_owner(scene), prop) for label, get_owner, prop, _w, _k in TARGETS}


def set_color_space(image, kind):
    """Set a texture's color space: ``"color"`` → sRGB, ``"data"`` → Non-Color.

    Returns the color space name. Assigns only if it differs.
    """
    if kind not in _COLOR_SPACES:
        raise ValueError(f"set_color_space: kind must be one of {sorted(_COLOR_SPACES)}, got {kind!r}")
    settings = image.colorspace_settings
    choices = _enum_choices(settings, "name")  # names come from the OCIO config
    name = next((c for c in _COLOR_SPACES[kind] if c in choices), None)
    if name is None:
        raise RuntimeError(f"set_color_space: none of {list(_COLOR_SPACES[kind])} available; found {choices}")
    if settings.name != name:
        settings.name = name
    return name


def seed_all(seed):
    """Seed Python's ``random`` and NumPy with a fixed seed; return a private stream.

    There is no default: each script passes its own fixed seed and records it
    (and saves it for the web where the parity rules ask).
    """
    if not isinstance(seed, int) or isinstance(seed, bool):
        raise TypeError(f"seed_all: seed must be an int, got {seed!r}")
    random.seed(seed)
    import numpy  # bundled with Blender; imported lazily so importers stay light

    numpy.random.seed(seed)
    return random.Random(seed)


def _main():
    scene = bpy.context.scene
    print(f"settings: Blender {bpy.app.version_string}, OCIO {bpy.app.ocio.version_string.replace(' ', '')}")

    changes = apply(scene)
    for label, (old, new) in changes.items():
        print(f"settings: changed {label}: {old!r} -> {new!r}")
    if not changes:
        print("settings: nothing needed changing")

    failures = []
    values = read_back(scene)
    for label, _owner, _prop, wanted, kind in _resolved_targets(scene):
        current = values[label]
        ok = _same(current, wanted, kind)
        print(f"settings: {label} = {current!r}  {'OK' if ok else f'FAIL (wanted {wanted!r})'}")
        if not ok:
            failures.append(label)
    print(f"settings: working color space = {bpy.data.colorspace.working_space!r} (info)")
    if failures:
        raise RuntimeError(f"values not set: {failures}")

    second = apply(scene)
    if second:
        raise RuntimeError(f"second apply changed {second}; apply() is not idempotent")
    print(f"settings: all {len(TARGETS)} values OK; second apply changed nothing")


if __name__ == "__main__":
    # Blender exits 0 on an uncaught exception in --python, so exit 1 explicitly
    # on failure. Success needs no exit call (and one would quit a GUI session
    # if this file were run from Blender's Text Editor).
    try:
        _main()
    except Exception:
        traceback.print_exc()
        print("settings: FAILED")
        sys.exit(1)
