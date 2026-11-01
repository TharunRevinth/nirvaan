
const { ethers } = require("hardhat");

async function main() {
    const [deployer, admin, psu, vendor1, vendor2, keeper, cvc, treasury] = await ethers.getSigners();
    
    // Implementation deployment
    const ImplFactory = await ethers.getContractFactory("OilTenderingV1");
    const impl = await ImplFactory.deploy();
    const implReceipt = await impl.deploymentTransaction().wait();

    // Proxy deployment
    const initData = impl.interface.encodeFunctionData("initialize", [
        admin.address,
        keeper.address,
        cvc.address,
        treasury.address,
        ethers.parseEther("0.01"),
        ethers.parseEther("0.001")
    ]);
    const ProxyFactory = await ethers.getContractFactory("TenderProxy");
    const proxy = await ProxyFactory.deploy(await impl.getAddress(), initData);
    const proxyReceipt = await proxy.deploymentTransaction().wait();
    const contract = ImplFactory.attach(await proxy.getAddress());

    // Admin configs
    const regPsuTx = await contract.connect(admin).registerPSU(psu.address);
    const regPsuRc = await regPsuTx.wait();

    const gstinHash = ethers.keccak256(ethers.toUtf8Bytes("GSTIN123456789"));
    const panHash = ethers.keccak256(ethers.toUtf8Bytes("ABCDE1234F"));
    const regVen1Tx = await contract.connect(admin).registerVendor(vendor1.address, gstinHash, panHash, "QmKYCDoc1");
    const regVen1Rc = await regVen1Tx.wait();

    const regVen2Tx = await contract.connect(admin).registerVendor(vendor2.address, gstinHash, panHash, "QmKYCDoc2");
    const regVen2Rc = await regVen2Tx.wait();

    // Create tender 1
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const subDead = now + 100;
    const openTime = now + 120;
    const revDead = now + 200;
    const createTx = await contract.connect(psu).createTender(
        "QmNITDocumentCID123456789012345678901234567890",
        subDead,
        openTime,
        revDead,
        ethers.parseEther("0.001")
    );
    const createRc = await createTx.wait();

    // Submit bid 1
    const salt1 = ethers.encodeBytes32String("salt1");
    const amount1 = ethers.parseEther("1.0");
    const commit1 = ethers.keccak256(ethers.solidityPacked(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor1.address, amount1, salt1, 1]
    ));
    const subBid1Tx = await contract.connect(vendor1).submitBid(1, "QmBidDoc1", commit1, { value: ethers.parseEther("0.001") });
    const subBid1Rc = await subBid1Tx.wait();

    // Submit bid 2
    const salt2 = ethers.encodeBytes32String("salt2");
    const amount2 = ethers.parseEther("1.5");
    const commit2 = ethers.keccak256(ethers.solidityPacked(
        ["address", "uint256", "bytes32", "uint256"],
        [vendor2.address, amount2, salt2, 1]
    ));
    const subBid2Tx = await contract.connect(vendor2).submitBid(1, "QmBidDoc2", commit2, { value: ethers.parseEther("0.001") });
    const subBid2Rc = await subBid2Tx.wait();

    // Fast forward to open
    await ethers.provider.send("evm_setNextBlockTimestamp", [openTime + 1]);
    await ethers.provider.send("evm_mine");

    const openTx = await contract.connect(keeper).openBids(1);
    const openRc = await openTx.wait();

    // Reveal bids
    const rev1Tx = await contract.connect(vendor1).revealBid(1, 0, amount1, salt1);
    const rev1Rc = await rev1Tx.wait();

    const rev2Tx = await contract.connect(vendor2).revealBid(1, 1, amount2, salt2);
    const rev2Rc = await rev2Tx.wait();

    // Score bids
    const score1Tx = await contract.connect(psu).setTechnicalScore(1, 0, true, 85);
    const score1Rc = await score1Tx.wait();

    const score2Tx = await contract.connect(psu).setTechnicalScore(1, 1, true, 90);
    const score2Rc = await score2Tx.wait();

    // Fast forward past revealDeadline
    await ethers.provider.send("evm_setNextBlockTimestamp", [revDead + 1]);
    await ethers.provider.send("evm_mine");

    // Award tender
    const awardTx = await contract.connect(psu).awardTender(1, vendor1.address, 1, amount1);
    const awardRc = await awardTx.wait();

    // Fast forward past appealDeadline (7 days) without dispute
    const curNow = (await ethers.provider.getBlock("latest")).timestamp;
    await ethers.provider.send("evm_setNextBlockTimestamp", [curNow + 7 * 86400 + 10]);
    await ethers.provider.send("evm_mine");

    // Finalize
    const finTx = await contract.connect(keeper).finalizeTender(1);
    const finRc = await finTx.wait();

    // Withdraw
    const withTx = await contract.connect(vendor1).withdraw();
    const withRc = await withTx.wait();

    // Tender 2 for Dispute tests
    const now2 = (await ethers.provider.getBlock("latest")).timestamp;
    await contract.connect(psu).createTender("QmDoc2", now2 + 100, now2 + 120, now2 + 200, ethers.parseEther("0.001"));
    const commit2_1 = ethers.keccak256(ethers.solidityPacked(["address", "uint256", "bytes32", "uint256"], [vendor1.address, amount1, salt1, 2]));
    const commit2_2 = ethers.keccak256(ethers.solidityPacked(["address", "uint256", "bytes32", "uint256"], [vendor2.address, amount2, salt2, 2]));
    await contract.connect(vendor1).submitBid(2, "QmBidDoc1", commit2_1, { value: ethers.parseEther("0.001") });
    await contract.connect(vendor2).submitBid(2, "QmBidDoc2", commit2_2, { value: ethers.parseEther("0.001") });
    await ethers.provider.send("evm_setNextBlockTimestamp", [now2 + 125]);
    await ethers.provider.send("evm_mine");
    await contract.connect(keeper).openBids(2);
    await contract.connect(vendor1).revealBid(2, 0, amount1, salt1);
    await contract.connect(vendor2).revealBid(2, 1, amount2, salt2);
    await contract.connect(psu).setTechnicalScore(2, 0, true, 90);
    await contract.connect(psu).setTechnicalScore(2, 1, true, 80);
    await ethers.provider.send("evm_setNextBlockTimestamp", [now2 + 205]);
    await ethers.provider.send("evm_mine");
    await contract.connect(psu).awardTender(2, vendor1.address, 3, amount1);

    // Dispute tender
    const disputeTx = await contract.connect(vendor2).disputeTender(2, "QmDisputeReason", { value: ethers.parseEther("0.01") });
    const disputeRc = await disputeTx.wait();

    // Resolve dispute (dismissed)
    const resolveDisTx = await contract.connect(cvc).resolveDispute(2, false, "QmCVCReasonDismissed");
    const resolveDisRc = await resolveDisTx.wait();

    // Tender 3 for cancelTender
    const now3 = (await ethers.provider.getBlock("latest")).timestamp;
    await contract.connect(psu).createTender("QmCancelDoc", now3 + 500, now3 + 600, now3 + 700, ethers.parseEther("0.001"));
    const commit3_1 = ethers.keccak256(ethers.solidityPacked(["address", "uint256", "bytes32", "uint256"], [vendor1.address, amount1, salt1, 3]));
    await contract.connect(vendor1).submitBid(3, "QmCancelBid", commit3_1, { value: ethers.parseEther("0.001") });
    const cancelTx = await contract.connect(psu).cancelTender(3, "Administrative grounds");
    const cancelRc = await cancelTx.wait();

    console.log("GAS_RESULTS=" + JSON.stringify({
        implementationDeployment: Number(implReceipt.gasUsed),
        proxyDeployment: Number(proxyReceipt.gasUsed),
        registerPSU: Number(regPsuRc.gasUsed),
        registerVendor: Number(regVen1Rc.gasUsed),
        createTender: Number(createRc.gasUsed),
        submitBidFirst: Number(subBid1Rc.gasUsed),
        submitBidSubsequent: Number(subBid2Rc.gasUsed),
        openBids: Number(openRc.gasUsed),
        revealBidFirst: Number(rev1Rc.gasUsed),
        revealBidSubsequent: Number(rev2Rc.gasUsed),
        setTechnicalScore: Number(score1Rc.gasUsed),
        awardTender: Number(awardRc.gasUsed),
        disputeTender: Number(disputeRc.gasUsed),
        resolveDisputeDismissed: Number(resolveDisRc.gasUsed),
        finalizeTender: Number(finRc.gasUsed),
        withdraw: Number(withRc.gasUsed),
        cancelTender: Number(cancelRc.gasUsed)
    }));
}

main().catch(console.error);
