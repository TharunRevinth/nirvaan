const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("==================================================");
  console.log(" Sepolia Online Deployment: OilTenderingV1 Proxy");
  console.log(" Network:", network.name, "| Chain ID:", Number(network.chainId));
  console.log(" Deployer Account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(" Deployer Balance:", ethers.formatEther(balance), "ETH");
  console.log("==================================================");

  // Read role addresses from environment variables
  const adminAddress = process.env.ADMIN_MULTISIG_ADDRESS || deployer.address;
  const keeperAddr = process.env.KEEPER_ADDRESS || deployer.address;
  const cvcAddr = process.env.CVC_AUDITOR_ADDRESS || deployer.address;
  const treasuryAddr = process.env.TREASURY_ADDRESS || adminAddress;

  // On Sepolia, faucet ETH is scarce, so dispute bond is configured to 0.01 ETH by default
  const disputeBond = ethers.parseEther(process.env.DISPUTE_BOND_ETH || "0.01");
  const defaultMinEMD = ethers.parseEther(process.env.DEFAULT_MIN_EMD_ETH || "0.001");

  console.log("Configuring initial contract parameters:");
  console.log(" - Multisig Admin :", adminAddress);
  console.log(" - Keeper Wallet  :", keeperAddr);
  console.log(" - CVC Auditor    :", cvcAddr);
  console.log(" - Treasury       :", treasuryAddr);
  console.log(" - Dispute Bond   :", ethers.formatEther(disputeBond), "ETH");
  console.log(" - Default Min EMD:", ethers.formatEther(defaultMinEMD), "ETH");

  // 1. Deploy Implementation Contract
  console.log("\n[1/3] Deploying OilTenderingV1 implementation...");
  const OilTendering = await ethers.getContractFactory("OilTenderingV1");
  const implementation = await OilTendering.deploy();
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log(" Implementation deployed at:", implAddress);

  // 2. Encode initializer call data with configurable roles, bond & EMD
  console.log("\n[2/3] Encoding atomic initializer call data...");
  const initData = OilTendering.interface.encodeFunctionData("initialize", [
    adminAddress,
    keeperAddr,
    cvcAddr,
    treasuryAddr,
    disputeBond,
    defaultMinEMD
  ]);

  // 3. Deploy ERC1967Proxy with initializer data in one single atomic transaction
  console.log("\n[3/3] Deploying ERC1967Proxy atomically...");
  const TenderProxy = await ethers.getContractFactory("TenderProxy");
  const proxy = await TenderProxy.deploy(implAddress, initData);
  const deployTx = proxy.deploymentTransaction();
  const receipt = await deployTx.wait(1);
  const proxyAddress = await proxy.getAddress();

  const deployBlock = receipt ? receipt.blockNumber : await ethers.provider.getBlockNumber();
  console.log(" ERC1967Proxy deployed at:", proxyAddress);
  console.log(" Deployed at block:", deployBlock);

  // 4. Verify on-chain state
  console.log("\nVerifying on-chain state via proxy...");
  const contract = OilTendering.attach(proxyAddress);
  const verifiedAdmin = await contract.multisigAdmin();
  const verifiedKeeper = await contract.keeperAddress();
  const verifiedCVC = await contract.cvcAuditorAddress();
  const verifiedTreasury = await contract.treasuryAddress();
  const verifiedBond = await contract.disputeBondAmount();
  const verifiedMinEMD = await contract.defaultMinEMD();

  console.log(" State verification result:");
  console.log(" - multisigAdmin    :", verifiedAdmin, verifiedAdmin.toLowerCase() === adminAddress.toLowerCase() ? "OK" : "MISMATCH");
  console.log(" - keeperAddress    :", verifiedKeeper, verifiedKeeper.toLowerCase() === keeperAddr.toLowerCase() ? "OK" : "MISMATCH");
  console.log(" - cvcAuditorAddress:", verifiedCVC, verifiedCVC.toLowerCase() === cvcAddr.toLowerCase() ? "OK" : "MISMATCH");
  console.log(" - treasuryAddress  :", verifiedTreasury, verifiedTreasury.toLowerCase() === treasuryAddr.toLowerCase() ? "OK" : "MISMATCH");
  console.log(" - disputeBondAmount:", ethers.formatEther(verifiedBond), "ETH", verifiedBond === disputeBond ? "OK" : "MISMATCH");
  console.log(" - defaultMinEMD    :", ethers.formatEther(verifiedMinEMD), "ETH", verifiedMinEMD === defaultMinEMD ? "OK" : "MISMATCH");

  // 5. Persist deployment record to deploy/addresses.json
  const deployDir = path.join(__dirname, "..", "deploy");
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }

  const addressesData = {
    network: network.name === "unknown" ? "sepolia" : network.name,
    chainId: Number(network.chainId),
    proxyAddress,
    implementationAddress: implAddress,
    deployBlock,
    multisigAdmin: verifiedAdmin,
    keeperAddress: verifiedKeeper,
    cvcAuditorAddress: verifiedCVC,
    treasuryAddress: verifiedTreasury,
    disputeBondEth: ethers.formatEther(verifiedBond),
    defaultMinEmdEth: ethers.formatEther(verifiedMinEMD),
    deployedAt: new Date().toISOString()
  };

  const addressesPath = path.join(deployDir, "addresses.json");
  fs.writeFileSync(addressesPath, JSON.stringify(addressesData, null, 2));
  console.log("\nDeployment addresses saved to:", addressesPath);

  // 6. Optional Etherscan Verification
  if (process.env.ETHERSCAN_API_KEY && network.chainId === 11155111n) {
    console.log("\nInitiating optional Etherscan source verification...");
    try {
      console.log("Waiting for 5 block confirmations for Etherscan indexation...");
      await deployTx.wait(5);

      console.log("Verifying implementation...");
      await hre.run("verify:verify", {
        address: implAddress,
        constructorArguments: []
      });

      console.log("Verifying proxy...");
      await hre.run("verify:verify", {
        address: proxyAddress,
        constructorArguments: [implAddress, initData]
      });
      console.log("Etherscan verification completed successfully.");
    } catch (verifyErr) {
      console.warn("Etherscan verification notice (non-fatal):", verifyErr.message);
    }
  }

  console.log("==================================================");
  console.log(" Sepolia Deployment Completed Successfully!");
  console.log(" PROXY ADDRESS:", proxyAddress);
  console.log(" DEPLOY BLOCK :", deployBlock);
  console.log("==================================================");

  return { proxyAddress, implAddress, deployBlock };
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exitCode = 1;
});
