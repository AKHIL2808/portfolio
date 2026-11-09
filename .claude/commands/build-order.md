---
description: Generate or track the ordered, tickable shot checklist for one stage (F, C, 0-7, Z) of Midnight to Dawn
argument-hint: <F | C | 0-7 | Z>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pdftotext:*), Bash(ls:*), Bash(date:*)
---

# /build-order

Argument: `$ARGUMENTS`

You maintain one ordered, tickable build checklist per stage in `.claude/build-order/`. A stage is **officially completed** only when every item in its file is ticked.

## 1. Validate the argument

- Trim `$ARGUMENTS` and uppercase it (`f` → `F`, `z` → `Z`). Accept `act3` / `A3` as `3`.
- It must match `^(F|C|Z|[0-7])$`. Otherwise print this and stop, creating no file:
  ```
  Usage: /build-order <stage>
    F     Foundation and parity setup (F.1–F.4)
    C     Cast build + shared props
    0-7   Act 0 Breath … Act 7 Mansion
    Z     Final assembly (Z.1–Z.6)
  ```
- Let `STAGE` be the normalized value. Target file: `.claude/build-order/stage-<STAGE>.md` (e.g. `stage-F.md`, `stage-1.md`).

Check whether the target file exists and pick a mode.

---

## 2. Progress mode (the file already exists)

Never regenerate, reorder or overwrite the item list in this mode.

1. Read the file. Count the top-level checklist items: lines starting with `- [ ]` or `- [x]` (case-insensitive). Ignore indented sub-bullets.
2. Sanity-check the ticked items:
   - For each ticked item, Glob the paths under its `Files:`; list the ones whose files are missing under **Suspicious ticks**.
   - For each ticked `/B` item that renders a shot, check that `blender/renders/APPROVALS.md` has a row for that shot id; list missing ones under **Suspicious ticks** too.
   - Do not untick anything; the user decides.
3. Update the header lines in place with Edit:
   - `Progress: <done>/<total>`
   - `Status: NOT STARTED` if done = 0, `IN PROGRESS` if 0 < done < total, `COMPLETED (<YYYY-MM-DD>)` if done = total (`date +%F`).
4. Print:
   - `Stage <STAGE>: <done>/<total> done, <status>`
   - the **next 1–3 unticked items** in file order, each with its ID, title, Mode, Files, Depends on and Done when
   - for the next item, the command to run: `/create-spec <unit> blender` for a `/B` item, `/create-spec <unit> web` for a `/W` item
   - any suspicious ticks
5. **If every item is ticked** (and the file did not already say COMPLETED): in the root `CLAUDE.md` **Build status** table, change row `<STAGE>`'s Status to `Done (<YYYY-MM-DD>)`, add a line to `docs/progress.md`, and print `✅ Stage <STAGE> officially completed.`
6. Stop.

---

## 3. Generate mode (the file does not exist)

This mode **plans only**. Do not write code, touch Blender, or edit any file other than the new stage file.

### 3.1 Prerequisite check (warn, don't block)

Order of work (docs/plan.md › Order of work): `F → C → 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → Z`.
- Warn if the previous stage's file is missing or not `COMPLETED`.
- Stage `0`–`7`: also warn if `stage-C.md` is not COMPLETED for a character this act uses (the plan allows Upper Ranks 2–6 to be finished during Act 4; say so instead of warning for them).
- Put the warnings in the file header and in your printed summary.

### 3.2 Read the sources (in this order)

1. Root `CLAUDE.md` (naming, critical rules, shot loop) and both `.claude/rules/blender.md` and `.claude/rules/web.md`.
2. **docs/plan.md** (or `pdftotext -layout "docs/Midnight to Dawn — Director's Implementation Plan.pdf" -`): the section(s) for this stage:
   - `F`: › Foundation (F.1–F.4) and › Blender-to-web parity rules.
   - `C`: › Cast build (character template, build order and budgets, shared props library) and › The cast.
   - `0`–`7`: the act's section, **including every transition placed under it** (e.g. stage 2 includes 2.5 and T2→3; stage 4 includes 3.5 / T3→4; stage 5 includes T4→5; stage 6 includes 5.7, 6.1, 6.2), every shot's Director's view, Build in Blender / Code / Test checklists, the repeat templates (Pillar sequence, fight sequence, phase sequence) and their lists, and the act's **done when**.
   - `Z`: › Final assembly.
3. **docs/tdd.md** (or the TDD PDF): › Scene specs per act (this act), › Shaders and VFX catalog, › Performance, › Characters, › Asset pipeline, › Milestones (the matching M row), › Accessibility, fallbacks and SEO and › Contact backend when they apply.
4. **docs/screenplay.md** (or the screenplay PDF): the act's shots, for intent, sound motifs and color script only.
5. Glob the repo (`blender/**`, `shots/**`, `content/**`, `src/**`, `tests/**`, `package.json`) to see what already exists. Real work there means the item is still listed, with `(exists: verify)`.

Every item must trace back to one of these sources. **Never invent shots, effects or features.** Put gaps and conflicts under **Open questions**.

### 3.3 Turn the plan into items

