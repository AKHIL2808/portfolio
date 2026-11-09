# Midnight to Dawn — Director's Implementation Plan

Nov 8, 2026 · @Akhilesh

> Converted from `docs/Midnight to Dawn — Director's Implementation Plan.pdf` on 2026-11-09.
> The PDF is the original; this file is the working copy that CLAUDE.md reads.

## How this plan works

This is the single plan for building the site: the screenplay and the build steps in one place, broken down to the level of single shots. Every shot has its Director's view (camera, action, sound, visitor), then its own Blender, code and test checklists, so you can build one small moment, like the door racing upward or the POV cut, finish it completely, and move to the next.

![The shot loop: Read the shot → Build in Blender → Render and approve → Export → Code the shot → Parity test → Stitch with the previous shot → Next shot, with loops back for "not approved", "parity fails: fix code" and "a visible jump: fix in Blender"](images/plan-shot-loop.png)

*the shot loop · repeated for every shot and transition*

Text version of the diagram ("Every shot is built, approved, coded, tested and stitched before the next"):

1. **Read the shot**: Director's view: camera, action, sound
2. **Build in Blender**: props, character clips, camera, marker
3. **Render and approve**: watch it against the Director's view (not approved → back to Build in Blender)
4. **Export**: GLB, clips, shot JSON, then optimize
5. **Code the shot**: same materials, lights, camera, cues, gates
6. **Parity test**: browser frame vs Blender still, 0.90+ (parity fails: fix code → back to Code the shot)
7. **Stitch with the previous shot**: play both together: no jump in camera or pose (a visible jump: fix in Blender → back to Build in Blender)
8. **Next shot**: tick the boxes, commit, move on

Framing and timing problems are always fixed in Blender and re-exported; code problems are fixed in code. A shot is never left with a known jump into the next one.

## Order of work

1. Foundation and parity setup.
2. Cast build (Akhilesh first).
3. Each act in order: its Set and scaffold first, then its shots one by one, with transitions where they appear.
4. Final assembly.

## Naming

- Shot ids match the screenplay (`1.5`, `T1→2`, `3K-A` for Kaname's P.A, `4R6-D` for Rank Six's R.D). They are used for Blender markers, shot JSON entries, test names, commits and `docs/progress.md`.
- Set files: `blender/scenes/act<N>-<name>.blend`; bridges: `blender/scenes/bridge_<from>-<to>.blend`.

## Working with Claude Code

- Keep the Technical Design Document as `docs/tdd.md` for architecture and budgets, and this plan as `docs/plan.md`.
- One session covers one to three shots: a Blender session (build, render, export), then a code session (code, test, stitch).
- Start each session in plan mode:

```text
Read CLAUDE.md, docs/plan.md (shots 1.5 and 1.6) and docs/tdd.md.
Propose a plan for the Blender checklist of these two shots only,
following the Director's view exactly. Don't build until I approve.
```

## Story bible

The whole portfolio is one night told as a single unbroken camera journey: Akhilesh falls into an endless castle at midnight, finds a moment of calm, fights beside the Pillars, defeats the Upper Ranks and the Demon King Yamikage, and wakes at dawn in the Mansion to leave a message for whoever came along for the ride.

### Acts and pages

| Act | Page | Story beat | Runtime |
|---|---|---|---|
| 0 Breath | Loading | The visitor breathes in; the paper door opens | until loaded |
| 1 The Fall | Home | Chaos and speed; the name appears on a racing door | ~35 s |
| 2 The Quiet Room | About | Silence and warmth; four scrolls tell who Akhilesh is | visitor-paced |
| 3 The Battlefield | Skills | The Pillars fight; each victory leaves a skill behind | ~60 s |
| 4 The Upper Ranks | Projects | Each strong demon is a problem Akhilesh solved | ~70 s |
| 5 The Demon King | Experience | Yamikage's phases are the experience timeline | ~45 s |
| 6 Dawn | transition | The castle breaks into light; a blink | ~6 s |
| 7 The Mansion | Contact | Morning calm; ink, paper, and Sumi the crow | visitor-paced |

### Sound motifs

| Sound | Meaning |
|---|---|
| Single taiko hit | The world is about to shift |
| Double taiko hit | Danger is close |
| Heartbeat | Time is slowing down |
| Sharp inhale | A breathing form begins |
| One second of silence | Impact or revelation |
| Wind chime and crickets | Safety |
| Bamboo fountain clack | Peace: the drum at rest (final scene only) |

### Color script

| Act | Palette | Mood |
|---|---|---|
| 1 | Deep indigo, cold purple, small orange lanterns | Lost, dizzy |
| 2 | Warm amber, wisteria purple | Safe, personal |
| 3 | Dark base + each Pillar's element color | Energy, teamwork |
| 4 | Crimson and black | High stakes |
| 5 | Black and blood red, then gold light leaking in | Final struggle, hope |
| 6 | White to soft gold | Release |
| 7 | Morning green, pale wood, wisteria | Calm, gratitude |

### Ink Breathing

Akhilesh's own style. His blade leaves black ink strokes that fade to gray, and every form is named after a stroke of calligraphy: First Form: Falling Stroke (a spiral that slows a fall), Second Form: Splitting Line (one clean horizontal slash), Final Form: Signature (the blade writes a full circle in the air).

### Camera words

| Term | Meaning |
|---|---|
| Wide / close-up / ECU | Far away / one face or object / only eyes, hand or blade |
| POV | Through Akhilesh's eyes |
| Dolly in / out | Camera moves straight closer / farther |
| Tracking | Camera moves alongside a moving subject |
| Crane | Camera rises or drops vertically |
| Orbit | Camera circles a subject |
| Whip pan | Very fast sideways spin with blur, used as a cut |
| Dutch angle | Camera tilted sideways; feels uneasy |
| Speed ramp | Slow, then fast, then slow again |
| Rack focus | Focus shifts from a near object to a far one |

## The cast

The theme comes through a full original cast built in the anime's spirit: a sword-wielding hero with his own breathing style, Pillars with distinct personalities and elements, ranked demons, a demon king, and a messenger crow. Every design below is original, so the site is unmistakably your own work.

### Heroes

| Character | Role | Breathing / skill group | Personality on screen | Design direction |
|---|---|---|---|---|
| Akhilesh | The hero; the portfolio owner's avatar | Ink Breathing | Quiet, focused; speaks only his form names | Dark corps uniform; haori in ink-wash that fades from black at the shoulders to white at the hem; brush-stroke sword guard; blade edge fades black to gray |
| Kaname Hebiishi | Serpent Pillar | Serpent · core languages | Sharp, precise, dry humor | Purple scale-pattern coat, high collar, curved blade |
| Minato Sazanami | Water Pillar | Water · data and ML | Calm, few words | Layered sea-blue coat with white foam edging, long straight blade with a wave line |
| Kiri Shizuku | Mist Pillar | Mist · AI and LLMs | Dreamy, notices everything | Pale gray layered robes, long veil-like scarf, thin blade |
| Homura Akane | Flame Pillar | Flame · frontend | Loud, warm, encouraging | Cropped dark hair with ember-red tips, short ember-orange jacket, wide blade |
| Hibiki Narukami | Sound Pillar | Sound · backend and APIs | Rhythmic, theatrical | Drum-skin pattern on the back, bells on the scabbard, single heavy blade |
| Iwao Kanemori | Stone Pillar | Stone · databases | Huge, gentle, steady | Stone-gray heavy coat, broad thick blade, prayer beads around the wrist |
| Hayate, Hotaru, Koharu | Wind, Insect and Love Pillars | Background fighters (cloud, testing, design) | Seen in the distance | Lighter models, LOD only |
| Sumi | Messenger crow | — | Cheeky, loyal | Black crow with a white ink-drop mark on the chest |

### Demons

| Character | Role | Design direction |
|---|---|---|
| Weak demons | The swarm in Act 3 | Small, hunched, shadow-black with glowing red eyes; one shared design |
| The Upper Ranks (six) | Act 4 bosses; each is a problem a project solved | Each built from its problem: The Endless Inbox, The Tangled Web, The Wrong Measure, The Slow Machine, The Faceless Crowd, The Market Storm; a glowing rank mark in the eye |
| Yamikage | The Demon King, Act 5 | Calm and elegant at first: black ceremonial robes with blood-red lining, long dark hair tied with a red cord, red slit-pupil eyes; grows arms, whips, armor and spikes across his phases |

### Character moments in the story

