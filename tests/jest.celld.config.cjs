// These API and polling tests use React DOM, without the native Expo preset.
module.exports = {
  rootDir: "..",
  testMatch: ["<rootDir>/tests/celld-stream.test.js", "<rootDir>/tests/celld-operations.test.js", "<rootDir>/tests/celld-observability.test.js", "<rootDir>/tests/celld-health.test.js", "<rootDir>/tests/celld-fleets.test.js", "<rootDir>/tests/text-web.test.js"],
  testEnvironment: "jsdom",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", {
      babelrc: false,
      configFile: false,
      presets: ["@babel/preset-typescript"],
      plugins: [["@babel/plugin-transform-react-jsx", { runtime: "automatic" }], "@babel/plugin-transform-modules-commonjs"],
    }],
  },
};
