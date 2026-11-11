---
paths: ["src/**", "content/**", "shots/**", "tests/**", "public/**", "scripts/**"]
---

# Web phase rules

Companion to the root `CLAUDE.md`, for every `<shot>/W` item. Source: `docs/tdd.md` › Core systems, Shaders and VFX catalog, Performance, Accessibility, Contact backend; `docs/plan.md` › the shot's **Code** and **Test** checklists.

**Precondition:** the shot's `<shot>/B` item is ticked and the shot is in `blender/renders/APPROVALS.md`. The exports (`public/models/*.glb`, `shots/<act>.json`) are the input; never re-author camera work in code.

---

## Director and shots

- `ActModule { id, menuLabel, shots, Scene, assets, onEnter?, onExit? }` per act in `src/experience/acts/act<N>-<name>/index.ts`.
- Shot = `{ id, mode: 'scrub'|'beat', scrollLength?, duration?, camera: 'main'|'pov', keys, events }`; gates `{ id, kind: 'hold'|'swipe'|'click'|'read', holdMs?, autoResolveMs }`.
- Beats lock scroll (`lenis.stop()`), play, unlock; scrolling hard during a beat plays it at 2×.
- Events (`sound`, `title`, `timeScale`, `shake`, `gate`, `custom`) are added in `shots/<act>.json` after export and must survive re-export.
- Camera: positions via `CatmullRomCurve3`, target/fov/roll with the key's ease; a cut = switching the active camera (exactly one frame).
- Time: `setTimeScale(to, rampSeconds)`; scrub shots are not slowed, only things inside the scene; `gsap.globalTimeline.timeScale()` kept in sync.
- Mount at most 2 acts; start loading the next act at 50% progress; dispose geometries, materials, textures, skeletons, mixers and render targets of the previous act after the hand-off.

## VFX catalog (the only 16 effects allowed)

ToonMaterial · InkOutline · VATCrowd · StrokeReveal · InkRibbon · InkRing · Dissolve · ParticleMorph · LanternField · WindSway · RingRipple · ElementBurst · ScreenSplit (post) · SpeedLines (post) · Bloom + Vignette (post) · SunriseGrade + Eyelid (post). A new effect needs a new row in the TDD table first. All post effects share one `EffectComposer`; ScreenSplit and SpeedLines are **disabled**, not zeroed, when unused.

## Performance rules (docs/tdd.md › Rules Claude Code must follow)

1. No allocations in `useFrame`. 2. Instance anything repeated > 5 times; crowds use VAT. 3. LOD every character and large prop with `<Detailed>`. 4. Pause mixers of hidden characters. 5. `gl.compile(scene, camera)` + one hidden warm-up frame per skinned character before showing. 6. Code-split each act with dynamic `import()`. 7. Dispose on unmount. 8. Bake, don't simulate. 9. Foliage uses `alphaTest`, not blending. 10. React out of the loop. 11. Pause the render loop when the tab is hidden or `/cv` is open. 12. Measure every act (r3f-perf, Chrome Performance, a real mid-range Android).

| Tier budget | High | Medium | Lite |
|---|---|---|---|
| DPR | 2 | 1.5 | 1 |
| Triangles on screen | 1.2M | 700k | 300k |
| Draw calls | 200 | 140 | 80 |
| Skinned at LOD0 | 6 | 4 | 2 |
| GPU texture memory | 400 MB | 256 MB | 128 MB |
| VAT instances | 200 | 120 | 60 |
| Particles per system | 20k | 10k | 4k |
| Lanterns (Act 1) | 300 | 200 | 120 |

Quality tier changes only between shots. Asset budgets per act: 0 = 300 KB, 1 = 8 MB, 2 = 6 MB, 3 = 14 MB, 4 = 12 MB, 5 = 10 MB, 6 = 50 KB, 7 = 7 MB. Download before the loading screen ≤ 1.5 MB; loading screen visible < 1.5 s on 4G.

## Input, audio, accessibility

- Hold = pointerdown→pointerup (Space); swipe ≤ 400 ms and ≥ 25% screen width (Enter = default diagonal); click = raycast (Tab + Enter); read = panel closed or timer (Escape).
- Howler audio sprite for effects; one ambience per act crossfaded 1.5 s; cues by name from shot events; unlock on the Enter click; mute in `localStorage`.
- Live region announces each act; visible focus outlines; soft dark backdrop behind overlay text; no flashes > 3/s; reduced motion → 0.6 s crossfades, no shake, no speed lines.
- Mobile portrait: wider fov, re-centered framing; Lenis touch smoothing off.

## Content and contact

- Content validation: exactly 4 about scrolls; 5–6 featured skill groups; ≤ 6 projects with unique ranks; every `stack` and `usedIn` reference exists; experience sorted oldest first.
- `/api/contact`: zod (name 1–80, valid email, message 10–2000), honeypot `website` empty, reject submits < 3 s after the form appeared, 5 per IP per hour, Resend with reply-to = visitor; escape everything in the email; return `{ ok: true }`. On failure Sumi returns and the paper shows a friendly error with the plain email address.
- Security headers in `next.config`: CSP (own assets + `blob:`), `X-Content-Type-Options`, `Referrer-Policy`. Long immutable cache headers on hashed assets.

## Tests per shot (from the plan's Test checklist)

- **Parity:** `pnpm blender:stills <shot> <t…>` (`blender/renders/stills/<unit-slug>/index.json`) vs `/dev/shot?shot=<id>&t=<t>` screenshot, similarity ≥ 0.90, HTML and VFX hidden, fixed seed.
- **Stitch:** `/dev/stitch?from=<prev>&to=<shot>` shows no jump; hand-offs have no frame over 50 ms.
- **Shot data (Vitest):** keys sorted by `t` from 0 to 1, valid cue names, gates that exist, events survive re-export.
- **Interaction:** every gate by mouse, touch and keyboard; screen reader reads HTML on surfaces.
- **Budgets:** the per-act performance test on High and Lite.
