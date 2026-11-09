import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "next-env.d.ts",
    "public/**",
    "raw-assets/**",
    "blender/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
