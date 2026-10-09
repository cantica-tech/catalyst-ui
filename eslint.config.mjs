import standard from "./.standards/eslint-standard.mjs";

export default [...standard({ tsconfigRootDir: import.meta.dirname })];
