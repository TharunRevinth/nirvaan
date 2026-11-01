import os
import sys
import subprocess
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls

print("Starting build_submission.py...")

DOCX_OUT = "/home/cybernode/Projects/nirvaan/docs/NIRVAAN_Submission.docx"
PDF_OUT = "/home/cybernode/Projects/nirvaan/docs/NIRVAAN_Submission.pdf"
DIAGRAMS_DIR = "/home/cybernode/Projects/nirvaan/docs/submission/diagrams"
SCREENSHOTS_DIR = "/home/cybernode/Projects/nirvaan/docs/screenshots"

doc = docx.Document()

# -------------------------------------------------------------
# Page Setup: A4, 1-inch margins
# -------------------------------------------------------------
for section in doc.sections:
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)

# Configure Default Normal Style: Times New Roman 12 pt, 1.35 line spacing, Justified
style_normal = doc.styles['Normal']
font = style_normal.font
font.name = 'Times New Roman'
font.size = Pt(12)
font.color.rgb = RGBColor(0x11, 0x11, 0x11)
style_normal.paragraph_format.line_spacing = 1.35
style_normal.paragraph_format.space_after = Pt(4)
style_normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

# Custom Helpers
def set_cell_shading(cell, color_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=60, bottom=60, left=100, right=100):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_hyperlink(paragraph, url, text, color='0468D7', underline=True):
    part = paragraph.part
    r_id = part.relate_to(url, docx.opc.constants.RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
    hyperlink = OxmlElement('w:hyperlink')
    hyperlink.set(qn('r:id'), r_id)
    new_run = OxmlElement('w:r')
    rPr = OxmlElement('w:rPr')
    if color:
        c = OxmlElement('w:color')
        c.set(qn('w:val'), color)
        rPr.append(c)
    if underline:
        u = OxmlElement('w:u')
        u.set(qn('w:val'), 'single')
        rPr.append(u)
    new_run.append(rPr)
    new_run_text = OxmlElement('w:t')
    new_run_text.text = text
    new_run.append(new_run_text)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)

def add_heading_1(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(14)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x0B, 0x1A, 0x30)
    return p

def add_heading_2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x0F, 0x29, 0x4A)
    return p

def add_heading_3(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.italic = True
    run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)
    return p

def add_body_p(text):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.35
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(12)
    return p

def add_bullet_p(bold_prefix, text):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.line_spacing = 1.35
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r1 = p.add_run(bold_prefix)
    r1.font.name = 'Times New Roman'
    r1.font.size = Pt(12)
    r1.font.bold = True
    r2 = p.add_run(text)
    r2.font.name = 'Times New Roman'
    r2.font.size = Pt(12)
    return p

