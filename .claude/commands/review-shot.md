---
description: Runs parallel quality and performance review (plus security when relevant) for one shot's web phase. Pass the unit, e.g. /review-shot 1.5
argument-hint: "<unit>, e.g. 1.5 · 7.5 · F.3/W.02"
allowed-tools: Read, Glob, Grep, Agent, Bash(git diff:*), Bash(git status:*), Bash(git branch:*), Bash(git log:*), Bash(git merge-base:*), Bash(git ls-files:*), Bash(git check-ignore:*)
disable-model-invocation: true
---

Run the code review pipeline for the web phase of the unit in $ARGUMENTS.

If no argument is provided, stop and say:
"Please provide a shot or unit. Usage: /review-shot <unit>, e.g. /review-shot 1.5"

## Pre-flight check

Do all of these before invoking any subagent. If a check stops, say why and do nothing else.

1. **Normalize** to the `/W` item id. For a `/B` item say: "Blender phases are reviewed by mtd-blender-reviewer inside /blender-shot." and stop.
2. **Spec:** Glob `.claude/specs/<slug>-*.md`. None: "No spec found for <item_id>. Run /create-spec <unit> web first." More than one: ask.
3. **Build-order item:** find the block in its stage file. Missing: stop. Ticked: warn and continue.
4. **Branch:** `git branch --show-current` should start with `shot/<slug>`. If not, warn and continue.
5. **Collect the changes** into one change set:
   - `git diff main...HEAD` (committed), `git diff --staged`, `git diff`
   - `git status --porcelain` for untracked files (reviewers read them in full)
   - the `--stat` summaries
6. **Empty check:** if all are empty, stop: "No changes detected for <item_id>. Implement the shot before running review."
7. **Security trigger:** security review is needed if the change set touches any of: `src/app/api/**`, `next.config.*`, `middleware.*`, `.env*`, `package.json` / lockfile, `src/lib/schemas.ts`, any form or `<input>`/`<textarea>`, `dangerouslySetInnerHTML`, external links, or the `/cv` page head (JSON-LD). Also always run a quick secret check: `git ls-files | grep -E '\.env($|\.)' | grep -v '\.env\.example$'` must be empty and `git check-ignore .env.local` must succeed. A failure here **forces** the security review.

---

## Step 1: Parallel review

Invoke the reviewers **in the same message** (Agent tool calls side by side), with the same context:
- the item id, title, spec path and the build-order block (Build, VFX, Files, Depends on, Done when)
- the combined change set (diffs + untracked paths + stat)

**mtd-quality-reviewer**
- Files to reference: `src/experience/director/`, `src/experience/systems/`, the touched `src/experience/acts/<act>/`, `src/store/useStore.ts`, `src/lib/schemas.ts`, `content/`, `shots/<act>.json`
- Instruction: "Review only the changed code for quality, spec and plan alignment, project rules (root CLAUDE.md, .claude/rules/web.md) and maintainability. Don't comment on frame-loop performance or budgets (performance reviewer) or security. Read-only."

**mtd-performance-reviewer**
- Files to reference: the touched act, `src/experience/{vfx,materials,shaders,characters,systems}/`, `src/experience/Experience.tsx`, the act's `assets.ts`, the GLB sizes in `public/models/`
- Instruction: "Review only the changed code against the TDD performance rules, tier budgets and act asset budget: frame-loop allocations and setState, instancing, LOD, mixers, warm-up, code-splitting, disposal, post-effect usage, VFX catalog compliance and Lite-tier behaviour. Don't comment on general quality or security. Read-only."

**mtd-security-reviewer** (only if the security trigger fired)
- Files to reference: `src/app/api/`, `next.config.*`, `src/lib/schemas.ts`, `.env.example`, `.gitignore`
- Instruction: "Review only the changed code for security: the contact route (validation, honeypot, timing, rate limit, escaping, Resend key handling), headers/CSP, secrets, HTML injection on 3D surfaces, external links and dependencies. Read-only."

If the security trigger didn't fire, note "🔒 Security: not triggered (no API, form, header, env or dependency changes); secret check passed."

---

## Step 2: Unified report

Combine the findings. **De-duplicate:** if two reviewers flag the same file/line, merge into one finding with both icons and keep the higher severity.

```
Code Review Report: <item_id>: <title>
Branch: <branch>   Spec: <spec path>   Files changed: <n>

## 🧹 Quality findings
[mtd-quality-reviewer: 🎓, 📋 Spec alignment, 🚧, 💡, 🌱, ✅, Verdict]

## ⚡ Performance findings
[mtd-performance-reviewer: 🎓, 📊 Budget check, 🚧, 💡, 🌱, ✅, Verdict]

## 🔒 Security findings
[mtd-security-reviewer output, or "not triggered"]

## Combined action plan
Ordered by priority; each line has file:line, a one-line fix and its source (🧹/⚡/🔒):
1. [ ] 🚧 Security must-fix
2. [ ] 🚧 Performance must-fix (budget or frame-loop rule broken)
3. [ ] 🚧 Quality must-fix (incl. spec/plan gaps)
4. [ ] 💡 Worth improving
5. [ ] 🌱 Polish (grouped, optional)

## Overall verdict
APPROVED: nothing worth acting on
APPROVED WITH SUGGESTIONS: no 🚧 items; you can ship and pick up 💡/🌱 later
CHANGES REQUESTED: at least one 🚧 item; fix before shipping
```

Any 🚧 from any reviewer means **CHANGES REQUESTED**.

**Next steps** line:
- CHANGES REQUESTED: fix the 🚧 items, re-run `/test-shot <unit>` if code changed, then `/review-shot <unit>` again.
- Otherwise: `/ship-shot`.

If a finding is really a framing or timing problem (camera doesn't match the approved render), label it "→ fix in Blender" rather than proposing a code change.

---

## Step 3: Ask for approval

"Do you want me to implement the action plan now? (all / only 🚧 items / pick numbers / no)"

Wait for explicit confirmation. Implement only the chosen items, stay inside the spec, don't tick the item. Then suggest re-running `/test-shot <unit>` and `/review-shot <unit>`.

---

## Rules
- Do NOT edit any file before the user approves
- Quality and performance reviewers always run, in parallel, in one message
- Do NOT skip the pre-flight checks or proceed without a spec
- Do NOT tick the build-order item or commit here
- If any subagent fails or returns nothing, report it; never present a partial review as complete
