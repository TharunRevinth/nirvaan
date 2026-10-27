# NIRVAAN Project Screenshots Guide

This directory holds the sample screenshots for the NIRVAAN final project submission.
In accordance with repository configuration, image binaries (`*.png`, `*.jpg`) are ignored by git to keep the repository lightweight. When preparing the submission PDF or Word document, the student can save screenshots into this folder.

## List of 10 Required Screenshots

1. **`01_landing_page.png`** — Landing page and tender discovery browser (`https://nirvaan-flame.vercel.app/`), showing active tenders across oil PSUs (IOCL, BPCL, ONGC) and GIGW accessibility controls.
2. **`02_officer_login.png`** — PSU Officer authentication portal (`/officer/login`), showing credentials login and tenant selection.
3. **`03_tender_creation.png`** — Tender creation form (`/officer/create-tender`), showing fields for NIT code, category, display budget, EMD in ETH, submission/opening/reveal deadlines with local timezone indicators, and specification document upload.
4. **`04_vendor_kyc_application.png`** — Vendor onboarding portal (`/vendor/register`), showing company name, GSTIN, PAN, and the MetaMask wallet nonce signature challenge.
5. **`05_officer_kyc_approval.png`** — Officer vendor application review portal (`/officer/vendors`), showing pending applications with Approve and Reject actions.
6. **`06_sealed_bid_submission.png`** — Sealed bid submission interface (`/tenders/:id/bid`), showing EMD deposit prefilled from tender parameters, client-side random 32-byte salt generation, and the "Download Backup JSON" prompt.
7. **`07_bid_reveal_page.png`** — Commercial bid reveal interface (`/tenders/:id`), showing unsealing of salt and bid amount during the active reveal window.
8. **`08_bid_evaluation_page.png`** — Technical proposal scoring view (`/tenders/:id/evaluate`), showing opened bids, technical score inputs, and the "Lowest Qualified (L1)" badge.
9. **`09_award_custody_timeline.png`** — Award confirmation and dynamic chain-of-custody timeline (`/tenders/:id`), showing chronological milestones with verified transaction hashes and block numbers linked to Sepolia Etherscan.
10. **`10_etherscan_transaction.png`** — Public Etherscan transaction receipt (`https://sepolia.etherscan.io/tx/...`), verifying an on-chain event (such as `TenderCreated`, `BidSubmitted`, or `TenderAwarded`).
