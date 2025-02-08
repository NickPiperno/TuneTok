import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  // Config for TypeScript files
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: ".",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      "quotes": ["error", "double"],
    },
  },
  // Config for JavaScript files (including eslint.config.js)
  {
    files: ["*.js"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      ...eslint.configs.recommended.rules,
      "quotes": ["error", "double"],
    },
  },
]; 