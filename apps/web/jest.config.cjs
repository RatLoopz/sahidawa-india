module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^next-intl$": "<rootDir>/tests/mocks/next-intl.cjs",
    "^next-intl/server$": "<rootDir>/tests/mocks/next-intl-server.cjs",
    "^next-intl/routing$": "<rootDir>/tests/mocks/next-intl-routing.cjs",
    "^next-intl/navigation$": "<rootDir>/tests/mocks/next-intl-navigation.cjs",
    "^next-intl/middleware$": "<rootDir>/tests/mocks/next-intl-middleware.cjs",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(next-intl|use-intl|@formatjs|intl-messageformat)/)"
  ],
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json",
      },
    ],
  },
};