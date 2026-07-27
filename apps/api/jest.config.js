module.exports = {
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
    // babel-jest replaces ts-jest here. It only strips TS syntax — it never
    // calls into the TypeScript compiler API — so it's unaffected by which
    // TypeScript major version (5.x, 7.x, ...) is installed anywhere in the
    // monorepo. No babel.config.js needed: presets are passed inline below.
    transform: {
        "^.+\\.[tj]sx?$": [
            "babel-jest",
            {
                presets: [
                    ["@babel/preset-env", { targets: { node: "current" } }],
                    "@babel/preset-typescript",
                ],
            },
        ],
    },
    transformIgnorePatterns: ["/node_modules/(?!(natural|afinn-165|apparatus|sylvester|uuid)/)"],
};