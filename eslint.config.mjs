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
    // The cPanel bundle: build output, not source (scripts/package-cpanel.mjs).
    "dist/**",
  ]),
  // The cPanel bundle is CommonJS and has to be: Passenger boots a single file
  // with require(), and the standalone server it loads is CommonJS as well.
  // ESM here would fail at the one moment there is no way to debug it.
  {
    files: ["deploy/cpanel/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);

export default eslintConfig;
