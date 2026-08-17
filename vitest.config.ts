import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";

// Three suites, run separately because two of them need an emulator:
//   npm test             — tests/unit, standalone
//   npm run test:rules   — tests/rules, Firestore emulator
//   npm run test:affiliate — tests/integration, Firestore emulator
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` exists to make importing a server module from a client
      // bundle a build error, and it does that by resolving to a module that
      // throws. Vite picks that build here, so the integration suite could not
      // import the very modules it exists to exercise. Node is the server; the
      // marker has nothing to protect against in this process.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