- **Act stages:** for each unit in plan order (set/scaffold `N.0`, each shot, each transition), create **two items**: `<unit>/B` (its *Build in Blender* list) then `<unit>/W` (its *Code* list, with its *Test* list as the Done when). If the plan has no Blender list for a unit (e.g. `4.0`'s code-only parts), create only the item that exists.
- **Repeat templates** expand per instance, built the plan's way (all sub-shots for the first instance, tested, then the next):
  - Act 3: `3<P>-A … 3<P>-G` for each Pillar in the Pillar list order (K, M, Ki, Ho, Hi, I).
  - Act 4: `4R<n>-A … 4R<n>-F` for Rank Six down to Rank One.
  - Act 5: `5K<n>-A … 5K<n>-E` per experience phase. If `content/experience.ts` doesn't exist yet, expand **Phase 1 only** and add an Open question: "expand phases 2…n once content/experience.ts exists".
- **Stage F:** F.1 and F.3/F.4 are web items (`F.1/W.nn`, `F.3/W.nn`, `F.4/W.nn`), F.2 is Blender items (`F.2/B.nn`), one per bullet of the plan, split so each item is one sitting.
- **Stage C:** per character in the build-order table, the template steps as `C<n>/B.01 … B.07` (concept → model + LOD1 → UVs and texture → material → rig → base clips → turntable approved) and one `C<n>/W` (web check on `/dev/character` + parity on one pose); then `CP/B` and `CP/W` for the shared props.
- **Stage Z:** one `Z.<n>/W` per section (Z.1 also needs a `Z.1/B` for the reference cut).
- Add the act's **done when** as a final tickable item `<STAGE>-DONE`.
- Keep each item small enough to build in one session (plan: one session covers one to three shots). Split anything bigger with `.nn` suffixes.

### 3.4 Order by dependency

- Plan order is the order. `<unit>/B` always comes before `<unit>/W`, and `<unit>/W` depends on `<unit>/B`.
- Each shot's `/B` depends on the previous shot's `/B` when the plan stitches them (camera continuity); each `/W` with a stitch test depends on the previous unit's `/W`.
- Set/scaffold items (`N.0`) come first in an act; transitions sit where the plan puts them.
- An item may only depend on items above it (or in earlier stages).

### 3.5 Item format

IDs are stable and never renumbered.

```
- [ ] **1.5/B: Racing the Door (Blender)** · `Blender`
  - Mode: Scrub · scroll 40–50%
  - Director: camera leaves Akhilesh, swings level with the door, tracks it rocketing upward; clacks per lock
  - Build: door tunnel of 12 doors (frame, two panels, paper); `doors_extend` with each lock on a keyed frame; camera path alongside; marker `1.5`
  - Files: blender/scripts/build_act1.py, blender/scenes/act1-fall.blend, blender/renders/stills/1-5/
  - Stills: start, end
  - Depends on: 1.4/B
  - Source: plan › Act 1 › 1.5; tdd › Scene specs › Act 1
  - Done when: render approved by the director (row in blender/renders/APPROVALS.md); stills at start and end saved; scene rebuilds headless from build_act1.py

- [ ] **1.5/W: Racing the Door (Web)** · `Web`
  - Build: door instances; one clack cue per lock frame; SpeedLines at maximum
  - VFX: SpeedLines
  - Files: src/experience/acts/act1-fall/Scene.tsx, shots/act1-fall.json, tests/e2e/shots/1-5.spec.ts
  - Depends on: 1.5/B, 1.4/W
  - Source: plan › Act 1 › 1.5 (Code, Test)
  - Done when: clacks in sync; parity passes; stitch 1.4 → 1.5 smooth
```

Categories: `Blender` · `Character` · `Export` · `Web` · `VFX` · `Content` · `Infra` · `Test` · `Assembly`.

### 3.6 File layout

```markdown
# Build order: Stage <STAGE>: <name, e.g. Act 1 — The Fall (Home)>

- Status: NOT STARTED
- Progress: 0/<total>
- Generated: <YYYY-MM-DD>
- Milestone: <TDD milestone row, e.g. M4 Act 0 + Act 1>
- Prerequisite: <stage(s)>: <OK | ⚠ warning text>
- Asset budget: <act budget from tdd › Scene specs, or n/a>
- Sources: <files and sections used>

> How to use: build items **in order**. For a `/B` item: `/create-spec <unit> blender` → `/blender-shot <unit>` → `/approve-shot <unit>` → `/ship-shot`.
> For a `/W` item: `/create-spec <unit> web` → implement → `/test-shot <unit>` → `/review-shot <unit>` → `/ship-shot`.
> Tick `- [ ]` → `- [x]` only after the item's *Done when* passes. Re-run `/build-order <STAGE>` to see progress.

## 1. <first heading from the plan, e.g. 1.0 · Set and scaffold>
- [ ] **1.0/B: …**
- [ ] **1.0/W: …**

## 2. <next shot heading>
…

## <n>. Stage done when
- [ ] **<STAGE>-DONE: <the plan's "Act N done when" sentence, word for word>**

## Out of scope for this stage
- <shots owned by other stages, anything the TDD lists as out of scope for v1>

## Open questions
- <gaps or conflicts between the sources; "None" if none>
```

### 3.7 Finish

Write the file with Write, then print:
- the file path
- the item count by category (`/B`, `/W`, other) and the total
- any prerequisite warnings
- the first item to build (ID, title, Done when) and its `/create-spec` command
