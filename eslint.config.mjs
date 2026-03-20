import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import aiSecurity from "eslint-plugin-vercel-ai-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  aiSecurity.configs.recommended,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
