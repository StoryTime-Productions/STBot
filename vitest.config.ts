import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist"],
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "tests/**",
        "src/generated/**",
        // Process wiring/glue only — its logic is factored into the
        // already-tested config/client/commands modules it composes.
        // Meaningfully unit-testing it would mean mocking discord.js'
        // Client.login and process signal handling for no real benefit.
        "src/index.ts",
        "**/*.config.{ts,js,mjs}",
        "**/*.d.ts",
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
