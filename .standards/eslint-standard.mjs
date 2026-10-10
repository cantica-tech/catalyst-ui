// cantica-tech TypeScript lint standard (ESLint ≥ 9 flat config). Synced as `.standards/eslint-standard.mjs` (not named eslint.config.*: ESLint would take it for that folder's config);
// the repository's own eslint.config.mjs:
//   import standard from "./.standards/eslint-standard.mjs";
//   export default [...standard({ tsconfigRootDir: import.meta.dirname }), /* its own settings */];
// Its devDependencies: eslint, @eslint/js, typescript-eslint, eslint-config-prettier. The ratchet is ESLint's
// bulk suppressions file (eslint-suppressions.json, `eslint --suppress-all` once, then `--prune-suppressions`).
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default function standard({ tsconfigRootDir, ignores = [] } = {}) {
  return tseslint.config(
    { ignores: ["**/dist/**", "**/out/**", "**/node_modules/**", "**/*.js", "**/*.cjs", "**/*.mjs", ...ignores] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir } },
      rules: {
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true, allowBoolean: true }],
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        eqeqeq: ["error", "smart"],
        "no-console": "off",
      },
    },
    {
      // tool configs (vitest.config.ts, …) belong to no tsconfig project: lint them without type information
      files: ["**/*.config.ts", "**/*.config.mts"],
      ...tseslint.configs.disableTypeChecked,
      languageOptions: { parserOptions: { projectService: false, project: null } },
    },
    {
      files: ["**/*.test.ts", "**/test/**/*.ts"],
      rules: { "@typescript-eslint/no-non-null-assertion": "off", "@typescript-eslint/no-unsafe-assignment": "off" },
    },
    prettier,
  );
}
