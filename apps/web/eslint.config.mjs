import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import nextTypescript from "eslint-config-next/typescript";

const config = [
    ...nextTypescript,
    {
        plugins: {
            "@next/next": nextPlugin,
            "react-hooks": reactHooks,
        },
    },
    {
        rules: {
            "@next/next/no-html-link-for-pages": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": "error",
            "react-hooks/purity": "off",
            "react-hooks/refs": "off",
            "react-hooks/set-state-in-effect": "off",
            "react/no-unescaped-entities": "off",
        },
    },
    {
        ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
    },
];

export default config;
