# Spec: F.1/W.03: Project docs in Markdown + progress log (Web)

- Build-order item: `F.1/W.03` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-1-w-03-project-docs-in-markdown`
- Mode: n/a (documentation, no shot)
- Approved render: n/a (F.1 has no `/B` item)
- Created: 2026-11-09

## Director's view
None. This is a Foundation item. Plan › F.1 bullet this item covers: "CLAUDE.md, docs/tdd.md, docs/plan.md (this document), docs/progress.md."

Plan › Working with Claude Code: "Keep the Technical Design Document as docs/tdd.md for architecture and budgets, and this plan as docs/plan.md."
TDD › Build plan for Claude Code: "Before starting, download this document and the screenplay as Markdown into the repository as docs/tdd.md and docs/screenplay.md."

## Overview
Every command, agent and rule in this repo (`CLAUDE.md`, `/build-order`, `/create-spec`, the reviewers) reads `docs/plan.md`, `docs/tdd.md` and `docs/screenplay.md`. Today only the PDFs exist, so each session has to run `pdftotext` and read column-wrapped tables. This item converts the three PDFs into faithful, readable Markdown and creates `docs/progress.md`, the log that every later item updates. Once the `.md` files exist, CLAUDE.md treats them as the source of truth (it reads "docs/plan.md, else the PDF"). So the conversion must not drop or change a single fact: no summarising, no rewording, no "fixing". The PDFs stay in the repo as the originals.

## Depends on
- F.1/W.01: Git repository, Git LFS and folder skeleton: ✅ ticked (PR #1).
- Tools: `pdftotext`, `pdfinfo`, `pdfimages` (poppler) ✅ installed. No `pandoc` / `mutool` (not needed).

## Source PDFs (measured 2026-11-09)

| PDF | Pages | Text lines (`pdftotext -layout`) | Raster images | → Markdown |
|---|---|---|---|---|
| `Midnight to Dawn — Director's Implementation Plan.pdf` | 48 | 2416 | 1 (1344 × 1372, "the shot loop" diagram) | `docs/plan.md` |
| `Midnight to Dawn — Technical Design Document.pdf` | 33 | 1616 | 1 (1344 × 1372, "system architecture · Director at the center") | `docs/tdd.md` |
| `Midnight to Dawn — Demon Slayer Portfolio Screenplay.pdf` | 20 | 994 | 0 | `docs/screenplay.md` |

All three were printed from Chromium, so the text layer is clean (no OCR needed). The problems are layout: running headers ("Midnight to Dawn — …"), "Page N of M" footers, table cells wrapped across lines and pages, code blocks split by page breaks, and the project tree's box characters broken by line wrapping.

## Shot data
None.

## Components and systems
None. No code under `src/`.

## VFX
None.

## Content
None. These are project docs, not portfolio text (`content/*.ts` is a later item).

## Accessibility and fallbacks
The two diagrams get alt text that describes what they show, plus a short text version under each image so the docs are readable in a terminal.

## Budgets
None.

## Conversion rules (how each PDF becomes Markdown)
1. **Start from the text layer:** `pdftotext -layout` for tables, `pdftotext -raw` for flowing text. Both are kept in the scratchpad for checking, never committed.
2. **Remove print artefacts only:** running headers, "Page N of M" footers, the date/byline line becomes one line under the title (`Nov 8, 2026 · @Akhilesh`), and stray zero-width characters.
3. **Headings:** the document title is `#`; each PDF section (e.g. "Foundation", "Core systems") is `##`; sub-sections (e.g. "F.1 Project setup", "1. Director", "1.5 · Racing the Door") are `###`; per-shot blocks such as "Director's view", "Build in Blender", "Code", "Test" are `####`. Keep the PDF's own heading text exactly, so `/build-order` and `/create-spec` can grep for it.
4. **Tables:** real Markdown tables with the PDF's column headers and every cell's full text, re-joined where the PDF wrapped it. Cell text is never shortened. `|` inside a cell is escaped.
5. **Code and data blocks** (TypeScript interfaces, CLAUDE.md template, `gltf-transform` command, the example prompts, the project tree): fenced blocks with a language tag (`ts`, `bash`, `md`, `text`), re-joined across page breaks, with the tree's `├─ │ └─` drawing repaired.
6. **Lists:** numbered and bulleted lists as in the PDF; inline code (`shots/<act>.json`, `useActFrame`) in backticks, matching what the PDF shows in monospace.
7. **Diagrams:** extract both raster images with `pdfimages -png` into `docs/images/plan-shot-loop.png` and `docs/images/tdd-system-architecture.png` (LFS-tracked `.png`), embed them where they appear, and add a short text version under each image built only from the PDF's own text (no invented steps).
8. **Wording:** copied verbatim. Typos and inconsistencies in the PDFs are kept, and listed under "Conversion notes" at the end of each file. Known one: the screenplay and TDD build Act 7 and Act 4 before Act 3, while the plan builds in order (CLAUDE.md already records this).
9. **Header block:** each file starts with a two-line note: "Converted from `<pdf name>` on 2026-11-09. The PDF is the original; this file is the working copy that CLAUDE.md reads."

