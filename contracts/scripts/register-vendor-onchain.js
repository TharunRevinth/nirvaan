const hre = require("hardhat");

async function main() {
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const vendorAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Test Vendor Account 1

  console.log("==================================================");
  console.log(" Registering Vendor Account On-Chain via Admin ");
  console.log(" Contract:", contractAddress);
  console.log(" Target Vendor Address:", vendorAddress);
  console.log("==================================================");

  const [admin] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt("OilTenderingV1", contractAddress, admin);

  const gstinHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("27AAACR12341Z5"));
  const panHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("AAACR1234F"));
  const kycCid = "QmKYC_Vendor_Verification_Document_Dossier_Hash";

  const tx = await contract.registerVendor(vendorAddress, gstinHash, panHash, kycCid);
  console.log(" Transaction Sent! Tx Hash:", tx.hash);
  
  const receipt = await tx.wait();
  console.log(" Transaction Confirmed in Block Number:", receipt.blockNumber);

  const isReg = await contract.registeredVendors(vendorAddress);
  console.log(" On-Chain Verification -> registeredVendors(", vendorAddress, "):", isReg);
  console.log("==================================================");
}

main().catch(console.error);
