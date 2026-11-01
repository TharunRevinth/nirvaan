# NIRVAAN Submission: Manual Screenshot Capture Guide

This guide details the exact steps for capturing the remaining screenshots required for Section 11 of the final course submission.

Because the repository configuration ignores image binary files (`*.png`), screenshots captured locally will not clutter the git tree but are bundled into the Word (`.docx`) and PDF (`.pdf`) submission documents.

---

## Captured Live via Headless Browser (Included)
The following screens have already been captured from the live deployment and included:
1. `01_landing_page.png` (Live URL: https://nirvaan-flame.vercel.app/)
2. `02_officer_login.png` (Live URL: https://nirvaan-flame.vercel.app/officer/login)
3. `04_vendor_kyc_application.png` (Live URL: https://nirvaan-flame.vercel.app/vendor/register)
4. `10_etherscan_transaction.png` (Sepolia Etherscan: https://sepolia.etherscan.io/address/0xe9649E82dC4fEdf86dFbE5120a3fE79BDde88663)
5. `11_backend_health.png` (Live URL: https://nirvaan-backend-84fc.onrender.com/api/health)

---

## Remaining Interactive Screens (To Capture with MetaMask)

For the screens below, open your browser with MetaMask installed, navigate to the indicated URL, and save the window screenshot with the specified filename into `docs/screenshots/`:

### 1. `03_tender_creation.png`
- **URL:** `https://nirvaan-flame.vercel.app/officer/create-tender` (or `http://localhost:5173/officer/create-tender`)
- **Action:** Log in as an officer, fill out the NIT code, title, INR budget, EMD (ETH), deadlines, and attach a specification document. Capture the completed form before submission.

### 2. `05_officer_kyc_approval.png`
- **URL:** `https://nirvaan-flame.vercel.app/officer/vendors` (or `http://localhost:5173/officer/vendors`)
- **Action:** In the officer portal, navigate to the Vendor Applications table showing pending submissions with the "Approve" button visible.

### 3. `06_sealed_bid_submission.png`
- **URL:** `https://nirvaan-flame.vercel.app/tenders/1/bid`
- **Action:** As a registered vendor with MetaMask connected, open the tender bid submission form. Show the prefilled EMD amount, the generated 32-byte salt, and the "Download Backup JSON" button with the MetaMask confirmation prompt.

### 4. `07_bid_reveal_page.png`
- **URL:** `https://nirvaan-flame.vercel.app/tenders/1`
- **Action:** During the active reveal window, open the bid reveal modal showing the entered secret salt and revealed bid quote amount.

### 5. `08_bid_evaluation_page.png`
- **URL:** `https://nirvaan-flame.vercel.app/tenders/1/evaluate`
- **Action:** As an officer, open the technical evaluation page displaying the opened bids, technical scores, and the highlighted "Lowest Qualified (L1)" badge.

### 6. `09_award_custody_timeline.png`
- **URL:** `https://nirvaan-flame.vercel.app/tenders/1`
- **Action:** In the tender detail page, scroll down to the "Chain of Custody" timeline showing the real transaction hashes, block numbers, and Etherscan links for tender creation, opening, reveal, and award.

---
Once captured, place these images into `docs/screenshots/` and re-run the build script (`python3 docs/submission/build_submission.py`) to re-generate the final submission DOCX and PDF with all 11 real screenshots embedded!
