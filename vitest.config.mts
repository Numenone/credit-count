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
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
