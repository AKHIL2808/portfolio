# Spec: F.1/W.02: Next.js + TypeScript strict + Tailwind, stack installed and pinned (Web)

- Build-order item: `F.1/W.02` in `.claude/build-order/stage-F.md` (stage F)
- Branch: `shot/f-1-w-02-next-js-typescript-strict`
- Mode: n/a (infrastructure, no shot)
- Approved render: n/a (F.1 has no `/B` item)
- Created: 2026-11-09

## Director's view
None. This is a Foundation item. Plan › F.1 bullet this item covers: "Next.js + TypeScript strict + Tailwind; install and pin the stack from the TDD."

TDD › Tech stack: "Install the latest stable version of each at setup and pin exact versions in package.json; do not upgrade major versions mid-build."

## Overview
This item turns the empty folder skeleton from F.1/W.01 into a working Next.js App Router project. It sets up TypeScript in strict mode, Tailwind CSS and ESLint, and installs every library from the CLAUDE.md › Preferred libraries table at an exact, pinned version. It also adds the `pnpm` scripts that every later item and CI (F.1/W.05) rely on. The only pages are a bare `layout.tsx` and a placeholder `page.tsx`, with no 3D yet. A single smoke test proves `pnpm test` runs. F.1/W.05 (CI) and all of F.3 build on this.

