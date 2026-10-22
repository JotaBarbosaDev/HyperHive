const base = require("./jest.celld.config.cjs");
module.exports = { ...base, testMatch: ["<rootDir>/tests/mounts.test.js", "<rootDir>/tests/isos.test.js"] };
