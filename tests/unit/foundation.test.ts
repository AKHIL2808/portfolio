import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string): string => readFileSync(`${root}${rel}`, "utf8");

interface PackageJson {
  packageManager?: string;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const pkg = JSON.parse(read("package.json")) as PackageJson;
const deps = pkg.dependencies ?? {};
const devDeps = pkg.devDependencies ?? {};
const all: Record<string, string> = { ...deps, ...devDeps };

// CLAUDE.md > Preferred libraries (npm packages only)
const RUNTIME = [
  "next",
  "react",
  "react-dom",
  "three",
  "@react-three/fiber",
  "@react-three/drei",
  "@react-three/postprocessing",
  "gsap",
  "lenis",
  "zustand",
  "zod",
  "howler",
  "detect-gpu",
  "resend",
];
const DEV = [
  "typescript",
  "tailwindcss",
  "eslint",
  "leva",
  "r3f-perf",
  "vitest",
  "@playwright/test",
  "@lhci/cli",
  "@gltf-transform/cli",
  "svgo",
];
const SUPPORT = [
  "postprocessing",
  "@tailwindcss/postcss",
  "postcss",
  "eslint-config-next",
  "@types/react",
  "@types/react-dom",
  "@types/node",
  "@types/three",
  "@types/howler",
];

describe("package.json dependencies", () => {
  it("pins every dependency to an exact semver (no ^ or ~ ranges)", () => {
    const loose = Object.entries(all).filter(([, v]) => !/^\d+\.\d+\.\d+$/.test(v));
    expect(loose, `not exact: ${loose.map(([n, v]) => `${n}@${v}`).join(", ")}`).toEqual([]);
  });

  it.each(RUNTIME)("lists runtime library %s in dependencies", (name) => {
    expect(deps[name], `${name} missing from dependencies`).toBeDefined();
  });

  it.each(DEV)("lists dev tool %s in devDependencies", (name) => {
    expect(devDeps[name], `${name} missing from devDependencies`).toBeDefined();
  });

  it("adds no library outside the approved set", () => {
    const approved = new Set([...RUNTIME, ...DEV, ...SUPPORT]);
    const extra = Object.keys(all).filter((n) => !approved.has(n));
    expect(extra, `unapproved packages: ${extra.join(", ")}`).toEqual([]);
  });

  it("keeps @types/three and three on the same version", () => {
    expect(devDeps["@types/three"]).toBe(deps["three"]);
  });
});

describe("package.json metadata", () => {
  it.each(["dev", "build", "start", "typecheck", "lint", "test", "test:e2e"])(
    "defines the %s script",
    (name) => {
      expect(pkg.scripts?.[name], `script ${name} missing`).toBeTruthy();
    },
  );

  it("declares packageManager pnpm@9.15.4 and node >=20.9", () => {
    expect(pkg.packageManager).toBe("pnpm@9.15.4");
    expect(pkg.engines?.["node"]).toBe(">=20.9");
  });
});

describe("pnpm-lock.yaml", () => {
  it("has importer specifiers and resolved versions matching package.json", () => {
    const lock = read("pnpm-lock.yaml");
    const start = lock.indexOf("\nimporters:");
    const end = lock.indexOf("\npackages:");
    expect(start).toBeGreaterThan(-1);
    const lines = lock.slice(start, end === -1 ? undefined : end).split("\n");

    const specs: Record<string, string> = {};
    let current: string | null = null;
    for (const line of lines) {
      const name = /^ {6}'?([^':]+(?:\/[^':]+)?)'?:$/.exec(line);
      if (name?.[1]) {
        current = name[1];
        continue;
      }
      const spec = /^ {8}specifier: (.+)$/.exec(line);
      if (spec?.[1] && current) specs[current] = spec[1].trim();
    }
    for (const [name, version] of Object.entries(all)) {
      expect(specs[name], `lockfile specifier for ${name}`).toBe(version);
    }
    expect(Object.keys(specs).sort()).toEqual(Object.keys(all).sort());
  });
});

describe(".npmrc", () => {
  it("sets save-exact=true", () => {
    expect(read(".npmrc")).toMatch(/^save-exact=true$/m);
  });
});

describe("tsconfig.json", () => {
  const ts = JSON.parse(read("tsconfig.json")) as {
    compilerOptions: Record<string, unknown> & { paths?: Record<string, string[]> };
  };
  it.each(["strict", "noUncheckedIndexedAccess", "noUnusedLocals", "noUnusedParameters"])(
    "enables %s",
    (flag) => {
      expect(ts.compilerOptions[flag]).toBe(true);
    },
  );
  it("maps @/* to ./src/*", () => {
    expect(ts.compilerOptions.paths?.["@/*"]).toEqual(["./src/*"]);
  });
});

describe("root app files", () => {
  const forbidden = /from\s+["'](three(\/.*)?|@react-three\/.*|gsap(\/.*)?|lenis(\/.*)?)["']/;

  it.each(["src/app/layout.tsx", "src/app/page.tsx"])(
    "%s does not import the 3D or animation stack",
    (file) => {
      expect(read(file)).not.toMatch(forbidden);
    },
  );

  it("layout sets <html lang=\"en\">", () => {
    expect(read("src/app/layout.tsx")).toMatch(/<html[^>]*\blang=["']en["']/);
  });

  it("page renders an <h1>", () => {
    expect(read("src/app/page.tsx")).toMatch(/<h1[\s>]/);
  });

  it.each(["next.config.ts", "eslint.config.mjs", "vitest.config.mts"])(
    "%s exists",
    (file) => {
      expect(existsSync(`${root}${file}`)).toBe(true);
    },
  );
});

describe("ESLint project config", () => {
  const lint = async (code: string, filePath: string) => {
    const eslint = new ESLint({ cwd: root });
    const [result] = await eslint.lintText(code, { filePath: `${root}${filePath}` });
    return result?.messages ?? [];
  };

  it("errors on explicit any", async () => {
    const msgs = await lint("export const x: any = 1;\n", "src/lint-probe.ts");
    expect(msgs.some((m) => m.ruleId === "@typescript-eslint/no-explicit-any" && m.severity === 2)).toBe(true);
  }, 60_000);

  it("errors on unused variables", async () => {
    const msgs = await lint("const unused = 1;\nexport {};\n", "src/lint-probe.ts");
    expect(msgs.some((m) => m.ruleId === "@typescript-eslint/no-unused-vars" && m.severity === 2)).toBe(true);
  }, 60_000);

  it("errors on hooks called conditionally", async () => {
    const code =
      'import { useState } from "react";\nexport function C({ a }: { a: boolean }) {\n  if (a) { useState(0); }\n  return null;\n}\n';
    const msgs = await lint(code, "src/lint-probe.tsx");
    expect(msgs.some((m) => m.ruleId === "react-hooks/rules-of-hooks" && m.severity === 2)).toBe(true);
  }, 60_000);
});

// F.1/W.05: secret names stay in sync with CLAUDE.md, and CI runs the agreed checks safely.
describe(".env.example", () => {
  it("lists exactly RESEND_API_KEY and CONTACT_TO_EMAIL, with no values", () => {
    expect(existsSync(`${root}.env.example`)).toBe(true);
    const lines = read(".env.example")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#"));
    expect(lines).toEqual(["RESEND_API_KEY=", "CONTACT_TO_EMAIL="]);
  });

  it("keeps .env.local git-ignored", () => {
    expect(read(".gitignore").split("\n")).toContain(".env.local");
  });
});

describe("CI workflow", () => {
  const ci = read(".github/workflows/ci.yml");

  it.each(["pnpm install --frozen-lockfile", "pnpm typecheck", "pnpm lint", "pnpm test"])(
    "runs %s",
    (cmd) => {
      expect(ci).toMatch(new RegExp(`^\\s*- run: ${cmd.replace(/[-]/g, "\\-")}\\s*$`, "m"));
    },
  );

  it("grants the workflow read-only repository access", () => {
    expect(ci).toMatch(/^permissions:\n {2}contents: read\s*$/m);
  });

  it("pins every action to a full commit SHA", () => {
    const uses = [...ci.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1] ?? "");
    expect(uses.length).toBeGreaterThan(0);
    for (const ref of uses) {
      expect(ref, `${ref} is not pinned to a 40-hex SHA`).toMatch(/@[0-9a-f]{40}$/);
    }
  });

  it("takes Node from .nvmrc, which pins Node 22", () => {
    expect(ci).toContain("node-version-file: .nvmrc");
    expect(read(".nvmrc").trim()).toBe("22");
  });
});

describe("CI workflow scope and hygiene (F.1/W.05)", () => {
  const ci = read(".github/workflows/ci.yml");
  const runLines = [...ci.matchAll(/^\s*- run:\s*(.+?)\s*$/gm)].map((m) => m[1] ?? "");

  it("triggers on push to every branch and on pull requests into main", () => {
    expect(ci).toMatch(/^on:\n {2}push:\n {4}branches: \["\*\*"\]\n {2}pull_request:\n {4}branches: \[main\]/m);
  });

  it("keeps the job id and name `checks` so a future ruleset can match it", () => {
    expect(ci).toMatch(/^jobs:\n {2}checks:\n {4}name: checks$/m);
  });

  it("checks out without LFS and without persisted credentials", () => {
    expect(ci).toMatch(/^\s*lfs: false\b/m);
    expect(ci).toMatch(/^\s*persist-credentials: false\b/m);
  });

  it("uses no secrets and no env blocks", () => {
    expect(ci).not.toMatch(/secrets\./);
    expect(ci).not.toMatch(/^\s*env:/m);
  });

  it("sets a job timeout and cancels superseded runs", () => {
    expect(ci).toMatch(/^\s*timeout-minutes:\s*\d+\s*$/m);
    expect(ci).toMatch(/^concurrency:\n\s+group: .*github\.ref.*\n\s+cancel-in-progress: true/m);
  });

  it("runs only install, typecheck, lint, test, in that order (no build, e2e or Lighthouse yet)", () => {
    expect(runLines).toEqual([
      "pnpm install --frozen-lockfile",
      "pnpm typecheck",
      "pnpm lint",
      "pnpm test",
    ]);
    expect(ci).not.toMatch(/pnpm build|test:e2e|lhci|playwright/);
  });

  it("keeps .env.example tracked: no .gitignore pattern matches it", () => {
    const patterns = read(".gitignore")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#"));
    expect(patterns).not.toContain(".env.example");
    expect(patterns).not.toContain(".env*");
    expect(patterns).not.toContain(".env.*");
    expect(patterns).toContain(".env*.local");
  });
});

describe("merge block and docs (F.1/W.05)", () => {
  it("/ship-shot still refuses to merge on a failing check", () => {
    const ship = read(".claude/commands/ship-shot.md");
    expect(ship).toMatch(/Any failing check: stop and show it\. Don't merge\./);
  });

  it("progress log records the soft-block decision and the Vercel production URL", () => {
    const progress = read("docs/progress.md");
    expect(progress).toMatch(/Merges are blocked only by `\/ship-shot`/);
    expect(progress).toContain("https://portfolio-chi-ten-ogbpwcpzyp.vercel.app/");
  });
});
