const { expect } = require("chai");
const { ethers } = require("hardhat");

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

  it("01. Should initialize proxy with correct admins, keeper, and CVC auditor", async function () {
    expect(await contract.multisigAdmin()).to.equal(admin.address);
    expect(await contract.keeperAddress()).to.equal(keeper.address);
    expect(await contract.cvcAuditorAddress()).to.equal(cvcAuditor.address);
    expect(await contract.registeredPSUs(psu.address)).to.be.true;
    expect(await contract.registeredVendors(vendor1.address)).to.be.true;
  });

  it("02. Should reject bid submission after the submission deadline has passed", async function () {
    const block = await ethers.provider.getBlock("latest");
    const subDeadline = block.timestamp + 10; // 10 seconds in future
    const openTime = subDeadline + 10;
    const minEMD = ethers.parseEther("1.0");

    await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, minEMD);

    // Fast forward time past submission deadline
    await ethers.provider.send("evm_increaseTime", [20]);
    await ethers.provider.send("evm_mine");

    const commitment = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32", "uint256"],
      [vendor1.address, ethers.parseEther("500000"), ethers.encodeBytes32String("salt1"), 1]
    );

    await expect(
      contract.connect(vendor1).submitBid(1, "QmEncryptedBid1", commitment, { value: minEMD })
    ).to.be.revertedWith("Submission period over");
  });

  it("03. Should reject bid reveal when wrong salt or amount is submitted (Commitment mismatch)", async function () {
    const block = await ethers.provider.getBlock("latest");
    const subDeadline = block.timestamp + 10;
    const openTime = block.timestamp + 20;
    const minEMD = ethers.parseEther("1.0");

    await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, minEMD);

    const actualAmount = ethers.parseEther("500000");
    const actualSalt = ethers.encodeBytes32String("correct_salt");
    const commitment = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32", "uint256"],
      [vendor1.address, actualAmount, actualSalt, 1]
    );

    await contract.connect(vendor1).submitBid(1, "QmBid1", commitment, { value: minEMD });

    // Open bids
    await ethers.provider.send("evm_increaseTime", [30]);
    await ethers.provider.send("evm_mine");
    await contract.connect(keeper).openBids(1);

    // Attempt reveal with wrong salt
    const wrongSalt = ethers.encodeBytes32String("wrong_salt");
    await expect(
      contract.connect(vendor1).revealBid(1, 0, actualAmount, wrongSalt)
    ).to.be.revertedWith("Commitment mismatch -- tampering detected");

    // Attempt reveal with wrong amount
    const wrongAmount = ethers.parseEther("400000");
    await expect(
      contract.connect(vendor1).revealBid(1, 0, wrongAmount, actualSalt)
    ).to.be.revertedWith("Commitment mismatch -- tampering detected");
  });

  it("04. Should reject bid submission when EMD deposited is below tender minimum", async function () {
    const block = await ethers.provider.getBlock("latest");
    const subDeadline = block.timestamp + 3600;
    const openTime = subDeadline + 300;
    const minEMD = ethers.parseEther("1.0");

    await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, minEMD);

    const commitment = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32", "uint256"],
      [vendor1.address, ethers.parseEther("500000"), ethers.encodeBytes32String("salt1"), 1]
    );

    // Deposit 0.5 ETH EMD (below 1.0 ETH required)
    await expect(
      contract.connect(vendor1).submitBid(1, "QmBid1", commitment, {
        value: ethers.parseEther("0.5"),
      })
    ).to.be.revertedWith("Insufficient EMD amount");
  });

  it("05. Should block contract award if bids remain un-opened/un-evaluated", async function () {
    const block = await ethers.provider.getBlock("latest");
    const subDeadline = block.timestamp + 10;
    const openTime = block.timestamp + 20;
    const minEMD = ethers.parseEther("1.0");

    await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, minEMD);

    const commitment = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32", "uint256"],
      [vendor1.address, ethers.parseEther("500000"), ethers.encodeBytes32String("salt1"), 1]
    );
    await contract.connect(vendor1).submitBid(1, "QmBid1", commitment, { value: minEMD });

    await ethers.provider.send("evm_increaseTime", [30]);
    await ethers.provider.send("evm_mine");
    await contract.connect(keeper).openBids(1);

    // Try to award before bid is revealed & opened
    await expect(
      contract.connect(psu).awardTender(1, vendor1.address, 1, ethers.parseEther("500000"))
    ).to.be.revertedWith("Bids must be opened before award");
  });

  it("06. Should allow dispute filing within 7-day appeal window with required bond", async function () {
    const block = await ethers.provider.getBlock("latest");
    const subDeadline = block.timestamp + 10;
    const openTime = block.timestamp + 20;
    const minEMD = ethers.parseEther("1.0");

    await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, minEMD);

    const amount = ethers.parseEther("500000");
    const salt = ethers.encodeBytes32String("salt1");
    const commitment = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32", "uint256"],
      [vendor1.address, amount, salt, 1]
    );
    await contract.connect(vendor1).submitBid(1, "QmBid1", commitment, { value: minEMD });

    await ethers.provider.send("evm_increaseTime", [30]);
    await ethers.provider.send("evm_mine");
    await contract.connect(keeper).openBids(1);
    await contract.connect(vendor1).revealBid(1, 0, amount, salt);

    await contract.connect(psu).awardTender(1, vendor1.address, 1, amount);

    // Vendor 2 files dispute within appeal window with 1 ETH bond
    const disputeBond = ethers.parseEther("1.0");
    await expect(
      contract.connect(vendor2).disputeTender(1, "QmDisputeReason", { value: disputeBond })
    )
      .to.emit(contract, "DisputeFiled")
      .withArgs(1, vendor2.address);
  });

  it("07. Should reject dispute filing after the 7-day appeal window has expired", async function () {
    const block = await ethers.provider.getBlock("latest");
    const subDeadline = block.timestamp + 10;
    const openTime = block.timestamp + 20;
    const minEMD = ethers.parseEther("1.0");

    await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, minEMD);

    const amount = ethers.parseEther("500000");
    const salt = ethers.encodeBytes32String("salt1");
    const commitment = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32", "uint256"],
      [vendor1.address, amount, salt, 1]
    );
    await contract.connect(vendor1).submitBid(1, "QmBid1", commitment, { value: minEMD });

    await ethers.provider.send("evm_increaseTime", [30]);
    await ethers.provider.send("evm_mine");
    await contract.connect(keeper).openBids(1);
    await contract.connect(vendor1).revealBid(1, 0, amount, salt);

    await contract.connect(psu).awardTender(1, vendor1.address, 1, amount);

    // Fast forward past 7 days appeal window (7 * 86400 + 10 seconds)
    await ethers.provider.send("evm_increaseTime", [7 * 86400 + 10]);
    await ethers.provider.send("evm_mine");

    await expect(
      contract.connect(vendor2).disputeTender(1, "QmDisputeReason", { value: ethers.parseEther("1.0") })
    ).to.be.revertedWith("Appeal window has closed");
  });

  it("08. Should prevent winning vendor from filing a dispute against their own award", async function () {
    const block = await ethers.provider.getBlock("latest");
    const subDeadline = block.timestamp + 10;
    const openTime = block.timestamp + 20;
    const minEMD = ethers.parseEther("1.0");

    await contract.connect(psu).createTender("QmTenderSpec1", subDeadline, openTime, minEMD);

    const amount = ethers.parseEther("500000");
    const salt = ethers.encodeBytes32String("salt1");
    const commitment = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32", "uint256"],
      [vendor1.address, amount, salt, 1]
    );
    await contract.connect(vendor1).submitBid(1, "QmBid1", commitment, { value: minEMD });

    await ethers.provider.send("evm_increaseTime", [30]);
    await ethers.provider.send("evm_mine");
    await contract.connect(keeper).openBids(1);
    await contract.connect(vendor1).revealBid(1, 0, amount, salt);

    await contract.connect(psu).awardTender(1, vendor1.address, 1, amount);

    // Winner vendor1 tries to dispute own award
    await expect(
      contract.connect(vendor1).disputeTender(1, "QmDisputeReason", { value: ethers.parseEther("1.0") })
    ).to.be.revertedWith("Winning vendor cannot dispute own award");
  });
});
