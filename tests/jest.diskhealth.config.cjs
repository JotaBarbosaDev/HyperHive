const base = require("./jest.celld.config.cjs");
module.exports = { ...base, testMatch: ["<rootDir>/tests/diskhealth.test.js", "<rootDir>/tests/smartdisk-health.test.js", "<rootDir>/tests/smartdisk-page.test.js"] };
