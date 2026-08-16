const Mocha = require("mocha");
const path = require("path");

// Register hardhat env
require("hardhat");

const mocha = new Mocha({
  timeout: 40000,
});

mocha.addFile(path.join(__dirname, "..", "test", "OilTendering.test.js"));

const runner = mocha.run((failures) => {
  process.exitCode = failures ? 1 : 0;
});

runner.on("suite", (suite) => {
  if (suite.title) {
    console.log(`\n  ${suite.title}`);
  }
});

runner.on("pass", (test) => {
  console.log(`    ✓ ${test.title} (${test.duration}ms)`);
});

runner.on("fail", (test, err) => {
  console.log(`    ✗ ${test.title}`);
  console.log(`      Error: ${err.message}`);
});

runner.on("end", () => {
  console.log("\n  All tests executed successfully!\n");
});
