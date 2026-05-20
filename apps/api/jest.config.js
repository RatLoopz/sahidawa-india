const path = require("path");

module.exports = {
    preset: path.dirname(require.resolve("ts-jest/package.json")),
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts"],
    clearMocks: true,
    setupFiles: ["<rootDir>/tests/setup.ts"],
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.test.json",
            },
        ],
    },
};
