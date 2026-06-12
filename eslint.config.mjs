import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Deuda conocida (ver SISTEMA.md §11): el codebase nunca fue linteado y tiene
    // ~80 `any` y ~50 violaciones de las reglas nuevas del React Compiler.
    // Se degradan a warning para que el lint sea ejecutable sin ocultarlas.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    // Scripts Node en CommonJS (PM2, migraciones de datos)
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/**",
    "prisma/dev.db",
  ]),
]);

export default eslintConfig;
