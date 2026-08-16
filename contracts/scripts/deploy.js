const { ethers } = require("hardhat");

async function main() {
  const [deployer, psu, vendor1, vendor2, keeper, cvcAuditor] = await ethers.getSigners();

  console.log("==================================================");
  console.log(" Deploying OilTenderingV1 System");
  console.log(" Deployer Account:", deployer.address);
  console.log("==================================================");

  const OilTendering = await ethers.getContractFactory("OilTenderingV1");
  const contract = await OilTendering.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("OilTenderingV1 Implementation Deployed at:", contractAddress);

  // Initialize Contract
  const keeperAddr = keeper ? keeper.address : deployer.address;
  const cvcAddr = cvcAuditor ? cvcAuditor.address : deployer.address;

  await contract.initialize(deployer.address, keeperAddr, cvcAddr);
  console.log("Initialized Proxy State Successfully.");
  console.log("Admin Multisig:", deployer.address);
  console.log("Keeper Address:", keeperAddr);
  console.log("CVC Auditor Address:", cvcAddr);
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
