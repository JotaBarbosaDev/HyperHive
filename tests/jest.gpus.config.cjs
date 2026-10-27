const base = require("./jest.celld.config.cjs");
module.exports = { ...base, testMatch: ["<rootDir>/tests/gpus.test.js", "<rootDir>/tests/pci-gpu-inventory.test.js"] };
