# Spec: F.1/W.01: Git repository, Git LFS and folder skeleton (Web)

- Build-order item: `F.1/W.01` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-1-w-01-git-repository-git-lfs-and` (not created yet: the folder isn't a git repository. Create it right after the first commit on `main`; see Open questions)
- Mode: n/a (infrastructure, no shot)
- Approved render: n/a (F.1 has no `/B` item)
- Created: 2026-11-09

## Director's view
None. This is a Foundation item. Plan › Foundation says: "The Foundation gives every shot the same tools: the web project, the export scripts, the Director and core systems, and the per-shot test harness."

Plan › F.1 bullet this item covers: "Folders from the TDD's Project structure, including blender/ ; Git LFS for .blend , .png , .exr ."

## Overview
This item turns the folder (currently just `CLAUDE.md`, `docs/` and `.claude/`) into a git repository whose large binary files are stored in Git LFS. It also creates the empty folder tree from the TDD Project structure, so every later item has a defined place to write to. No app code, no `package.json` and no Blender files yet. F.1/W.02 (Next.js) and F.1/W.03 (docs) build directly on it.

## Depends on
- None (first item of the first stage).
- Tools on the machine: `git` 2.56.0 ✅ · **`git-lfs` ⚠ not installed** (`git lfs` isn't found; it must be installed, e.g. `sudo dnf install git-lfs`, then `git lfs install`).
- `init.defaultBranch` is not set, so `git init` would create `master`. Use `git init -b main` (CI, Vercel and `/create-spec` all expect `main`).

## Shot data
None.

## Components and systems
None. No `src/` code in this item; `src/` only gets its folder (filled by F.1/W.02 and F.3).

## VFX
None.

## Content
None. `content/` is created empty; its files and zod schemas come later (tdd › M1).

## Accessibility and fallbacks
None.

## Budgets
None. One indirect effect: putting binary files in LFS keeps the repository fast (tdd › Tech stack, Source control for art).

## Files to change / Files to create

**Repository**
- `.git/` — `git init -b main`.
- `.gitattributes` — LFS tracking:
  - required by the plan / CLAUDE.md: `*.blend`, `*.png`, `*.exr`
  - "raw textures/audio" (CLAUDE.md › Critical rules): `raw-assets/**/*.{jpg,jpeg,tga,tif,tiff,hdr,ktx2}` and `*.wav` anywhere; `*.mp4` and `*.webm` (previews and project videos); `*.glb` under `raw-assets/` and `public/models/` (see Open questions)
  - `* text=auto eol=lf` for consistent line endings
- `.gitignore` — `node_modules/`, `.next/`, `out/`, `coverage/`, `playwright-report/`, `test-results/`, `.vercel/`, `.env.local`, `.env*.local`, `*.blend1`, `*.blend2`, `__pycache__/`, `.DS_Store`, `*.tsbuildinfo`, `next-env.d.ts`. **Not** ignored: `.env.example`, `.claude/`, `blender/renders/`.

**Folders** (tdd › Project structure, CLAUDE.md › Architecture), each holding a `.gitkeep` until real files arrive:
- `blender/library/`, `blender/characters/`, `blender/scenes/`, `blender/scripts/`
- `blender/renders/`, `blender/renders/previews/`, `blender/renders/stills/`
- `raw-assets/` (plus `raw-assets/models/`, `raw-assets/vat/`, the targets of F.2/B.03 and F.2/B.05)
- `content/`, `shots/`
- `public/models/`, `public/textures/`, `public/vat/`, `public/audio/`, `public/icons/`
- `src/app/`, `src/experience/{director,systems,characters,acts,materials,vfx,shaders,ui}/`, `src/store/`, `src/lib/`
- `scripts/` (for `optimize-assets.mjs` in F.2/B.07)
- `tests/unit/`, `tests/e2e/`

**Files with content**
- `raw-assets/LICENSES.md` — header and an empty table: `| Asset | Path | Source / URL | Author | License | Date added | Notes |`, plus one line saying every third-party asset must have a row before use and only CC0 / royalty-free assets are allowed (tdd › Art sourcing).

**Not touched:** `CLAUDE.md`, `docs/*.pdf` (committed as normal git objects, see Open question 3), `.claude/**`.

## New dependencies
No new npm dependencies. One new **system tool**: `git-lfs` (needed by the TDD and CLAUDE.md, not an npm package). ⚠ It must be installed by you (needs `sudo`); suggest `! sudo dnf install git-lfs`.

## Rules for implementation
- Create only folders the TDD Project structure / CLAUDE.md › Architecture names (plus the `raw-assets` and `renders` subfolders the stage F file names). No code, no `package.json`.
- Run `git lfs install --local` before any `.blend`, `.png` or `.exr` is committed, so none of them is ever stored as a normal git object. The only binaries before LFS is set up are the three PDFs.
- Commit order (Open question 2): a bootstrap commit on `main` with `CLAUDE.md`, `docs/` and `.claude/` (including `stage-F.md` and this spec), then branch `shot/f-1-w-01-git-repository-git-lfs-and` for `.gitattributes`, `.gitignore`, the folder skeleton and `raw-assets/LICENSES.md`. Commit messages end with the attribution line.
- Don't add a remote or push in this item (the GitHub remote + Vercel come in F.1/W.05). Committing needs your OK.
- Update `docs/progress.md`? It doesn't exist until F.1/W.03; record progress for this item in that file when W.03 creates it (see Open questions).

## Tests
No test framework exists yet (Vitest arrives in F.1/W.02). Verify with shell commands:
1. `git rev-parse --abbrev-ref HEAD` → `main`.
2. `git lfs track` lists `*.blend`, `*.png`, `*.exr` (and the other patterns above).
3. `git check-attr filter -- blender/scenes/x.blend blender/renders/stills/a.png raw-assets/vat/a.exr` → `filter: lfs` for all three.
4. `git check-ignore .env.local node_modules/x foo.blend1` → all ignored; `git check-ignore .env.example` → not ignored.
5. A folder-existence check over every path in "Folders" above.
6. `git status --porcelain` is empty after the first commit.

## Definition of done
- [ ] `git lfs track` lists `.blend`, `.png`, `.exr`; every folder in the TDD Project structure exists; `git status` is clean after the first commit
- [ ] The six checks under Tests pass
- [ ] Repository is on `main`; branch `shot/f-1-w-01-git-repository-git-lfs-and` created from it for the work (or skipped, see Open questions)
- [ ] `/review-shot` not needed for pure infrastructure with no code (see Open questions); `mtd-test-runner` is skipped because no tests exist yet
- [ ] `docs/progress.md` updated (in F.1/W.03); `F.1/W.01` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- `package.json`, Next.js, TypeScript, Tailwind, ESLint, Vitest (F.1/W.02).
- Converting the PDFs to Markdown and creating `docs/progress.md` (F.1/W.03).
- Blender MCP check (F.1/W.04).
- GitHub remote, CI, Vercel, `.env.example` (F.1/W.05).
- Any Blender script or `.blend` file (F.2).

## Open questions
1. **Git LFS isn't installed.** Proposed: you run `! sudo dnf install git-lfs` before the build session; nothing in this item can be done without it.
2. **Branch for the first commit.** The shot loop puts every item on its own `shot/...` branch and squash-merges it. A brand-new repo has no `main` to branch from. Proposed: make one bootstrap commit on `main` (docs, CLAUDE.md, `.claude/`), then create `shot/f-1-w-01-git-repository-git-lfs-and` and put `.gitattributes`, `.gitignore`, the folders and LICENSES.md on it. Since there's no remote yet, `/ship-shot` merges locally. But the bootstrap commit would come before LFS is set up; it contains no LFS-pattern files (PDFs aren't on the list), so that's safe.
3. **PDFs in LFS?** The three `docs/*.pdf` files total ~3.7 MB, and the rules don't list `.pdf`. Proposed: keep them as normal git objects, because they're small and won't change often.
4. **GLB, MP4 and WebM in LFS?** CLAUDE.md lists `.blend`, `.png`, `.exr` and "raw textures/audio". Exported GLBs, preview mp4s and project videos are also large binaries. Proposed: track `*.glb`, `*.mp4`, `*.webm` and `*.wav` in LFS too. One catch: Vercel must be able to fetch LFS files at build time for `public/` (Vercel supports this with "Git LFS" turned on in project settings; to be checked in F.1/W.05).
5. **`docs/progress.md`** doesn't exist until F.1/W.03. Proposed: W.03 writes the first progress entries for W.01–W.03 together.
6. **Review for an item with no code.** Proposed: skip `/test-shot` and `/review-shot` for this item; the shell checks under Tests are the verification.
