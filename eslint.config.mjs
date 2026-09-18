import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Laravel port is a second application in this repository with its own
    // toolchain. Its handful of JavaScript files answer to Laravel's
    // conventions, and `vendor/` alone is tens of thousands of files ESLint has
    // no business walking.
    "laravel/**",
  ]),
]);

export default eslintConfig;
