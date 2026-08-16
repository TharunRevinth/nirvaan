const hre = require("hardhat");

async function startServer() {
  console.log("==================================================");
  console.log(" HARDHAT LOCAL ETHEREUM RPC NODE STARTING... ");
  console.log("==================================================");

  // Run hardhat node task
  await hre.run("node", { port: 8545, hostname: "127.0.0.1" });
}

startServer().catch((err) => {
  console.error("Hardhat node error:", err);
});
