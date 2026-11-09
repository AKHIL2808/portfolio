import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as PackageJson;

const allDeps: Record<string, string> = {
  ...pkg.dependencies,
  ...pkg.devDependencies,
};

describe("package.json", () => {
  it("pins every dependency to an exact version", () => {
    const loose = Object.entries(allDeps).filter(
      ([, version]) => !/^\d+\.\d+\.\d+$/.test(version),
    );
    expect(loose, `not pinned exactly: ${loose.map(([n, v]) => `${n}@${v}`).join(", ")}`).toEqual([]);
  });

  it("keeps the majors chosen at setup (TypeScript 6, ESLint 9)", () => {
    expect(allDeps.typescript?.split(".")[0]).toBe("6");
    expect(allDeps.eslint?.split(".")[0]).toBe("9");
  });
});
