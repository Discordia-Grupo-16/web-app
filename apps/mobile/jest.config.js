module.exports = {
  preset: "jest-expo",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/shared/config/**",
  ],
};
