const hre = require("hardhat");

async function main() {
  const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const vendorAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Test Vendor Account 1

  console.log("==================================================");
  console.log(" Submitting Real Sealed Bid On-Chain ");
  console.log(" Contract:", contractAddress);
  console.log(" Bidder Account:", vendorAddress);
  console.log("==================================================");

  const vendorSigner = await hre.ethers.getSigner(vendorAddress);
  const contract = await hre.ethers.getContractAt("OilTenderingV1", contractAddress, vendorSigner);

  const amount = hre.ethers.parseEther("45200000"); // 45,20,00,000 INR
  const salt = hre.ethers.encodeBytes32String("SecretSalt123");
  const tenderId = 1;

  // Compute Keccak-256 commitment hash: keccak256(vendor + amount + salt + tenderId)
  const commitmentHash = hre.ethers.solidityPackedKeccak256(
    ["address", "uint256", "bytes32", "uint256"],
    [vendorAddress, amount, salt, tenderId]
  );
  console.log(" Client-Side Calculated Commitment Hash:", commitmentHash);

  const emdWei = hre.ethers.parseEther("0.1"); // 0.1 ETH EMD
  const tx = await contract.submitBid(
    tenderId,
    "QmEncryptedBidDocumentIpfsHash_12345",
    commitmentHash,
    { value: emdWei }
  );

  console.log(" Transaction Sent to Network! Tx Hash:", tx.hash);
  const receipt = await tx.wait();
  console.log(" Transaction Confirmed in Block Number:", receipt.blockNumber);

  // Query back stored bid data on contract
  const bidCount = await contract.getTenderBidsCount(tenderId);
  console.log(" Total Bids Stored for Tender #1:", bidCount.toString());

  const bidData = await contract.tenderBids(tenderId, 0);
  console.log("\n Real On-Chain Bid Record Verification (tenderBids[1][0]):");
  console.log("   Bid ID:", bidData.id.toString());
  console.log("   Tender ID:", bidData.tenderId.toString());
  console.log("   Vendor Address:", bidData.vendorAddress);
  console.log("   Stored Commitment Hash:", bidData.bidCommitment);
  console.log("   EMD Amount Deposited:", hre.ethers.formatEther(bidData.emdDeposited), "ETH");
  console.log("   Submission Time (Block Timestamp):", new Date(Number(bidData.submissionTime) * 1000).toISOString());
  console.log("==================================================");
}

main().catch(console.error);
