if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}

module.exports = {
    testEnvironment: "jsdom",
    setupFiles: ["<rootDir>/jest.env.cjs"],
    setupFilesAfterEnv: ["<rootDir>/tests/setupTests.ts"],
    roots: ["<rootDir>/tests"],
    testPathIgnorePatterns: ["<rootDir>/tests/e2e/"],
    transformIgnorePatterns: ["/node_modules/(?!(nuqs|next-intl|@next/third-parties|uncrypto|@upstash/redis)/)"],
    moduleNameMapper: {
        "\\.css$": "<rootDir>/tests/mocks/styleMock.ts",
        "^leaflet$": "<rootDir>/tests/mocks/leaflet.ts",
        "^react-leaflet$": "<rootDir>/tests/mocks/react-leaflet.ts",
        "^leaflet/dist/leaflet.css$": "<rootDir>/tests/mocks/leaflet.ts",
        "^@/i18n/routing(\\.js)?$": "<rootDir>/tests/mocks/i18n-routing.tsx",
        "^.*/PharmacyMap$": "<rootDir>/tests/mocks/PharmacyMap.tsx",
        "^@/(.*)$": "<rootDir>/$1",
        "^next-intl/routing(\\.js)?$": "<rootDir>/tests/mocks/next-intl-routing.ts",
        "^next-intl/navigation(\\.js)?$": "<rootDir>/tests/mocks/next-intl-navigation.tsx",
        "^next/navigation(\\.js)?$": "<rootDir>/tests/mocks/next-navigation.tsx",
    },
    transform: {
        "^.+\\.(t|j)sx?$|^.+\\.mjs$": "<rootDir>/jest-transformer.cjs"
    },
};
