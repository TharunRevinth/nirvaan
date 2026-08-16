const hre = require("hardhat");

async function main() {
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  console.log("==================================================");
  console.log(" Creating Real Tender On-Chain via PSU ");
  console.log(" Contract:", contractAddress);
  console.log("==================================================");

  const [deployer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt("OilTenderingV1", contractAddress, deployer);

  const block = await hre.ethers.provider.getBlock("latest");
  const subDeadline = block.timestamp + 7 * 86400; // 7 days in future
  const openTime = subDeadline + 3600;
  const minEMD = hre.ethers.parseEther("0.1"); // 0.1 ETH min EMD

  const tx = await contract.createTender(
    "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    subDeadline,
    openTime,
    minEMD
  );
  console.log(" Transaction Sent! Tx Hash:", tx.hash);
  const receipt = await tx.wait();
  console.log(" Tender #1 Created in Block Number:", receipt.blockNumber);

  const tender = await contract.tenders(1);
  console.log(" On-Chain Tender Data Query -> Tender #1:");
  console.log("   PSU Address:", tender.psuAddress);
  console.log("   IPFS CID Doc:", tender.ipfsHashDoc);
  console.log("   Min EMD (Wei):", tender.minEMDAmount.toString());
  console.log("   Submission Deadline:", tender.submissionDeadline.toString());
  console.log("==================================================");
}

main().catch(console.error);
