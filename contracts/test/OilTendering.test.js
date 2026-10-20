const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OilTenderingV1 Comprehensive Test Suite", function () {
  let OilTendering, TenderProxy;
  let contract, implementation;
  let deployer, multisigAdmin, psu, vendor1, vendor2, vendor3, keeper, cvcAuditor, treasury;

  beforeEach(async function () {
    [deployer, multisigAdmin, psu, vendor1, vendor2, vendor3, keeper, cvcAuditor, treasury] = await ethers.getSigners();

    // 1. Deploy Implementation
    OilTendering = await ethers.getContractFactory("OilTenderingV1");
    implementation = await OilTendering.deploy();
    await implementation.waitForDeployment();
    const implAddress = await implementation.getAddress();

    // 2. Encode initializer with configurable multisigAdmin and testnet bond/EMD values
    const disputeBond = ethers.parseEther("0.01");
    const defaultMinEMD = ethers.parseEther("0.001");
    const initData = OilTendering.interface.encodeFunctionData(
      "initialize(address,address,address,address,uint256,uint256)",
      [multisigAdmin.address, keeper.address, cvcAuditor.address, treasury.address, disputeBond, defaultMinEMD]
    );

    // 3. Deploy ERC1967Proxy with initializer data in one single atomic transaction
    TenderProxy = await ethers.getContractFactory("TenderProxy");
    const proxy = await TenderProxy.deploy(implAddress, initData);
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();

    contract = OilTendering.attach(proxyAddress);

    // Register PSU & Vendors via multisigAdmin
    await contract.connect(multisigAdmin).registerPSU(psu.address);

    const gstin1 = ethers.keccak256(ethers.toUtf8Bytes("GSTIN12345"));
    const pan1 = ethers.keccak256(ethers.toUtf8Bytes("PAN12345"));
    await contract.connect(multisigAdmin).registerVendor(vendor1.address, gstin1, pan1, "QmKYC1");

    const gstin2 = ethers.keccak256(ethers.toUtf8Bytes("GSTIN67890"));
    const pan2 = ethers.keccak256(ethers.toUtf8Bytes("PAN67890"));
    await contract.connect(multisigAdmin).registerVendor(vendor2.address, gstin2, pan2, "QmKYC2");

    const gstin3 = ethers.keccak256(ethers.toUtf8Bytes("GSTIN99999"));
    const pan3 = ethers.keccak256(ethers.toUtf8Bytes("PAN99999"));
    await contract.connect(multisigAdmin).registerVendor(vendor3.address, gstin3, pan3, "QmKYC3");
  });

  describe("Proxy Initialization & Access Control", function () {
    it("01. Should deploy via ERC1967Proxy with configurable multisig admin and disable implementation initialization", async function () {
      expect(await contract.multisigAdmin()).to.equal(multisigAdmin.address);
      expect(await contract.keeperAddress()).to.equal(keeper.address);
      expect(await contract.cvcAuditorAddress()).to.equal(cvcAuditor.address);
      expect(await contract.treasuryAddress()).to.equal(treasury.address);
      expect(await contract.disputeBondAmount()).to.equal(ethers.parseEther("0.01"));
      expect(await contract.defaultMinEMD()).to.equal(ethers.parseEther("0.001"));

      // Direct initialization on implementation must revert because of _disableInitializers()
      await expect(
        implementation.initialize(multisigAdmin.address, keeper.address, cvcAuditor.address, treasury.address, ethers.parseEther("0.01"), ethers.parseEther("0.001"))
      ).to.be.revertedWithCustomError(implementation, "InvalidInitialization");
    });

    it("02. Should enforce access control across roles", async function () {
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      // Non-PSU cannot create tender
      await expect(
        contract.connect(vendor1).createTender("QmDoc", now + 100, now + 200, now + 300, ethers.parseEther("1.0"))
      ).to.be.revertedWith("Only registered PSUs allowed");

      // Non-admin cannot register PSU
      await expect(
        contract.connect(deployer).registerPSU(deployer.address)
      ).to.be.revertedWith("Only admin allowed");

      // Non-keeper cannot open bids
      await expect(
        contract.connect(vendor1).openBids(1)
      ).to.be.revertedWith("Only keeper allowed");

      // Non-CVC cannot resolve dispute
      await expect(
        contract.connect(multisigAdmin).resolveDispute(1, true, "QmCVC")
      ).to.be.revertedWith("Only CVC auditor allowed");
    });
  });

  describe("Bid Submission & Duplicate Protection", function () {
    it("03. Should reject bid submission after the deadline or below min EMD", async function () {
      const block = await ethers.provider.getBlock("latest");
      const subDeadline = block.timestamp + 10;
      const openTime = subDeadline + 10;
      const revealDeadline = openTime + 300;
      const minEMD = ethers.parseEther("1.0");

      await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, revealDeadline, minEMD);

      const commitment = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor1.address, ethers.parseEther("500000"), ethers.encodeBytes32String("salt1"), 1]
      );

      // Insufficient EMD
      await expect(
        contract.connect(vendor1).submitBid(1, "QmEncryptedBid1", commitment, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Insufficient EMD amount");

      // After deadline
      await ethers.provider.send("evm_increaseTime", [20]);
      await ethers.provider.send("evm_mine");

      await expect(
        contract.connect(vendor1).submitBid(1, "QmEncryptedBid1", commitment, { value: minEMD })
      ).to.be.revertedWith("Submission period over");
    });

    it("04. Should block duplicate bids per vendor per tender", async function () {
      const block = await ethers.provider.getBlock("latest");
      const subDeadline = block.timestamp + 100;
      const openTime = subDeadline + 50;
      const revealDeadline = openTime + 300;
      const minEMD = ethers.parseEther("1.0");

      await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, revealDeadline, minEMD);

      const commitment = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor1.address, ethers.parseEther("500000"), ethers.encodeBytes32String("salt1"), 1]
      );

      await contract.connect(vendor1).submitBid(1, "QmBid1", commitment, { value: minEMD });

      // Duplicate submission
      await expect(
        contract.connect(vendor1).submitBid(1, "QmBid1-Dup", commitment, { value: minEMD })
      ).to.be.revertedWith("Duplicate bid: vendor already submitted a bid for this tender");
    });
  });

  describe("Bid Reveal & Technical Score", function () {
    it("05. Should successfully reveal bid with correct commitment and emit BidRevealed", async function () {
      const block = await ethers.provider.getBlock("latest");
      const subDeadline = block.timestamp + 100;
      const openTime = subDeadline + 50;
      const revealDeadline = openTime + 300;
      const minEMD = ethers.parseEther("1.0");

      await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, revealDeadline, minEMD);

      const amount = ethers.parseEther("400000");
      const salt = ethers.encodeBytes32String("secure_salt_123");
      const commitment = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor1.address, amount, salt, 1]
      );

      await contract.connect(vendor1).submitBid(1, "QmBid1", commitment, { value: minEMD });

      // Fast-forward to opening time
      await ethers.provider.send("evm_increaseTime", [160]);
      await ethers.provider.send("evm_mine");

      await contract.connect(keeper).openBids(1);

      // Reveal with wrong salt should fail
      await expect(
        contract.connect(vendor1).revealBid(1, 0, amount, ethers.encodeBytes32String("bad_salt"))
      ).to.be.revertedWith("Commitment mismatch -- tampering detected");

      // Successful reveal
      await expect(contract.connect(vendor1).revealBid(1, 0, amount, salt))
        .to.emit(contract, "BidRevealed")
        .withArgs(1, 0, vendor1.address, amount);

      // Score technical evaluation
      await expect(contract.connect(psu).setTechnicalScore(1, 0, true, 95))
        .to.emit(contract, "TechnicalScoreSet")
        .withArgs(1, 0, true, 95);
    });

    it("06. Should reject reveal after reveal deadline", async function () {
      const block = await ethers.provider.getBlock("latest");
      const subDeadline = block.timestamp + 100;
      const openTime = subDeadline + 50;
      const revealDeadline = openTime + 100;
      const minEMD = ethers.parseEther("1.0");

      await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, revealDeadline, minEMD);

      const amount = ethers.parseEther("400000");
      const salt = ethers.encodeBytes32String("salt");
      const commitment = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor1.address, amount, salt, 1]
      );
      await contract.connect(vendor1).submitBid(1, "QmBid1", commitment, { value: minEMD });

      await ethers.provider.send("evm_increaseTime", [160]);
      await ethers.provider.send("evm_mine");
      await contract.connect(keeper).openBids(1);

      // Fast forward past reveal deadline
      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine");

      await expect(
        contract.connect(vendor1).revealBid(1, 0, amount, salt)
      ).to.be.revertedWith("Reveal deadline has passed");
    });
  });

  describe("Award Rules & Lowest Qualified Bid (L1) On-Chain Enforcement", function () {
    it("07. Should enforce on-chain L1 award, require tech-qualification, and reject higher bids", async function () {
      const block = await ethers.provider.getBlock("latest");
      const subDeadline = block.timestamp + 100;
      const openTime = subDeadline + 50;
      const revealDeadline = openTime + 200;
      const minEMD = ethers.parseEther("1.0");

      await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, revealDeadline, minEMD);

      // Vendor 1 bids 500,000 (higher bid)
      const amount1 = ethers.parseEther("500000");
      const salt1 = ethers.encodeBytes32String("salt1");
      const commitment1 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor1.address, amount1, salt1, 1]
      );
      await contract.connect(vendor1).submitBid(1, "QmBid1", commitment1, { value: minEMD });

      // Vendor 2 bids 400,000 (L1 lowest bid)
      const amount2 = ethers.parseEther("400000");
      const salt2 = ethers.encodeBytes32String("salt2");
      const commitment2 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor2.address, amount2, salt2, 1]
      );
      await contract.connect(vendor2).submitBid(1, "QmBid2", commitment2, { value: minEMD });

      // Vendor 3 submits but never reveals
      const commitment3 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor3.address, ethers.parseEther("300000"), ethers.encodeBytes32String("salt3"), 1]
      );
      await contract.connect(vendor3).submitBid(1, "QmBid3", commitment3, { value: minEMD });

      // Open bids
      await ethers.provider.send("evm_increaseTime", [160]);
      await ethers.provider.send("evm_mine");
      await contract.connect(keeper).openBids(1);

      // Reveal Vendor 1 and Vendor 2
      await contract.connect(vendor1).revealBid(1, 0, amount1, salt1);
      await contract.connect(vendor2).revealBid(1, 1, amount2, salt2);

      // Technical qualifications: both qualified
      await contract.connect(psu).setTechnicalScore(1, 0, true, 85);
      await contract.connect(psu).setTechnicalScore(1, 1, true, 92);

      // Cannot award before reveal deadline has passed
      await expect(
        contract.connect(psu).awardTender(1, vendor2.address, 2, amount2)
      ).to.be.revertedWith("Reveal period still active");

      // Pass reveal deadline
      await ethers.provider.send("evm_increaseTime", [250]);
      await ethers.provider.send("evm_mine");

      // Trying to award higher bidder Vendor 1 must revert (L1 enforcement!)
      await expect(
        contract.connect(psu).awardTender(1, vendor1.address, 1, amount1)
      ).to.be.revertedWith("Must award to lowest qualified bid (L1)");

      // Successfully award to L1 (Vendor 2), and unrevealed Vendor 3 bid is marked Rejected with EMD forfeited
      await expect(contract.connect(psu).awardTender(1, vendor2.address, 2, amount2))
        .to.emit(contract, "TenderAwarded")
        .withArgs(1, vendor2.address, amount2)
        .and.to.emit(contract, "BidRejected")
        .withArgs(1, 3, vendor3.address);

      const tender = await contract.tenders(1);
      expect(tender.winner).to.equal(vendor2.address);
      expect(tender.winningBidAmount).to.equal(amount2);
      expect(tender.status).to.equal(2); // TenderStatus.Awarded
    });
  });

  describe("Disputes & CVC Resolutions & Timeouts", function () {
    let amount1, amount2;

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const subDeadline = block.timestamp + 100;
      const openTime = subDeadline + 50;
      const revealDeadline = openTime + 100;
      const minEMD = ethers.parseEther("1.0");

      await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, revealDeadline, minEMD);

      amount1 = ethers.parseEther("500000");
      const commitment1 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor1.address, amount1, ethers.encodeBytes32String("salt1"), 1]
      );
      await contract.connect(vendor1).submitBid(1, "QmBid1", commitment1, { value: minEMD });

      amount2 = ethers.parseEther("400000");
      const commitment2 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor2.address, amount2, ethers.encodeBytes32String("salt2"), 1]
      );
      await contract.connect(vendor2).submitBid(1, "QmBid2", commitment2, { value: minEMD });

      await ethers.provider.send("evm_increaseTime", [160]);
      await ethers.provider.send("evm_mine");
      await contract.connect(keeper).openBids(1);

      await contract.connect(vendor1).revealBid(1, 0, amount1, ethers.encodeBytes32String("salt1"));
      await contract.connect(vendor2).revealBid(1, 1, amount2, ethers.encodeBytes32String("salt2"));

      await contract.connect(psu).setTechnicalScore(1, 0, true, 80);
      await contract.connect(psu).setTechnicalScore(1, 1, true, 90);

      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine");

      await contract.connect(psu).awardTender(1, vendor2.address, 2, amount2);
    });

    it("08. Should reject dispute from non-bidder, winning vendor, or below dispute bond", async function () {
      // Rejects below dispute bond
      await expect(
        contract.connect(vendor1).disputeTender(1, "QmReason", { value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Dispute bond required");

      // Vendor 3 did not bid
      await expect(
        contract.connect(vendor3).disputeTender(1, "QmReason", { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Only vendors who placed a bid may dispute");

      // Vendor 2 is winner
      await expect(
        contract.connect(vendor2).disputeTender(1, "QmReason", { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Winning vendor cannot dispute own award");
    });

    it("09. Should resolve dispute as UPHELD: reset winner state and refund bond via pull payments", async function () {
      // Vendor 1 files dispute with 0.01 ETH testnet bond
      await contract.connect(vendor1).disputeTender(1, "QmProceduralError", { value: ethers.parseEther("0.01") });

      expect(await contract.getDisputeCount(1)).to.equal(1);

      // CVC upholds dispute
      await expect(contract.connect(cvcAuditor).resolveDispute(1, true, "QmCVCUpheld"))
        .to.emit(contract, "DisputeResolved")
        .withArgs(1, true);

      // Winner state reset
      const tender = await contract.tenders(1);
      expect(tender.winner).to.equal(ethers.ZeroAddress);
      expect(tender.winningBidAmount).to.equal(0);
      expect(tender.status).to.equal(1); // TenderStatus.UnderEvaluation

      // Challenger bond credited to pull payments
      expect(await contract.pendingWithdrawals(vendor1.address)).to.equal(ethers.parseEther("0.01"));
    });

    it("10. Should resolve dispute as DISMISSED: send bond to treasury address", async function () {
      await contract.connect(vendor1).disputeTender(1, "QmFrivolous", { value: ethers.parseEther("0.01") });

      await contract.connect(cvcAuditor).resolveDispute(1, false, "QmCVCDismissed");

      const tender = await contract.tenders(1);
      expect(tender.status).to.equal(4); // TenderStatus.DisputeResolved

      // Forfeited bond credited to treasury
      expect(await contract.pendingWithdrawals(treasury.address)).to.equal(ethers.parseEther("0.01"));
    });

    it("11. Should auto-resolve via resolveDisputeTimeout when CVC exceeds 14-day timeout", async function () {
      await contract.connect(vendor1).disputeTender(1, "QmDelayedDispute", { value: ethers.parseEther("0.01") });

      // Trying before timeout
      await expect(contract.resolveDisputeTimeout(1)).to.be.revertedWith("CVC resolution timeout not yet reached");

      // Advance 14 days + 1 minute
      await ethers.provider.send("evm_increaseTime", [14 * 86400 + 60]);
      await ethers.provider.send("evm_mine");

      await contract.resolveDisputeTimeout(1);

      const tender = await contract.tenders(1);
      expect(tender.winner).to.equal(ethers.ZeroAddress);
      expect(tender.status).to.equal(1); // TenderStatus.UnderEvaluation
      expect(await contract.pendingWithdrawals(vendor1.address)).to.equal(ethers.parseEther("0.01"));
    });
  });

  describe("Finalize, Refunds via Pull Payments & Tender Cancellation", function () {
    it("12. Should finalize tender and credit refunds to all bidders including winner", async function () {
      const block = await ethers.provider.getBlock("latest");
      const subDeadline = block.timestamp + 100;
      const openTime = subDeadline + 50;
      const revealDeadline = openTime + 100;
      const minEMD = ethers.parseEther("1.0");

      await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, revealDeadline, minEMD);

      const amount1 = ethers.parseEther("400000");
      const commitment1 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor1.address, amount1, ethers.encodeBytes32String("salt1"), 1]
      );
      await contract.connect(vendor1).submitBid(1, "QmBid1", commitment1, { value: minEMD });

      await ethers.provider.send("evm_increaseTime", [160]);
      await ethers.provider.send("evm_mine");
      await contract.connect(keeper).openBids(1);
      await contract.connect(vendor1).revealBid(1, 0, amount1, ethers.encodeBytes32String("salt1"));
      await contract.connect(psu).setTechnicalScore(1, 0, true, 95);

      await ethers.provider.send("evm_increaseTime", [150]);
      await ethers.provider.send("evm_mine");
      await contract.connect(psu).awardTender(1, vendor1.address, 1, amount1);

      // Fast forward past 7-day appeal window
      await ethers.provider.send("evm_increaseTime", [7 * 86400 + 10]);
      await ethers.provider.send("evm_mine");

      await contract.connect(keeper).finalizeTender(1);

      const tender = await contract.tenders(1);
      expect(tender.status).to.equal(5); // TenderStatus.Finalized

      // Winner's EMD is credited for withdrawal
      expect(await contract.pendingWithdrawals(vendor1.address)).to.equal(minEMD);

      // Vendor pulls payment via withdraw()
      const balBefore = await ethers.provider.getBalance(vendor1.address);
      const tx = await contract.connect(vendor1).withdraw();
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(vendor1.address);

      expect(balAfter + gasSpent - balBefore).to.equal(minEMD);
      expect(await contract.pendingWithdrawals(vendor1.address)).to.equal(0);
    });

    it("13. Should cancel tender and refund EMD to bidders via pull payments", async function () {
      const block = await ethers.provider.getBlock("latest");
      const subDeadline = block.timestamp + 100;
      const openTime = subDeadline + 50;
      const revealDeadline = openTime + 300;
      const minEMD = ethers.parseEther("1.0");

      await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, revealDeadline, minEMD);

      const commitment1 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor1.address, ethers.parseEther("500000"), ethers.encodeBytes32String("salt1"), 1]
      );
      await contract.connect(vendor1).submitBid(1, "QmBid1", commitment1, { value: minEMD });

      // PSU cancels tender
      await expect(contract.connect(psu).cancelTender(1, "Budget allocation rescheduled"))
        .to.emit(contract, "TenderCancelled")
        .withArgs(1, "Budget allocation rescheduled");

      const tender = await contract.tenders(1);
      expect(tender.status).to.equal(6); // TenderStatus.Cancelled

      // EMD credited to pending withdrawals
      expect(await contract.pendingWithdrawals(vendor1.address)).to.equal(minEMD);
    });
  });
});
