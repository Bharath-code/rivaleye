import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Minimal ESLint 9 flat config for RivalEye.
 *
 * Note: We intentionally do NOT use `next/core-web-vitals` because that
 * preset is broken under Next.js 16 + ESLint 9 (it throws a circular-JSON
 * error during config validation). Instead we use:
 *   - @eslint/js recommended rules
 *   - typescript-eslint recommended-type-checked rules
 *   - react-hooks/rules-of-hooks + exhaustive-deps
 *
 * This catches the 90% of issues that matter for a solo founder.
 */

export default [
    {
        ignores: [
            ".next/**",
            "node_modules/**",
            "out/**",
            "build/**",
            "coverage/**",
            "src/**/__tests__/**",
            "supabase/**",
            "docs/**",
            ".remember/**",
        ],
    },
    js.configs.recommended,
    // Use `recommended` (not deprecated `recommended`) — tseslint v8
    ...tseslint.configs.recommended,
    {
        plugins: { "react-hooks": reactHooks },
        rules: {
            ...reactHooks.configs.recommended.rules,

            // Loosen rules that are noisy without value for a small codebase
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/ban-ts-comment": [
                "warn",
                { "ts-ignore": true, "ts-expect-error": "allow-with-description" },
            ],
            "no-unused-vars": "off", // handled by @typescript-eslint
            "no-undef": "off", // handled by TypeScript
            "no-empty": ["warn", { allowEmptyCatch: true }],
        },
    },
    {
        files: ["**/*.{ts,tsx,js,jsx}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
        },
    },
];
