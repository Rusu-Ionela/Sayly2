const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".expo/**",
      "web-build/**",
      "**/*.test.ts",
    ],
  },
  {
    // Tooling config files run in Node, not in the app.
    files: ["*.config.js"],
    languageOptions: {
      globals: { __dirname: "readonly", module: "writable", require: "readonly" },
    },
  },
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],
      "import/no-duplicates": "warn",
      "react-hooks/exhaustive-deps": "warn",
      // Existing codebase uses Reanimated shared values, refs in effects, etc.
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react/no-unescaped-entities": "warn",
    },
  },
]);
