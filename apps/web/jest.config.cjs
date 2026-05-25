module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>/tests"],
    moduleNameMapper: {
        "^@/i18n/routing$": "<rootDir>/tests/mocks/i18n-routing.tsx",
        "^@/(.*)$": "<rootDir>/$1",
        "^next-intl/routing$": "<rootDir>/tests/mocks/next-intl-routing.ts",
        "^next-intl/navigation$": "<rootDir>/tests/mocks/next-intl-navigation.tsx",
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "<rootDir>/tsconfig.test.json",
            },
        ],
    },
};
