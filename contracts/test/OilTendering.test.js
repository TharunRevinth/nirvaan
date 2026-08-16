const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("OilTenderingV1 Contract Unit Tests", function () {
  let OilTendering;
  let contract;
  let admin, psu, vendor1, vendor2, keeper, cvcAuditor;

  beforeEach(async function () {
    [admin, psu, vendor1, vendor2, keeper, cvcAuditor] = await ethers.getSigners();

    OilTendering = await ethers.getContractFactory("OilTenderingV1");
    contract = await OilTendering.deploy();
    await contract.waitForDeployment();

    // Initialize proxy state
    await contract.initialize(
      admin.address,
      keeper.address,
      cvcAuditor.address
    );

    // Register PSU & Vendors
    await contract.connect(admin).registerPSU(psu.address);

    const gstin1 = ethers.keccak256(ethers.toUtf8Bytes("GSTIN12345"));
    const pan1 = ethers.keccak256(ethers.toUtf8Bytes("PAN12345"));
    await contract.connect(admin).registerVendor(vendor1.address, gstin1, pan1, "QmKYC1");

    const gstin2 = ethers.keccak256(ethers.toUtf8Bytes("GSTIN67890"));
    const pan2 = ethers.keccak256(ethers.toUtf8Bytes("PAN67890"));
    await contract.connect(admin).registerVendor(vendor2.address, gstin2, pan2, "QmKYC2");
  });

  it("Should initialize proxy with correct admins, keeper, and CVC auditor", async function () {
    expect(await contract.multisigAdmin()).to.equal(admin.address);
    expect(await contract.keeperAddress()).to.equal(keeper.address);
    expect(await contract.cvcAuditorAddress()).to.equal(cvcAuditor.address);
    expect(await contract.registeredPSUs(psu.address)).to.be.true;
    expect(await contract.registeredVendors(vendor1.address)).to.be.true;
  });

  it("Should allow registered PSU to create a tender", async function () {
    const block = await ethers.provider.getBlock("latest");
    const subDeadline = block.timestamp + 3600; // 1 hour later
    const openTime = subDeadline + 300; // 5 mins after deadline
    const minEMD = ethers.parseEther("1.0");

    await expect(
      contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, minEMD)
    )
      .to.emit(contract, "TenderCreated")
      .withArgs(1, psu.address, subDeadline);

    const tender = await contract.tenders(1);
    expect(tender.psuAddress).to.equal(psu.address);
    expect(tender.ipfsHashDoc).to.equal("QmTenderSpec1");
    expect(tender.minEMDAmount).to.equal(minEMD);
    expect(tender.status).to.equal(0); // TenderStatus.Created
  });

  it("Should allow registered vendors to submit sealed bids with commitment hash", async function () {
    const block = await ethers.provider.getBlock("latest");
    const subDeadline = block.timestamp + 3600;
    const openTime = subDeadline + 300;
    const minEMD = ethers.parseEther("1.0");

    await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, minEMD);

    // Vendor 1 computes commitment hash: keccak256(vendor1Address, bidAmount, salt, tenderId)
    const bidAmount1 = ethers.parseEther("500000"); // 500,000 INR equivalent
    const salt1 = ethers.encodeBytes32String("salt123");
    const tenderId = 1;

    const commitment1 = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32", "uint256"],
      [vendor1.address, bidAmount1, salt1, tenderId]
    );

    await expect(
      contract.connect(vendor1).submitBid(tenderId, "QmEncryptedBid1", commitment1, {
        value: minEMD,
      })
    )
      .to.emit(contract, "BidSubmitted")
      .withArgs(tenderId, 1, vendor1.address);

    const bidsCount = await contract.getTenderBidsCount(tenderId);
    expect(bidsCount).to.equal(1);
  });

  it("Should perform full bid opening, technical evaluation, awarding, and dispute cycle", async function () {
    const block = await ethers.provider.getBlock("latest");
    const subDeadline = block.timestamp + 10;
    const openTime = block.timestamp + 20;
    const minEMD = ethers.parseEther("1.0");
    const tenderId = 1;

    await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, minEMD);

    // Vendor 1 submits bid (500,000)
    const bidAmount1 = ethers.parseEther("500000");
    const salt1 = ethers.encodeBytes32String("salt1");
    const commitment1 = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32", "uint256"],
      [vendor1.address, bidAmount1, salt1, tenderId]
    );
    await contract.connect(vendor1).submitBid(tenderId, "QmBid1", commitment1, { value: minEMD });

    // Vendor 2 submits bid (450,000 - L1)
    const bidAmount2 = ethers.parseEther("450000");
    const salt2 = ethers.encodeBytes32String("salt2");
    const commitment2 = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32", "uint256"],
      [vendor2.address, bidAmount2, salt2, tenderId]
    );
    await contract.connect(vendor2).submitBid(tenderId, "QmBid2", commitment2, { value: minEMD });

    // Fast forward time past opening time
    await ethers.provider.send("evm_increaseTime", [30]);
    await ethers.provider.send("evm_mine");

    // Keeper opens bids
    await expect(contract.connect(keeper).openBids(tenderId))
      .to.emit(contract, "BidsOpened")
      .withArgs(tenderId);

    // Vendors reveal bids
    await contract.connect(vendor1).revealBid(tenderId, 0, bidAmount1, salt1);
    await contract.connect(vendor2).revealBid(tenderId, 1, bidAmount2, salt2);

    // PSU sets technical scores
    await contract.connect(psu).setTechnicalScore(tenderId, 0, true, 85);
    await contract.connect(psu).setTechnicalScore(tenderId, 1, true, 92);

    // PSU awards tender to Vendor 2 (L1)
    await expect(contract.connect(psu).awardTender(tenderId, vendor2.address, 2, bidAmount2))
      .to.emit(contract, "TenderAwarded")
      .withArgs(tenderId, vendor2.address, bidAmount2);

    // Vendor 1 files a dispute within 7-day appeal window
    const disputeBond = ethers.parseEther("1.0");
    await expect(
      contract.connect(vendor1).disputeTender(tenderId, "QmDisputeReason", { value: disputeBond })
    )
      .to.emit(contract, "DisputeFiled")
      .withArgs(tenderId, vendor1.address);

    // CVC resolves dispute (Dismissed)
    await expect(contract.connect(cvcAuditor).resolveDispute(tenderId, false, "QmCVCRulingDismissed"))
      .to.emit(contract, "DisputeResolved")
      .withArgs(tenderId, false);

    // Fast forward past appeal window (7 days)
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 3600 + 10]);
    await ethers.provider.send("evm_mine");

    // Keeper finalizes tender and refunds losing bidders
    await expect(contract.connect(keeper).finalizeTender(tenderId))
      .to.emit(contract, "TenderFinalized")
      .withArgs(tenderId);

    const updatedTender = await contract.tenders(tenderId);
    expect(updatedTender.status).to.equal(8); // TenderStatus.Finalized
  });
});
