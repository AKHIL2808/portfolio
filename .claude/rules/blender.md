---
paths: ["blender/**", "raw-assets/**"]
---

# Blender phase rules

Companion to the root `CLAUDE.md`, for every `<shot>/B` item. Source: `docs/tdd.md` › Asset pipeline, Characters, Environments, Export settings; `docs/plan.md` › Blender-to-web parity rules, Cast build, and the shot's **Build in Blender** checklist.

---

## The Blender-first loop (per shot)

1. **Block out** from the shot's Director's view: grey boxes, one animated camera, a timeline marker named with the shot id.
2. **Build assets:** reuse `blender/library/` kit pieces and props; add new ones only when the shot needs them.
3. **Shade:** `MTD_Toon` node group + Solidify outline from the library; environments baked with Cycles into one texture per piece.
4. **Rig and animate:** shared Rigify layout; one action per move, `<character>_<move>`.
5. **Lay out the film:** camera keys for the shot; check timing against the plan's mode and duration (beat seconds or scrub percent).
6. **Render and approve:** `pnpm blender:stills <shot>` for the stills the plan lists, plus a preview `.mp4`. Only the user approves (`/approve-shot`).
7. **Export:** `pnpm blender:export <act>` (GLB + clips, shot JSON, VAT), then `pnpm assets`.

Live building goes through the Blender MCP so the user can watch; **the final state is always saved in a script** under `blender/scripts/`, and the scene must rebuild headless from it.

---

## Parity settings (set once in `settings.py`, never per shot)

| Item | Blender side |
|---|---|
| Scale and axes | 1 unit = 1 m, transforms applied, export +Y up, origin at the base |
| Color | View transform AgX, exposure 0, sRGB |
| Texture spaces | Color = sRGB; normal, roughness, stroke-order, VAT = Non-Color |
| Toon | `MTD_Toon` node group; values copied to material custom properties (the web `ToonMaterial` reads them) |
| Outlines | Solidify + flipped normals, width in meters |
| Environments | Cycles-baked lighting in one texture per piece; 1–3 real lights, mostly for characters |
| Character lights | glTF lighting mode Standard |
| Camera | 1920 × 1080; focal length and focus distance keyed per shot |
| Animation | 30 fps keys, constraints baked, root motion removed, one action per clip, loops end `_loop` |
| Timing | Markers named with shot ids; custom properties on each marker set `mode`, `scrollLength` or `duration` |
| Randomness | Fixed seeds in scripts; scatter seeds saved for the web (e.g. `shots/act1-shaft.json`) |

**Not exportable:** particles, simulations and compositor effects. Use a VFX proxy (plane, curve, ring) for timing and framing, hidden in parity stills.

---

## Budgets (docs/tdd.md › Characters)

| Character | Triangles LOD0 / LOD1 | Bones | Textures |
|---|---|---|---|
| Akhilesh (hero) | 25k / 8k | ≤ 65 | 1 × 2048 atlas; face shape keys blink, inhale, shout |
| Pillars (6 featured) | 18k / 6k each | ≤ 65 | 1 × 1024 each; shared rig and base clips |
| Background Pillars (Hayate, Hotaru, Koharu) | 6k, one LOD | ≤ 65 | `fight_loop` only |
| Upper Rank demons | 20k / 7k | ≤ 80 | 1 × 1024; extra limbs = extra bone chains |
| Yamikage | 30k / 10k | ≤ 100 | 1 × 2048; forms = shape keys + toggled parts |
| Weak demon | 1.5k, one LOD | none (VAT) | shared 512 |
| Sumi (crow) | 3k | ≤ 20 | 512 |
| Koi | 800 | none (VAT) | shared 256 |

Environments and props: kits, not one-offs; repeated pieces exported once and instanced in code; textures max 2048, prefer 1024; LOD1 via Decimate for large pieces. Shaft kit pieces under 4k triangles; the door under 2k. VAT: max 512 × 512 per clip set, half-float EXR or 16-bit PNG. Effect textures 512 px max.

---

## Script rules

- Every scene script starts by calling `settings.py`; scripts are idempotent (clear/rebuild their own collections, never duplicate on re-run).
- Look shader nodes up by **type**, never by name; read enum identifiers instead of hard-coding them; material colors go on shader node inputs, not `diffuse_color`.
- Collections `act<N>_<thing>`; actions `<character>_<move>`; `text_anchor`, `video_anchor`, `form_anchor`, `label_anchor` empties where HTML will sit.
- Hinged objects have their origin at the hinge (tatami, floorboards, door panels, bamboo fountain).
- `export_shots.py` samples one keyframe per Blender key (not per frame) and **merges** existing events and gates by shot id; it never drops hand-added events.
- Never hand-edit exported GLBs or camera keys in `public/` or `shots/`; fix in Blender and re-export.
- Imported/third-party assets: CC0 or royalty-free only, logged in `raw-assets/LICENSES.md`. Designs are original (see `docs/plan.md` › The cast).
