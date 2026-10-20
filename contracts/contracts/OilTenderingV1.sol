// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title OilTenderingV1
 * @dev Permissioned Consortium E-Tendering System for Indian Oil PSUs.
 * Features: UUPS Proxy Upgradeability via ERC1967, Sealed Commit-Reveal Bid Encryption,
 * 7-Day Dispute Appeal Window, L1 On-Chain Lowest Qualified Bid Verification,
 * Pull Payments (withdraw pattern), CVC Resolution Timeout & Dispute History,
 * Reveal Deadlines with EMD Forfeiture for Non-Revealers, and Event Emission.
 */
contract OilTenderingV1 is Initializable, UUPSUpgradeable {

    // -----------------------------------------------------------------------
    // ENUMS
    // -----------------------------------------------------------------------

    enum TenderStatus {
        Created,
        UnderEvaluation,
        Awarded,           // 7-day appeal window active
        Disputed,          // Formal challenge filed
        DisputeResolved,   // CVC has ruled
        Finalized,         // Ready for contract execution
        Cancelled
    }

    enum BidStatus { Submitted, Opened, Accepted, Rejected }

    // -----------------------------------------------------------------------
    // STRUCTS
    // -----------------------------------------------------------------------

    struct Tender {
        uint256 id;
        address psuAddress;
        string ipfsHashDoc;           // SHA-256/CID of tender doc on IPFS
        uint256 submissionDeadline;   // Unix timestamp
        uint256 openingTime;          // Unix timestamp
        uint256 revealDeadline;       // Bids must be revealed before this deadline
        uint256 appealDeadline;       // Set when tender is awarded (awardedTime + 7 days)
        uint256 minEMDAmount;         // Earnest Money Deposit
        TenderStatus status;
        address winner;
        uint256 winningBidId;
        uint256 winningBidAmount;
    }

    struct Bid {
        uint256 id;
        uint256 tenderId;
        address vendorAddress;
        string encryptedBidIpfsHash;  // Encrypted bid file on IPFS
        bytes32 bidCommitment;        // keccak256(vendor+amount+salt+tenderId)
        uint256 submissionTime;       // Automatically set by block.timestamp
        uint256 bidAmount;            // Revealed during opening phase
        BidStatus status;
        bool isTechQualified;
        uint256 techScore;
        uint256 emdDeposited;         // Exact EMD amount sent by vendor
    }

    struct VendorKYC {
        bytes32 gstinHash;
        bytes32 panHash;
        string kycIpfsHash;
        uint256 registeredAt;
        bool isActive;
    }

    struct Dispute {
        uint256 tenderId;
        address challenger;
        string reasonIpfsHash;
        uint256 filedAt;
        uint256 timeoutAt;           // CVC resolution deadline
        bool isResolved;
        bool isUpheld;
        string cvcReasonIpfsHash;
        uint256 disputeBondDeposited; // Holds the exact refund amount
    }

    // -----------------------------------------------------------------------
    // CONSTANTS & STORAGE MAPPINGS
    // -----------------------------------------------------------------------

    uint256 public constant CVC_RESOLUTION_TIMEOUT = 14 days;

    mapping(uint256 => Tender) public tenders;
    mapping(uint256 => Bid[]) public tenderBids;
    mapping(uint256 => mapping(address => bool)) public hasBid;
    mapping(address => bool) public registeredPSUs;
    mapping(address => bool) public registeredVendors;
    mapping(address => VendorKYC) public vendorKYC;
    mapping(uint256 => Dispute[]) public tenderDisputeHistory;

    // Pull Payment pattern mapping: balances pending withdrawal
    mapping(address => uint256) public pendingWithdrawals;

    uint256 public tenderCounter;
    uint256 public bidCounter;

    address public keeperAddress;     // Whitelisted Keeper/Oracle wallet
    address public cvcAuditorAddress; // CVC read/resolve address
    address public multisigAdmin;     // Consortium multisig for upgrades
    address public treasuryAddress;   // Treasury for forfeited bonds
    uint256 public disputeBondAmount; // Configurable statutory dispute bond
    uint256 public defaultMinEMD;     // Configurable minimum default EMD

    // -----------------------------------------------------------------------
    // EVENTS
    // -----------------------------------------------------------------------

    event TenderCreated(uint256 indexed tenderId, address indexed psu, uint256 deadline);
    event BidSubmitted(uint256 indexed tenderId, uint256 indexed bidId, address indexed vendor);
    event BidsOpened(uint256 indexed tenderId);
    event BidRevealed(uint256 indexed tenderId, uint256 indexed bidIndex, address indexed vendor, uint256 amount);
    event BidRejected(uint256 indexed tenderId, uint256 indexed bidId, address indexed vendor);
    event TechnicalScoreSet(uint256 indexed tenderId, uint256 indexed bidIndex, bool qualified, uint256 score);
    event TenderAwarded(uint256 indexed tenderId, address indexed winner, uint256 amount);
    event DisputeFiled(uint256 indexed tenderId, address indexed challenger);
    event DisputeResolved(uint256 indexed tenderId, bool upheld);
    event TenderFinalized(uint256 indexed tenderId);
    event TenderCancelled(uint256 indexed tenderId, string reason);
    event VendorRegistered(address indexed vendor, bytes32 gstinHash, uint256 timestamp);
    event PSURegistered(address indexed psu);
    event Withdrawal(address indexed recipient, uint256 amount);

    // -----------------------------------------------------------------------
    // MODIFIERS
    // -----------------------------------------------------------------------

    modifier onlyPSU() {
        require(registeredPSUs[msg.sender], "Only registered PSUs allowed");
        _;
    }

    modifier onlyVendor() {
        require(registeredVendors[msg.sender], "Only registered Vendors");
        _;
    }

    modifier onlyKeeper() {
        require(msg.sender == keeperAddress, "Only keeper allowed");
        _;
    }

    modifier onlyCVC() {
        require(msg.sender == cvcAuditorAddress, "Only CVC auditor allowed");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == multisigAdmin, "Only admin allowed");
        _;
    }

    // -----------------------------------------------------------------------
    // UUPS INITIALIZATION
    // -----------------------------------------------------------------------

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _multisigAdmin,
        address _keeperAddress,
        address _cvcAuditorAddress,
        address _treasuryAddress,
        uint256 _disputeBondAmount,
        uint256 _defaultMinEMD
    ) public initializer {
        require(_multisigAdmin != address(0), "Admin cannot be zero address");
        multisigAdmin = _multisigAdmin;
        keeperAddress = _keeperAddress;
        cvcAuditorAddress = _cvcAuditorAddress;
        treasuryAddress = _treasuryAddress != address(0) ? _treasuryAddress : _multisigAdmin;
        disputeBondAmount = _disputeBondAmount > 0 ? _disputeBondAmount : 0.01 ether;
        defaultMinEMD = _defaultMinEMD > 0 ? _defaultMinEMD : 0.001 ether;

        // Self-register the admin as initial PSU for bootstrapping
        registeredPSUs[_multisigAdmin] = true;
    }

    // -----------------------------------------------------------------------
    // ADMIN MANAGEMENT FUNCTIONS
    // -----------------------------------------------------------------------

    function setDisputeBondAmount(uint256 _newBond) external onlyAdmin {
        require(_newBond > 0, "Bond must be greater than zero");
        disputeBondAmount = _newBond;
    }

    function setDefaultMinEMD(uint256 _newMinEMD) external onlyAdmin {
        require(_newMinEMD > 0, "EMD must be greater than zero");
        defaultMinEMD = _newMinEMD;
    }

    function registerPSU(address _psuAddress) external onlyAdmin {
        require(!registeredPSUs[_psuAddress], "PSU already registered");
        registeredPSUs[_psuAddress] = true;
        emit PSURegistered(_psuAddress);
    }

    function setKeeperAddress(address _newKeeper) external onlyAdmin {
        keeperAddress = _newKeeper;
    }

    function setCVCAuditorAddress(address _newCVC) external onlyAdmin {
        cvcAuditorAddress = _newCVC;
    }

    function setTreasuryAddress(address _newTreasury) external onlyAdmin {
        treasuryAddress = _newTreasury;
    }

    // -----------------------------------------------------------------------
    // CORE TENDERING FUNCTIONS
    // -----------------------------------------------------------------------

    function createTender(
        string memory _ipfsHash,
        uint256 _submissionDeadline,
        uint256 _openingTime,
        uint256 _revealDeadline,
        uint256 _minEMD
    ) external onlyPSU {
        require(_submissionDeadline > block.timestamp, "Deadline must be in the future");
        require(_openingTime >= _submissionDeadline, "Opening must be after deadline");
        require(_revealDeadline > _openingTime, "Reveal deadline must be after opening time");

        uint256 emd = _minEMD > 0 ? _minEMD : defaultMinEMD;

        tenderCounter++;
        tenders[tenderCounter] = Tender({
            id: tenderCounter,
            psuAddress: msg.sender,
            ipfsHashDoc: _ipfsHash,
            submissionDeadline: _submissionDeadline,
            openingTime: _openingTime,
            revealDeadline: _revealDeadline,
            appealDeadline: 0,
            minEMDAmount: emd,
            status: TenderStatus.Created,
            winner: address(0),
            winningBidId: 0,
            winningBidAmount: 0
        });

        emit TenderCreated(tenderCounter, msg.sender, _submissionDeadline);
    }

    function cancelTender(uint256 _tenderId, string memory _reason) external onlyPSU {
        Tender storage tender = tenders[_tenderId];
        require(tender.psuAddress == msg.sender, "Only issuing PSU allowed");
        require(
            tender.status != TenderStatus.Finalized && tender.status != TenderStatus.Cancelled,
            "Cannot cancel finalized or cancelled tender"
        );

        tender.status = TenderStatus.Cancelled;

        // Refund all deposited EMDs to bidders via pull payments
        Bid[] storage bids = tenderBids[_tenderId];
        for (uint256 i = 0; i < bids.length; i++) {
            if (bids[i].emdDeposited > 0) {
                uint256 refund = bids[i].emdDeposited;
                bids[i].emdDeposited = 0;
                pendingWithdrawals[bids[i].vendorAddress] += refund;
            }
        }

        emit TenderCancelled(_tenderId, _reason);
    }

    function submitBid(
        uint256 _tenderId,
        string memory _encryptedBidIpfs,
        bytes32 _bidCommitment
    ) external payable onlyVendor {
        Tender storage tender = tenders[_tenderId];
        require(tender.id != 0, "Tender does not exist");
        require(tender.status == TenderStatus.Created, "Tender not open for bidding");
        require(block.timestamp < tender.submissionDeadline, "Submission period over");
        uint256 requiredEMD = tender.minEMDAmount > 0 ? tender.minEMDAmount : defaultMinEMD;
        require(msg.value >= requiredEMD, "Insufficient EMD amount");
        require(!hasBid[_tenderId][msg.sender], "Duplicate bid: vendor already submitted a bid for this tender");

        hasBid[_tenderId][msg.sender] = true;
        bidCounter++;
        tenderBids[_tenderId].push(Bid({
            id: bidCounter,
            tenderId: _tenderId,
            vendorAddress: msg.sender,
            encryptedBidIpfsHash: _encryptedBidIpfs,
            bidCommitment: _bidCommitment,
            submissionTime: block.timestamp,
            bidAmount: 0,
            status: BidStatus.Submitted,
            isTechQualified: false,
            techScore: 0,
            emdDeposited: msg.value
        }));

        emit BidSubmitted(_tenderId, bidCounter, msg.sender);
    }

    function openBids(uint256 _tenderId) external onlyKeeper {
        Tender storage tender = tenders[_tenderId];
        require(tender.id != 0, "Tender does not exist");
        require(block.timestamp >= tender.openingTime, "Opening time not reached");
        require(tender.status == TenderStatus.Created, "Tender not in Created state");

        tender.status = TenderStatus.UnderEvaluation;
        emit BidsOpened(_tenderId);
    }

    function revealBid(
        uint256 _tenderId,
        uint256 _bidIndex,
        uint256 _bidAmount,
        bytes32 _salt
    ) external onlyVendor {
        Tender storage tender = tenders[_tenderId];
        require(tender.status == TenderStatus.UnderEvaluation, "Bids not yet opened");
        require(block.timestamp <= tender.revealDeadline, "Reveal deadline has passed");
        require(_bidIndex < tenderBids[_tenderId].length, "Invalid bid index");

        Bid storage bid = tenderBids[_tenderId][_bidIndex];
        require(bid.vendorAddress == msg.sender, "Not your bid");
        require(bid.status == BidStatus.Submitted, "Bid already revealed or evaluated");

        bytes32 computedCommitment = keccak256(
            abi.encodePacked(msg.sender, _bidAmount, _salt, _tenderId)
        );
        require(computedCommitment == bid.bidCommitment, "Commitment mismatch -- tampering detected");

        bid.bidAmount = _bidAmount;
        bid.status = BidStatus.Opened;

        emit BidRevealed(_tenderId, _bidIndex, msg.sender, _bidAmount);
    }

    function setTechnicalScore(
        uint256 _tenderId,
        uint256 _bidIndex,
        bool _qualified,
        uint256 _score
    ) external onlyPSU {
        Tender storage tender = tenders[_tenderId];
        require(tender.psuAddress == msg.sender, "Only issuing PSU allowed");
        require(tender.status == TenderStatus.UnderEvaluation, "Tender not under evaluation");
        require(_bidIndex < tenderBids[_tenderId].length, "Invalid bid index");

        Bid storage bid = tenderBids[_tenderId][_bidIndex];
        bid.isTechQualified = _qualified;
        bid.techScore = _score;

        emit TechnicalScoreSet(_tenderId, _bidIndex, _qualified, _score);
    }

    function awardTender(
        uint256 _tenderId,
        address _winner,
        uint256 _winningBidId,
        uint256 _winningBidAmount
    ) external onlyPSU {
        Tender storage tender = tenders[_tenderId];
        require(tender.psuAddress == msg.sender, "Only issuing PSU allowed");
        require(tender.status == TenderStatus.UnderEvaluation, "Tender not under evaluation");
        require(block.timestamp > tender.revealDeadline, "Reveal period still active");

        Bid[] storage bids = tenderBids[_tenderId];
        require(bids.length > 0, "No bids submitted");

        // Mark any unrevealed bids as Rejected; their EMD is forfeited so one vendor cannot block award
        for (uint256 i = 0; i < bids.length; i++) {
            if (bids[i].status == BidStatus.Submitted) {
                bids[i].status = BidStatus.Rejected;
                emit BidRejected(_tenderId, bids[i].id, bids[i].vendorAddress);
            }
        }

        // Verify winner is a bidder, the bid is Opened and tech-qualified, and amount matches revealed bid
        // Enforce lowest qualified bid (L1) on-chain
        bool foundWinnerBid = false;
        uint256 lowestQualifiedAmount = type(uint256).max;
        address lowestQualifiedVendor = address(0);

        for (uint256 i = 0; i < bids.length; i++) {
            if (bids[i].status == BidStatus.Opened && bids[i].isTechQualified) {
                if (bids[i].bidAmount < lowestQualifiedAmount) {
                    lowestQualifiedAmount = bids[i].bidAmount;
                    lowestQualifiedVendor = bids[i].vendorAddress;
                }
                if (
                    bids[i].id == _winningBidId &&
                    bids[i].vendorAddress == _winner &&
                    bids[i].bidAmount == _winningBidAmount
                ) {
                    foundWinnerBid = true;
                    bids[i].status = BidStatus.Accepted;
                }
            }
        }

        require(foundWinnerBid, "Winner must be a tech-qualified bidder with matching revealed amount");
        require(
            _winner == lowestQualifiedVendor && _winningBidAmount == lowestQualifiedAmount,
            "Must award to lowest qualified bid (L1)"
        );

        tender.winner = _winner;
        tender.winningBidId = _winningBidId;
        tender.winningBidAmount = _winningBidAmount;
        tender.status = TenderStatus.Awarded;

        // Start 7-day appeal window
        tender.appealDeadline = block.timestamp + 7 days;

        emit TenderAwarded(_tenderId, _winner, _winningBidAmount);
    }

    // -----------------------------------------------------------------------
    // DISPUTE MANAGEMENT FUNCTIONS
    // -----------------------------------------------------------------------

    function disputeTender(
        uint256 _tenderId,
        string memory _reasonIpfsHash
    ) external payable onlyVendor {
        Tender storage tender = tenders[_tenderId];
        require(tender.status == TenderStatus.Awarded, "Tender not in Awarded state");
        require(hasBid[_tenderId][msg.sender], "Only vendors who placed a bid may dispute");
        require(msg.sender != tender.winner, "Winning vendor cannot dispute own award");
        require(block.timestamp <= tender.appealDeadline, "Appeal window has closed");
        require(msg.value >= disputeBondAmount, "Dispute bond required");

        Dispute memory newDispute = Dispute({
            tenderId: _tenderId,
            challenger: msg.sender,
            reasonIpfsHash: _reasonIpfsHash,
            filedAt: block.timestamp,
            timeoutAt: block.timestamp + CVC_RESOLUTION_TIMEOUT,
            isResolved: false,
            isUpheld: false,
            cvcReasonIpfsHash: "",
            disputeBondDeposited: msg.value
        });

        tenderDisputeHistory[_tenderId].push(newDispute);
        tender.status = TenderStatus.Disputed;

        emit DisputeFiled(_tenderId, msg.sender);
    }

    function resolveDispute(
        uint256 _tenderId,
        bool _upheld,
        string memory _cvcReasonIpfsHash
    ) external onlyCVC {
        Tender storage tender = tenders[_tenderId];
        require(tender.status == TenderStatus.Disputed, "No active dispute");

        uint256 historyLen = tenderDisputeHistory[_tenderId].length;
        require(historyLen > 0, "No dispute history");
        Dispute storage dispute = tenderDisputeHistory[_tenderId][historyLen - 1];
        require(!dispute.isResolved, "Dispute already resolved");
        require(block.timestamp <= dispute.timeoutAt, "CVC resolution timeout expired");

        dispute.isResolved = true;
        dispute.isUpheld = _upheld;
        dispute.cvcReasonIpfsHash = _cvcReasonIpfsHash;

        uint256 bond = dispute.disputeBondDeposited;
        dispute.disputeBondDeposited = 0; // Re-entrancy protection

        if (_upheld) {
            // Reset winner state when upheld
            tender.winner = address(0);
            tender.winningBidId = 0;
            tender.winningBidAmount = 0;
            tender.appealDeadline = 0;
            tender.status = TenderStatus.UnderEvaluation;

            // Refund challenger bond via pull payment
            pendingWithdrawals[dispute.challenger] += bond;
        } else {
            // Dispute dismissed: Send dismissed-dispute bonds to treasury address
            tender.status = TenderStatus.DisputeResolved;
            pendingWithdrawals[treasuryAddress] += bond;
        }

        emit DisputeResolved(_tenderId, _upheld);
    }

    function resolveDisputeTimeout(uint256 _tenderId) external {
        Tender storage tender = tenders[_tenderId];
        require(tender.status == TenderStatus.Disputed, "No active dispute");

        uint256 historyLen = tenderDisputeHistory[_tenderId].length;
        require(historyLen > 0, "No dispute history");
        Dispute storage dispute = tenderDisputeHistory[_tenderId][historyLen - 1];
        require(!dispute.isResolved, "Dispute already resolved");
        require(block.timestamp > dispute.timeoutAt, "CVC resolution timeout not yet reached");

        dispute.isResolved = true;
        dispute.isUpheld = true;
        dispute.cvcReasonIpfsHash = "CVC_RESOLUTION_TIMED_OUT";

        uint256 bond = dispute.disputeBondDeposited;
        dispute.disputeBondDeposited = 0;
        pendingWithdrawals[dispute.challenger] += bond;

        // Reset winner state
        tender.winner = address(0);
        tender.winningBidId = 0;
        tender.winningBidAmount = 0;
        tender.appealDeadline = 0;
        tender.status = TenderStatus.UnderEvaluation;

        emit DisputeResolved(_tenderId, true);
    }

    // Compatibility getter returning the latest dispute
    function tenderDisputes(uint256 _tenderId) external view returns (
        uint256 tenderId,
        address challenger,
        string memory reasonIpfsHash,
        uint256 filedAt,
        bool isResolved,
        bool isUpheld,
        string memory cvcReasonIpfsHash,
        uint256 disputeBondDeposited
    ) {
        uint256 len = tenderDisputeHistory[_tenderId].length;
        if (len == 0) {
            return (_tenderId, address(0), "", 0, false, false, "", 0);
        }
        Dispute storage d = tenderDisputeHistory[_tenderId][len - 1];
        return (
            d.tenderId,
            d.challenger,
            d.reasonIpfsHash,
            d.filedAt,
            d.isResolved,
            d.isUpheld,
            d.cvcReasonIpfsHash,
            d.disputeBondDeposited
        );
    }

    function getDisputeCount(uint256 _tenderId) external view returns (uint256) {
        return tenderDisputeHistory[_tenderId].length;
    }

    // -----------------------------------------------------------------------
    // FINALIZATION & PULL PAYMENTS (WITHDRAW)
    // -----------------------------------------------------------------------

    function finalizeTender(uint256 _tenderId) external onlyKeeper {
        Tender storage tender = tenders[_tenderId];
        require(
            tender.status == TenderStatus.Awarded || tender.status == TenderStatus.DisputeResolved,
            "Cannot finalize in current state"
        );
        require(block.timestamp > tender.appealDeadline, "Appeal window still open");

        tender.status = TenderStatus.Finalized;
        _creditRefunds(_tenderId);
        emit TenderFinalized(_tenderId);
    }

    function _creditRefunds(uint256 _tenderId) internal {
        Bid[] storage bids = tenderBids[_tenderId];
        for (uint256 i = 0; i < bids.length; i++) {
            // Non-rejected bids have their EMD credited for withdrawal (including winner)
            if (bids[i].status != BidStatus.Rejected && bids[i].emdDeposited > 0) {
                uint256 refund = bids[i].emdDeposited;
                bids[i].emdDeposited = 0; // Prevent duplicate refunds
                pendingWithdrawals[bids[i].vendorAddress] += refund;
            }
        }
    }

    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending withdrawal");

        pendingWithdrawals[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal transfer failed");

        emit Withdrawal(msg.sender, amount);
    }

    // -----------------------------------------------------------------------
    // VENDOR MANAGEMENT & GENERAL GETTERS
    // -----------------------------------------------------------------------

    function registerVendor(
        address _vendorAddress,
        bytes32 _gstinHash,
        bytes32 _panHash,
        string memory _kycIpfsHash
    ) external onlyAdmin {
        require(!registeredVendors[_vendorAddress], "Already registered");
        vendorKYC[_vendorAddress] = VendorKYC({
            gstinHash: _gstinHash,
            panHash: _panHash,
            kycIpfsHash: _kycIpfsHash,
            registeredAt: block.timestamp,
            isActive: true
        });
        registeredVendors[_vendorAddress] = true;
        emit VendorRegistered(_vendorAddress, _gstinHash, block.timestamp);
    }

    function getTenderBidsCount(uint256 _tenderId) external view returns (uint256) {
        return tenderBids[_tenderId].length;
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