- Act 2: Sumi perches on the windowsill of the Quiet Room, then caws and flies off just before the floor opens.
- Act 3: after the last swarm falls, Homura claps Akhilesh on the shoulder and Iwao gives a slow nod.
- Act 4: the Pillar whose skills built each project fights beside Akhilesh in that fight.
- Act 5: Iwao and Minato pin Yamikage in place so Akhilesh can draw the Final Form.
- Act 7: Iwao asleep against a tree, Hibiki sharpening his blade, Kiri feeding a bird, Homura waving; Sumi carries the visitor's message.

## Blender-to-web parity rules

Every shot in the browser must look the same as its Blender render, so both sides share these settings, set once in the Foundation and never changed per shot.

| Item | Blender side | Web side |
|---|---|---|
| Scale and axes | 1 unit = 1 m, transforms applied, export +Y up | three.js meters, Y up |
| Color | View transform AgX, exposure 0, sRGB | `AgXToneMapping`, exposure 1, sRGB output |
| Texture spaces | Color = sRGB; normal, roughness, stroke-order, VAT = Non-Color | `SRGBColorSpace` / `NoColorSpace` |
| Toon shading | `MTD_Toon` node group; values copied to material custom properties | `ToonMaterial` reads the same custom properties |
| Outlines | Solidify + flipped normals, width in meters | `InkOutline` with the same width |
| Environments | Cycles-baked lighting in one texture per piece | Unlit material with the baked texture |
| Character lights | 1–3 lights, glTF lighting mode Standard | Lights imported from the GLB |
| Camera | 1920 × 1080, focal length and focus distance keyed per shot | FOV and focus from `shots/<act>.json` |
| Animation | 30 fps, constraints baked, one action per clip | `AnimationMixer` driven by the Director's time |
| Timing | Markers named with shot ids | Shot JSON from `export_shots.py` |
| Randomness | Fixed seeds in scripts | Seeded random in VFX and scatter |

Not exportable: particles, simulations and compositor effects. Keep a simple VFX proxy in Blender for timing and framing, and approve the real effect in the browser.

The parity test, for every shot:

1. `pnpm blender:stills <shot>` renders 1–3 key frames (Eevee, 1920 × 1080, VFX proxies hidden).
2. `/dev/shot?shot=1.5&t=0.5` freezes the browser at the same moment, VFX off, fixed seed.
3. Playwright screenshots it and compares; pass = similarity 0.90 or higher, otherwise a side-by-side difference image is saved.

## Foundation

The Foundation gives every shot the same tools: the web project, the export scripts, the Director and core systems, and the per-shot test harness. Architecture details are in the Technical Design Document.

### F.1 Project setup

- Next.js + TypeScript strict + Tailwind; install and pin the stack from the TDD.
- Folders from the TDD's Project structure, including `blender/`; Git LFS for `.blend`, `.png`, `.exr`.
- `CLAUDE.md`, `docs/tdd.md`, `docs/plan.md` (this document), `docs/progress.md`.
- Blender MCP connected to Claude Code; confirm it can create an object in an open file.
- CI (typecheck, lint, unit tests) and Vercel preview deploys.

### F.2 Blender settings and scripts

- `settings.py`: meters, 30 fps, 1920 × 1080, AgX, Eevee preview settings; every scene script calls it first.
- `export_glb.py`: chosen collections with custom properties, clips, shape keys, lights.
- `export_shots.py`: camera keys, focal length, focus distance, markers → `shots/<act>.json`, merging existing events by shot id.
- `bake_vat.py`: animated mesh → VAT textures + metadata.
- `render_stills.py`: renders a shot's key frames for the parity test.
- Commands: `pnpm blender:export <act>`, `pnpm blender:stills <shot>`, `pnpm assets`.

### F.3 Core web systems

- Store, Director (act registry, scrub shots, beat shots, gates), camera rig (main + POV), `useActFrame` with time scale.
- Lenis + ScrollTrigger with lock/unlock; input (hold, swipe, click, keys); audio cues; asset manager; quality tiers.
- `ToonMaterial` and `InkOutline` matching the Blender library.
- HUD: quick menu, skip, mute, breathing ring.

### F.4 Test harness

- `/dev/shot` page: freezes any shot at any time, VFX off, fixed seed.
- `/dev/stitch?from=1.4&to=1.6`: plays a range of shots on a loop, for checking continuity.
- Playwright parity test and a per-act performance test (FPS, draw calls, triangles).

**Done when:** a test cube scene exports from Blender, plays in the browser through the Director, and passes the parity test.

## Cast build

Each character is built once, with its base animations, before any scene uses it; shot-specific moves are added later inside each shot. Build Akhilesh first, because his rig becomes the base for every Pillar.

### The character template (repeat per character)

- Concept: front, side and back reference sheet from the Cast design direction; approve before modeling.
- Model: start from a base mesh or sculpt; stay within the triangle budget; make LOD1.
- UVs and texture: one atlas; paint flat anime colors (shading comes from the toon material).
- Material: `MTD_Toon` + outline from the library; check under the Act 1 and Act 7 lighting.
- Rig: Rigify on the shared layout; sword socket bone; face shape keys (blink, inhale, shout).
- Base clips: listed in the table below.
- Turntable: render a 360° turn and approve.
- Web check: export, load on `/dev/character`, play every clip, parity test on one pose.

### Build order and budgets

| # | Character | Triangles (LOD0 / LOD1) | Bones | Base clips |
|---|---|---|---|---|
| 1 | Akhilesh | 25k / 8k | ≤ 65 | `idle`, `idle_tense`, `inhale`, `draw_sword`, `sheathe`, `run`, `jump`, `land_kneel`, `fall_loop` |
| 2 | Pillar base body | — | shared rig | `idle_combat`, `inhale`, `strike_wide`, `strike_thrust`, `land`, `leap_up` |
| 3 | Kaname, Minato, Kiri, Homura, Hibiki, Iwao | 18k / 6k each | ≤ 65 | Base set + 1–2 signature strikes |
| 4 | Hayate, Hotaru, Koharu | 6k (one LOD) | ≤ 65 | `fight_loop` |
| 5 | Weak demon | 1.5k | VAT | `swarm_loop`, `lunge`, `freeze` |
| 6 | Upper Rank demons (one first, then five) | 20k / 7k | ≤ 80 | `reveal`, `power_cast`, `attack`, `hit`, `freeze` |
| 7 | Yamikage | 30k / 10k | ≤ 100 | `seated_idle`, `eyes_open`, `stand`, `transform_<form>`, `attack_<form>`, `regenerate`, `panic_flee` |
| 8 | Sumi | 3k | ≤ 20 | `perch_idle`, `take_off`, `fly`, `land`, `pick_up`, `caw` |
| 9 | Koi | 800 | VAT | `swim_loop` |

### Shared props library

- Paper lantern (and a 300-triangle shaft version), paper sliding door, tatami mat, hanging scroll, sword designs for each character, debris pieces.
- Each prop gets toon or baked material, correct origin (hinges at the hinge), and a web check.

**Done when:** every character and prop above passes its web check; Upper Ranks 2–6 may be finished later during Act 4.

## Act 0 — Breath (Loading)

The loading screen is the visitor's first breath, and clicking the paper door is entering the castle. It must appear within 1.5 seconds and weigh under 300 KB.

### 0.0 · Set and scaffold

#### Build in Blender

- `act0-loading.blend` from `build_act0.py`: black void, ink ring plane, the library door (under 2k triangles).
- Materials: ink ring unlit black with brush texture; door paper toon with a soft inner glow; dark wood frame.

#### Code

- Act 0 module loads first with three.js core only; everything else is code-split.
- Small HTML name and role visible from the first frame; "Skip the story" link to `/cv`.

### 0.1 · Total Concentration

**Beat · loops until Act 1 has loaded**

Director: the screen is quiet and black; one ink circle breathes like a living thing while the castle loads.

- Camera: static, straight on.
- Action: the ring slowly grows and shrinks; ink fills it as loading progresses; small text *Total Concentration… 42%*.
- Sound: none (browsers block sound before the first click).

#### Build in Blender

- `ring_breathe` loop (scale 0.96 ↔ 1.04 over 4 s) and `ring_fill` (custom property 0 → 1).
- Static camera; marker `0.1`.
- Render and approve; stills at fill 0.25 and 0.75.

#### Code

- `InkRing` shader; `uFill` bound to Act 1's loading progress; breathing loop.
- Percentage as HTML under the ring.

#### Test

- Parity stills pass; visible under 1.5 s on throttled 4G.

### 0.2 · The Door

**Beat · waits for the click**

Director: the ring becomes a door; the whole site waits for one decision from the visitor.