## `docs/progress.md` (new)
Three sections, as CLAUDE.md › "Before finishing a task" and `/ship-shot` Step 3.4 expect:
- **Done:** `F.1/W.01: Git repository, Git LFS and folder skeleton (2026-11-09, PR #1)`, `F.1/W.02: Next.js + TypeScript strict + Tailwind, stack installed and pinned (2026-11-09, PR #2)`, `F.1/W.03: Project docs in Markdown + progress log (<ship date>)`. The W.03 line goes in at `/ship-shot`, so it carries the real PR number.
- **Next:** `F.1/W.04: Blender MCP connected to Claude Code`.
- **Open issues**, carried from the stage file, the specs and the W.02 review. Each is one line with its source:
  - Stage F Open questions: MTD_Toon library vs F.3 materials; parity image-compare library; test-scene naming; test-cube approval row; preview mp4 in render_stills; KTX-Software install.
  - F.1/W.05: turn on Git LFS in Vercel; `.env.example`; CI should run `pnpm install --frozen-lockfile`.
  - W.02 review: AGENTS.md (generated by `next dev`), keep or git-ignore; pnpm `onlyBuiltDependencies` allowlist; dev-only `basic-ftp` advisory via `@lhci/cli`; r3f-perf's duplicate drei 9 (check at first use); load leva and r3f-perf dev-only; lazy `<Experience/>`; remove `--pass-with-no-tests` in F.4/W.03; no security headers until Act 7, so no public deploy before then.
  - Environment: zoxide warning in the shell (harmless); stray `~/package-lock.json` (Turbopack root pinned).
- One line at the top: `Stage F: 3/29` (updated by each `/ship-shot`).

## Files to change / Files to create
- `docs/plan.md`: Director's Implementation Plan, full conversion.
- `docs/tdd.md`: Technical Design Document, full conversion.
- `docs/screenplay.md`: screenplay, full conversion.
- `docs/images/plan-shot-loop.png`, `docs/images/tdd-system-architecture.png`: the two diagrams (Git LFS).
- `docs/progress.md`: the progress log described above.
- `tests/unit/docs.test.ts`: Vitest checks (see Tests).
- Not touched: the three PDFs, `CLAUDE.md`, `.claude/**` apart from this spec, all code.

## New dependencies
No new dependencies. Poppler (`pdftotext`, `pdfimages`) is already on the machine and is used only during conversion, never by the app or CI.

## Rules for implementation
- **Faithful, not edited:** every sentence, table cell, number, id and code line from the PDF appears in the Markdown. Nothing summarised, reordered or "improved". When a PDF passage is unclear, keep it as is and add a Conversion note.
- Work section by section (plan in about 4 chunks: front matter + cast, Foundation + Cast build, Acts 0–3, Acts 4–7 + Final assembly), checking each chunk against the PDF text before moving on.
- Keep shot ids, Pillar names, file paths, version numbers and budgets byte-exact (`T0→1`, `3Ho-D`, `≤ 65`, `1920 × 1080`).
- No HTML in the Markdown except `<br>` inside table cells when a cell really has line breaks.
- Don't edit CLAUDE.md; it already points at `docs/*.md` first.

