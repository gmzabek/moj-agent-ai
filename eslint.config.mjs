import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const ignores = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "dist/**"],
  },
];

const eslintConfig = [...ignores, ...nextVitals, ...nextTs];

export default eslintConfig;
