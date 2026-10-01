module.exports = {
  preset: "jest-expo",
  // The monorepo hoists a different React to the root (web-app uses it). The renderer
  // lives in the root too, so without this the component and the renderer would each
  // get their own React and hooks would fail with "Cannot read properties of null".
  moduleNameMapper: {
    "^react$": "<rootDir>/node_modules/react",
    "^react/(.*)$": "<rootDir>/node_modules/react/$1",
  },
};