## Tests
`tests/unit/docs.test.ts` (Vitest, reads the files with `node:fs`):
- **Section coverage:** each `.md` contains every section heading of its PDF. The expected heading lists are written into the test from the PDFs' own headings: e.g. plan › "Foundation", "F.1 Project setup" … "F.4 Test harness", "Blender-to-web parity rules", "Cast build", every act heading, "Final assembly"; tdd › "Tech stack", "Core systems", "Shaders and VFX catalog", "Performance", "Milestones"; screenplay › "Director's vision" and each Act heading.
- **Key facts survive:** a few exact strings per file that later items depend on: plan › `Done when: a test cube scene exports from Blender, plays in the browser through the Director, and passes the parity test.`; tdd › the `interface ActModule` block and `similarity 0.90` / the tier budget row `Draw calls per frame`; screenplay › the logline.
- **No print artefacts:** no line matches `Page \d+ of \d+`; no running header line `Midnight to Dawn — <title>` after the first heading.
- **Images:** `docs/images/*.png` exist and are referenced from the `.md` files.
- **progress.md:** has `## Done`, `## Next`, `## Open issues`; Done lists F.1/W.01 and F.1/W.02.

Plus a word-level fidelity check run during the build and reported (not a committed test, because it needs poppler): normalise both `pdftotext -raw` output and the Markdown (strip Markdown syntax, headers and footers, collapse whitespace), then compare word sequences. Target: **≥ 99 %** of the PDF's words present in order. List every missing run of ≥ 3 words and fix or explain it.

Commands: `pnpm test`, `pnpm lint`, `pnpm typecheck` stay green.

## Definition of done
- [ ] each `.md` contains every section heading of its PDF (spot-checked: plan › Foundation, tdd › Core systems, screenplay Act 1); progress.md exists with the three sections
- [ ] Word-level fidelity ≥ 99 % per document, with every missing run explained
- [ ] Both diagrams extracted, embedded and described in text
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green
- [ ] Verified by `mtd-test-runner` (`/test-shot`); `/review-shot` has no 🚧 items (quality only; performance has nothing to check, security isn't triggered)
- [ ] `docs/progress.md` updated; `F.1/W.03` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- Changing any decision in the docs (they're the director's documents; changes go through the director).
- Editing CLAUDE.md, the PDFs, or the stage file beyond the tick.
- Blender MCP check (F.1/W.04), CI and Vercel (F.1/W.05).
- Acting on the open issues; this item only records them.

## Open questions
1. ~~Who checks fidelity?~~ Resolved 2026-11-09: automated word check + the director's spot-check of 3 places before `/ship-shot`.
2. ~~Diagrams as images or redrawn?~~ Resolved: original PNGs + a text version transcribing the image's own words.
3. ~~Typos and contradictions.~~ Resolved: kept verbatim, listed in each doc's Conversion notes and in progress.md › Open issues.
4. ~~Session size.~~ Resolved: all three docs fit in one session; no split, F.1/W.03.02 not needed.
5. ~~Review scope.~~ Resolved: quality reviewer only.

## Results (2026-11-09)

Word coverage (order-free, against `pdftotext -layout`; table header rows the PDF repeats after a page break are not counted twice):

| Doc | PDF words | Missing | Coverage | Missing words, explained |
|---|---|---|---|---|
| `docs/plan.md` | 9,987 | 6 | 99.94 % | ids the PDF splits across a line break (`3.2-` / `<pillar>`, `3<P>-` / `C`, `5K<n>-` / `C1..C3`) |
| `docs/tdd.md` | 7,413 | 5 | 99.93 % | `ActModule s` (code + plural), `-- background -- python` (CLI flags split across lines), `2– 3` |
| `docs/screenplay.md` | 5,544 | 0 | 100.00 % | — |

Extra words beyond the PDF are only the header note, the two diagram text versions (transcribed from the images) and the Conversion notes; with those removed, the remaining extras are PDF headings the checker's repeat-filter skipped (counts verified: plan has 47 "Build in Blender", 47 "Code", 38 "Test", 46 shot headings in both PDF and Markdown).

Images: `docs/images/plan-shot-loop.png` (PDF page 2), `docs/images/tdd-system-architecture.png` (PDF page 6), both 1344 × 1372, in Git LFS.
Tests: `tests/unit/docs.test.ts` (96 cases); full suite 150/150, typecheck and lint green.
