module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: [
        "**/tests/**/*.test.ts",
        "**/src/services/lasa.service.test.ts",
        "**/src/services/drugLookup.test.ts",
    ],
    clearMocks: true,
    setupFiles: ["<rootDir>/tests/setup.ts"],
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.test.json",
            },
        ],
        "^.+\\.jsx?$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.test.json",
            },
        ],
    },
    transformIgnorePatterns: ["/node_modules/(?!(natural|afinn-165|apparatus|sylvester|uuid)/)"],
};
