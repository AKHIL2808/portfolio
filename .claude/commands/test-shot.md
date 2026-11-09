---
description: Writes and runs the tests for one shot's web phase (parity, stitch, shot data, interaction, budgets). Pass the unit, e.g. /test-shot 1.5
argument-hint: "<unit>, e.g. 1.5 · T0→1 · 4R6-D · F.3/W.02"
allowed-tools: Read, Glob, Grep, Agent, Bash(git status:*), Bash(git diff:*), Bash(git branch:*)
disable-model-invocation: true
---

Run the testing pipeline for the web phase of the unit in $ARGUMENTS:
**mtd-test-writer** writes the tests from the spec and the plan's Test list, then **mtd-test-runner** runs and verifies them.

If no argument is provided, stop and say:
"Please provide a shot or unit. Usage: /test-shot <unit>, e.g. /test-shot 1.5"

## Pre-flight check

Do all of these before invoking any subagent. If a check says stop, report it and do nothing else.

1. **Normalize** to the `/W` item id (`1.5` → `1.5/W`; `F.3/W.02` stays). A `/B` item has no test pipeline: say "Blender phases are checked by /blender-shot and approved by /approve-shot" and stop.
2. **Spec:** Glob `.claude/specs/<slug>-*.md` for the `/W` item. None: "Spec not found for <item_id>. Run /create-spec <unit> web first." More than one: ask.
3. **Build-order item:** find `- [ ] **<item_id>:` or `- [x] **<item_id>:` in its stage file. Keep its Build, VFX, Files, Depends on and **Done when** for the subagents.
4. **Approved in Blender:** if the unit has a `/B` item, `blender/renders/APPROVALS.md` must have its row and `blender/renders/stills/<unit-slug>/` must hold the stills. Missing: stop; parity can't be tested without approved stills.
5. **Branch:** `git branch --show-current` should start with `shot/<slug>`. If not, warn and continue.
6. **Implementation exists:** `git diff main...HEAD --stat`, `git diff --stat`, `git status --porcelain`. If nothing changed outside `tests/`, warn: "No implementation changes found for <item_id>. Tests will be written from the spec, but they're expected to fail until the shot is built." Continue.

---

## Step 1: Write the tests

Invoke **mtd-test-writer** with:
- The item id, title and the build-order block (Build, VFX, Files, Depends on, **Done when**)
- The spec: `<spec path>` (its *Shot data*, *Components and systems*, *VFX*, *Content*, *Accessibility*, *Budgets*, *Tests* and *Definition of done*)
- The approved stills folder and the shot's entry in `shots/<act>.json`
- Source files to read **for public structure only** (exports, component names, store fields, cue names, gate ids, dev-page query params): the item's `Files`, `src/experience/director/`, `src/experience/systems/`, `src/store/useStore.ts`, `src/lib/schemas.ts`, `src/app/dev/`, existing `tests/`
- Where tests go: `tests/unit/…` (Vitest) and `tests/e2e/shots/<unit-slug>.spec.ts` (Playwright), as the spec's *Tests* section names them
- Instruction: "Write tests from what the spec, the plan's Test list and the Done when say the shot SHOULD do. Do NOT derive test logic from the implementation. Cover: parity of every approved still (≥ 0.90, HTML and VFX hidden, fixed seed), the stitch from the previous shot, shot-data rules, event/cue timing, each gate by mouse, touch and keyboard, reduced motion where the plan mentions it, and the budget check. Only write inside tests/. Don't add packages. Return your test plan, the files written and your run results."

Wait for it to finish completely.
- **Clarifying questions:** show them to the user, wait, re-invoke with the answers. Don't guess.
- **Couldn't write tests** (missing spec detail, missing harness from F.4, a needed package): stop and report. Do NOT go to Step 2.
- **Confirm the files exist** (Glob every path it reports). None: stop and report.

---

## Step 2: Run and verify

Invoke **mtd-test-runner** with:
- The item id, title and **Done when**
- The test files the writer reported
- The spec path and the approved stills folder
- Source files to cross-reference failures: the item's `Files` and the touched systems/VFX
- Instruction: "Follow your execution protocol: targeted tests first, re-run failures once with full output, then the full unit suite, typecheck and lint, the shot's Playwright spec (parity + stitch), and the budget check on High and Lite. Classify each failure as Implementation bug, Test bug, Blender/parity (needs a fix in Blender), Environment or Out of order. Map every Done when line to the test that proves it. Read-only: don't fix anything."

---

## Handoff rules
- Do NOT start Step 2 until Step 1 is complete and the files are confirmed on disk
- Do NOT fix code, tests, shots or Blender files here; this command only writes tests (through the writer) and reports
- Do NOT run tests yourself; that's the runner's job
- Do NOT tick the build-order item or commit
- If either subagent fails or returns nothing, report it; never present a partial pipeline as complete

---

## Final output

```
### Testing Pipeline Report: <item_id>: <title>
Branch: <branch>   Spec: <spec path>   Approved stills: <folder>

**Step 1: Tests written** (mtd-test-writer)
- `<test name or file>`: <which Done when line / plan Test bullet it proves>
Files: <paths>

**Step 2: Test results** (mtd-test-runner)
[Mirror the runner's report: commands, summary table, parity scores per still, stitch result,
budget numbers, typecheck/lint, Done when traceability, failures with classification]

**Verdict**
- ✅ Ready for review: runner says VERIFIED. Next: `/review-shot <unit>`
- ❌ Needs fixes:
  - Implementation bug → fix the code, re-run `/test-shot <unit>`
  - Test bug → re-run `/test-shot <unit>` so the writer corrects it (say what was wrong)
  - Blender/parity → the framing or timing differs from the approved render: fix it in Blender (`/blender-shot <unit>` → `/approve-shot <unit>`), re-export, re-test. Never "fix" camera work in code
  - Environment → the fix command (e.g. `pnpm exec playwright install chromium`), then re-run
  - Out of order → build the dependency first
  - ⚠ Done when lines not covered → the writer must add tests for them
```

Then ask: "Do you want me to fix the implementation bugs listed above?" Wait for explicit confirmation before touching any file.
