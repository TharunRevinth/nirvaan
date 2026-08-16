// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title OilTenderingV1
 * @dev Permissioned Consortium E-Tendering System for Indian Oil PSUs.
 * Features: UUPS Proxy Upgradeability, Sealed Commit-Reveal Bid Encryption,
 * 7-Day Dispute Appeal Window, Oracle Keeper Auto-Finalization & Re-entrancy Safe Refunds.
 */
contract OilTenderingV1 is Initializable, UUPSUpgradeable {

    // -----------------------------------------------------------------------
    // ENUMS
    // -----------------------------------------------------------------------

    enum TenderStatus {
        Created,
        Active,
        Closed,
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
        string ipfsHashDoc;           // SHA-256 hash of tender doc on IPFS
        uint256 submissionDeadline;   // Unix timestamp
        uint256 openingTime;          // Unix timestamp
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
        bool isResolved;
        bool isUpheld;
        string cvcReasonIpfsHash;
        uint256 disputeBondDeposited; // Holds the exact refund amount
    }

    // -----------------------------------------------------------------------
    // STORAGE MAPPINGS
    // -----------------------------------------------------------------------

    mapping(uint256 => Tender) public tenders;
    mapping(uint256 => Bid[]) public tenderBids;
    mapping(address => bool) public registeredPSUs;
    mapping(address => bool) public registeredVendors;
    mapping(address => VendorKYC) public vendorKYC;
    mapping(uint256 => Dispute) public tenderDisputes;

    uint256 public tenderCounter;
    uint256 public bidCounter;

    address public keeperAddress;     // Whitelisted Keeper/Oracle wallet
    address public cvcAuditorAddress; // CVC read/resolve address
    address public multisigAdmin;     // Consortium multisig for upgrades

    // -----------------------------------------------------------------------
    // EVENTS (for Subgraph indexing)
    // -----------------------------------------------------------------------

    event TenderCreated(uint256 indexed tenderId, address indexed psu, uint256 deadline);
    event BidSubmitted(uint256 indexed tenderId, uint256 indexed bidId, address indexed vendor);
    event BidsOpened(uint256 indexed tenderId);
    event TenderAwarded(uint256 indexed tenderId, address indexed winner, uint256 amount);
    event DisputeFiled(uint256 indexed tenderId, address indexed challenger);
    event DisputeResolved(uint256 indexed tenderId, bool upheld);
    event TenderFinalized(uint256 indexed tenderId);
    event VendorRegistered(address indexed vendor, bytes32 gstinHash, uint256 timestamp);
    event PSURegistered(address indexed psu);

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
    // UUPS INITIALIZATION (Replaces Constructor)
    // -----------------------------------------------------------------------

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _multisigAdmin,
        address _keeperAddress,
        address _cvcAuditorAddress
    ) public initializer {
        multisigAdmin = _multisigAdmin;
        keeperAddress = _keeperAddress;
        cvcAuditorAddress = _cvcAuditorAddress;

        // Self-register the admin as initial PSU for bootstrapping
        registeredPSUs[_multisigAdmin] = true;
    }

    // -----------------------------------------------------------------------
    // ADMIN MANAGEMENT FUNCTIONS
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // CORE TENDERING FUNCTIONS
    // -----------------------------------------------------------------------

    function createTender(
        string memory _ipfsHash,
        uint256 _submissionDeadline,
        uint256 _openingTime,
        uint256 _minEMD
    ) external onlyPSU {
        require(_submissionDeadline > block.timestamp, "Deadline must be in the future");
        require(_openingTime >= _submissionDeadline, "Opening must be after deadline");

        tenderCounter++;
        tenders[tenderCounter] = Tender({
            id: tenderCounter,
            psuAddress: msg.sender,
            ipfsHashDoc: _ipfsHash,
            submissionDeadline: _submissionDeadline,
            openingTime: _openingTime,
            appealDeadline: 0, // Set later during award
            minEMDAmount: _minEMD,
            status: TenderStatus.Created,
            winner: address(0),
            winningBidId: 0,
            winningBidAmount: 0
        });

        emit TenderCreated(tenderCounter, msg.sender, _submissionDeadline);
    }

    function submitBid(
        uint256 _tenderId,
        string memory _encryptedBidIpfs,
        bytes32 _bidCommitment
    ) external payable onlyVendor {
        Tender storage tender = tenders[_tenderId];
        require(tender.id != 0, "Tender does not exist");
        require(block.timestamp < tender.submissionDeadline, "Submission period over");
        require(msg.value >= tender.minEMDAmount, "Insufficient EMD amount");

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
        require(_bidIndex < tenderBids[_tenderId].length, "Invalid bid index");

        Bid storage bid = tenderBids[_tenderId][_bidIndex];
        require(bid.vendorAddress == msg.sender, "Not your bid");

        bytes32 computedCommitment = keccak256(
            abi.encodePacked(msg.sender, _bidAmount, _salt, _tenderId)
        );
        require(computedCommitment == bid.bidCommitment, "Commitment mismatch -- tampering detected");

        bid.bidAmount = _bidAmount;
        bid.status = BidStatus.Opened;
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

        // Verify all bids in tender have been evaluated (no pending qualifications)
        Bid[] storage bids = tenderBids[_tenderId];
        for (uint256 i = 0; i < bids.length; i++) {
            require(bids[i].status == BidStatus.Opened, "Bids must be opened before award");
        }

        tender.winner = _winner;
        tender.winningBidId = _winningBidId;
        tender.winningBidAmount = _winningBidAmount;
        tender.status = TenderStatus.Awarded;
        
        // Start 7-day appeal window
        tender.appealDeadline = block.timestamp + 7 days;

        emit TenderAwarded(_tenderId, _winner, _winningBidAmount);
    }

    function disputeTender(
        uint256 _tenderId,
        string memory _reasonIpfsHash
    ) external payable onlyVendor {
        Tender storage tender = tenders[_tenderId];
        require(tender.status == TenderStatus.Awarded, "Tender not in Awarded state");
        require(msg.sender != tender.winner, "Winning vendor cannot dispute own award");
        require(block.timestamp <= tender.appealDeadline, "Appeal window has closed");
        require(msg.value >= 1 ether, "Dispute bond required"); // 1 base token bond

        tenderDisputes[_tenderId] = Dispute({
            tenderId: _tenderId,
            challenger: msg.sender,
            reasonIpfsHash: _reasonIpfsHash,
            filedAt: block.timestamp,
            isResolved: false,
            isUpheld: false,
            cvcReasonIpfsHash: "",
            disputeBondDeposited: msg.value
        });

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

        Dispute storage dispute = tenderDisputes[_tenderId];
        dispute.isResolved = true;
        dispute.isUpheld = _upheld;
        dispute.cvcReasonIpfsHash = _cvcReasonIpfsHash;

        uint256 refundAmount = dispute.disputeBondDeposited;
        dispute.disputeBondDeposited = 0; // Re-entrancy protection

        if (_upheld) {
            tender.status = TenderStatus.UnderEvaluation;
            payable(dispute.challenger).transfer(refundAmount);
        } else {
            tender.status = TenderStatus.DisputeResolved;
            payable(tender.psuAddress).transfer(refundAmount);
        }

        emit DisputeResolved(_tenderId, _upheld);
    }

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

    function finalizeTender(uint256 _tenderId) external onlyKeeper {
        Tender storage tender = tenders[_tenderId];
        require(tender.status == TenderStatus.Awarded || tender.status == TenderStatus.DisputeResolved, "Cannot finalize in current state");
        require(block.timestamp > tender.appealDeadline, "Appeal window still open");

        tender.status = TenderStatus.Finalized;
        _refundLosingBidders(_tenderId);
        emit TenderFinalized(_tenderId);
    }

    function _refundLosingBidders(uint256 _tenderId) internal {
        Bid[] storage bids = tenderBids[_tenderId];
        Tender storage tender = tenders[_tenderId];
        for (uint256 i = 0; i < bids.length; i++) {
            if (bids[i].vendorAddress != tender.winner && bids[i].emdDeposited > 0) {
                uint256 refund = bids[i].emdDeposited;
                bids[i].emdDeposited = 0; // Prevent re-entrancy
                payable(bids[i].vendorAddress).transfer(refund);
            }
        }
    }

    function getTenderBidsCount(uint256 _tenderId) external view returns (uint256) {
        return tenderBids[_tenderId].length;
    }

    function _authorizeUpgrade(address) internal override onlyAdmin {}
}
