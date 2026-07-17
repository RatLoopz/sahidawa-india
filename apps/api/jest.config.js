module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testTimeout: 30000,
    maxWorkers: 2,
    detectOpenHandles: true,
    globalTeardown: "<rootDir>/jest.globalTeardown.js",
    testMatch: [
        "**/tests/**/*.test.ts",
        "**/src/services/lasa.service.test.ts",
        "**/src/services/drugLookup.test.ts",
        "**/src/services/cache.test.ts",
    ],
    testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
    clearMocks: true,
    setupFiles: ["<rootDir>/tests/setup.ts"],
    moduleNameMapper: {
        "^@sahidawa/shared$": "<rootDir>/../../packages/shared/src",
        "^@sahidawa/validators$": "<rootDir>/../../packages/validators/src",
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "<rootDir>/tsconfig.test.json",
            },
        ],
        "^.+\\.jsx?$": [
            "ts-jest",
            {
                tsconfig: "<rootDir>/tsconfig.test.json",
            },
        ],
    },
    transformIgnorePatterns: ["/node_modules/(?!(natural|afinn-165|apparatus|sylvester|uuid)/)"],
};
