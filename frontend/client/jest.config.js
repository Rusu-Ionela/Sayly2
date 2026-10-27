const path = require("path");

module.exports = {
  testEnvironment: "node",
  // packages/shared tests run here too: it has no runner of its own.
  roots: ["<rootDir>/src", path.resolve(__dirname, "../../packages/shared/src")],
  // Shared code (../../packages/shared) resolves its packages from the app, like Metro does.
  moduleDirectories: ["node_modules", path.resolve(__dirname, "node_modules")],
  testMatch: ["**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Shared rules are tested from source, as Metro bundles them.
    "^@sayly/shared$": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    "^react-native$": "<rootDir>/src/test/mocks/react-native.ts",
    "^expo-constants$": "<rootDir>/src/test/mocks/expo-constants.ts",
    "^expo/virtual/env$": "<rootDir>/src/test/mocks/expo-env.ts",
    "^@react-native-async-storage/async-storage$":
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "babel-jest",
      {
        presets: ["babel-preset-expo"],
      },
    ],
  },
  transformIgnorePatterns: ["node_modules/(?!(expo|@expo|expo-.*)/)"],
};