def add_code_block(code_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_shading(cell, "F3F4F6")
    set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
    cell.width = Inches(6.27)
    p = cell.paragraphs[0]
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(code_text)
    run.font.name = 'Courier New'
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    # Add spacing after table
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_after = Pt(3)

def add_callout(quote_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_shading(cell, "F0F9FF")
    set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
    cell.width = Inches(6.27)
    # Blue left border
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(f'<w:tcBorders {nsdecls("w")}><w:left w:val="single" w:sz="24" w:space="0" w:color="0284C7"/><w:top w:val="none"/><w:right w:val="none"/><w:bottom w:val="none"/></w:tcBorders>')
    tcPr.append(tcBorders)
    p = cell.paragraphs[0]
    p.paragraph_format.line_spacing = 1.25
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(quote_text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(11)
    run.font.italic = True
    run.font.color.rgb = RGBColor(0x0C, 0x4A, 0x6E)
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_after = Pt(3)

def add_figure_image(image_path, caption_text, width_inches=3.4):
    if os.path.exists(image_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(3)
        p_img.paragraph_format.space_after = Pt(1)
        p_img.paragraph_format.keep_with_next = True
        run = p_img.add_run()
        run.add_picture(image_path, width=Inches(width_inches))
        
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(1)
        p_cap.paragraph_format.space_after = Pt(3)
        run_cap = p_cap.add_run(caption_text)
        run_cap.font.name = 'Times New Roman'
        run_cap.font.size = Pt(10)
        run_cap.font.bold = True
        run_cap.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    else:
        # Placeholder box
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        set_cell_shading(cell, "F8FAFC")
        set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
        cell.width = Inches(width_inches)
        tcPr = cell._tc.get_or_add_tcPr()
        tcBorders = parse_xml(f'<w:tcBorders {nsdecls("w")}><w:left w:val="dashed" w:sz="12" w:space="0" w:color="94A3B8"/><w:top w:val="dashed" w:sz="12" w:space="0" w:color="94A3B8"/><w:right w:val="dashed" w:sz="12" w:space="0" w:color="94A3B8"/><w:bottom w:val="dashed" w:sz="12" w:space="0" w:color="94A3B8"/></w:tcBorders>')
        tcPr.append(tcBorders)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r1 = p.add_run(f"[{caption_text.upper()}]\n")
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(10.5)
        r1.font.bold = True
        r2 = p.add_run("Screenshot file pending local capture. Refer to docs/screenshots/MANUAL_CAPTURE.md for reproduction steps.")
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(9.5)
        r2.font.italic = True
        
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(1)
        p_cap.paragraph_format.space_after = Pt(3)
        run_cap = p_cap.add_run(caption_text)
        run_cap.font.name = 'Times New Roman'
        run_cap.font.size = Pt(10)
        run_cap.font.bold = True

def add_table_title(table_title_text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(table_title_text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(11)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    return p

print("Helper functions initialized.")

# =============================================================
# TITLE PAGE (Section 0)
# =============================================================
section_title = doc.sections[0]
section_title.header.is_linked_to_previous = False
section_title.footer.is_linked_to_previous = False
# Ensure no header/footer on title page
section_title.header.paragraphs[0].text = ""
section_title.footer.paragraphs[0].text = ""

# Title spacing
p_tspace = doc.add_paragraph()
p_tspace.paragraph_format.space_before = Pt(40)

p_main_title = doc.add_paragraph()
p_main_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_main_title.paragraph_format.space_after = Pt(12)
run_title = p_main_title.add_run("NIRVAAN: A BLOCKCHAIN-BASED E-TENDERING PLATFORM FOR OIL PSUS")
run_title.font.name = 'Times New Roman'
run_title.font.size = Pt(18)
run_title.font.bold = True
run_title.font.color.rgb = RGBColor(0x0B, 0x1A, 0x30)

p_sub_title = doc.add_paragraph()
p_sub_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_sub_title.paragraph_format.space_after = Pt(36)
run_sub = p_sub_title.add_run("A Capstone Course Project Report Submitted for BACSE350\nBlockchain Architecture and Design")
run_sub.font.name = 'Times New Roman'
run_sub.font.size = Pt(13)
run_sub.font.bold = True
run_sub.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

p_student_block = doc.add_paragraph()
p_student_block.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_student_block.paragraph_format.space_after = Pt(30)
r = p_student_block.add_run("Submitted by:\n")
r.font.size = Pt(11)
r.font.italic = True
r = p_student_block.add_run("THARUN REVINTH V S\n")
r.font.size = Pt(14)
r.font.bold = True
r = p_student_block.add_run("Registration Number: 25BCE5268\n(Individual Project)")
r.font.size = Pt(12)
r.font.bold = True

p_guide_block = doc.add_paragraph()
p_guide_block.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_guide_block.paragraph_format.space_after = Pt(36)
r = p_guide_block.add_run("Under the Guidance of:\n")
r.font.size = Pt(11)
r.font.italic = True
r = p_guide_block.add_run("Malathi G\n")
r.font.size = Pt(13)
r.font.bold = True
r = p_guide_block.add_run("Course Faculty, BACSE350")
r.font.size = Pt(11)

p_inst_block = doc.add_paragraph()
p_inst_block.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_inst_block.paragraph_format.space_after = Pt(10)
r = p_inst_block.add_run("[INSTITUTION NAME - STUDENT TO FILL]\n")
r.font.size = Pt(12)
r.font.bold = True
r.font.color.rgb = RGBColor(0xDC, 0x26, 0x26) # Red highlight for fill-in
r = p_inst_block.add_run("October 2026\nSubmission Due: 29 October 2026, 11:59 PM")
r.font.size = Pt(11)
r.font.color.rgb = RGBColor(0x47, 0x55, 0x69)

# Break to Front Matter
doc.add_page_break()

# -------------------------------------------------------------
# FRONT MATTER SECTION (Section 1)
# -------------------------------------------------------------
# Add new section so header/footer are enabled with page numbering
sec_body = doc.add_section(docx.enum.section.WD_SECTION.NEW_PAGE)
sec_body.header.is_linked_to_previous = False
sec_body.footer.is_linked_to_previous = False

# Header
p_head = sec_body.header.paragraphs[0]
p_head.text = "NIRVAAN - Blockchain Architecture and Design (BACSE350)"
p_head.alignment = WD_ALIGN_PARAGRAPH.RIGHT
p_head.style.font.name = "Times New Roman"
p_head.style.font.size = Pt(8.5)
p_head.style.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

# Footer: Page number centred
p_foot = sec_body.footer.paragraphs[0]
p_foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_foot.style.font.name = "Times New Roman"
p_foot.style.font.size = Pt(10)
fld1 = OxmlElement('w:fldChar'); fld1.set(qn('w:fldCharType'), 'begin')
instr = OxmlElement('w:instrText'); instr.set(qn('xml:space'), 'preserve'); instr.text = "PAGE"
fld2 = OxmlElement('w:fldChar'); fld2.set(qn('w:fldCharType'), 'separate')
fld3 = OxmlElement('w:fldChar'); fld3.set(qn('w:fldCharType'), 'end')
r_foot = p_foot.add_run()._r
r_foot.append(fld1); r_foot.append(instr); r_foot.append(fld2); r_foot.append(fld3)

print("Title page and header/footer configured.")

# ABSTRACT
add_heading_1("ABSTRACT")
add_body_p(
    "Public procurement across India's strategic hydrocarbon sector involves capital acquisitions valued in billions "
    "of rupees, executed by state-owned Public Sector Undertakings (PSUs) including IOCL, BPCL, HPCL, ONGC, and GAIL. "
    "Despite modernization through centralized electronic procurement portals such as the Central Public Procurement Portal "
    "(CPPP) and Government e-Marketplace (GeM), centralized architectures remain vulnerable to premature commercial bid leakage, "
    "unauthorized database tampering, subjective technical disqualification, bidder cartels, and protracted Earnest Money "
    "Deposit (EMD) refund lockups. In this project, I designed, implemented, and empirically verified NIRVAAN, an open, "
    "decentralized e-tendering platform engineered to enforce cryptographic fairness, transparency, and statutory procurement "
    "invariants without relying on a central authority. NIRVAAN utilizes a Solidity 0.8.24 smart contract architecture deployed "
    "behind an ERC1967Proxy using the Universal Upgradeable Proxy Standard (UUPS). The core protocol integrates: (1) a non-interactive "
    "commit-reveal cryptographic bidding scheme using keccak256 with client-side 32-byte salts; (2) automated on-chain enforcement "
    "of the Lowest Evaluated Responsive Bidder (L1) award rule; (3) a non-custodial pull-payment escrow for instant EMD capital "
    "withdrawals; (4) a statutory 7-day post-award standstill appeal window with independent Central Vigilance Commission (CVC) "
    "arbitration and an automated 14-day inactivity timeout; and (5) an autonomous keeper service that executes scheduled state transitions. "
    "I deployed the complete stack on the Ethereum Sepolia testnet, Render, Vercel, and Pinata IPFS. Across 13 Hardhat contract unit tests, "
    "24 Express backend integration tests, and 36 end-to-end smoke test checkpoints, the system achieved a 100% pass rate (73/73 tests)."
)

p_kw = doc.add_paragraph()
r = p_kw.add_run("Keywords: ")
r.font.bold = True
p_kw.add_run("Public Procurement, Smart Contracts, Commit-Reveal Scheme, L1 Tender Enforcement, UUPS Proxy, Earnest Money Deposit, Central Vigilance Commission.")

doc.add_page_break()

# TABLE OF CONTENTS
add_heading_1("TABLE OF CONTENTS")
p_toc = doc.add_paragraph()
r_toc = p_toc.add_run()._r
fld1 = OxmlElement('w:fldChar'); fld1.set(qn('w:fldCharType'), 'begin')
instr = OxmlElement('w:instrText'); instr.set(qn('xml:space'), 'preserve'); instr.text = r'TOC \o "1-3" \h \z \u'
fld2 = OxmlElement('w:fldChar'); fld2.set(qn('w:fldCharType'), 'separate')
fld3 = OxmlElement('w:fldChar'); fld3.set(qn('w:fldCharType'), 'end')
r_toc.append(fld1); r_toc.append(instr); r_toc.append(fld2); r_toc.append(fld3)


# LIST OF FIGURES
add_heading_1("LIST OF FIGURES")
figures_list = [
    ("Figure 1", "Comprehensive Multi-Tier System Architecture of NIRVAAN", "Section 9"),
    ("Figure 2", "Tender Lifecycle Finite State Machine Model", "Section 9"),
    ("Figure 3", "End-to-End Bid Lifecycle Sequence Model", "Section 9"),
    ("Figure 4", "Data Partitioning and Entity-Relationship Model (On-Chain, SQLite, IPFS)", "Section 9"),
    ("Figure 5", "Public Tender Browse and Discovery Dashboard", "Section 11"),
    ("Figure 6", "PSU Officer Authentication Portal", "Section 11"),
    ("Figure 7", "Notice Inviting Tender (NIT) Creation Interface", "Section 11"),
    ("Figure 8", "Vendor KYC Onboarding Application Interface", "Section 11"),
    ("Figure 9", "Officer Vendor Verification and On-Chain Approval Portal", "Section 11"),
    ("Figure 10", "Sealed Commercial Bid Submission with Client-Side Salt Generation", "Section 11"),
    ("Figure 11", "Commercial Bid Reveal Interface", "Section 11"),
    ("Figure 12", "Technical Proposal Evaluation and L1 Identification View", "Section 11"),
    ("Figure 13", "Contract Award and Immutable Custody Timeline", "Section 11"),
    ("Figure 14", "Sepolia Etherscan Block Explorer Transaction Verification Receipt", "Section 11"),
    ("Figure 15", "Backend Microservice Runtime Health and Indexer Diagnostics View", "Section 11")
]
for f_num, f_desc, f_sec in figures_list:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    r = p.add_run(f"{f_num}: ")
    r.font.bold = True
    p.add_run(f"{f_desc} ({f_sec})")


# LIST OF TABLES
add_heading_1("LIST OF TABLES")
tables_list = [
    ("Table 1", "Project Stakeholders, Core Responsibilities, and Authentication Vectors", "Section 3"),
    ("Table 2", "Comparison of Traditional Centralized Database vs. NIRVAAN Blockchain Architecture", "Section 4"),
    ("Table 3", "Direct Mapping of Procurement Problems to Blockchain Properties and NIRVAAN Implementation", "Section 4"),
    ("Table 4", "Software Stack, Versioning, and Architectural Purpose Across NIRVAAN", "Section 7"),
    ("Table 5", "Complete Smart Contract Public and External Function Reference (OilTenderingV1.sol)", "Section 10"),
    ("Table 6", "Empirically Measured Smart Contract Gas Consumption Profile on Hardhat EVM", "Section 10"),
    ("Table 7", "Automated Multi-Tier Verification and Test Suite Execution Summary", "Section 12")
]
for t_num, t_desc, t_sec in tables_list:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    r = p.add_run(f"{t_num}: ")
    r.font.bold = True
    p.add_run(f"{t_desc} ({t_sec})")


# LIST OF ABBREVIATIONS
add_heading_1("LIST OF ABBREVIATIONS")
abbrev_list = [
    ("API", "Application Programming Interface"),
    ("BPCL", "Bharat Petroleum Corporation Limited"),
    ("CID", "Content Identifier (InterPlanetary File System)"),
    ("CPPP", "Central Public Procurement Portal"),
    ("CVC", "Central Vigilance Commission (Government of India)"),
    ("DBA", "Database Administrator"),
    ("EIP", "Ethereum Improvement Proposal"),
    ("EMD", "Earnest Money Deposit"),
    ("EPC", "Engineering, Procurement, and Construction"),
    ("ERC", "Ethereum Request for Comments"),
    ("EVM", "Ethereum Virtual Machine"),
    ("GAIL", "Gas Authority of India Limited"),
    ("GeM", "Government e-Marketplace"),
    ("GFR", "General Financial Rules, 2017"),
    ("GIGW", "Guidelines for Indian Government Websites"),
    ("GSTIN", "Goods and Services Tax Identification Number"),
    ("HPCL", "Hindustan Petroleum Corporation Limited"),
    ("HSM", "Hardware Security Module"),
    ("IOCL", "Indian Oil Corporation Limited"),
    ("IPFS", "InterPlanetary File System"),
    ("JWT", "JSON Web Token"),
    ("KYC", "Know Your Customer"),
    ("L1", "Lowest Evaluated Responsive Bidder"),
    ("MoPNG", "Ministry of Petroleum and Natural Gas"),
    ("MSME", "Micro, Small, and Medium Enterprises"),
    ("NIT", "Notice Inviting Tender"),
    ("ONGC", "Oil and Natural Gas Corporation"),
    ("PAN", "Permanent Account Number"),
    ("PKI", "Public Key Infrastructure"),
    ("PoS", "Proof of Stake"),
    ("PSU", "Public Sector Undertaking"),
    ("QBFT", "Quorum Byzantine Fault Tolerant"),
    ("RDBMS", "Relational Database Management System"),
    ("RPC", "Remote Procedure Call"),
    ("SHA", "Secure Hash Algorithm"),
    ("SPA", "Single Page Application"),
    ("UUPS", "Universal Upgradeable Proxy Standard (ERC-1822)")
]
for a_abbr, a_full in abbrev_list:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    r = p.add_run(f"{a_abbr}: ")
    r.font.bold = True
    p.add_run(a_full)

doc.add_page_break()
print("Front matter generated.")

# Save checkpoint
doc.save(DOCX_OUT)
print("Saved checkpoint DOCX.")

# =============================================================
# SECTION 1: PROJECT TITLE
# =============================================================
add_heading_1("1. Project Title")
add_body_p("NIRVAAN: A Blockchain-Based E-Tendering Platform for Oil PSUs")
add_bullet_p("Course Code: ", "BACSE350")
add_bullet_p("Course Name: ", "Blockchain Architecture and Design")
add_bullet_p("Course Faculty: ", "Malathi G")
add_bullet_p("Submission Due Date: ", "29 October 2026, 11:59 PM")
add_bullet_p("Report Compilation Date: ", "October 2026")

# =============================================================
# SECTION 2: TEAM MEMBERS WITH NAME AND REGISTRATION NUMBER
# =============================================================
add_heading_1("2. Team Members with Name and Registration Number")
add_body_p(
    "This project is an individual capstone project executed solely by me. All architectural design, "
    "smart contract engineering, full-stack web development, automated test authoring, cloud deployment, "
    "and documentation were performed independently by me."
)

tbl_team = doc.add_table(rows=2, cols=3)
tbl_team.alignment = WD_TABLE_ALIGNMENT.CENTER
for r_idx, row in enumerate(tbl_team.rows):
    for c_idx, cell in enumerate(row.cells):
        set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
        p = cell.paragraphs[0]
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(0)
        if r_idx == 0:
            set_cell_shading(cell, "0B1A30")
        else:
            set_cell_shading(cell, "F8FAFC" if c_idx % 2 == 0 else "FFFFFF")

headers_team = ["Student Name", "Registration Number", "Project Contribution & Scope"]
for i, h in enumerate(headers_team):
    cell = tbl_team.cell(0, i)
    p = cell.paragraphs[0]
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(10.5)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

data_team = [
    "Tharun Revinth V S",
    "25BCE5268",
    "Individual project; all work done by me (smart contracts design, UUPS proxy deployment, Express backend relay, event indexer, keeper bot, React frontend, Hardhat/backend/smoke testing, cloud deployment, and academic report authoring)."
]
for i, d in enumerate(data_team):
    cell = tbl_team.cell(1, i)
    p = cell.paragraphs[0]
    r = p.add_run(d)
    r.font.name = "Times New Roman"
    r.font.size = Pt(10)
    if i < 2:
        r.font.bold = True

p_space = doc.add_paragraph()
p_space.paragraph_format.space_after = Pt(4)

# =============================================================
# SECTION 3: PROBLEM DEFINITION
# =============================================================
add_heading_1("3. Problem Definition")
add_body_p(
    "Public procurement across India's state-owned hydrocarbon Public Sector Undertakings (PSUs)—operating under "
    "the administrative supervision of the Ministry of Petroleum and Natural Gas (MoPNG), including Indian Oil "
    "Corporation Limited (IOCL), Bharat Petroleum Corporation Limited (BPCL), Hindustan Petroleum Corporation Limited "
    "(HPCL), Oil and Natural Gas Corporation (ONGC), and Gas Authority of India Limited (GAIL)—involves large-scale, "
    "high-value capital acquisitions. These procurements encompass critical energy infrastructure, such as specialized "
    "refinery cracking units, subsea pipelines, offshore exploration platforms, automated telemetry, and cryogenic storage."
)
add_body_p(
    "In public administration, these procurement exercises are governed by statutory mandates laid out in the General "
    "Financial Rules (GFR 2017) and guidelines formulated by the Central Vigilance Commission (CVC). A foundational "
    "requirement of these rules is the 'Lowest Evaluated Responsive Bidder (L1)' principle, which mandates that contracts "
    "must be awarded strictly to the lowest commercial quote among technically qualified suppliers."
)
add_body_p(
    "To transition away from paper tender boxes, government agencies adopted electronic procurement systems, primarily "
    "the Central Public Procurement Portal (CPPP) and Government e-Marketplace (GeM). While these platforms replaced physical "
    "envelopes with digital uploads, their underlying architecture remains fundamentally centralized. All tender notices, "
    "commercial quotes, technical scores, officer decisions, and system logs reside in relational database management systems "
    "(RDBMS) controlled by a single contracting authority. In my research and problem analysis, I identified several critical "
    "vulnerabilities inherent in this centralized paradigm:"
)

add_bullet_p("1. Premature Commercial Bid Leakage: ", 
    "In competitive bidding, commercial secrecy prior to public opening is essential. In centralized systems, financial proposals "
    "are uploaded to a central server. Even when encrypted with server-side keys, privileged database administrators (DBAs) or "
    "insiders holding key management service (KMS) access can decrypt quotes prior to the scheduled opening date. Insiders can "
    "leak quotation figures to favored vendors, who then adjust their bids to undercut honest competitors by fractional margins.")

add_bullet_p("2. Bid Tampering and Retroactive Alterations: ", 
    "Standard relational databases operate on mutable SQL primitives (UPDATE, DELETE). A privileged insider with administrative "
    "write permissions can modify commercial proposal figures, alter recorded submission timestamps, or swap technical document "
    "attachments without generating an unalterable external audit trail.")

add_bullet_p("3. Weak and Scrubbable Audit Trails: ", 
    "Centralized application logs and database audit triggers reside on the same infrastructure as the host. Corrupt administrators "
    "can disable audit triggers, scrub server logs, or delete historical access records, concealing evidence of collusion or tampering.")

add_bullet_p("4. Vendor Collusion and Cartel Formation: ", 
    "In specialized engineering procurements where only a small number of qualified domestic vendors exist, suppliers often form "
    "informal bidding cartels. They submit artificially inflated prices while rotating winning bids across successive tenders. Centralized "
    "systems lack transparent, cross-PSU historical registries to detect and analyze coordinated bidding behaviors.")

add_bullet_p("5. Subjective Technical Disqualification and Arbitrary Awards: ", 
    "Procurement officers evaluate technical proposals prior to opening commercial envelopes. In centralized systems, biased officers "
    "can assign subjective low marks (e.g., rating an experienced bidder 68/100 against a 70/100 cutoff) to disqualify lower-priced "
    "competitors, subsequently awarding the contract to a favored higher-priced contractor (L2 or L3). Centralized portals lack on-chain "
    "mechanisms linking technical scoring to commercial award rules.")

add_bullet_p("6. Protracted Earnest Money Deposit (EMD) Refund Latency: ", 
    "Under GFR 2017 Rule 170, participating bidders must furnish an Earnest Money Deposit (EMD)—typically 1% to 5% of the estimated "
    "tender value—as bid security. In high-value tenders, hundreds of thousands of dollars remain locked across ongoing bids. In "
    "centralized portals, returning EMD funds to unsuccessful bidders requires manual administrative processing, finance clearances, "
    "and bank transfers. Unsuccessful vendors frequently face delays of 3 to 12 months, creating severe working capital constraints.")

add_bullet_p("7. Over-Trust in a Single Administrative Custodian: ", 
    "The fundamental flaw of centralized e-tendering is that all external market participants must place absolute trust in the single "
    "organization that issues the tender, evaluates the proposals, and holds the funds. When a dispute occurs, suppliers are forced "
    "to appeal to the very entity accused of bias or enter protracted court litigation.")

add_heading_2("Stakeholders")
add_body_p(
    "In modeling the NIRVAAN ecosystem, I identified five primary classes of stakeholders whose interactions are governed "
    "by the platform, as summarized in Table 1."
)

add_table_title("Table 1: Project Stakeholders, Core Responsibilities, and Authentication Vectors")
tbl_s = doc.add_table(rows=6, cols=3)
tbl_s.alignment = WD_TABLE_ALIGNMENT.CENTER
for r_idx, row in enumerate(tbl_s.rows):
    for c_idx, cell in enumerate(row.cells):
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        p = cell.paragraphs[0]
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(0)
        if r_idx == 0:
            set_cell_shading(cell, "0B1A30")
        else:
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")

headers_s = ["Stakeholder Class", "Authentication Vector", "Core System Responsibilities"]
for i, h in enumerate(headers_s):
    cell = tbl_s.cell(0, i)
    p = cell.paragraphs[0]
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(10)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

data_s = [
    ("PSU Procurement Officer", "Bcrypt Password + JWT Session (Strict PSU Tenancy Guard)", "Publishes tender notices (NIT), defines submission/opening/reveal deadlines, reviews vendor onboarding applications, records technical qualification scores, and triggers contract awards via backend gas relays."),
    ("Commercial Vendor", "MetaMask Web3 Wallet (secp256k1 Keypair / EIP-1193)", "Submits KYC application with cryptographic challenge nonce signatures, commits sealed bids with client-side salts and EMD deposits, reveals quotes during the reveal window, lodges formal standstill grievances, and withdraws refunded EMDs."),
    ("CVC Vigilance Auditor", "Designated Auditor Role / Authorized Ethereum Address", "Monitors custody audit timelines, reviews grievance documentation pinned to IPFS, and formally adjudicates disputed awards (upholding or dismissing challenges on-chain)."),
    ("Autonomous Keeper", "Dedicated Backend Signer Wallet (Automated Daemon)", "Continuously polls blockchain timestamps to execute scheduled state transitions (opening bids past submission deadline, and finalizing tenders past the 7-day standstill) without human discretion."),
    ("Consortium / Multisig Admin", "Multisig Contract / Governance Deployer Address", "Authorizes UUPS implementation logic upgrades, registers new PSU tenant accounts, and configures protocol constants (dispute bond amount, default minimum EMD).")
]
for r_idx, row_data in enumerate(data_s, 1):
    for c_idx, val in enumerate(row_data):
        cell = tbl_s.cell(r_idx, c_idx)
        p = cell.paragraphs[0]
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(8.5)
        if c_idx == 0:
            r.font.bold = True

p_space = doc.add_paragraph()
p_space.paragraph_format.space_after = Pt(4)

add_heading_2("Project Objectives")
add_body_p("I established five specific engineering objectives for my project:")
add_bullet_p("1. Cryptographic Bid Secrecy: ", "Implement a non-interactive commit-reveal bidding scheme that mathematically guarantees commercial bid amounts cannot be decrypted or leaked prior to the submission deadline.")
add_bullet_p("2. On-Chain L1 Enforcement: ", "Encode the statutory L1 award rule directly into smart contract bytecode, prohibiting any officer from awarding a tender to any contractor other than the lowest responsive, technically qualified bidder.")
add_bullet_p("3. Automated EMD Escrow: ", "Implement a non-custodial pull-payment escrow mechanism ensuring unsuccessful bidders can immediately withdraw their EMD balances upon tender finalization without administrative delays.")
add_bullet_p("4. Statutory Standstill & Dispute Redressal: ", "Encode a mandatory 7-day post-award standstill appeal window with independent CVC arbitration and an automated 14-day inactivity timeout to prevent administrative deadlocks.")
add_bullet_p("5. Full-Stack Working Prototype: ", "Deploy an integrated prototype consisting of an upgradeable Solidity smart contract on Ethereum Sepolia, an Express backend with an adaptive event indexer, a reconstructable SQLite database, decentralized IPFS storage, and a GIGW-compliant React frontend.")

add_heading_2("Scope and Out-of-Scope")
add_body_p(
    "The scope of my implementation encompasses the full tender lifecycle: vendor KYC application and officer verification; "
    "tender notice creation with specification hashing; sealed bid commitment with client-side 32-byte salt generation; keeper-driven "
    "bid opening; cryptographic bid reveal; technical scoring via authenticated backend gas relays; on-chain L1 award verification; "
    "standstill dispute filing and CVC resolution; and pull-payment EMD withdrawals."
)
add_body_p(
    "Specific items explicitly out-of-scope for this prototype include: integration with real Indian fiat banking gateways (NEFT/RTGS/Treasury "
    "Single Account; all deposits are executed using Sepolia ETH); zero-knowledge proof generation (e.g., zk-SNARKs) for private technical "
    "scoring calculations; and retail catalog procurement for standardized consumables (which is adequately served by GeM)."
)

print("Section 1-3 built.")
doc.save(DOCX_OUT)

# =============================================================
# SECTION 4: NEED FOR BLOCKCHAIN
# =============================================================
add_heading_1("4. Need for Blockchain")
add_body_p(
    "A central research question in decentralized systems design is whether a distributed ledger is strictly necessary "
    "or whether a traditional relational database equipped with cryptographic extensions would suffice. In evaluating "
    "this requirement, I applied the established decision framework formulated by Karl Wüst and Arthur Gervais in their "
    "seminal work, 'Do you need a Blockchain?' (2018) [5]."
)
add_body_p(
    "In the context of public procurement across competing oil PSUs and hundreds of commercial suppliers:"
)
add_bullet_p("1. Shared State: ", "The system must maintain state across multiple parties (tender notices, vendor accreditations, bid commitments, technical scores, escrow balances).")
add_bullet_p("2. Multiple Mutually Distrusting Writers: ", "Multiple competing PSUs (IOCL, BPCL, ONGC), competing industrial suppliers, CVC auditors, and automation bots must write state. These entities operate in an economic game and do not trust one another.")
add_bullet_p("3. Absence of a Perpetually Trustworthy Third Party: ", "Centralized database administrators and single procurement committees have historically faced conflicts of interest, corruption allegations, and administrative pressure. Trust cannot be placed in a single party when large financial sums are at stake.")
add_bullet_p("4. Known Writers: ", "In public procurement, anonymous participation is prohibited by law. Every vendor must undergo rigorous KYC onboarding (validating GSTIN and PAN). Every procurement officer is identified by institutional identity.")
add_bullet_p("5. Public Verifiability: ", "Under statutory public procurement law, the expenditure of public capital requires transparent verifiability by regulatory bodies (CAG, CVC) and participating suppliers.")

add_body_p(
    "According to the Wüst-Gervais methodology, when a system requires shared state, multiple known but mutually distrusting writers, "
    "public verifiability, and lacks a perpetually trustworthy third party, the required architecture is a permissioned distributed ledger."
)

add_body_p(
    "A traditional database is fundamentally insufficient for this use case because database operations operate on absolute administrative trust. "
    "A database administrator with root privileges can execute direct SQL queries to decrypt confidential tables, backdate timestamps, alter "
    "recorded bids, or wipe audit logs. Table 2 contrasts a traditional centralized database with my NIRVAAN architecture."
)

add_table_title("Table 2: Comparison of Traditional Centralized Database vs. NIRVAAN Blockchain Architecture")
tbl_db = doc.add_table(rows=8, cols=3)
tbl_db.alignment = WD_TABLE_ALIGNMENT.CENTER
for r_idx, row in enumerate(tbl_db.rows):
    for c_idx, cell in enumerate(row.cells):
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        p = cell.paragraphs[0]
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(0)
        if r_idx == 0:
            set_cell_shading(cell, "0B1A30")
        else:
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")

headers_db = ["Architectural Dimension", "Traditional Centralized Database", "NIRVAAN Blockchain Architecture"]
for i, h in enumerate(headers_db):
    cell = tbl_db.cell(0, i)
    p = cell.paragraphs[0]
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(10)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

data_db = [
    ("Trust Model", "Centralized; full trust placed in the single hosting entity and database root user.", "Decentralized; trust distributed across independent consensus nodes validating smart contract bytecode."),
    ("Data Mutability", "Mutable; state records can be modified, backdated, or deleted via SQL statements.", "Append-only; state transitions are permanently sealed in cryptographically linked blocks."),
    ("Bid Confidentiality", "Dependent on server-side encryption keys managed by the application administrator.", "Client-side non-interactive cryptographic commitments (keccak256) with private 32-byte salts."),
    ("Award Enforcement", "Application-level business logic; can be bypassed by direct database queries or API tampering.", "On-chain smart contract consensus; awardTender algorithmically rejects non-L1 winners at the EVM level."),
    ("Escrow Accounting", "Delegated to external commercial banking systems subject to manual processing clearances.", "Programmable native escrow; automated pull-payment disbursements via withdraw()."),
    ("Audit Trail Integrity", "Application logs stored on disk; vulnerable to truncation, editing, or deletion.", "Immutable event logs emitted into block receipts, permanently inspectable via block explorers."),
    ("Single Point of Failure", "High vulnerability; if the hosting server or cloud instance fails, the entire tender stalls.", "High availability; ledger state is replicated across network nodes.")
]
for r_idx, row_data in enumerate(data_db, 1):
    for c_idx, val in enumerate(row_data):
        cell = tbl_db.cell(r_idx, c_idx)
        p = cell.paragraphs[0]
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(8.5)
        if c_idx == 0:
            r.font.bold = True

p_space = doc.add_paragraph()
p_space.paragraph_format.space_after = Pt(4)

add_body_p(
    "To solve each specific vulnerability identified in Section 3, I mapped the failure mode to a cryptographic or distributed systems "
    "property, and implemented concrete code to enforce the invariant. Table 3 details this mapping."
)

add_table_title("Table 3: Direct Mapping of Procurement Problems to Blockchain Properties and NIRVAAN Implementation")
tbl_map = doc.add_table(rows=8, cols=4)
tbl_map.alignment = WD_TABLE_ALIGNMENT.CENTER
for r_idx, row in enumerate(tbl_map.rows):
    for c_idx, cell in enumerate(row.cells):
        set_cell_margins(cell, top=100, bottom=100, left=130, right=130)
        p = cell.paragraphs[0]
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(0)
        if r_idx == 0:
            set_cell_shading(cell, "0B1A30")
        else:
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")

headers_map = ["Procurement Problem", "Blockchain Property", "NIRVAAN Code Implementation", "Architectural Resolution"]
for i, h in enumerate(headers_map):
    cell = tbl_map.cell(0, i)
    p = cell.paragraphs[0]
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(8.5)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

data_map = [
    ("Premature Bid Leakage", "Cryptographic Commit-Reveal", "submitBid() & revealBid() in OilTenderingV1.sol", "Quote is hashed client-side with 32-byte salt; raw quote is never sent until reveal period."),
    ("Bid Tampering", "Ledger Immutability & Content Addressing", "tenderBids mapping & Pinata IPFS CIDs", "Post-submission modification is cryptographically impossible; CIDs lock document digests."),
    ("Subjective L1 Bypass", "EVM Bytecode Invariant Enforcement", "awardTender() in OilTenderingV1.sol", "Smart contract iterates over all bids and reverts if winner is not the lowest qualified bid."),
    ("Delayed EMD Refunds", "Programmable Pull-Payment Escrow", "finalizeTender() & withdraw()", "_creditRefunds() credits balances upon finalization; vendors withdraw instantly via low-level call."),
    ("Weak Audit Trail", "Decentralized Event Emission", "Solidity Events (BidSubmitted, TenderAwarded)", "Every state transition emits structured event logs indexed permanently on-chain."),
    ("Arbitrary Disqualification", "Statutory Standstill & CVC Role", "disputeTender() & resolveDispute()", "Enforces 7-day standstill post-award; CVC adjudicates; 14-day inactivity timeout."),
    ("Single Point of Trust", "Distributed Consensus & UUPS", "ERC1967Proxy & Multi-role Access Control", "Replaces central DBA with role-based cryptographic modifiers (onlyPSU, onlyVendor, onlyCVC, onlyKeeper).")
]
for r_idx, row_data in enumerate(data_map, 1):
    for c_idx, val in enumerate(row_data):
        cell = tbl_map.cell(r_idx, c_idx)
        p = cell.paragraphs[0]
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(8.5)
        if c_idx == 0:
            r.font.bold = True

p_space = doc.add_paragraph()
p_space.paragraph_format.space_after = Pt(4)

add_heading_2("Deployment Reality and Network Honesty Statement")
add_callout(
    "Honesty Statement on Network Topology: This project is implemented and deployed as a research prototype on the "
    "public Ethereum Sepolia testnet. In an actual enterprise deployment across Indian oil PSUs, the platform would be hosted "
    "on a private, permissioned consortium network (such as Hyperledger Besu utilizing the QBFT consensus algorithm). A permissioned "
    "network would eliminate transaction gas fees, provide sub-second deterministic block finality, and restrict validator consensus "
    "exclusively to verified government servers (IOCL, BPCL, HPCL, ONGC, GAIL, and MoPNG). Because my deployment operates on the "
    "public Sepolia testnet, I do NOT describe or claim the deployed system to be a private consortium blockchain in its current form."
)

# =============================================================
# SECTION 5: YOUTUBE UPLOAD LINK
# =============================================================
add_heading_1("5. YouTube Upload Link")
add_body_p(
    "A comprehensive video demonstration of the working NIRVAAN prototype—showcasing PSU officer login, tender creation, "
    "vendor KYC application, officer on-chain approval, sealed bid submission with client-side salt generation, keeper-automated "
    "bid opening, commercial reveal, technical scoring, on-chain L1 award verification, and pull-payment EMD withdrawal—has been recorded."
)

p_yt = doc.add_paragraph()
p_yt.paragraph_format.space_before = Pt(8)
p_yt.paragraph_format.space_after = Pt(12)
r_yt = p_yt.add_run("YouTube link: ")
r_yt.font.bold = True
r_yt_fill = p_yt.add_run("[STUDENT TO ADD AFTER UPLOAD]")
r_yt_fill.font.bold = True
r_yt_fill.font.color.rgb = RGBColor(0xDC, 0x26, 0x26) # Highlighted placeholder

# =============================================================
# SECTION 6: PROJECT LAUNCH LINK
# =============================================================
add_heading_1("6. Project Launch Link")
add_body_p("My NIRVAAN platform is deployed live on cloud and testnet infrastructure and can be accessed at the following endpoints:")

p_l1 = doc.add_paragraph()
p_l1.paragraph_format.space_after = Pt(3)
r = p_l1.add_run("1. Live Web Application (Frontend): ")
r.font.bold = True
add_hyperlink(p_l1, "https://nirvaan-flame.vercel.app/", "https://nirvaan-flame.vercel.app/")
p_l1.add_run(" (Hosted on Vercel Global Edge Network; built from the React/Vite master branch).")

p_l2 = doc.add_paragraph()
p_l2.paragraph_format.space_after = Pt(3)
r = p_l2.add_run("2. Backend API Gateway & Health Check: ")
r.font.bold = True
add_hyperlink(p_l2, "https://nirvaan-backend-84fc.onrender.com/api/health", "https://nirvaan-backend-84fc.onrender.com/api/health")
p_l2.add_run(" (Hosted on Render Web Service; reports health status, indexer lag, keeper status, and network connection).")

p_l3 = doc.add_paragraph()
p_l3.paragraph_format.space_after = Pt(3)
r = p_l3.add_run("3. Deployed ERC-1967 Proxy Contract on Sepolia: ")
r.font.bold = True
p_l3.add_run("Address: ")
r_code = p_l3.add_run("0xe9649E82dC4fEdf86dFbE5120a3fE79BDde88663\n")
r_code.font.name = "Courier New"
r_code.font.size = Pt(10)
p_l3.add_run("Etherscan Explorer URL: ")
add_hyperlink(p_l3, "https://sepolia.etherscan.io/address/0xe9649E82dC4fEdf86dFbE5120a3fE79BDde88663", "https://sepolia.etherscan.io/address/0xe9649E82dC4fEdf86dFbE5120a3fE79BDde88663")

p_l4 = doc.add_paragraph()
p_l4.paragraph_format.space_after = Pt(3)
r = p_l4.add_run("4. Deployed Logic Implementation Contract (OilTenderingV1): ")
r.font.bold = True
p_l4.add_run("Address: ")
r_code = p_l4.add_run("0xd5451fe17e92B9A9A8Abce4C6c1fc5bFF86f6606\n")
r_code.font.name = "Courier New"
r_code.font.size = Pt(10)
p_l4.add_run("Etherscan Explorer URL: ")
add_hyperlink(p_l4, "https://sepolia.etherscan.io/address/0xd5451fe17e92B9A9A8Abce4C6c1fc5bFF86f6606", "https://sepolia.etherscan.io/address/0xd5451fe17e92B9A9A8Abce4C6c1fc5bFF86f6606")

p_l5 = doc.add_paragraph()
p_l5.paragraph_format.space_after = Pt(6)
r = p_l5.add_run("Deployment Metadata: ")
r.font.bold = True
p_l5.add_run("Target Network: Ethereum Sepolia Testnet | Chain ID: 11155111 | Deployment Block Height: 11959326 | Deployed At: 2026-10-21T02:04:28.463Z (read from contracts/deploy/addresses.json).")

add_callout(
    "Operational Note on Free Cloud Hosting: The Express backend runs on Render's free hosting tier. When inactive, "
    "the container spins down automatically to conserve resources. Upon receiving a new request, Render requires 30 to 60 seconds "
    "to spin up the instance. If the application displays a loading spinner or initial connection delay, please allow up to one minute "
    "for the backend container to wake up. Demo credentials for testing officer accounts and vendor wallets are provided separately; "
    "in accordance with security practices, no private keys, JWT secrets, or account passwords are printed in this document."
)

print("Section 4-6 built.")
doc.save(DOCX_OUT)

# =============================================================
# SECTION 7: SOFTWARES USED
# =============================================================
add_heading_1("7. Softwares Used")
add_body_p(
    "To construct, verify, and host the NIRVAAN platform, I utilized a modern, full-stack software and developer toolkit. "
    "Every software package, framework, and utility listed in Table 4 was verified directly against the configuration files, "
    "package manifests (package.json), and environment tooling in the repository."
)

add_table_title("Table 4: Software Stack, Versioning, and Architectural Purpose Across NIRVAAN")
tbl_sw = doc.add_table(rows=25, cols=3)
tbl_sw.alignment = WD_TABLE_ALIGNMENT.CENTER
for r_idx, row in enumerate(tbl_sw.rows):
    for c_idx, cell in enumerate(row.cells):
        set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
        p = cell.paragraphs[0]
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(0)
        if r_idx == 0:
            set_cell_shading(cell, "0B1A30")
        else:
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")

headers_sw = ["Software / Package", "Exact Version in Use", "Purpose and Architectural Scope"]
for i, h in enumerate(headers_sw):
    cell = tbl_sw.cell(0, i)
    p = cell.paragraphs[0]
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(8.5)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

data_sw = [
    ("Solidity", "^0.8.24", "Smart contract programming language; compiled with default checked arithmetic to eliminate overflow/underflow vulnerabilities."),
    ("OpenZeppelin Contracts", "5.0.2", "Standardized smart contract library; provides ERC1967Proxy infrastructure."),
    ("OpenZeppelin Contracts-Upgradeable", "5.0.2", "Upgradeable contract library; provides Initializable and UUPSUpgradeable base classes."),
    ("Hardhat", "2.22.0", "Ethereum local development environment, EVM testing harness, gas profiling, and deployment runner."),
    ("ethers.js (Backend)", "6.17.0", "Web3 interaction library in backend for signing relay transactions, querying block logs, and computing keccak256 hashes."),
    ("ethers.js (Frontend)", "6.13.2", "Client-side Web3 library in React for MetaMask EIP-1193 provider integration and BigInt currency formatting."),
    ("Node.js (Local Runtime)", "v24.17.0", "Local JavaScript runtime executing test suites, build scripts, and local microservices."),
    ("Node.js (Render Cloud)", "v22.x (>=22.0.0 engine)", "Production cloud runtime executing the Express API gateway, event indexer, and embedded keeper on Render."),
    ("Express.js", "4.19.2", "REST API gateway server managing routing, tenant isolation middleware, and officer authentication."),
    ("helmet", "8.3.0", "Security middleware setting HTTP response headers to defend against cross-site scripting and injection attacks."),
    ("express-rate-limit", "8.7.1", "Rate-limiting middleware protecting public endpoints (such as /api/vendors/apply and /api/ipfs/nonce) against DoS attacks."),
    ("bcryptjs", "2.4.3", "Cryptographic password hashing library for securing PSU officer authentication credentials."),
    ("jsonwebtoken", "9.0.2", "Cryptographic session token generator creating signed JWTs embedded with officer ID and PSU tenancy."),
    ("SQLite (node:sqlite)", "Native Node 22 Engine", "Embedded, zero-dependency SQL database storing indexed on-chain events and pending vendor applications."),
    ("React", "18.3.1", "Declarative component-based frontend user interface library powering the single-page application."),
    ("Vite", "5.4.1", "Next-generation frontend bundler providing fast build optimization and client-side environment variable injection."),
    ("Tailwind CSS", "3.4.10", "Utility-first CSS framework styling the responsive user interface and GIGW accessibility controls."),
    ("Playwright / Puppeteer-core", "Local Headless Chromium", "Automated browser testing and screenshot capture engine used to capture real application interfaces."),
    ("MetaMask", "Browser Extension (EIP-1193)", "Client-side Ethereum wallet provider enabling commercial vendors to sign transactions and challenge nonces."),
    ("Alchemy", "Sepolia JSON-RPC API", "High-availability RPC node gateway connecting the backend indexer and client applications to the Sepolia testnet."),
    ("Pinata", "Cloud IPFS API / SDK", "Content-addressed storage provider pinning tender notices, engineering drawings, and vendor KYC files to IPFS."),
    ("Vercel", "Global Edge CDN", "Cloud hosting provider delivering the compiled React frontend single-page application over TLS 1.3."),
    ("Render", "Cloud PaaS (Linux Container)", "Cloud hosting provider executing the Express backend server, background event indexer, and keeper cron."),
    ("UptimeRobot", "Cloud Monitoring", "Automated synthetic monitor sending HTTP GET pings to /api/health every 5 minutes to keep the backend warm.")
]
for r_idx, row_data in enumerate(data_sw, 1):
    for c_idx, val in enumerate(row_data):
        cell = tbl_sw.cell(r_idx, c_idx)
        p = cell.paragraphs[0]
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(8)
        if c_idx == 0:
            r.font.bold = True

p_space = doc.add_paragraph()
p_space.paragraph_format.space_after = Pt(4)

# =============================================================
# SECTION 8: AI MODELS USED
# =============================================================
add_heading_1("8. AI Models Used")
add_body_p(
    "In developing NIRVAAN, I utilized several state-of-the-art generative artificial intelligence models to assist with "
    "code authoring, syntax checking, debugging, and documentation drafting. The specific models and development platforms "
    "I used are:"
)

add_bullet_p("AI Foundation Models: ", "Claude Opus and Claude Sonnet 5 (Anthropic), DeepSeek V4 Flash, Kimi K3, Gemini 3.8 Flash. [STUDENT TO CONFIRM the exact Claude Opus version.]")
add_bullet_p("AI CLI Platforms and Tools: ", "OpenCode and Antigravity (AGY).")

add_body_p(
    "I used these AI models across different stages of the project lifecycle in the following ways:"
)
add_bullet_p("1. Code Review and Refactoring: ", "I used the models to review my Solidity smart contract logic, analyze access control modifiers, check reentrancy safety patterns, and suggest refactorings to ensure compatibility with OpenZeppelin's UUPS upgradeable standards.")
add_bullet_p("2. Debugging Complex Asynchronous Flows: ", "When my event indexer crashed on startup due to Alchemy's free-tier 10-block query limit on eth_getLogs, I used the models to help design an adaptive regex fallback parser that automatically halves batch sizes and retries with backoff.")
add_bullet_p("3. Test Suite Generation: ", "I used AI tools to help generate edge-case test fixtures in Hardhat and Node.js native test runner, validating duplicate-bid blocking, deadline bounds, and currency formatting rules.")
add_bullet_p("4. Documentation and Diagrams: ", "I used the models to help structure comprehensive academic documentation, format IEEE references, and draft Mermaid diagram specifications.")
add_bullet_p("5. Cloud Deployment Guidance: ", "I consulted the models for configuration advice regarding environment variable propagation across Render, Vercel, and Pinata IPFS gateways.")

add_heading_2("Student Responsibility Statement")
add_callout(
    "Student Responsibility Statement: I wrote the requirements and made the design decisions, I gave written instructions "
    "to the AI tools, I read and reviewed the code they produced including the Solidity contract, the backend and the frontend, "
    "and I used that review to learn how the commit-reveal scheme, the pull-payment escrow, the UUPS proxy and the keeper work. "
    "I deployed the system myself on Sepolia, Render, Vercel and Pinata and tested the tender workflow with separate officer "
    "and vendor wallets. I decided what to keep or change and I take full responsibility for the functionality, security and "
    "content of this submission."
)

print("Section 7-8 built.")
doc.save(DOCX_OUT)

# =============================================================
# SECTION 9: DETAILED ARCHITECTURE DIAGRAM
# =============================================================
add_heading_1("9. Detailed Architecture Diagram")
add_body_p(
    "To provide a clear understanding of the system's operational topology, I engineered NIRVAAN as a decoupled, multi-tier "
    "architecture. Figure 1 illustrates the overall system architecture, showing the interaction between client browsers, "
    "Vercel CDN, Render cloud hosting, the adaptive indexer, native SQLite, Pinata IPFS, and the Ethereum Sepolia blockchain layer."
)

fig1_path = os.path.join(DIAGRAMS_DIR, "detailed_architecture.png")
add_figure_image(fig1_path, "Figure 1: Comprehensive Multi-Tier System Architecture of NIRVAAN", width_inches=4.0)

add_body_p(
    "Explanation of Figure 1: The architecture is partitioned into four primary layers: (1) Presentation Layer on Vercel "
    "delivering the React 18 single-page application and integrating MetaMask (EIP-1193) for vendor wallet signatures; (2) Application "
    "and Indexing Layer on Render executing an Express.js server that enforces PSU tenant isolation, manages single-use upload nonces, "
    "relays gas-sponsored officer transactions via the server wallet, runs an adaptive event indexer that queries Ethereum Sepolia "
    "via Alchemy RPC, and runs an embedded keeper bot that triggers time-dependent lifecycle events; (3) Decentralized Storage Layer "
    "using Pinata IPFS to pin large tender documents and technical proposals by their cryptographic Content Identifiers (CIDs); and "
    "(4) Blockchain Layer on Ethereum Sepolia hosting the ERC1967Proxy and OilTenderingV1 implementation contract, which deterministically "
    "executes business logic, stores sealed bid commitments, enforces on-chain L1 awards, and manages the non-custodial pull-payment escrow."
)

add_heading_2("Tender State Machine Model")
add_body_p(
    "The lifecycle of a tender in NIRVAAN is governed by an immutable finite state machine encoded directly in the smart contract. "
    "Figure 2 illustrates all seven states defined in the contract enum (TenderStatus: Created, UnderEvaluation, Awarded, Disputed, "
    "DisputeResolved, Finalized, Cancelled), along with role-based transition guards and refund triggers."
)

fig2_path = os.path.join(DIAGRAMS_DIR, "tender_state_machine.png")
add_figure_image(fig2_path, "Figure 2: Tender Lifecycle Finite State Machine Model", width_inches=4.0)

add_body_p(
    "Explanation of Figure 2: A tender begins in the Created state upon creation by an authorized PSU officer. Participating vendors "
    "submit sealed commitments backed by EMD deposits. When block.timestamp exceeds openingTime, the autonomous keeper triggers "
    "openBids(), transitioning the tender to UnderEvaluation. During this phase, vendors unseal their bids during the reveal window, "
    "and officers assign technical evaluation scores (0–100) via backend gas relays. After the reveal deadline, the officer calls "
    "awardTender(), which algorithmically verifies on-chain that the winner is technically qualified and represents the lowest quote (L1). "
    "The award starts a statutory 7-day standstill appeal window. If an unsuccessful bidder appeals with a 0.01 ETH dispute bond, the "
    "status transitions to Disputed. If the CVC Auditor upholds the dispute (or if the CVC is inactive for >14 days and resolveDisputeTimeout "
    "is invoked), the winner is cleared, the bond is refunded, and the tender returns to UnderEvaluation. If the CVC dismisses the dispute, "
    "the bond is forfeited to the treasury, and the status transitions to DisputeResolved. Both Awarded and DisputeResolved tenders can be "
    "finalized by the keeper via finalizeTender() once block.timestamp > appealDeadline. Finalization invokes _creditRefunds(), making EMDs "
    "withdrawable via pull payments. In any state prior to finalization, an officer can call cancelTender() to cancel the tender and refund all EMDs."
)

add_heading_2("End-to-End Bid Lifecycle Sequence Model")
add_body_p(
    "Figure 3 models the chronological sequence of interactions between the Vendor, PSU Officer, CVC Auditor, Express Backend Relay, "
    "OilTenderingV1 smart contract, and Autonomous Keeper across all seven lifecycle phases."
)

fig3_path = os.path.join(DIAGRAMS_DIR, "bid_lifecycle_sequence.png")
add_figure_image(fig3_path, "Figure 3: End-to-End Bid Lifecycle Sequence Model", width_inches=4.0)

add_body_p(
    "Explanation of Figure 3: In Phase 1 (Commit), the vendor computes a cryptographic commitment keccak256(vendor, amount, salt, tenderId) "
    "using a client-side 32-byte salt, and calls submitBid() attaching the minimum EMD. In Phase 2 (Open), the keeper calls openBids() once "
    "the deadline lapses. In Phase 3 (Reveal), the vendor reveals the quote and salt; the contract recomputes the hash and marks the bid Opened. "
    "In Phase 4 (Score), the officer reviews proposals and sets technical scores via the backend relay. In Phase 5 (Award), the officer awards "
    "the tender; the contract validates the L1 invariant and starts the 7-day standstill window. In Phase 6 (Dispute), an appealing vendor "
    "can deposit a 0.01 ETH bond; the CVC adjudicates on-chain. In Phase 7 (Finalize & Withdraw), the keeper finalizes the tender, crediting "
    "EMDs to pendingWithdrawals, which vendors withdraw asynchronously via withdraw()."
)

add_heading_2("Data Partitioning and Entity-Relationship Model")
add_body_p(
    "To balance security, immutability, query performance, and storage costs, I partitioned system data across three storage media: "
    "the Ethereum Sepolia blockchain, the off-chain SQLite database, and decentralized IPFS storage. Figure 4 illustrates this data model."
)

fig4_path = os.path.join(DIAGRAMS_DIR, "data_partition_er.png")
add_figure_image(fig4_path, "Figure 4: Data Partitioning and Entity-Relationship Model (On-Chain, SQLite, IPFS)", width_inches=4.0)

add_body_p(
    "Explanation of Figure 4: The Ethereum Sepolia blockchain maintains core state (tenders, sealed bids, dispute history, vendor KYC hashes, "
    "and pull-payment balances). The off-chain SQLite database acts as a reconstructable read cache: on startup, the event indexer "
    "reconstructs all tenders and approved vendors from on-chain event logs, while storing officer authentication records and pending "
    "onboarding applications. Pinata IPFS stores large, unstructured files (tender specification documents, engineering drawings, and vendor "
    "KYC filings). Smart contract structs reference these documents strictly by their immutable 46-character Content Identifiers (CIDs)."
)

# =============================================================
# SECTION 10: COMPONENTS OF BLOCKCHAIN & SMART CONTRACT EXPLANATION
# =============================================================
add_heading_1("10. Components of Blockchain and Explanation of the Smart Contract Used")
add_body_p(
    "In designing NIRVAAN, I utilized fundamental blockchain architectural primitives, mapping each to a concrete role in the procurement workflow:"
)
add_bullet_p("1. Network & Consensus: ", "I deployed on the Ethereum Sepolia Testnet (Chain ID: 11155111), which utilizes Proof of Stake (PoS) consensus matching Ethereum mainnet execution specifications, providing globally verifiable block finality.")
add_bullet_p("2. Accounts & Cryptographic Keypairs: ", "Participants use secp256k1 public-key cryptography. Vendors authenticate and sign transactions via MetaMask; the Express backend holds an officer signing key for relaying gas transactions.")
add_bullet_p("3. Transactions & Calldata: ", "State mutations (bidding, revealing, scoring, awarding, disputing) are encapsulated in signed Ethereum transactions transmitting ABI-encoded calldata to the proxy contract.")
add_bullet_p("4. Blocks & Timestamps: ", "Ethereum block timestamps (block.timestamp) govern tender progression (submission deadline, opening time, reveal deadline, 7-day standstill appeal deadline, and 14-day dispute timeout).")
add_bullet_p("5. Gas & Execution Metering: ", "Every EVM instruction consumes gas. I optimized contract functions to ensure routine vendor interactions consume <300,000 gas units, preventing out-of-gas errors.")
add_bullet_p("6. Events & Structured Logs: ", "State transitions emit Solidity events (TenderCreated, BidSubmitted, BidRevealed, TenderAwarded, DisputeResolved). These logs are indexed by the backend using eth_getLogs to maintain the off-chain SQLite cache.")
add_bullet_p("7. Smart Contracts & Storage Layout: ", "Business logic is compiled to EVM bytecode using Solidity 0.8.24. Storage variables are arranged using standardized ERC-1967 storage slots to guarantee upgrade safety.")
add_bullet_p("8. Proxy Architecture: ", "I utilized an ERC1967Proxy coupled with OpenZeppelin's UUPSUpgradeable pattern, allowing logic upgrades while permanently preserving contract state and escrowed funds.")
add_bullet_p("9. IPFS & Cryptographic Hashing: ", "Unstructured documents are addressed via SHA-256 IPFS CIDs. Commercial quotations are sealed on-chain using keccak256 commitments.")

add_heading_2("Smart Contract Source Code Analysis")
add_body_p(
    "The smart contract architecture consists of two contracts: TenderProxy.sol and OilTenderingV1.sol. "
    "TenderProxy inherits OpenZeppelin's ERC1967Proxy directly, forwarding incoming calls to the implementation contract via delegatecall. "
    "OilTenderingV1 contains the complete procurement logic and inherits OpenZeppelin's Initializable and UUPSUpgradeable."
)

add_heading_3("Data Structures (Structs)")
add_body_p("The smart contract defines four core structs that model procurement state:")
add_code_block(
    "struct Tender {\n"
    "    uint256 id;\n"
    "    address psuAddress;\n"
    "    string ipfsHashDoc;           // IPFS CID of specification document\n"
    "    uint256 submissionDeadline;   // Unix timestamp for bid submissions\n"
    "    uint256 openingTime;          // Unix timestamp when keeper unseals bids\n"
    "    uint256 revealDeadline;       // Bids must be revealed before this deadline\n"
    "    uint256 appealDeadline;       // Set to awardedTime + 7 days upon award\n"
    "    uint256 minEMDAmount;         // Earnest Money Deposit required\n"
    "    TenderStatus status;          // Finite state machine status\n"
    "    address winner;               // Awarded L1 contractor address\n"
    "    uint256 winningBidId;         // Internal ID of winning bid\n"
    "    uint256 winningBidAmount;     // Revealed quote of winning contractor\n"
    "}\n\n"
    "struct Bid {\n"
    "    uint256 id;\n"
    "    uint256 tenderId;\n"
    "    address vendorAddress;\n"
    "    string encryptedBidIpfsHash;  // IPFS CID of technical proposal\n"
    "    bytes32 bidCommitment;        // keccak256(vendor + amount + salt + tenderId)\n"
    "    uint256 submissionTime;       // Block timestamp of submission\n"
    "    uint256 bidAmount;            // Commercial quote revealed during reveal phase\n"
    "    BidStatus status;             // Submitted, Opened, Accepted, Rejected\n"
    "    bool isTechQualified;         // Technical qualification flag\n"
    "    uint256 techScore;            // Technical evaluation score (0-100)\n"
    "    uint256 emdDeposited;         // Exact EMD amount deposited in Wei\n"
    "}\n\n"
    "struct VendorKYC {\n"
    "    bytes32 gstinHash;            // keccak256 hash of corporate GSTIN\n"
    "    bytes32 panHash;              // keccak256 hash of corporate PAN\n"
    "    string kycIpfsHash;           // IPFS CID of incorporation certificate\n"
    "    uint256 registeredAt;         // Registration block timestamp\n"
    "    bool isActive;                // Active accreditation status\n"
    "}\n\n"
    "struct Dispute {\n"
    "    uint256 tenderId;             // Target tender ID\n"
    "    address challenger;           // Disputing vendor address\n"
    "    string reasonIpfsHash;        // IPFS CID of formal grievance filing\n"
    "    uint256 filedAt;              // Block timestamp of dispute filing\n"
    "    uint256 timeoutAt;            // CVC resolution deadline (filedAt + 14 days)\n"
    "    bool isResolved;              // Adjudication completion status\n"
    "    bool isUpheld;                // True if CVC ruled in favor of challenger\n"
    "    string cvcReasonIpfsHash;     // IPFS CID or note of CVC ruling\n"
    "    uint256 disputeBondDeposited; // Holds the 0.01 ETH dispute bond deposit\n"
    "}"
)

add_heading_3("Complete Public and External Function Reference")
add_body_p(
    "Table 5 details every public and external function implemented in OilTenderingV1.sol, including administrative setters, "
    "lifecycle mutations, view functions, access control modifiers, payable status, and core security assertions."
)

add_table_title("Table 5: Complete Smart Contract Public and External Function Reference (OilTenderingV1.sol)")
tbl_fn = doc.add_table(rows=20, cols=4)
tbl_fn.alignment = WD_TABLE_ALIGNMENT.CENTER
for r_idx, row in enumerate(tbl_fn.rows):
    for c_idx, cell in enumerate(row.cells):
        set_cell_margins(cell, top=80, bottom=80, left=110, right=110)
        p = cell.paragraphs[0]
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(0)
        if r_idx == 0:
            set_cell_shading(cell, "0B1A30")
        else:
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")

headers_fn = ["Function Signature", "Access Guard", "Payable?", "Purpose and Core Invariants Enforced"]
for i, h in enumerate(headers_fn):
    cell = tbl_fn.cell(0, i)
    p = cell.paragraphs[0]
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(8.5)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

data_fn = [
    ("initialize(admin, keeper, cvc, treasury, bond, emd)", "External", "No", "Initializes proxy storage. Configures multisig admin, keeper, CVC auditor, treasury, dispute bond, and default EMD. Protected by initializer modifier."),
    ("setDisputeBondAmount(newBond)", "onlyAdmin", "No", "Updates the statutory dispute bond requirement (e.g. 0.01 ETH on Sepolia)."),
    ("setDefaultMinEMD(newMinEMD)", "onlyAdmin", "No", "Updates the default minimum EMD required when tenders do not specify a custom EMD."),
    ("registerPSU(psuAddress)", "onlyAdmin", "No", "Accredits an institutional PSU procurement address to create and manage tenders."),
    ("setKeeperAddress(newKeeper)", "onlyAdmin", "No", "Updates the authorized keeper wallet address for automated lifecycle execution."),
    ("setCVCAuditorAddress(newCVC)", "onlyAdmin", "No", "Updates the authorized Central Vigilance Commission auditor wallet address."),
    ("setTreasuryAddress(newTreasury)", "onlyAdmin", "No", "Updates the government treasury address where forfeited dispute bonds are transferred."),
    ("createTender(ipfsHashDoc, subDead, openTime, revDead, minEMD)", "onlyPSU", "No", "Publishes a new tender. Enforces: subDead > now, openTime >= subDead, revDead > openTime. Sets status = Created."),
    ("cancelTender(tenderId, reason)", "onlyPSU", "No", "Cancels tender in any state except Finalized or Cancelled. Calls _creditRefunds() inline to refund all deposited EMDs."),
    ("submitBid(tenderId, encryptedDoc, commitment)", "onlyVendor", "YES", "Accepts sealed bid commitment. Requires now < subDead, msg.value >= minEMD, and blocks duplicates via hasBid[tenderId][vendor]."),
    ("openBids(tenderId)", "onlyKeeper", "No", "Transitions tender to UnderEvaluation. Enforces block.timestamp >= openingTime and current status == Created."),
    ("revealBid(tenderId, bidIndex, bidAmount, salt)", "onlyVendor", "No", "Unseals quote during reveal window (now <= revDead). Asserts keccak256(msg.sender, bidAmount, salt, tenderId) == commitment. Updates status = Opened."),
    ("setTechnicalScore(tenderId, bidIndex, qualified, score)", "onlyPSU", "No", "Records technical evaluation score (0-100) and qualification flag for opened bids. Enforces tender.psuAddress == msg.sender."),
    ("awardTender(tenderId, winner, winningBidId, amount)", "onlyPSU", "No", "Enforces L1 award on-chain: iterates over all bids, marks unrevealed bids Rejected (EMD forfeited), asserts winner is qualified and matches lowest quote. Sets status = Awarded and appealDeadline = now + 7 days."),
    ("disputeTender(tenderId, reasonIpfsHash)", "onlyVendor", "YES", "Lodges formal grievance during 7-day standstill (now <= appealDeadline). Requires msg.value >= disputeBondAmount and challenger is a bidder. Sets status = Disputed."),
    ("resolveDispute(tenderId, upheld, resolutionNotes)", "onlyCVC", "No", "Adjudicates dispute. If upheld: resets winner, status returns to UnderEvaluation, refunds bond. If dismissed: bond to treasury, status transitions to DisputeResolved."),
    ("resolveDisputeTimeout(tenderId)", "Public", "No", "Timeout failsafe: allows any caller to auto-resolve dispute if CVC exceeds 14 days without ruling. Counts as upheld (winner cleared, bond refunded, status = UnderEvaluation)."),
    ("finalizeTender(tenderId)", "onlyKeeper", "No", "Finalizes tender when status is Awarded or DisputeResolved and block.timestamp > appealDeadline. Calls _creditRefunds() to credit EMD refunds to all qualified bidders."),
    ("withdraw()", "Public", "No", "Non-custodial pull-payment pattern: resets caller's pendingWithdrawals balance to 0, then transfers native ETH via low-level call{value: amount}(\"\").")
]
for r_idx, row_data in enumerate(data_fn, 1):
    for c_idx, val in enumerate(row_data):
        cell = tbl_fn.cell(r_idx, c_idx)
        p = cell.paragraphs[0]
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(8)
        if c_idx == 0:
            r.font.name = "Courier New"
            r.font.size = Pt(8)
            r.font.bold = True
        elif c_idx == 2 and val == "YES":
            r.font.bold = True
            r.font.color.rgb = RGBColor(0xDC, 0x26, 0x26)

p_space = doc.add_paragraph()
p_space.paragraph_format.space_after = Pt(4)

add_heading_3("Key Security Patterns and Invariants")
add_bullet_p("1. Cryptographic Commit-Reveal Scheme: ", "Financial quotes are blinded on-chain using keccak256(msg.sender, bidAmount, salt, tenderId). Binding msg.sender and tenderId prevents front-running and cross-tender replay attacks.")
add_bullet_p("2. Non-Custodial Pull Payments (Checks-Effects-Interactions): ", "The contract never pushes funds to external wallets during batch operations. Instead, _creditRefunds() credits pendingWithdrawals. The withdraw() function resets pending balance to zero before executing low-level ETH transfers, eliminating reentrancy vulnerabilities.")
add_bullet_p("3. On-Chain L1 Enforcement Invariant: ", "During awardTender(), the contract iterates through all bids in EVM storage, determines lowestQualifiedAmount, and strictly reverts if the proposed winner is not the lowest qualified bid.")
add_bullet_p("4. Dispute Timeouts and State Handling: ", "A dismissed dispute transitions status to DisputeResolved (preserving the award), while an upheld dispute or a 14-day timeout resets the winner to address(0) and returns status to UnderEvaluation.")
add_bullet_p("5. Unrevealed Bid Forfeiture: ", "If a vendor submits a commitment but fails to reveal their bid before revealDeadline, awardTender() marks their bid Rejected and forfeits their EMD, preventing malicious bidders from freezing tenders by withholding their quotes.")

add_heading_2("Empirical Gas Profiling")
add_body_p(
    "To measure the real execution efficiency of my smart contracts, I executed gas profiling scripts against the compiled bytecode "
    "on a local Hardhat network. Table 6 reports the exact gas consumed by every contract transaction."
)

add_table_title("Table 6: Empirically Measured Smart Contract Gas Consumption Profile on Hardhat EVM")
tbl_gas = doc.add_table(rows=18, cols=4)
tbl_gas.alignment = WD_TABLE_ALIGNMENT.CENTER
for r_idx, row in enumerate(tbl_gas.rows):
    for c_idx, cell in enumerate(row.cells):
        set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
        p = cell.paragraphs[0]
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(0)
        if r_idx == 0:
            set_cell_shading(cell, "0B1A30")
        else:
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")

headers_gas = ["Smart Contract Operation", "Gas Units (Hardhat EVM)", "Est. Sepolia Cost (at 2 Gwei)", "Est. USD Cost (ETH = $2,500)"]
for i, h in enumerate(headers_gas):
    cell = tbl_gas.cell(0, i)
    p = cell.paragraphs[0]
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(8.5)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

data_gas = [
    ("deployImplementation (OilTenderingV1)", "3,971,912", "0.00794 ETH", "$19.85"),
    ("deployProxy (TenderProxy)", "313,204", "0.00063 ETH", "$1.57"),
    ("setDisputeBondAmount", "33,617", "0.00007 ETH", "$0.17"),
    ("setDefaultMinEMD", "33,661", "0.00007 ETH", "$0.17"),
    ("registerPSU", "52,451", "0.00010 ETH", "$0.26"),
    ("registerVendor", "166,302", "0.00033 ETH", "$0.83"),
    ("createTender", "219,509", "0.00044 ETH", "$1.10"),
    ("submitBid (Initial Bid)", "270,500", "0.00054 ETH", "$1.35"),
    ("submitBid (Subsequent Bid)", "236,300", "0.00047 ETH", "$1.18"),
    ("openBids", "56,274", "0.00011 ETH", "$0.28"),
    ("revealBid", "87,211", "0.00017 ETH", "$0.44"),
    ("setTechnicalScore", "65,407", "0.00013 ETH", "$0.33"),
    ("awardTender", "132,698", "0.00027 ETH", "$0.66"),
    ("disputeTender", "203,703", "0.00041 ETH", "$1.02"),
    ("resolveDispute (Dismissed)", "110,738", "0.00022 ETH", "$0.55"),
    ("finalizeTender", "95,601", "0.00019 ETH", "$0.48"),
    ("withdraw", "34,948", "0.00007 ETH", "$0.17")
]
for r_idx, row_data in enumerate(data_gas, 1):
    for c_idx, val in enumerate(row_data):
        cell = tbl_gas.cell(r_idx, c_idx)
        p = cell.paragraphs[0]
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(8.5)
        if c_idx == 0:
            r.font.bold = True

p_space = doc.add_paragraph()
p_space.paragraph_format.space_after = Pt(4)

add_heading_2("Known Limitations")
add_callout(
    "Known Architectural Limitations: In evaluating my project objectively, I acknowledge several operational limitations "
    "in the current prototype: (1) A single backend signing wallet (OFFICER_PRIVATE_KEY) is shared across all PSUs to relay gas "
    "transactions, whereas production would require dedicated Hardware Security Modules (HSMs) per PSU; (2) The deployer wallet "
    "retains combined administrative, officer, and upgrade roles, which must be partitioned into an institutional multisig contract in production; "
    "(3) The keeper service must remain online for timely bid openings and finalizations; (4) The system is deployed on the public "
    "Sepolia testnet, meaning transaction metadata (bidder wallet addresses and timestamps) is publicly visible on Etherscan; and "
    "(5) The codebase has not undergone formal mathematical verification or an external third-party security audit."
)

print("Section 9-10 built.")
doc.save(DOCX_OUT)

# =============================================================
# SECTION 11: SAMPLE SCREENSHOTS
# =============================================================
add_heading_1("11. Sample Screenshots")
add_body_p(
    "In accordance with project verification standards, I captured real screenshots of the working NIRVAAN application "
    "across all critical lifecycle checkpoints. Real browser window captures are embedded below, with the remaining "
    "interactive screens (which require connected MetaMask wallets and state transitions) clearly documented with their "
    "reproduction steps in docs/screenshots/MANUAL_CAPTURE.md."
)

# 1. Landing Page
s1_path = os.path.join(SCREENSHOTS_DIR, "01_landing_page.png")
add_figure_image(s1_path, "Figure 5: Public Tender Browse and Discovery Dashboard (Captured live at https://nirvaan-flame.vercel.app/)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 5: The public landing page allows prospective contractors to discover active tenders across "
    "participating PSUs (IOCL, BPCL, ONGC). The interface features the GIGW accessibility toolbar (font scaling A-/A/A+ and contrast "
    "controls) and real-time status indicators confirming connection to the Ethereum Sepolia testnet."
)

# 2. Officer Login
s2_path = os.path.join(SCREENSHOTS_DIR, "02_officer_login.png")
add_figure_image(s2_path, "Figure 6: PSU Officer Authentication Portal (Captured live at https://nirvaan-flame.vercel.app/officer/login)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 6: The officer authentication portal secures institutional access using bcrypt password digests. "
    "Upon successful authentication, the server issues a scoped JWT embedding the officer's organization ID, enforcing strict "
    "per-PSU tenant isolation across all tender management routes."
)

# 3. Tender Creation
s3_path = os.path.join(SCREENSHOTS_DIR, "03_tender_creation.png")
add_figure_image(s3_path, "Figure 7: Notice Inviting Tender (NIT) Creation Interface (Form at /officer/create-tender)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 7: Authorized PSU officers create new procurement notices, specifying the NIT code, project category, "
    "display budget (INR), required EMD (ETH), submission deadline, opening time, and reveal deadline with local timezone indicators. "
    "The specification document is pinned to Pinata IPFS to obtain its cryptographic CID."
)

# 4. Vendor Registration / KYC
s4_path = os.path.join(SCREENSHOTS_DIR, "04_vendor_kyc_application.png")
add_figure_image(s4_path, "Figure 8: Vendor KYC Onboarding Application Interface (Captured live at https://nirvaan-flame.vercel.app/vendor/register)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 8: Prospective commercial vendors apply for onboarding by submitting company legal details, GSTIN, PAN, "
    "and incorporation certificates. To prevent unauthorized uploads, the vendor signs a server-issued challenge nonce using their "
    "MetaMask wallet (EIP-1193) via ethers.verifyMessage."
)

# 5. Officer KYC Approval
s5_path = os.path.join(SCREENSHOTS_DIR, "05_officer_kyc_approval.png")
add_figure_image(s5_path, "Figure 9: Officer Vendor Verification and On-Chain Approval Portal (View at /officer/vendors)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 9: PSU officers inspect pending supplier applications, verify submitted corporate credentials, and execute "
    "on-chain registration via registerVendor(). The smart contract stores keccak256 hashes of the GSTIN and PAN to satisfy data minimization "
    "under the Digital Personal Data Protection Act, 2023."
)

# 6. Sealed Bid Submission
s6_path = os.path.join(SCREENSHOTS_DIR, "06_sealed_bid_submission.png")
add_figure_image(s6_path, "Figure 10: Sealed Commercial Bid Submission with Client-Side Salt Generation (View at /tenders/:id/bid)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 10: Verified suppliers submit sealed bids before the submission deadline. The client generates a random "
    "32-byte salt, computes the commitment hash keccak256(vendor, amount, salt, tenderId), prompts the bidder to download a recovery "
    "JSON backup file, and broadcasts the commitment with the prefilled EMD value to submitBid()."
)

# 7. Commercial Bid Reveal
s7_path = os.path.join(SCREENSHOTS_DIR, "07_bid_reveal_page.png")
add_figure_image(s7_path, "Figure 11: Commercial Bid Reveal Interface (Modal at /tenders/:id)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 11: During the active reveal window following keeper unsealing, vendors submit their private salt and "
    "quotation. The contract asserts hash equivalence and updates the bid status to Opened, permanently recording the quote on-chain."
)

# 8. Technical Proposal Evaluation
s8_path = os.path.join(SCREENSHOTS_DIR, "08_bid_evaluation_page.png")
add_figure_image(s8_path, "Figure 12: Technical Proposal Evaluation and L1 Identification View (View at /tenders/:id/evaluate)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 12: Officers review opened technical proposals and assign technical scores (0–100). The interface dynamically "
    "highlights qualified bidders and flags the Lowest Evaluated Responsive Bidder with the 'Lowest Qualified (L1)' badge."
)

# 9. Award & Chain of Custody Timeline
s9_path = os.path.join(SCREENSHOTS_DIR, "09_award_custody_timeline.png")
add_figure_image(s9_path, "Figure 13: Contract Award and Immutable Custody Timeline (View at /tenders/:id)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 13: The tender detail page presents an immutable custody timeline constructed from real blockchain event logs, "
    "displaying creation blocks, opening timestamps, reveal receipts, and award transaction hashes hyperlinked to Sepolia Etherscan."
)

# 10. Etherscan Block Explorer
s10_path = os.path.join(SCREENSHOTS_DIR, "10_etherscan_transaction.png")
add_figure_image(s10_path, "Figure 14: Sepolia Etherscan Block Explorer Transaction Verification Receipt (Captured live at https://sepolia.etherscan.io/address/0xe9649E82dC4fEdf86dFbE5120a3fE79BDde88663)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 14: Public block explorer receipt on Sepolia Etherscan verifying the deployed ERC1967Proxy contract address, "
    "implementation contract address, transaction history, and event emissions."
)

# 11. Backend Health Check
s11_path = os.path.join(SCREENSHOTS_DIR, "11_backend_health.png")
add_figure_image(s11_path, "Figure 15: Backend Microservice Runtime Health and Indexer Diagnostics View (Captured live at https://nirvaan-backend-84fc.onrender.com/api/health)", width_inches=3.2)
add_body_p(
    "Explanation of Figure 15: The runtime health endpoint confirms backend microservice status, zero indexer block lag, active keeper "
    "polling, and healthy Alchemy JSON-RPC connection to the Sepolia testnet."
)

# =============================================================
# SECTION 12: CONCLUSION
# =============================================================
add_heading_1("12. Conclusion")
add_body_p(
    "In this project, I designed, developed, and deployed NIRVAAN, an open decentralized e-tendering platform engineered "
    "to solve the systemic failure modes of centralized procurement in Indian oil and gas PSUs. By synthesizing an upgradeable "
    "Solidity smart contract architecture (UUPS / ERC-1967), a client-side non-interactive commit-reveal bidding scheme, on-chain L1 "
    "algorithmic award enforcement, an automated pull-payment escrow mechanism, and a statutory 7-day standstill governance window "
    "with independent CVC arbitration, NIRVAAN demonstrates that high-stakes public procurement can transition from subjective "
    "administrative trust to verifiable cryptographic consensus."
)

add_heading_2("Verification and Empirical Results Summary")
add_body_p(
    "To establish the correctness, security, and resilience of my implementation, I authored and executed three multi-tier automated test suites. "
    "Across all 73 automated tests, my platform achieved a 100% pass rate with zero failures, as detailed in Table 7."
)

add_table_title("Table 7: Automated Multi-Tier Verification and Test Suite Execution Summary")
tbl_t = doc.add_table(rows=5, cols=4)
tbl_t.alignment = WD_TABLE_ALIGNMENT.CENTER
for r_idx, row in enumerate(tbl_t.rows):
    for c_idx, cell in enumerate(row.cells):
        set_cell_margins(cell, top=100, bottom=100, left=130, right=130)
        p = cell.paragraphs[0]
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(0)
        if r_idx == 0:
            set_cell_shading(cell, "0B1A30")
        else:
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")

headers_t = ["Test Suite Identifier", "Scope of Verification", "Passing / Total", "Execution Status"]
for i, h in enumerate(headers_t):
    cell = tbl_t.cell(0, i)
    p = cell.paragraphs[0]
    r = p.add_run(h)
    r.font.name = "Times New Roman"
    r.font.size = Pt(8.5)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

data_t = [
    ("Hardhat Smart Contract Unit Tests (OilTendering.test.js)", "Proxy initialization, role access control, deadline bounds, duplicate-bid blocking, commit-reveal verification, L1 award enforcement, dispute timeouts, and cancellation refunds.", "13 / 13", "100% PASS"),
    ("Express Backend Integration Tests (test/*.test.js)", "Alchemy 10-block query limit regex parsing, automatic batch halving, ETH decimal string validation, GSTIN/PAN regex checks, and on-chain event vendor reconstruction.", "24 / 24", "100% PASS"),
    ("End-to-End System Smoke Tests (scripts/smoke-test.js)", "Security guards, unauthenticated 401 rejections, challenge nonce authentication, officer login/password reset, vendor apply-then-approve flow, tender creation, and on-chain award transitions.", "36 / 36", "100% PASS"),
    ("Git Working Tree Security Scan (scripts/scan-secrets.js)", "Scans all 117 tracked files in repository to ensure zero 64-hexadecimal private keys or secret API credentials are committed.", "117 / 117 files clean", "0 SECRETS DETECTED")
]
for r_idx, row_data in enumerate(data_t, 1):
    for c_idx, val in enumerate(row_data):
        cell = tbl_t.cell(r_idx, c_idx)
        p = cell.paragraphs[0]
        r = p.add_run(val)
        r.font.name = "Times New Roman"
        r.font.size = Pt(8.5)
        if c_idx == 0:
            r.font.bold = True
        elif c_idx == 3:
            r.font.bold = True
            r.font.color.rgb = RGBColor(0x16, 0x65, 0x34) # Green highlight

p_space = doc.add_paragraph()
p_space.paragraph_format.space_after = Pt(4)

add_heading_2("Key Lessons Learned")
add_bullet_p("1. Separation of Consensus from Storage: ", "Blockchains are designed for state transitions, financial escrow, and cryptographic commitments. Large engineering schematics and tender dossiers must reside on decentralized content-addressed storage (IPFS), with only their 46-character cryptographic CIDs anchored on-chain.")
add_bullet_p("2. RPC Rate-Limit Resilience: ", "Free-tier RPC node providers (such as Alchemy) enforce strict 10-block ranges on eth_getLogs. An adaptive indexer capable of automatically halving batch sizes and retrying with exponential backoff is essential for cloud reliability.")
add_bullet_p("3. Defensive Financial Patterns: ", "Smart contracts must never push funds to external addresses during state transitions. Adhering strictly to the pull-payment pattern (Checks-Effects-Interactions) guarantees immunity against reentrancy attacks and denial-of-service exploits.")

add_heading_2("Future Work")
add_bullet_p("1. Multi-Signature Governance: ", "Transitioning the platform administrative role from a single wallet to an institutional multi-signature contract (e.g., Safe) requiring unanimous approvals from participating PSUs.")
add_bullet_p("2. Dedicated Per-PSU Signing Relays: ", "Deploying independent Hardware Security Modules (HSMs) for each individual PSU rather than sharing a single backend signing key.")
add_bullet_p("3. Decentralized Keeper Integration: ", "Migrating the embedded keeper bot to a decentralized automation network (such as Chainlink Automation or Gelato Network) to remove the reliance on a single backend daemon.")
add_bullet_p("4. Zero-Knowledge Commercial Commitments: ", "Implementing zk-SNARK circuits allowing vendors to prove that their commercial bid falls below the statutory budget ceiling without revealing the numeric quote during the commitment phase.")
add_bullet_p("5. Migration to a Permissioned Consortium: ", "Deploying the verified architecture to a dedicated private Hyperledger Besu network utilizing QBFT consensus to eliminate gas fees, achieve sub-second block finality, and guarantee data sovereignty across government infrastructure.")

# =============================================================
# REFERENCES (Unnumbered heading, IEEE style)
# =============================================================
p_ref_head = doc.add_paragraph()
p_ref_head.paragraph_format.space_before = Pt(20)
p_ref_head.paragraph_format.space_after = Pt(8)
p_ref_head.paragraph_format.keep_with_next = True
r = p_ref_head.add_run("References")
r.font.name = "Times New Roman"
r.font.size = Pt(14)
r.font.bold = True
r.font.color.rgb = RGBColor(0x0B, 0x1A, 0x30)

references_data = [
    "[1] S. Nakamoto, \"Bitcoin: A Peer-to-Peer Electronic Cash System,\" Decentralized Business Review, 2008. [Online]. Available: https://bitcoin.org/bitcoin.pdf",
    "[2] V. Buterin, \"A Next-Generation Smart Contract and Decentralized Application Platform,\" Ethereum Whitepaper, 2014. [Online]. Available: https://ethereum.org/en/whitepaper/",
    "[3] G. Wood, \"Ethereum: A Secure Decentralised Generalised Transaction Ledger,\" Ethereum Yellow Paper, 2014. [Online]. Available: https://ethereum.github.io/yellowpaper/paper.pdf",
    "[4] J. Benet, \"IPFS - Content Addressed, Versioned, P2P File System,\" arXiv preprint arXiv:1407.3561, 2014.",
    "[5] K. Wüst and A. Gervais, \"Do you need a Blockchain?\" in Proceedings of the 2018 Crypto Valley Conference on Blockchain Technology (CVCBT), Innsbruck, Austria, 2018, pp. 45–54.",
    "[6] Ethereum Improvement Proposals, \"EIP-1967: Standard Proxy Storage Slots,\" EIP-1967, 2019. [Online]. Available: https://eips.ethereum.org/EIPS/eip-1967",
    "[7] Ethereum Improvement Proposals, \"EIP-1822: Universal Upgradeable Proxy Standard (UUPS),\" EIP-1822, 2019. [Online]. Available: https://eips.ethereum.org/EIPS/eip-1822",
    "[8] OpenZeppelin, \"OpenZeppelin Contracts Upgradeable Documentation,\" 2024. [Online]. Available: https://docs.openzeppelin.com/contracts/5.x/upgradeable",
    "[9] Solidity Team, \"Solidity 0.8.24 Release and Checked Arithmetic Documentation,\" Ethereum Foundation, 2024. [Online]. Available: https://docs.soliditylang.org/",
    "[10] Hardhat Team, \"Hardhat: Ethereum Development Environment for Professionals,\" Nomic Foundation, 2024. [Online]. Available: https://hardhat.org/",
    "[11] R. Moore, \"ethers.js: Complete and Compact Web3 Library for JavaScript and TypeScript,\" 2024. [Online]. Available: https://docs.ethers.org/v6/",
    "[12] Pinata Cloud, \"Pinata IPFS Documentation and Pinning Services,\" 2024. [Online]. Available: https://docs.pinata.cloud/",
    "[13] Vercel Inc., \"Vercel Edge Network and Static CDN Deployment Documentation,\" 2024. [Online]. Available: https://vercel.com/docs",
    "[14] Render Services Inc., \"Render Cloud Application Hosting and Background Workers Documentation,\" 2024. [Online]. Available: https://render.com/docs",
    "[15] Department of Expenditure, \"General Financial Rules (GFR) 2017,\" Ministry of Finance, Government of India, New Delhi, 2017.",
    "[16] Ministry of Law and Justice, \"The Information Technology Act, 2000 (Act No. 21 of 2000),\" The Gazette of India, New Delhi, 2000.",
    "[17] National Informatics Centre (NIC), \"Central Public Procurement Portal of India (CPPP),\" Government of India, 2024. [Online]. Available: https://eprocure.gov.in",
    "[18] Government e-Marketplace (GeM), \"GeM Procurement Guidelines and Technical Architecture,\" Ministry of Commerce and Industry, Government of India, 2024. [Online]. Available: https://gem.gov.in",
    "[19] Hyperledger Foundation, \"Hyperledger Besu Enterprise Ethereum Client and QBFT Consensus Specification,\" 2024. [Online]. Available: https://besu.hyperledger.org/",
    "[20] Transparency International Ukraine, \"ProZorro: Open Procurement System Architecture and Anti-Corruption Impacts,\" Kyiv, Ukraine, 2016. [Online]. Available: https://prozorro.gov.ua"
]

for ref_text in references_data:
    p_ref = doc.add_paragraph()
    p_ref.paragraph_format.line_spacing = 1.15
    p_ref.paragraph_format.space_after = Pt(3)
    p_ref.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    run_ref = p_ref.add_run(ref_text)
    run_ref.font.name = "Times New Roman"
    run_ref.font.size = Pt(10)

print("Full build complete. Saving DOCX...")
doc.save(DOCX_OUT)
print(f"SUCCESS: Saved {DOCX_OUT}")
