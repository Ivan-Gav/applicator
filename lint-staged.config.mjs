const lintStagedConfig = {
  "*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}": [
    "eslint --fix --no-warn-ignored",
    "biome format --write --no-errors-on-unmatched",
  ],
  "*.{json,css}": ["biome format --write --no-errors-on-unmatched"],
};

export default lintStagedConfig;
