if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}

module.exports = {
    testEnvironment: "node",
    setupFiles: ["<rootDir>/jest.env.cjs"],
    roots: ["<rootDir>/tests"],
    moduleNameMapper: {
        "^leaflet$": "<rootDir>/tests/mocks/leaflet.ts",
        "^react-leaflet$": "<rootDir>/tests/mocks/react-leaflet.ts",
        "^leaflet/dist/leaflet.css$": "<rootDir>/tests/mocks/leaflet.ts",
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