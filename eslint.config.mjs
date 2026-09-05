import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";
import testingLibrary from "eslint-plugin-testing-library";
import vitest from "@vitest/eslint-plugin";
import playwright from "eslint-plugin-playwright";

const supabaseOnlyInAdapters = {
  group: ["@supabase/*", "@supabase/**"],
  message:
    "Supabase access goes through a repository interface. " +
    "Import @supabase/* only inside src/adapters/supabase/.",
};

const domainMustNotDependOnAdapters = {
  group: ["@/adapters/*", "@/adapters/**", "**/adapters/*", "**/adapters/**"],
  message:
    "The domain must not depend on adapters. " +
    "Depend on a repository interface from src/domain/ instead; adapters implement it.",
};

export default defineConfig([
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),

  ...nextVitals,
  {
    // eslint-config-next already registers the jsx-a11y plugin; registering it again
    // throws "Cannot redefine plugin", so only the recommended rules are layered on.
    name: "jsx-a11y/recommended-rules",
    rules: jsxA11y.flatConfigs.recommended.rules,
  },

  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },

  {
    name: "architecture/supabase-only-in-adapters",
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    ignores: ["src/adapters/supabase/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [supabaseOnlyInAdapters] }],
    },
  },
  {
    name: "architecture/domain-is-adapter-free",
    files: ["src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [supabaseOnlyInAdapters, domainMustNotDependOnAdapters] },
      ],
    },
  },

  {
    ...vitest.configs.recommended,
    files: ["**/*.test.{ts,tsx}"],
  },
  {
    ...testingLibrary.configs["flat/react"],
    files: ["src/ui/**/*.test.{ts,tsx}"],
  },

  {
    ...playwright.configs["flat/recommended"],
    files: ["e2e/**"],
  },

  prettier,
]);