## Depends on
- F.1/W.01: Git repository, Git LFS and folder skeleton: ✅ ticked (PR #1).
- Tools: Node 22.23.1 ✅ (Next needs ≥ 20.9), pnpm 9.15.4 ✅.

## Shot data
None.

## Components and systems
- `src/app/layout.tsx`: root layout, `<html lang="en">`, imports `globals.css`, `metadata` with the title "Midnight to Dawn" and a one-line description. No fonts yet (fonts come with the content and Act 0 work; tdd › Export settings: `next/font`, under 100 KB).
- `src/app/page.tsx`: a placeholder server component: the site name and "Akhilesh Singh" in plain HTML with Tailwind classes. `<Experience/>` replaces it in F.3/W.04.
- `src/app/globals.css`: `@import "tailwindcss";` and a dark `body` background.

No `src/experience/**`, store or systems in this item.

## VFX
None.

## Content
None. The placeholder text is not portfolio content; `content/profile.ts` comes later (tdd › M1).

## Accessibility and fallbacks
`<html lang="en">`; the placeholder page uses a real `<h1>`. Nothing interactive yet.

## Budgets
None measured yet. Note for later: three, drei, postprocessing and GSAP are installed but must **not** be imported by the root page. The first download stays small (≤ 1.5 MB before the loading screen, tdd › Rules 6).

## Pinned stack (latest stable on 2026-11-09, checked with `npm view`)

**Runtime** (`dependencies`)

| Package | Version | Note |
|---|---|---|
| next | 16.4.5 | |
| react, react-dom | 19.3.1 | R3F 9.8 accepts React `>=19 <19.4` ✅ |
| three | 0.187.0 | |
| @react-three/fiber | 9.8.2 | |
| @react-three/drei | 10.7.9 | |
| @react-three/postprocessing | 3.2.2 | |
| postprocessing | 6.39.6 | peer of @react-three/postprocessing |
| gsap | 3.15.1 | ScrollTrigger is included |
| lenis | 1.3.27 | |
| zustand | 5.1.0 | |
| zod | 4.6.7 | |
| howler | 2.2.4 | |
| detect-gpu | 5.0.70 | |
| resend | 6.37.0 | used only by `/api/contact` (Act 7) |

**Dev** (`devDependencies`)

| Package | Version | Note |
|---|---|---|
| typescript | **6.0.3** | ⚠ not 7.0.2, see Open question 1 |
| @types/react, @types/react-dom | 19.3.0 | |
| @types/node | 26.6.6 | |
| @types/three | 0.187.0 | matches three |
| @types/howler | 2.2.13 | |
| tailwindcss, @tailwindcss/postcss | 4.3.5 | Tailwind v4: config in CSS, no `tailwind.config` file |
| postcss | 8.5.32 | |
| eslint | **9.39.5** | ⚠ not 10.14.0, see Open question 1 |
| eslint-config-next | 16.4.5 | brings typescript-eslint, react-hooks, jsx-a11y |
| leva | 0.10.1 | dev-only tuning |
| r3f-perf | 7.2.3 | dev-only overlay |
| vitest | 5.1.0 | |
| @playwright/test | 1.65.0 | browsers are installed in F.4/W.03 |
| @lhci/cli | 0.16.0 | |
| @gltf-transform/cli | 4.5.1 | |
| svgo | 4.1.0 | |

Not npm packages: KTX-Software (system tool, needed in F.2/B.07), Blender.

## Files to change / Files to create
- `package.json`: name `midnight-to-dawn`, `private: true`, `packageManager: "pnpm@9.15.4"`, `engines.node: ">=20.9"`, exact versions above, and the scripts:
  - `dev`: `next dev` · `build`: `next build` · `start`: `next start`
  - `typecheck`: `tsc --noEmit`
  - `lint`: `eslint .` (Next 16 has no `next lint`)
  - `test`: `vitest run`
  - `test:e2e`: `playwright test --pass-with-no-tests` (no specs until F.4)
  - `blender:*` and `assets` are **not** added here; F.2/B.07 adds them.
- `pnpm-lock.yaml`: generated.
- `.npmrc`: `save-exact=true`, so later installs stay pinned.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `moduleResolution: "bundler"`, `jsx: "react-jsx"` (Next 16 default), the Next plugin, and path alias `@/*` → `src/*`. Includes `src`, `tests`, `content`, root config files.
- `next.config.ts`: `reactStrictMode: true`, `turbopack.root: __dirname` (a stray `~/package-lock.json` outside the repo made Turbopack guess the wrong root). No headers yet (out of scope).
- `playwright.config.ts`: minimal, only `testDir: "./tests/e2e"`, so `pnpm test:e2e` doesn't pick up the Vitest files; F.4/W.03 extends it.
- `postcss.config.mjs`: `@tailwindcss/postcss`.
- `eslint.config.mjs`: flat config from `eslint-config-next` (`core-web-vitals` + `typescript`), plus `@typescript-eslint/no-explicit-any: error`, `@typescript-eslint/no-unused-vars: error`, `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: error`; ignores `.next`, `public`, `raw-assets`, `blender`.
- `vitest.config.mts` (`.mts` so Vite loads it as ESM without a warning): `environment: "node"`, `include: ["tests/unit/**/*.test.ts"]`, `@` alias.
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`: as above. Remove `src/app/.gitkeep`.
- `tests/unit/smoke.test.ts`: one real assertion (e.g. that the pinned versions in `package.json` have no `^` or `~`, so the Done when stays guarded in CI).
- `.gitignore`: already covers `.next`, `node_modules`, `next-env.d.ts`, `*.tsbuildinfo`; no change expected.

## New dependencies
All the packages above are new to the repo. Every **library** comes from the CLAUDE.md › Preferred libraries table. ⚠ These support packages are not named in the table, so they need your approval first:
- `postprocessing`: required peer of `@react-three/postprocessing`.
- `@tailwindcss/postcss` + `postcss`: how Tailwind v4 plugs into Next.
- `eslint-config-next`: the standard Next ESLint setup (includes the React hooks rules CLAUDE.md asks for).
- `@types/react`, `@types/react-dom`, `@types/node`, `@types/three`, `@types/howler`: TypeScript types only, nothing ships to the browser.

## Rules for implementation
- Exact versions only; no `^` / `~` anywhere in `package.json`.
- Set the project up by hand, not with `create-next-app` (it adds demo SVGs, a README and fonts we don't want). Same result, fewer files to delete.
- TypeScript strict, no `any`; no unused code.
- The root page must not import three, R3F, GSAP or Lenis (keeps the first download small).
- No `src/experience/**` code; no security headers; no `.env.example` (F.1/W.05).
- Don't touch `CLAUDE.md` or the docs.

## Tests
- `tests/unit/smoke.test.ts` (Vitest): every version in `dependencies` and `devDependencies` matches `^\d+\.\d+\.\d+$`.
- Commands, all must pass: `pnpm install --frozen-lockfile` (fresh clone), `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e` (passes with no specs).
- Manual: `pnpm dev` and open `http://localhost:3000`: the placeholder page renders with Tailwind styles.
- Parity, stitch and budget tests: n/a (no shot).

## Definition of done
- [ ] no `^`/`~` ranges in package.json; `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` all pass
- [ ] `pnpm install --frozen-lockfile` works from a clean checkout
- [ ] Placeholder page renders with Tailwind at `pnpm dev`
- [ ] Verified by `mtd-test-runner` (`/test-shot`); `/review-shot` has no 🚧 items (quality + performance; add security because it touches dependencies)
- [ ] `docs/progress.md` updated (created in F.1/W.03; see Open question 4); `F.1/W.02` ticked in `.claude/build-order/stage-F.md`

## Out of scope
- `docs/*.md` and `docs/progress.md` (F.1/W.03).
- CI, Vercel, `.env.example` (F.1/W.05).
- `pnpm blender:*`, `pnpm assets`, `scripts/optimize-assets.mjs` (F.2/B.07).
- Playwright config and browsers (F.4/W.03).
- Store, Director, systems, materials, HUD (F.3).
- Security headers and CSP in `next.config` (Act 7 / tdd › Contact backend).
- Fonts (later, with content and Act 0).

## Open questions
1. ~~Two "latest" versions don't work together.~~ Resolved 2026-11-09: director chose TypeScript 6.0.3 + ESLint 9.39.5. Note: npm marks ESLint 9.39.5 "no longer supported"; revisit only if eslint-config-next gains ESLint 10 support.
2. ~~Support packages.~~ Resolved 2026-11-09: director approved all of them.
3. ~~Test and review.~~ Resolved 2026-11-09: run `/test-shot` and `/review-shot` with the security reviewer.
4. **`docs/progress.md`** still doesn't exist (F.1/W.03 creates it). Proposed: as agreed for W.01, W.03 writes the entries for W.01 and W.02.
5. **Vitest environment.** Proposed: `node` for now (Foundation tests are pure logic). Switching to `jsdom` or `happy-dom` for component tests later would be another new dependency to approve.

## Implementation notes (2026-11-09)
- `next build` added `allowJs: true` (suggested) and `esModuleInterop: true` (mandatory for SWC) to `tsconfig.json`; both kept so the file is stable across builds.
- Peer warnings at install, all in dev-only tools: `r3f-perf` 7.2.3 (latest) bundles its own `@react-three/drei` 9.122.0 built for React 18 / R3F 8; `@lhci/cli` → puppeteer wants `proxy-agent >= 8`. Neither ships to the browser. r3f-perf gets checked when it's first used (F.3/F.4); if it breaks on R3F 9, drei's built-in `<Stats>` / `renderer.info` are the fallback.
- Registry timeouts during install were retried by pnpm and succeeded.
