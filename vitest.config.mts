import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The suite covers the pure logic only: statistics, unit conversion, CSV
 * encoding and the mascot's input handling. Everything that depends on the
 * database or on a real session is covered instead by scripts/verify-*.mjs,
 * which run against a live deployment with real sessions — mocking Postgres
 * would test the mock rather than the policies, and the policies are the
 * security model.
 */
export default defineConfig({
  test: {
    environment: "node",
    // .tsx too: the mascot rig is asserted on the markup it renders, because
    // an animation and a transition fighting over one property type-checks,
    // lints clean, and is only visible in the output.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
