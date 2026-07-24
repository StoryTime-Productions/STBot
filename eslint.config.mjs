import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "src/generated/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain Node scripts (not covered by the TS-specific globals typescript-eslint
    // implicitly handles) — needs process/console declared as Node globals.
    files: ["**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  {
    files: ["**/*.ts"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      // Tests legitimately spy on/reference console methods to assert on logger output.
      "no-console": "off",
    },
  }
);
