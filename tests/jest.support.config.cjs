module.exports = {
  rootDir: "..",
  testMatch: ["<rootDir>/tests/support.test.js"],
  testEnvironment: "jsdom",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  transform: { "^.+\\.[jt]sx?$": ["babel-jest", { babelrc: false, configFile: false, presets: ["@babel/preset-typescript"], plugins: [["@babel/plugin-transform-react-jsx", { runtime: "automatic" }], "@babel/plugin-transform-modules-commonjs"] }] },
};