- Camera: static, then a very slight push-in when the door appears.
- Action: the ring's outline traces into a paper sliding door. *Headphones on. Breathe in.* fades in on the paper.
- Sound: on click, a soft wooden slide.
- Visitor: click the door (or press Enter).

#### Build in Blender

- `ring_to_door` (ring fades as the door's frame draws in) and `door_open` (panels slide apart).
- `text_anchor` empty on the paper; marker `0.2`.
- Render and approve; stills: door closed, door half open.

#### Code

- Play `ring_to_door` when loading completes; text as HTML on the door surface.
- Door clickable (raycast) and focusable (Enter); click unlocks audio and starts T0→1.

#### Test

- Parity stills pass; Enter works by click and keyboard; no sound before it.

### T0→1 · Through the door

**Beat · about 2 s · hand-off: light flood**

Director: the door opens onto warm light, and we push through it into the dim corridor; one continuous move.

- Camera: dolly through the opening, ending on the 1.1 start pose behind Akhilesh.
- Action: light floods the screen for 3 frames as we cross the threshold.
- Sound: door slide; crickets fade in.

#### Build in Blender

- `bridge_0-1.blend` links the door (Act 0) and the corridor start (Act 1).
- Camera push; light-flood proxy plane for 3 frames; markers `T01` and `T01-handoff`.
- Render the bridge with 2 s on each side and approve.

#### Code

- Act 1 is already mounted; on click play `door_open`, then the bridge shot.
- At `T01-handoff`: white grade for 3 frames, hide Act 0, show Act 1; dispose Act 0 afterward.

#### Test

- No frame over 50 ms; `/dev/stitch?from=0.2&to=1.1` shows no jump.

**Act 0 done when:** the visitor watches the ring fill, clicks the door, and glides into the corridor with no visible cut.

## Act 1 — The Fall (Home page)

The Home page is one continuous fall that ends with the visitor knowing Akhilesh's name and role, and the rule that a drum means change. Scroll controls the fall; percentages show where each shot sits in the act's scroll. About 35 seconds at normal speed.

### 1.0 · Set and scaffold

#### Build in Blender

- Corridor kit, each under 4k triangles: wall panel, stair section, room box, beam, floor, ceiling grid; baked in the cold indigo palette.
- `build_act1.py` stacks the kit into a 400 m shaft with a fixed seed, rooms rotated at odd angles; seed and piece list saved to `shots/act1-shaft.json`.
- 300 shaft lanterns scattered with the same seed; emissive paper.
- Lights: one cool moonlight key and one rim light on Akhilesh only.

#### Code

- Act 1 module; rebuild the shaft from `act1-shaft.json`; recycle pieces above and below the camera.
- `LanternField` with the same seeded positions; Akhilesh loaded with toon + outline.

#### Test

- Parity still of the empty shaft from 3 heights.

### 1.1 · The Threshold

**Beat · 3 s**

Director: a breath before chaos: Akhilesh alone in a dim corridor, the visitor right behind him.

- Camera: wide from behind Akhilesh, slow dolly in.
- Action: one dying lantern ahead; his sleeve stirs in a draft from below.
- Sound: crickets, then they stop all at once.

#### Build in Blender

- Corridor start piece with a single lantern; Akhilesh `idle_tense` with a sleeve-draft layer.
- Camera dolly over 3 s; marker `1.1`. Render, approve, stills at start and end.

#### Code

- Beat shot; crickets cut on the marker's end event.

#### Test

- Parity passes; stitch T0→1 → 1.1 has no jump.

### 1.2 · First Drum: The Drop

**Scrub · scroll 0–10%**

Director: the first rule of the castle: a drum hits, and the floor is gone.

- Camera: snap to top-down directly above him; hold half a second while he falls away; then dive after him.
- Action: floorboards split and swing down like trapdoors; he shrinks into the dark.
- Sound: TAIKO; wind rush starts rising.

#### Build in Blender

- Floorboards as separate objects hinged at their edges; `floor_split` animation.
- Akhilesh `drop_start` blending into `fall_loop`.
- Camera: cut to top-down, hold, dive; marker `1.2`. Render, approve, stills: split moment, mid-dive.

#### Code

- Taiko cue on the exact split frame; `floor_split` clip; wind volume follows fall speed.

#### Test

- Drum and split land on the same frame (±1); parity passes.

### 1.3 · Endless Corridors

**Scrub · scroll 10–35%**

Director: dizzy wonder: the world turns upside down and never ends.

- Camera: swings from above to his side; tracks his fall; slowly rolls 180° so the world inverts.
- Action: rooms and staircases rotate past at impossible angles; lanterns stream upward, the nearest ones blurred; coat and hair whip upward.
- Sound: wind, wooden creaks, rooms grinding as they shift.
- Visitor: scroll speed = fall speed; mouse tilts the camera a few degrees; hint *Scroll to fall*.

#### Build in Blender

- Akhilesh `fall_upside_down` (coat and hair baked).
- Some rooms animated rotating slowly; camera path with the 180° roll; marker `1.3`.
- Render, approve, stills at 25%, 50%, 75% of the shot.

#### Code

- Piece recycling during the long scrub; room rotation clips.
- `SpeedLines` strength from fall speed; mouse parallax added on top of the camera.
- Brush hint as HTML that fades after the first scroll.

#### Test

- Scroll fast, slow and backward; memory stays flat; parity and budgets pass.

### 1.4 · Double Drum: Danger

**Beat · 2.5 s**

Director: something is coming; the castle itself warns him.

- Camera: tracking holds; slow push in toward his face.
- Action: a wave of darkness travels up the shaft and every lantern goes out; a beat later they relight red. Far below, one paper door appears, rushing up.
- Sound: DUM-DUM; wind cuts for one beat, returns lower and heavier.

#### Build in Blender

- Lantern color animation previewed as a wave by height (out, then red).
- The first door far below; camera push-in; marker `1.4`. Render, approve, stills: dark, red.

#### Code

- `LanternField` `uWaveHeight` and `uWaveColor` tweens; double-drum cue; wind ducking.

#### Test

- Wave timing matches the render; parity passes; no flashing faster than 3 per second.

### 1.5 · Racing the Door

**Scrub · scroll 40–50%**

Director: show the door's speed from outside, so the visitor feels the danger before Akhilesh does.

- Camera: leaves Akhilesh, swings out level with the door, and tracks alongside it as it rockets upward; speed lines streak past.
- Action: behind the first door, more doors snap into place one after another like a telescope; Akhilesh is a small figure at the top of the frame.
- Sound: a wooden clack for each door locking, getting faster.

#### Build in Blender

- Door tunnel: 12 doors (frame, two panels, paper); `doors_extend` animation, each lock on a keyed frame.
- Camera path alongside the doors; marker `1.5`. Render, approve, stills at start and end.

#### Code

- Door instances; one clack cue per lock frame (from markers or events); `SpeedLines` at maximum.

#### Test

- Clacks in sync; parity passes; stitch 1.4 → 1.5 smooth.

### 1.6 · POV: The Tunnel of Doors

**Scrub · scroll 50–60%**

Director: cut inside his head; the danger is now ours.

- Camera: hard cut to Akhilesh's POV looking straight down.
- Action: a tunnel of doors rushes up; each slides open just before impact, left, right, left, right, faster and faster.
- Sound: his breathing, loud and close; clacks synced to it.

#### Build in Blender

- POV camera parented to the head bone; his head and hair hidden from this camera (separate view layer).
- Alternating panel slides with accelerating timing; marker `1.6`. Render, approve, stills at 3 points.

#### Code

- Switch to the POV camera on the marker (a one-frame cut); hide head and hair meshes while POV is active.
- Breathing loop with clacks on the beat.

#### Test

- The cut is exactly one frame; no head geometry visible; parity passes.

### 1.7 · Slow Motion: The Name

**Beat + read gate · time at 5%**

Director: the whole world stops so the visitor can meet Akhilesh; the most important frame on the Home page.

- Camera: still POV; rack focus from the wooden frame to the paper.
- Action: the last door does not open. Inches away, an invisible brush writes *This is Akhilesh Singh*, then the role line beneath.
- Sound: silence except a slow heartbeat; a faint paper scratch per stroke.
- Visitor: the page waits until the last stroke is written.

#### Build in Blender

- Name and role as brush strokes; script stores stroke order as a gray value in a Non-Color texture.
- Door paper material reveals ink below a reveal value; animate reveal 0 → 1.
- Depth of field: focus distance keyed from frame to paper; marker `1.7` with `timeScale 0.05`.
- Render, approve, stills at reveal 0.5 and 1.0.

#### Code

- `setTimeScale(0.05, 0.3)`; `StrokeReveal` runs on real time so writing stays readable.
- Depth-of-field focus from the shot JSON; heartbeat and scratch cues; read gate until reveal = 1.
- Name and role from `content/profile.ts`; a script rebuilds the stroke texture when they change.

#### Test

- Parity passes at both reveal values; Space advances after the gate.

### 1.8 · The Dodge

**Beat · 1.5 s**

Director: instinct, not thought: he twists, and the name slips past his cheek.

- Camera: POV barrel-rolls 180° left; cut to a third-person side shot still in slow motion; speed ramp back to full speed.
- Action: he twists in mid-air; the door brushes his hair; the name's ink peels off as particles and settles top-left as the site logo.
- Sound: a deep whoosh as time snaps back; wind returns.

#### Build in Blender

- Akhilesh `twist_dodge`; hair brush against the door.
- Camera roll, cut, side shot; marker `1.8`. Render, approve, stills: mid-roll, door passing.

#### Code

- Roll then camera cut; `setTimeScale(1, 0.4)` speed ramp.
- `ParticleMorph` from the stroke texture to the HUD logo position; swap to the HTML logo on arrival.

#### Test

- Logo lands exactly in place; parity passes; stitch 1.6 → 1.8 feels like one moment.

### 1.9 · Ink Breathing: Falling Stroke

**Scrub · scroll 80–100%**

Director: Akhilesh takes control for the first time; the visitor sees his power.

- Camera: low angle from below as a lit room rushes up; then an orbit circling him once, following his spiral.
- Action: ECU of his eyes opening; inhale; he draws his blade; brush title *Ink Breathing · First Form · Falling Stroke*; ink ribbons spiral around him, each loop slowing the fall; he lands on one knee.
- Sound: sharp inhale, blade drawn, a whoosh per spiral, a soft landing thud.

#### Build in Blender

- `draw_sword`, `falling_stroke`, `land_kneel` clips.
- Spiral proxy (a curve) for timing; title card as a camera-facing plane with a stroke-order texture.
- Camera: low angle, then orbit; marker `1.9`. Render, approve, stills: eyes, mid-spiral, landed.

#### Code

- `InkRibbon` attached to the sword-tip bone, revealed along the spiral.
- Title card with `StrokeReveal`; inhale, blade and whoosh cues.

#### Test

- Parity passes; play the whole act via `/dev/stitch?from=1.1&to=1.9`; budgets met on High and Lite.

**Act 1 done when:** the browser plays the fall like the Blender render, controlled by scroll, and Akhilesh's name is unmistakable.

## Act 2 — The Quiet Room (About page)

After 35 seconds of chaos, the About page is the visitor's first calm, and that contrast is what makes the story feel like the anime. The room is safe because wisteria hangs outside every window.

### 2.0 · Set and scaffold

#### Build in Blender

- Room at the exact bottom of the shaft; offset saved as `act2_origin`.
- Tatami mats (each a separate object, hinged on one edge), paper walls, windows, beams; low table, tea cup with a separate tea-surface plane, teapot, incense holder; folding screen.
- Wisteria clusters and trellis outside; baked warm amber lighting; warm key + wisteria-purple rim for characters.

#### Code

- Act 2 mounts during Act 1 at `act2_origin`; unlit baked room; `WindSway` wisteria.

### T1→2 · The ripple lights the room

**Continuous · no cut · hand-off: camera passes the ceiling line**

Director: the landing and the room are one moment: ink spreads from his knee, and the room wakes up around him.

- Camera: the end of the 1.9 orbit flows down into the low start pose of 2.1.
- Action: an ink ripple spreads across the tatami; each lantern lights as the ripple reaches it.
- Sound: landing thud; wind fades; crickets and wind chimes fade in.

#### Build in Blender

- `bridge_1-2.blend` links the shaft bottom and the room; ripple proxy ring; lantern light-up order by distance.
- Markers `T12-ripple`, `T12-handoff`. Render the last 4 s of Act 1 into the first 4 s of Act 2; approve.

#### Code

- `RingRipple` on the tatami; lantern emission ramps when the ripple radius reaches each one.
- At `T12-handoff`: unmount the shaft, lanterns and doors.

#### Test

- No frame over 50 ms; parity stills: ripple halfway, all lit; scrolling back re-enters Act 1.

### 2.1 · The Room Reveals Itself

**Scrub · 1 screen**

Director: exhale. Show the visitor this is a safe place before showing them anything personal.

- Camera: starts low on the kneeling Akhilesh, cranes up and back to a wide of the whole room.
- Action: he rises and slides his sword into its sheath; tea steaming, wisteria swaying, incense curling. Sumi perches on the windowsill, head tilted.
- Sound: sheath click; wind chimes; a slow shamisen melody begins.

#### Build in Blender

- Akhilesh `rise_from_kneel` → `sheathe` → `idle_calm`; Sumi `perch_idle` on the sill.
- Crane camera; marker `2.1`. Render, approve, stills: start, wide.

#### Code

- Steam and incense as small particle ribbons; sheath and chime cues; music starts.

#### Test

- Parity passes; stitch T1→2 → 2.1 continuous.

### 2.2 · The Scrolls

**Scrub + 4 read gates**

Director: the visitor reads Akhilesh's story at their own pace; the camera serves the reading.

- Camera: slow pan along the far wall; on a click, dolly in until the scroll fills the screen.
- Action: four scrolls labeled *Who I Am*, *My Path*, *What Drives Me*, *Beyond Code*; a hovered scroll sways and its word glows; a clicked one unrolls and its text writes in ink.
- Visitor: hover, click, read, click outside or press Escape to close.

#### Build in Blender

- Scroll rig with a short bone chain: `scroll_sway`, `scroll_unroll`, `scroll_roll_up`; `text_anchor` empty on the paper.
- Brush word textures; four dolly-in camera poses as markers `2.2-who`, `2.2-path`, `2.2-drive`, `2.2-beyond`.
- Render the pan and one scroll opening; approve; stills: pan, each scroll open.

#### Code

- Hover plays `scroll_sway`; click flies the camera to the pose and plays `scroll_unroll`.
- Text from `content/profile.ts` as HTML at `text_anchor` (`<Html transform occlude>`), fading in as it unrolls.
- Gate resolves when all four are read or the visitor keeps scrolling.

#### Test

- Each scroll by mouse, touch and keyboard; screen reader reads the text; parity passes (HTML hidden).

### 2.3 · The Portrait (optional)

**Scrub · half a screen**

Director: one human face before the storm.

- Camera: slow push-in on the folding screen.
- Action: an ink-wash portrait of Akhilesh settles from blurry to sharp as the camera arrives.

#### Build in Blender

- Portrait texture on the screen; camera push; marker `2.3`. Render, approve, still at the end.

#### Code

- Blur-to-sharp shader driven by camera distance.

#### Test

- Parity passes at the end frame.

### 2.4 · The Warning

**Beat · 4 s**

Director: peace breaks quietly before it breaks loudly.

- Camera: ECU of the tea cup; then a medium shot of Akhilesh.
- Action: rings appear on the tea: again, again. Lanterns flicker. Sumi caws once and flies off. Akhilesh's hand moves to his sword.
- Sound: a heartbeat thump from far below, growing; the music stops mid-note.

#### Build in Blender

- Tea ripple proxy; lantern flicker animation; Sumi `caw` → `take_off`; Akhilesh `hand_to_sword`.
- Camera ECU then medium; marker `2.4`. Render, approve, stills: tea rings, hand on sword.

#### Code

- `RingRipple` triggered by heartbeat cues; flicker on the same cues; music stop event.

#### Test

- Ripples land exactly on the thumps; parity passes.

**Act 2 done when:** the room plays like the Blender render and all four scrolls work with every input method.

## Transition 2→3 — The Floor Opens

The drum takes the safe room away: the mats flip open like dominoes, Akhilesh drops, and three seconds of darkness carry the sounds of battle before the battlefield appears. The swap happens in that darkness.

### 2.5 · The Floor Opens

**Beat · 3 s**

Director: he could run, but he doesn't; he closes his eyes and lets the castle take him.

- Camera: wide from the ceiling looking down.
- Action: on the drum, the tatami flip open one after another from the far wall toward him. He closes his eyes; the floor under him opens; he drops. The camera holds at the ceiling for 1 second looking into the hole, then dives.
- Sound: TAIKO; mats slapping open in rhythm.

#### Build in Blender

- `tatami_flip` with a stagger from the far wall; Akhilesh `close_eyes` → `drop`.
- Ceiling camera, 1 s hold, dive; marker `2.5`. Render, approve, stills: half flipped, the hole.

#### Code

- Taiko cue; mat flip clip with the slaps synced; scroll locked for the beat.

#### Test

- Slaps match each mat's flip frame; parity passes.

### T2→3 · The Dark Fall

**Beat · 3 s · hand-off: full black**

Director: let the ears see first: the visitor hears the war before they see it.

- Camera: dive into complete black; emerge low over the battlefield floor for 3.1.
- Action: nothing visible; Akhilesh falls in darkness.
- Sound: a sound bridge that rises: steel clashing, demons screaming, fire roaring, thunder.

#### Build in Blender

- `bridge_2-3.blend` links the room and the Act 3 landing platform; camera path through black; markers `T23-dark`, `T23-handoff`.
- Render the floor opening through the landing with a temporary sound track; approve the timing.

#### Code

- Act 3 starts loading at Act 2 50%; if it isn't ready, the black holds with a breathing ring until it is.
- During `T23-dark`: unmount Act 2, show Act 3; play the sound bridge.

#### Test

- The hand-off frame is fully black (pixel check); the hold-until-loaded works on a throttled connection.

## Act 3 — The Battlefield (Skills page)

Each Pillar is one skill group: they defeat a swarm of weak demons, and the ash re-forms into that group's skill icons. The Pillar sequence is seven small shots (P.A to P.G); build all seven for Kaname first, test them, then repeat for each Pillar.

### 3.0 · Set and scaffold

#### Build in Blender

- 3 platform meshes reused 9× at odd angles by `build_act3.py` (fixed seed); dark chamber walls; fog card layers.
- A glowing beacon column above each platform in its Pillar's color; baked lighting tinted per platform.
- Weak-demon crowd: 3 clips baked with `bake_vat.py`; 200 positions scattered with a fixed seed.

#### Code

- Rebuild the chamber from the seed file; `VATCrowd`; beacons with bloom; background Pillars on `fight_loop` at LOD1.

### 3.1 · Hero Landing

**Beat · 2 s**

Director: he arrives like he belongs here.

- Camera: low angle, close to the ground.
- Action: Akhilesh slams down in a three-point landing; a ring of dust and cracked stone blasts outward and slowly clears.
- Sound: heavy impact, then the full battle sound.

#### Build in Blender

- Akhilesh `hero_landing`; crack decal and dust-ring proxy; camera; marker `3.1`.
- Render, approve, stills: impact, dust cleared.

#### Code

- Dust ring particles, crack decal, camera shake; battle ambience to full.

#### Test

- Parity passes; stitch T2→3 → 3.1 lands on the beat.

### 3.2 · The Battle Map

**Scrub · 1 screen, then free choice**

Director: show the scale of the war, then hand the visitor the choice of where to go.

- Camera: crane up and rotate 360° to reveal everything, settling in a wide view.
- Action: floating platforms at crazy angles; on each, a Pillar fights a swarm; their element colors glow like beacons.
- Visitor: scroll to visit Pillars in order, or click a beacon to fly straight to one; a small battle map shows visited Pillars.

#### Build in Blender

- Crane-and-rotate camera; each platform's "arrival pose" saved as a marker `3.2-<pillar>`.
- Render, approve, stills: mid-rotation, settled wide.

#### Code

- Beacons clickable and keyboard-focusable; click flies the camera to that Pillar's P.A start.
- Battle-map HUD tracking visited Pillars.

#### Test

- Every beacon reachable by mouse, touch and Tab; parity passes.

### The Pillar sequence (repeat per Pillar)

#### P.A · Approach

**Beat · 1.5 s**

- Camera: fast fly-through across the gap to the Pillar's platform; ducks a claw.
- Action: demons blur past; one swipes inches from the lens.
- Sound: wind rush, growls.
- Blender: camera path; one demon's lunge timed at the lens; marker `3<P>-A`; render, approve, still.
- Code: play path; VAT lunge for the nearest instance.
- Test: parity; no clipping through demons.

#### P.B · Breath

**Beat + hold gate · time at 20%**

- Camera: ECU of the Pillar's eyes and mouth.
- Action: glowing breath mist in the element color.
- Sound: heartbeat, deep inhale.
- Visitor: a breathing ring appears; press and hold to strike (auto after 3 s).
- Blender: `inhale` + face shape keys; ECU camera; marker `3<P>-B`; render, approve, still.
- Code: `setTimeScale(0.2)`; breath-mist particles; hold gate.
- Test: hold works by mouse, touch and Space; auto-resolve after 3 s.

#### P.C · The Call

**Beat · 1.5 s**

- Camera: close-up, slight low angle.
- Action: the Pillar calls the form; brush title card slams in, in the element color.
- Sound: voice line (or none, title only); drum accent.
- Blender: `shout` shape key; title-card plane with stroke-order texture; marker `3<P>-C`; render, approve, still.
- Code: `StrokeReveal` title; voice and drum cues.
- Test: title readable for at least 1 s; parity.

#### P.D · Strike

**Beat · 2 s · speed ramp**

- Camera: slow wind-up, real-speed blur, freeze at the peak.
- Action: the element becomes a huge shape frozen for half a second.
- Sound: silence, then one huge impact.
- Blender: signature strike clip; burst proxy mesh at the peak; camera with the freeze; marker `3<P>-D`; render, approve, stills: wind-up, peak.
- Code: `ElementTrail` on the sword bone; `ElementBurst` at the freeze; ramp `0.2 → 1 → 0.02 → 1`.
- Test: burst appears on the impact frame; parity with VFX off.

#### P.E · Reverse

**Beat · 1.5 s**

- Camera: whip around to the demons' side.
- Action: demons freeze, crack like dry clay, and turn to ash drifting upward.
- Sound: crumbling, a sigh of wind.
- Blender: crowd `freeze`; whip camera; marker `3<P>-E`; render, approve, still.
- Code: VAT `freeze`; staggered `Dissolve` per instance; ash particles.
- Test: every instance in the swarm dissolves; no leftovers.

#### P.F · Skill Reveal

**Beat · 3 s**

- Camera: slow orbit around the floating icons.
- Action: ash swirls together and forms the skill icons in an arc, glowing in the element color.
- Sound: a soft chime per icon.
- Visitor: hover an icon to see its card.
- Blender: each skill's logo extruded into a thin 3D icon; arc positions; orbit camera; marker `3<P>-F`; render, approve, still.
- Code: `ParticleMorph` from ash to icon points; icons and cards from `content/skills.ts`; HTML card on hover.
- Test: icons match content; parity of the final arc.

#### P.G · Exit

**Beat · 0.5 s**

- Camera: whip pan with motion blur to the next Pillar's P.A.
- Sound: whoosh.
- Blender: whip camera; marker `3<P>-G`.
- Code: motion-blur pass on; whoosh cue.
- Test: stitch P.F → next P.A without a visible jump.

### Pillar list

| # | Pillar | Skill group | Form call | Burst shape | Color |
|---|---|---|---|---|---|
| 1 | Kaname Hebiishi | Core languages | Serpent Breathing · Third Form · Silent Scale | A purple serpent coiling through the swarm | Purple |
| 2 | Minato Sazanami | Data and ML | Water Breathing · Fourth Form · Rippling Current | A leaping koi made of water | Blue |
| 3 | Kiri Shizuku | AI and LLMs | Mist Breathing · Second Form · Veil of Dawn | Fog that parts to reveal glowing moths | Pale teal |
| 4 | Homura Akane | Frontend | Flame Breathing · Third Form · Lantern Bloom | A burning crane spreading its wings | Orange |
| 5 | Hibiki Narukami | Backend and APIs | Sound Breathing · Second Form · Echoing Drum | Giant rings of sound with drum patterns | Gold |
| 6 | Iwao Kanemori | Databases | Stone Breathing · First Form · Mountain's Weight | A mountain silhouette crashing down | Stone gray |

- [ ] Kaname: P.A–P.G built, coded, tested
- [ ] Minato: P.A–P.G built, coded, tested
- [ ] Kiri: P.A–P.G built, coded, tested
- [ ] Homura: P.A–P.G built, coded, tested
- [ ] Hibiki: P.A–P.G built, coded, tested
- [ ] Iwao: P.A–P.G built, coded, tested

### 3.3 · Ash Snow

**Beat · 3 s**

Director: the war stops; silence is the reward.

- Camera: wide, very slow push in.
- Action: the last demon dissolves; grey ash falls like snow; the Pillars land one by one in a circle around Akhilesh.
- Sound: total silence, then only breathing.

#### Build in Blender

- Pillars land in sequence around Akhilesh; ash-snow proxy; camera; marker `3.3`.
- Render, approve, still.

#### Code

- Ash-snow particles; landing cues; ambience drops to silence.

### 3.4 · The Circle

**Beat · 3 s**

Director: these warriors are a team, and Akhilesh is one of them.

- Camera: low-angle orbit around the whole group.
- Action: blades lowered, catching their breath. Homura claps Akhilesh on the shoulder; Iwao gives a slow nod.

#### Build in Blender

- Homura `shoulder_clap`, Iwao `nod`, others `catch_breath`; orbit camera; marker `3.4`.
- Render, approve, stills.

#### Code

- All six Pillars at LOD0 only for this shot; others paused.

#### Test

- Parity passes; budget holds with six skinned characters on High.

**Act 3 done when:** every Pillar plays its sequence like its render and reveals the right skills from content.

## Act 4 — The Upper Ranks (Projects page)

Each Upper Rank demon is the problem one project solved, and the visitor delivers the final blow to reveal it. The fight is six small shots (R.A to R.F); build all six for Rank Six first, test them, then repeat up to Rank One.

### 3.5 / T3→4 · Double Drum: The Ascent

**Beat · 4 s · hand-off: mid-leap, camera pointing straight up**

Director: the real enemies were above them all along; the team rises together.

- Camera: tilt up high above the group; cut to a low-angle slow-motion leap; rise fast with them.
- Action: DUM-DUM. The chamber rotates and rearranges; balconies slide into place far above, six tall figures standing on them with glowing rank marks in their eyes. Akhilesh and the Pillars leap upward, their element trails rising like fireworks.
- Sound: double drum, grinding architecture; the music returns faster and darker.

#### Build in Blender

- `bridge_3-4.blend` links the battlefield and the balcony tier (placed above at `act4_origin`).
- Chamber rotation and balcony slide animations; the six Upper Ranks in idle poses; everyone's `leap_up`.
- Camera tilt, cut, rise; markers `3.5`, `T34-handoff`. Render from 3.4 to the first R.A; approve.

#### Code

- Act 4 mounts after the fourth Pillar; rotation and slide clips; every Pillar's `ElementTrail` during the leap.
- At `T34-handoff`: full speed lines and blur; unmount the crowd, platforms and background Pillars (spread disposal across frames).

#### Test

- No frame over 50 ms; parity stills: balconies revealed, mid-leap; scrolling back restores 3.4.

### 4.0 · Set and scaffold

#### Build in Blender

- Six balconies up the castle wall from one balcony kit; wall-run paths between them; baked crimson and black, an accent light color per demon.
- Talisman: tall paper strip with tassels, 4-bone sway rig, unfurl clip, `text_anchor` and `video_anchor` empties.

#### Code

- `RankFight` component that plays R.A–R.F from a demon config and its project in `content/projects.ts`.
- Rank board in the HUD to jump to any fight's talisman.

### The fight sequence (repeat per rank)

#### R.A · The Reveal

**Beat · 2.5 s**

- Camera: low angle from the bottom of the balcony stairs, slow dolly in; cut to ECU of the demon's eye as its rank mark glows.
- Action: the demon stands still as Akhilesh lands in front of it; brush title *Upper Rank Six · The Endless Inbox*.
- Sound: double drum; the demon's own low hum.
- Blender: demon `reveal`; Akhilesh `land`; dolly and ECU cameras; eye-glow animation; title plane; marker `4R<n>-A`; render, approve, stills.
- Code: title with `StrokeReveal` (name from content); emissive eye ramp; hum cue.
- Test: parity; title matches the project's demon name.

#### R.B · The Demon's Power

**Beat · 2 s**

- Camera: wide, Dutch angle.
- Action: the demon unleashes a power that looks like its problem (thousands of letters swarming like bats, red threads binding the arena…).
- Sound: the power's own sound: paper fluttering, threads snapping tight, gears grinding.
- Blender: `power_cast`; power pieces modeled and a swarm proxy animated; tilted camera; marker `4R<n>-B`; render, approve, still.
- Code: power preset as instanced meshes with shader motion; sound cue.
- Test: power reads clearly in one second; budget holds.

#### R.C · The Clash

**Beat · 3 s · three quick cuts**

- Camera: handheld-style shake, a cut every second.
- Action: cut 1, blades spark against the power; cut 2, Akhilesh dodges by inches; cut 3, the helper Pillar's element tears an opening in the demon's defense.
- Sound: steel, impacts, the Pillar calling a form.
- Blender: Akhilesh `parry`, `dodge`; demon `attack`, `hit`; helper Pillar strike; three cameras; markers `4R<n>-C1..C3`; render, approve, stills.
- Code: camera cuts; shake; spark particles; helper's `ElementTrail`.
- Test: each cut lands on its beat; parity per cut.

#### R.D · The Final Blow

**Swipe gate · time stopped**

- Camera: freeze on a wide shot.
- Action: hint *Slash*. The visitor swipes; Akhilesh performs *Ink Breathing · Second Form · Splitting Line* along the drawn line; an ink line appears and the screen splits along it, then slides back together.
- Sound: silence, then one clean blade ring.
- Blender: demon `freeze`; Akhilesh `splitting_line`; freeze camera; marker `4R<n>-D`; render, approve, still.
- Code: swipe gate; `ScreenSplit` along the visitor's line; world-space `InkRibbon` slash; Enter gives a default diagonal.
- Test: swipe works by mouse, touch and keyboard; the split follows the drawn angle.

#### R.E · Ash to Talisman

**Beat · 3 s, then the card stays open**

- Camera: slow orbit, then push in until the talisman fills most of the screen.
- Action: the demon crumbles to ash; the ash swirls into a tall paper talisman showing the project: name, pitch, problem, solution, result, stack icons, a preview video, and *Live Demo*, *GitHub*, *Case Study* links.
- Blender: talisman `unfurl`; orbit and push camera; marker `4R<n>-E`; render, approve, still.
- Code: `Dissolve`; `ParticleMorph` ash → talisman; HTML card at `text_anchor`; video at `video_anchor`, loaded only now.
- Test: card content from content; links work; text selectable; parity (HTML hidden).

#### R.F · To the Next Balcony

**Scrub · half a screen**

- Camera: tracking as Akhilesh runs up the wall to the next balcony.
- Blender: `wall_run` along the path; tracking camera; marker `4R<n>-F`; render, approve.
- Code: play on scroll; stitch to the next R.A.
- Test: stitch R.E → next R.A continuous.

### Rank list

Rank Six is the first fight and Rank One the last; put your strongest project at Rank One and adapt each demon to your real projects.

| Rank | Demon (the problem) | Power | Helper Pillar | Fits a project like |
|---|---|---|---|---|
| 6 | The Endless Inbox | Swarms of letters | Hibiki | Email triage or automation |
| 5 | The Tangled Web | Red threads binding everything | Kiri | Knowledge graph or RAG assistant |
| 4 | The Wrong Measure | Shifting scales and numbers | Minato | Precision calculator, medical or finance app |
| 3 | The Faceless Crowd | Hundreds of identical masks | Homura | HR, people or customer system |
| 2 | The Slow Machine | Gears that stretch time | Kaname | Local AI agent, performance tool |
| 1 | The Market Storm | A whirlwind of candlestick charts | Iwao | Trading or financial analytics |

- [ ] Rank Six: R.A–R.F built, coded, tested
- [ ] Rank Five: R.A–R.F built, coded, tested
- [ ] Rank Four: R.A–R.F built, coded, tested
- [ ] Rank Three: R.A–R.F built, coded, tested
- [ ] Rank Two: R.A–R.F built, coded, tested
- [ ] Rank One: R.A–R.F built, coded, tested

**Act 4 done when:** all six fights play like their renders and each talisman shows the right project from content.

## Act 5 — The Demon King (Experience page)

Yamikage's fight is the experience timeline: his health scroll is the timeline, each phase is one job or program, and he grows stronger each phase just as the work got harder. The act ends at sunrise, the only thing he cannot survive.

### T4→5 · The Platforms Fall Away

**Beat · 3 s · hand-off: balconies below the frame**

Director: everything else falls away; only the final enemy is left.

- Camera: from the last talisman, pull back and up to an extreme wide.
- Action: every balcony breaks off and drops into darkness; one huge circular floor remains; Akhilesh and the Pillars land on its edge.
- Sound: all music stops; only a slow ticking clock.

#### Build in Blender

- `bridge_4-5.blend` links the tier and the arena (under the group at `act5_origin`); balcony fall with stagger and spin; everyone `land`.
- Camera pull-back; markers `T45-fall`, `T45-handoff`. Render to 5.2; approve.

#### Code

- Act 5 mounts during Rank Two; play the fall; at the hand-off unmount the tier.

#### Test

- No frame over 50 ms; parity stills: mid-fall, extreme wide.

### 5.0 · Set and scaffold

#### Build in Blender

- Circular floor, low throne, darkness all around; thin crack meshes in the walls (hidden at start).
- Two bake sets: black and blood red, and dawn gold for the end.
- Health scroll: a long horizontal scroll parented to the camera at the top of frame, one segment per phase, a `label_anchor` per segment.

#### Code

- `BossPhase` component driven by `content/experience.ts` (oldest first); health-scroll segments generated from content.

### 5.1 · The Throne Room

**Beat · 4 s**

Director: his calm is what makes him frightening; he doesn't even look at them.

- Camera: extreme wide, slow dolly in; Yamikage is a tiny figure at the center.
- Action: he sits calmly on the throne.
- Sound: the ticking clock.

#### Build in Blender

- Yamikage `seated_idle`; dolly camera; marker `5.1`. Render, approve, stills: start, end.

#### Code

- Beat; ticking ambience.

#### Test

- Parity passes.

### 5.2 · His Eyes

**Beat · 3 s**

Director: one look tells the visitor this is the end of the road.

- Camera: cut to ECU of his eyes as they open.
- Action: red slit pupils; he speaks quietly, shown as a subtitle: "You have come a long way. Show me what you have learned."
- Sound: a deep bass drop.

#### Build in Blender

- `eyes_open` with eye emission ramp; ECU camera; marker `5.2`. Render, approve, still.

#### Code

- Subtitle as HTML; bass cue.

#### Test

- Parity passes; subtitle readable for 2 s.

### 5.3 · The Health Scroll

**Beat · 2 s**

Director: the visitor learns the rules of this fight: the scroll is the journey.

- Camera: same frame; the scroll unrolls across the top.
- Action: segments labeled with each role and dates, oldest on the left.

#### Build in Blender

- Scroll `unroll`; marker `5.3`. Render, approve, still.

#### Code

- Segment labels as HTML at each `label_anchor`; clicking a segment jumps to that phase.

#### Test

- Adding an entry to `experience.ts` adds a segment with no code change.

### The phase sequence (repeat per experience entry)

#### K.A · Phase Title

- Camera: freeze frame; brush title card with role, organization and dates.
- Blender: title plane; marker `5K<n>-A`. Code: title from content with `StrokeReveal`.
- Test: readable 1.5 s.

#### K.B · Transformation

- Camera: low angle, slow motion.
- Action: Yamikage's body changes: new arms, whips, armor or spikes, more dangerous each phase.
- Blender: `transform_<form>` using shape keys + revealed parts; marker `5K<n>-B`; render, approve, still.
- Code: blend shape keys, show parts for the phase's `bossForm`.
- Test: each form matches its render.

#### K.C · Battle

- Camera: fast Dutch angles, shake, wide-to-close cuts.
- Action: Akhilesh and the Pillars attack together; crossing element trails.
- Blender: team strike clips; Yamikage `attack_<form>`; cameras; markers `5K<n>-C1..C3`; render, approve, stills.
- Code: cuts, shake, trails; only 6 characters at LOD0.
- Test: budget holds on High and Lite.

#### K.D · Segment Breaks

- Camera: push in on the health scroll.
- Action: that phase's segment cracks; its ink drips down and writes 2–3 achievements on the arena floor.
- Blender: segment crack animation; drip proxy; marker `5K<n>-D`.
- Code: achievements from content as HTML on the floor surface, written in ink style.
- Test: text selectable and readable.

#### K.E · Regeneration

- Camera: wide.
- Action: Yamikage recovers and prepares his next form.
- Blender: `regenerate`; marker `5K<n>-E`. Code: play; stitch to the next K.A. Test: stitch continuous.

- [ ] Phase 1 built, coded, tested
- [ ] Phase 2 built, coded, tested
- [ ] Phase 3 built, coded, tested
- [ ] Final phase built, coded, tested

### 5.4 · Hold Until Dawn

**Beat · 3 s**

Director: for the first time, he is afraid.

- Camera: wide, shaking; thin gold lines appear in the frame.
- Action: the walls crack; golden light cuts through; Yamikage tries to flee. Iwao and Minato pin him in place. Hint: *Hold until dawn*.
- Sound: the music at its loudest; a rooster, very far away.

#### Build in Blender

- Crack meshes grow (reveal value); light cones; Yamikage `panic_flee`; Iwao and Minato `pin_hold`; marker `5.4`. Render, approve, stills.

#### Code

- Crack reveal uniform; light cones + bloom; `SunriseGrade` begins.

### 5.5 · Final Form: Signature

**Hold gate · 3 s · no auto-resolve**

Director: the visitor finishes the story with their own hands.

- Camera: slow-motion close-up, then an orbit around Akhilesh.
- Visitor: press and hold for 3 seconds; the breathing ring fills.
- Action: title *Ink Breathing · Final Form · Signature*. His blade draws one perfect circle, the same circle as the loading screen; it fills with light and the sunrise bursts through.
- Sound: silence for one second, then one pure note.

#### Build in Blender

- Akhilesh `final_form`; circle proxy; orbit camera; marker `5.5`. Render, approve, stills: mid-circle, burst.

#### Code

- Hold gate; world-space `InkRing` around Akhilesh; on complete, swap to the gold bake set.

#### Test

- Releasing early drains the ring; Space works; parity passes.

### 5.6 · The King Dissolves

**Beat · 3 s**

- Camera: medium shot, slow motion.
- Action: caught in sunlight, Yamikage dissolves into ash and wisteria petals that blow away.

#### Build in Blender

- Yamikage final pose; petal proxy; marker `5.6`. Render, approve, still.

#### Code

- `Dissolve` with petal particles.

**Act 5 done when:** the fight plays like the render, the timeline comes from content, and the visitor's hold brings the sunrise.

## Act 6 — Dawn (the transition from castle to mansion)

The castle comes apart and floats into the light, the screen goes white, a heartbeat, and Akhilesh's eyes open in the Mansion. The white-out is the hand-off frame, so the swap is invisible.

### 5.7 · The Castle Falls Apart

**Beat · 4 s**

Director: release: the nightmare lets go of him.

- Camera: top-down looking at Akhilesh, then a slow pull up and away.
- Action: beams, doors and hundreds of lanterns float upward into the light. Akhilesh falls backward with his arms open, peaceful, and closes his eyes. The screen fills with white.
- Sound: everything fades to a soft hum.

#### Build in Blender

- `bridge_5-7.blend` links the arena, the debris kit, and the Mansion bedroom corner (from its early blockout).
- 150–300 debris pieces scattered by a seeded script, floating up with spin; seed saved for the web.
- Akhilesh `fall_backward_peaceful`; top-down camera pulling away; marker `5.7`.
- Render, approve, stills: mid-float, near white.

#### Code

- Debris as one instanced mesh tweened from the seed file; no physics.
- `SunriseGrade` `uWhite` rises toward 1.

#### Test

- Parity passes; reduced-motion mode replaces this with a gentle fade to white.

### 6.1 · White

**Beat · 2 s · hand-off frame**

- Camera: pure white screen.
- Action: nothing for 2 seconds.
- Sound: silence, then one heartbeat.

#### Build in Blender

- White hold with marker `6.1` and `T67-handoff`.

#### Code

- At full white: unmount Act 5, show Act 7 (mounted during the King fight).

#### Test

- The hand-off frame is pure white (pixel check).

### 6.2 · The Blink

**Beat · 3 s**

Director: waking up should feel physical, like the visitor's own eyes opening.

- Camera: POV lying down. Eyelids close from top and bottom, open on a blurry warm image, close again, then open as focus pulls from blur to sharp.
- Sound: birdsong fades in; a light breeze.

#### Build in Blender

- POV camera on the futon in the Mansion; eyelid proxy planes and focus-distance keys; marker `6.2`. Render, approve, still at the first sharp frame.

#### Code

- Eyelid vignette shader (`uLid`) closes and opens twice; depth of field from the shot JSON.
- Birdsong and breeze cues.

#### Test

- Parity at the first sharp frame; stitch 5.6 → 7.1 feels like one waking.

**Act 6 done when:** the castle-to-mansion change feels like waking up, with no visible swap.

## Act 7 — The Mansion (Contact page)

The journey ends in morning calm: Akhilesh wakes, the Pillars rest in the garden, his contact details write themselves in ink, the visitor leaves a message, and Sumi carries it away into the sunrise.

### 7.0 · Set and scaffold

#### Build in Blender

- Room: wooden beams, paper screens that slide open to the garden, futon with a folded haori.
- Low table: contact sheet (`text_anchor`), message sheet (`form_anchor`) with fold shape keys, ink stone, brush pen with a tip bone.
- Garden: koi pond, stepping stones, wisteria trellis, bamboo fountain with a pivot, distant mountains, morning sky dome.
- Baked morning light (soft green, pale wood, wisteria purple); one warm sun light for characters.

#### Code

- Unlit baked mansion; `WindSway` foliage; koi `VATCrowd`; bamboo fountain clack on a timer.

### 7.1 · Waking

**Scrub · half a screen**

Director: the visitor wakes with him; the first breath of morning.

- Camera: POV on the futon looking up at the beams; rises slowly as he sits up.
- Action: morning light through paper screens; the folded haori beside the futon.
- Sound: birdsong, wind in leaves.

#### Build in Blender

- POV rise path; marker `7.1`. Render, approve, stills: lying, sitting.

#### Code

- POV camera continues from 6.2; ambience.

#### Test

- Parity passes; stitch 6.2 → 7.1 continuous.

### 7.2 · The Garden

**Scrub · 1 screen**

Director: the reward for the whole night: friends at rest in the sun.

- Camera: slow pan from the room out through the open screens to a wide of the garden.
- Action: koi in the pond, wisteria, morning mist. Iwao asleep against a tree, Hibiki sharpening his blade, Kiri feeding a small bird, Homura waving. The bamboo fountain fills, tips, and clacks against a stone.
- Sound: the bamboo clack: the drum of the whole story, finally at peace.

#### Build in Blender

- Pillar rest loops: Iwao `sleep_sit`, Hibiki `sharpen_blade`, Kiri `feed_bird`, Homura `wave`.
- Fountain tip animation; screens slide open; pan camera; marker `7.2`. Render, approve, stills: room edge, garden wide.

#### Code

- Pillars at LOD1 except the one nearest the camera; clack cue synced to the tip frame.

#### Test

- Parity passes; budget holds on Lite.

### 7.3 · The Table

**Beat · 4 s**

Director: the story becomes a letter: the brush writes Akhilesh's details by itself.

- Camera: POV kneeling at the low table; tilt down to the paper.
- Action: the brush pen lifts and writes, stroke by stroke: *Email*, *LinkedIn*, *GitHub*, *Download Resume*.
- Sound: soft brush strokes.

#### Build in Blender

- Brush pen writing motion following the contact sheet's stroke texture; tilt camera; marker `7.3`. Render, approve, still.

#### Code

- Brush-pen clip; contact lines from `content/contact.ts` appear as HTML at `text_anchor`, each a real link, timed to the strokes.

#### Test

- Links work and are keyboard-focusable; parity (HTML hidden).

### 7.4 · The Visitor's Turn

**Form gate**

Director: now the visitor writes back.

- Camera: same POV, slight push in on the second sheet.
- Action: a blank sheet with faint guide lines: *Your name*, *Your email*, *Your message*; typed words appear in a brush-style font.

#### Build in Blender

- Message sheet slides beside the first; push camera; marker `7.4`. Render, approve, still.

#### Code

- Real HTML inputs (plus hidden honeypot) at `form_anchor`; validation with the shared schema.

#### Test

- Works with mouse, touch, keyboard, autofill and screen readers.

### 7.5 · Sumi Carries the Message

**Beat · 5 s**

Director: the message leaves the story and goes into the real world.

- Camera: medium shot of the table; crane up following Sumi over the roof to the mountains and the sun.
- Action: on Send, the paper folds itself into a small letter. Sumi lands on the table edge with a caw, takes it in her beak, and flies out over the garden.
- Sound: wings, a single caw; music swells softly.

#### Build in Blender

- Paper `fold`; Sumi `land` → `pick_up` → `fly` along a curve; crane camera; marker `7.5`.
- Render, approve, stills: folded letter, Sumi over the roof.

#### Code

- POST to `/api/contact`; the animation starts immediately; on failure Sumi returns and the sheet shows a friendly error with the plain email address.

#### Test

- A real email arrives on the preview deployment; spam checks reject correctly.

### 7.6 · The End Card

**Beat · holds**

Director: say thank you, and invite them to fall again.

- Camera: wide sky shot, still.
- Action: brush writing across the sky: *Hope you enjoyed the ride.* Buttons: *Fall again* and *Download Resume*.
- Sound: a final bamboo clack, then silence.

#### Build in Blender

- Sky plane with the end-card stroke texture; marker `7.6`. Render, approve, still.

#### Code

- `StrokeReveal` end card; HTML buttons; *Fall again* jumps to 1.1 without reloading.

#### Test

- Fall again restarts cleanly; parity passes.

**Act 7 done when:** a visitor reads the contact details, sends a message that really arrives, and watches Sumi carry it into the sunrise.

## Final assembly

With every shot and transition built and tested on its own, the last stage plays them as one film and proves it holds together on real devices.

### Z.1 · The full film

- Join every act render and bridge into `blender/renders/full.mp4` as the reference cut.
- Screen-record a full browser playthrough at 60 fps and compare side by side with the reference.
- Fix timing drift in Blender first, re-export, then re-test the affected shot only.

### Z.2 · Navigation

- Scroll forward through the whole film, then backward to the start.
- Quick-menu jumps from every act to every other act; skip in every act; Fall again from the end card.
- GPU memory returns to the same level after visiting all acts twice (no leaks).

### Z.3 · Sound

- Final effects sprite, ambience per act, music themes; levels balanced across the film.
- Mute works everywhere; no sound before the door is clicked.

### Z.4 · Devices and tiers

- High, Medium and Lite budgets met in every act.
- Full playthroughs on a desktop browser, a mid-range Android phone and an iPhone in Safari; portrait framing checked for every shot.

### Z.5 · Accessibility and fallbacks

- Every gate and control by keyboard; act names announced to screen readers; text readable over every scene.
- Reduced-motion mode, no-WebGL redirect to `/cv`, slow-connection suggestion; no flashes faster than 3 per second.

### Z.6 · Launch

- `/cv` Lighthouse 95+; Open Graph image rendered from Blender; Person JSON-LD.
- Long cache headers on assets; production environment variables; production deploy.
- One final full playthrough on the live URL.

**Done when:** the live site plays from the loading ring to the end card as one continuous film that matches the Blender reference cut, on desktop and phone.

## Conversion notes

Notes added during the PDF → Markdown conversion (2026-11-09). Nothing above was reworded; these record layout choices and points for the director to decide.

**Layout choices**

- Running headers ("Midnight to Dawn — Director's Implementation Plan") and "Page N of 48" footers removed.
- Table header rows that the PDF repeats after a page break are written once.
- Words the PDF hyphenates across a line break are re-joined (`visitor-paced`, `veil-like`, `Non-Color`, `3.2-<pillar>`).
- Each shot's mode line (e.g. "Scrub · scroll 40–50%") is shown in bold under the shot heading; the PDF shows it as a sub-title.
- The PDF's checklists (Pillar list, Rank list, phase list) are written as unticked `- [ ]` items.
- Text the PDF shows in monospace is in backticks; on-screen text the visitor reads (titles, hints, labels) is in italics.
- The "the shot loop" diagram (PDF page 2) is `images/plan-shot-loop.png`; its text version transcribes the words in the image exactly.

**Points kept verbatim for the director**

1. `ElementTrail` appears in 3.5 / T3→4 (Code), P.D · Strike (Code) and R.C · The Clash (Code). The TDD names it too (Scene specs › Act 3), but it is not a row in the TDD's 16-effect Shaders and VFX catalog table (which has `ElementBurst` and `InkRibbon`). Either add `ElementTrail` to the catalog or map these trails to an existing effect before those items are built.
2. The plan builds the acts in order (3 before 4 before 7); the screenplay's Build order and the TDD milestones build Act 7 and Act 4 before Act 3. CLAUDE.md already records that the plan wins.
3. 5.7 · The Castle Falls Apart sits under Act 6 in the plan (it is shot 5.7 of the screenplay's Act 5). The build-order stages follow the plan (stage 6 includes 5.7).
4. 6.2 · The Blink, Test: "stitch 5.6 → 7.1" skips 5.7, 6.1 and 6.2 by id; kept as written.
5. Naming says shot ids "match the screenplay"; the screenplay names Pillar and Upper Rank shots P.A–P.G and 4.A–4.F, while the plan and CLAUDE.md use `3<P>-A` and `4R<n>-A` markers. Both are kept; CLAUDE.md's naming is the one the build uses.
