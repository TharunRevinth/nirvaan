const hre = require("hardhat");

async function main() {
  console.log("Starting Hardhat Local JSON-RPC Node on http://127.0.0.1:8545 ...");
  await hre.run("node");
}

main().catch(console.error);
