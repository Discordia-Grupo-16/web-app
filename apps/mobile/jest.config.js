module.exports = {
  preset: "jest-expo",
  // With an empty cache (as in CI) the first render of a suite transforms its modules and can take
  // longer than the default 5 s.
  testTimeout: 20000,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/shared/config/**",
  ],
};
