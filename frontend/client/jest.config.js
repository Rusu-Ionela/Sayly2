module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^react-native$": "<rootDir>/src/test/mocks/react-native.ts",
    "^expo-constants$": "<rootDir>/src/test/mocks/expo-constants.ts",
    "^expo/virtual/env$": "<rootDir>/src/test/mocks/expo-env.ts",
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
