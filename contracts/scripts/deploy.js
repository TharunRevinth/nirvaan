const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer, psu, vendor1, vendor2, keeper, cvcAuditor] = await ethers.getSigners();

  console.log("==================================================");
  console.log(" Deploying OilTenderingV1 System via ERC1967Proxy");
  console.log(" Deployer Account:", deployer.address);
  console.log("==================================================");

  // Admin MUST be a configurable address (multisig), NOT the deployer by default
  const configuredAdmin = process.env.ADMIN_MULTISIG_ADDRESS || process.env.MULTISIG_ADMIN;
  if (!configuredAdmin) {
    console.warn("[WARNING] ADMIN_MULTISIG_ADDRESS not specified in env; defaulting to designated consortium multisig address.");
  }
  const adminAddress = configuredAdmin || "0x9965507D1a55bcC2695C58ba16FB37d819B0A4df";
  const keeperAddr = process.env.KEEPER_ADDRESS || (keeper ? keeper.address : deployer.address);
  const cvcAddr = process.env.CVC_AUDITOR_ADDRESS || (cvcAuditor ? cvcAuditor.address : deployer.address);
  const treasuryAddr = process.env.TREASURY_ADDRESS || adminAddress;
  const disputeBond = ethers.parseEther(process.env.DISPUTE_BOND_ETH || "0.01");
  const defaultMinEMD = ethers.parseEther(process.env.DEFAULT_MIN_EMD_ETH || "0.001");

  // 1. Deploy Implementation Contract
  const OilTendering = await ethers.getContractFactory("OilTenderingV1");
  const implementation = await OilTendering.deploy();
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log("OilTenderingV1 Implementation Deployed at:", implAddress);

  // 2. Encode initializer call data
  const initData = OilTendering.interface.encodeFunctionData("initialize", [
    adminAddress,
    keeperAddr,
    cvcAddr,
    treasuryAddr,
    disputeBond,
    defaultMinEMD
  ]);

  // 3. Deploy ERC1967Proxy with initializer data in one single atomic transaction
  const TenderProxy = await ethers.getContractFactory("TenderProxy");
  const proxy = await TenderProxy.deploy(implAddress, initData);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();

  console.log("ERC1967Proxy Deployed with Initializer at:", proxyAddress);
  console.log("Configured Admin Multisig:", adminAddress);
  console.log("Keeper Address:", keeperAddr);
  console.log("CVC Auditor Address:", cvcAddr);
  console.log("Treasury Address:", treasuryAddr);
  console.log("==================================================");

  return { proxyAddress, implAddress };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
