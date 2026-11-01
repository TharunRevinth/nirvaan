import os
import sys
import subprocess
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls

DOCX_OUT = "/home/cybernode/Projects/nirvaan/docs/NIRVAAN_Submission.docx"
PDF_OUT = "/home/cybernode/Projects/nirvaan/docs/NIRVAAN_Submission.pdf"
DIAGRAMS_DIR = "/home/cybernode/Projects/nirvaan/docs/submission/diagrams"
SCREENSHOTS_DIR = "/home/cybernode/Projects/nirvaan/docs/screenshots"

# -------------------------------------------------------------
# XML Helper Functions
# -------------------------------------------------------------
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

def add_heading_1(doc, text):
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

def add_heading_2(doc, text):
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

def add_heading_3(doc, text):
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

def add_body_p(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.35
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(12)
    return p

def add_bullet_p(doc, text, bold_prefix=""):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.line_spacing = 1.35
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if bold_prefix:
        r1 = p.add_run(bold_prefix)
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(12)
        r1.font.bold = True
    r2 = p.add_run(text)
    r2.font.name = 'Times New Roman'
    r2.font.size = Pt(12)
    return p

def add_code_block(doc, code_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_shading(cell, "F3F4F6")
    set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
    cell.width = Inches(6.27)
    p = cell.paragraphs[0]
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(code_text)
    run.font.name = 'Courier New'
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_after = Pt(2)

def add_figure_image(doc, image_path, caption_text, width_inches=4.2):
    if os.path.exists(image_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(4)
        p_img.paragraph_format.space_after = Pt(2)
        p_img.paragraph_format.keep_with_next = True
        run = p_img.add_run()
        run.add_picture(image_path, width=Inches(width_inches))
        
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(1)
        p_cap.paragraph_format.space_after = Pt(4)
        run_cap = p_cap.add_run(caption_text)
        run_cap.font.name = 'Times New Roman'
        run_cap.font.size = Pt(10)
        run_cap.font.bold = True
        run_cap.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

def add_table_title(doc, table_title_text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(table_title_text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(10.5)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    return p

def add_leader_line(doc, title, page_str, bold=False, indent_inches=0):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(2)
    if indent_inches > 0:
        p.paragraph_format.left_indent = Inches(indent_inches)
    pPr = p._p.get_or_add_pPr()
    tabs = OxmlElement('w:tabs')
    tab = OxmlElement('w:tab')
    tab.set(qn('w:val'), 'right')
    tab.set(qn('w:leader'), 'dot')
    tab.set(qn('w:pos'), '9020') # 6.27 inches
    tabs.append(tab)
    pPr.append(tabs)
    
    r = p.add_run(f"{title}\t{page_str}")
    r.font.name = 'Times New Roman'
    r.font.size = Pt(10.5)
    if bold:
        r.font.bold = True
    return p

# -------------------------------------------------------------
# Document Builder
# -------------------------------------------------------------
def build_submission_doc(page_lookup=None):
    if page_lookup is None:
        page_lookup = {}
    
    def get_pg(key, default="..."):
        return str(page_lookup.get(key, default))

    doc = docx.Document()

    # Page Setup: A4, 1-inch margins
    for section in doc.sections:
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Base style
    style_normal = doc.styles['Normal']
    font = style_normal.font
    font.name = 'Times New Roman'
    font.size = Pt(12)
    font.color.rgb = RGBColor(0x11, 0x11, 0x11)
    style_normal.paragraph_format.line_spacing = 1.35
    style_normal.paragraph_format.space_after = Pt(4)
    style_normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    # =============================================================
    # TITLE PAGE
    # =============================================================
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(36)
    p_title.paragraph_format.space_after = Pt(12)
    r = p_title.add_run("NIRVAAN: A BLOCKCHAIN-BASED E-TENDERING PLATFORM FOR OIL PSUS\n")
    r.font.size = Pt(17)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0x0B, 0x1A, 0x30)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(28)
    r = p_sub.add_run("A Capstone Course Project Report Submitted for BACSE350\nBlockchain Architecture and Design")
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

    p_auth = doc.add_paragraph()
    p_auth.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_auth.paragraph_format.space_after = Pt(24)
    r = p_auth.add_run("Submitted by:\n")
    r.font.size = Pt(11)
    r.font.color.rgb = RGBColor(0x47, 0x55, 0x69)
    r = p_auth.add_run("THARUN REVINTH V S\nRegistration Number: 25BCE5268\n(Individual Project)")
    r.font.size = Pt(13)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0x0F, 0x29, 0x4A)

    p_fac = doc.add_paragraph()
    p_fac.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_fac.paragraph_format.space_after = Pt(36)
    r = p_fac.add_run("Course Faculty:\n")
    r.font.size = Pt(11)
    r.font.color.rgb = RGBColor(0x47, 0x55, 0x69)
    r = p_fac.add_run("Malathi G\nFaculty, BACSE350")
    r.font.size = Pt(12)
    r.font.bold = True

    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst.paragraph_format.space_before = Pt(36)
    p_inst.paragraph_format.space_after = Pt(4)
    r = p_inst.add_run("[INSTITUTION NAME - STUDENT TO FILL]\n")
    r.font.size = Pt(12)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0xDC, 0x26, 0x26)
    r = p_inst.add_run("October 2026\nSubmission Due: 29 October 2026, 11:59 PM")
    r.font.size = Pt(11)
    r.font.color.rgb = RGBColor(0x47, 0x55, 0x69)

    # Section break for body with header/footer
    sec_body = doc.add_section(docx.enum.section.WD_SECTION.NEW_PAGE)
    sec_body.header.is_linked_to_previous = False
    sec_body.footer.is_linked_to_previous = False

    p_head = sec_body.header.paragraphs[0]
    p_head.text = "NIRVAAN - Blockchain Architecture and Design (BACSE350)"
    p_head.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_head.style.font.name = "Times New Roman"
    p_head.style.font.size = Pt(8.5)
    p_head.style.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

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

    # =============================================================
    # ABSTRACT & DECLARATION
    # =============================================================
    add_heading_1(doc, "ABSTRACT")
    add_body_p(
        doc,
        "Public procurement across Indian oil and gas Public Sector Undertakings (PSUs) such as IOCL, BPCL, HPCL, and ONGC "
        "involves high-value contracts governed by statutory procurement guidelines from the Central Vigilance Commission (CVC). "
        "Existing electronic procurement portals rely on centralized relational databases managed by central administrators. "
        "This centralized architecture leaves commercial bids vulnerable to premature inspection before opening, administrative "
        "tampering, subjective technical disqualification, and delayed Earnest Money Deposit (EMD) refunds. In this capstone project, "
        "I designed and implemented NIRVAAN, an open e-tendering platform prototype built on the Ethereum Sepolia testnet. "
        "NIRVAAN uses an upgradeable smart contract (UUPS / ERC-1967) that enforces a commit-reveal bidding scheme with client-side "
        "32-byte salts, automated on-chain Lowest Evaluated Responsive Bidder (L1) selection, an escrow pull-payment model for "
        "EMD refunds, and a 7-day standstill appeal window with independent CVC dispute arbitration. The complete system comprises "
        "a Solidity smart contract, an Express.js backend with an adaptive event indexer and autonomous keeper bot, a React 18 single-page "
        "interface, and decentralized file storage on Pinata IPFS. Across 13 Hardhat unit tests, 24 backend integration tests, "
        "and 36 end-to-end smoke tests, the test suite achieved a 100% pass rate (73/73 tests)."
    )
    p_kw = doc.add_paragraph()
    p_kw.paragraph_format.space_after = Pt(8)
    r = p_kw.add_run("Keywords: ")
    r.font.bold = True
    p_kw.add_run("Public Procurement, Smart Contracts, Commit-Reveal Scheme, L1 Tender Enforcement, UUPS Proxy, Earnest Money Deposit, Central Vigilance Commission.")

    add_heading_2(doc, "Declaration and Acknowledgement")
    add_body_p(
        doc,
        "I, Tharun Revinth V S (Registration Number: 25BCE5268), declare that this report titled \"NIRVAAN: A Blockchain-Based "
        "E-Tendering Platform for Oil PSUs\" represents my own work carried out for the course Blockchain Architecture and Design "
        "(BACSE350). The smart contract code, backend services, frontend interface, and test suites were generated using AI "
        "development tools based on my architecture prompts, and were reviewed, debugged, integrated, and deployed by me. "
        "I express my gratitude to Prof. Malathi G for guidance throughout this course."
    )

    doc.add_page_break()

    # =============================================================
    # TABLE OF CONTENTS
    # =============================================================
    add_heading_1(doc, "TABLE OF CONTENTS")
    add_leader_line(doc, "1. Project Title", get_pg("sec_1"), bold=True)
    add_leader_line(doc, "2. Team Members with Name and Registration Number", get_pg("sec_2"), bold=True)
    add_leader_line(doc, "3. Problem Definition", get_pg("sec_3"), bold=True)
    add_leader_line(doc, "   3.1 Procurement Context in Strategic PSUs", get_pg("sec_3_1"), indent_inches=0.2)
    add_leader_line(doc, "   3.2 Vulnerabilities of Centralized E-Tendering", get_pg("sec_3_2"), indent_inches=0.2)
    add_leader_line(doc, "   3.3 Stakeholders and System Boundaries", get_pg("sec_3_3"), indent_inches=0.2)
    add_leader_line(doc, "4. Need for Blockchain", get_pg("sec_4"), bold=True)
    add_leader_line(doc, "   4.1 Limitations of Centralized Databases", get_pg("sec_4_1"), indent_inches=0.2)
    add_leader_line(doc, "   4.2 Blockchain Properties Applied to Tendering", get_pg("sec_4_2"), indent_inches=0.2)
    add_leader_line(doc, "   4.3 Related Systems", get_pg("sec_4_3"), indent_inches=0.2)
    add_leader_line(doc, "5. YouTube Upload Link", get_pg("sec_5"), bold=True)
    add_leader_line(doc, "6. Project Launch Link", get_pg("sec_6"), bold=True)
    add_leader_line(doc, "7. Softwares Used", get_pg("sec_7"), bold=True)
    add_leader_line(doc, "8. AI Models Used", get_pg("sec_8"), bold=True)
    add_leader_line(doc, "   Student Responsibility Statement", get_pg("sec_8_stmt"), indent_inches=0.2)
    add_leader_line(doc, "9. Detailed Architecture Diagram", get_pg("sec_9"), bold=True)
    add_leader_line(doc, "   9.1 System Architecture", get_pg("sec_9_1"), indent_inches=0.2)
    add_leader_line(doc, "   9.2 Tender State Machine Model", get_pg("sec_9_2"), indent_inches=0.2)
    add_leader_line(doc, "   9.3 Bid Lifecycle Sequence Model", get_pg("sec_9_3"), indent_inches=0.2)
    add_leader_line(doc, "   9.4 Data Partitioning and ER Model", get_pg("sec_9_4"), indent_inches=0.2)
    add_leader_line(doc, "10. Components of Blockchain and Smart Contract Explanation", get_pg("sec_10"), bold=True)
    add_leader_line(doc, "   10.1 Blockchain Primitives and UUPS Proxy Pattern", get_pg("sec_10_1"), indent_inches=0.2)
    add_leader_line(doc, "   10.2 Data Structures and Functions Reference", get_pg("sec_10_2"), indent_inches=0.2)
    add_leader_line(doc, "   10.3 Security Patterns and Measured Gas Profile", get_pg("sec_10_3"), indent_inches=0.2)
    add_leader_line(doc, "   10.4 Known Limitations and Prototype Scope", get_pg("sec_10_4"), indent_inches=0.2)
    add_leader_line(doc, "11. Sample Screenshots", get_pg("sec_11"), bold=True)
    add_leader_line(doc, "12. Conclusion", get_pg("sec_12"), bold=True)
    add_leader_line(doc, "References", get_pg("sec_refs"), bold=True)

    doc.add_page_break()

    # LIST OF FIGURES
    add_heading_1(doc, "LIST OF FIGURES")
    add_leader_line(doc, "Figure 1: System Architecture of the NIRVAAN Platform", get_pg("fig_1"))
    add_leader_line(doc, "Figure 2: Tender Lifecycle Finite State Machine Model", get_pg("fig_2"))
    add_leader_line(doc, "Figure 3: End-to-End Bid Lifecycle Sequence Model", get_pg("fig_3"))
    add_leader_line(doc, "Figure 4: Data Partitioning and Entity-Relationship Model", get_pg("fig_4"))
    add_leader_line(doc, "Figure 5: PSU Officer Authentication Portal", get_pg("fig_5"))
    add_leader_line(doc, "Figure 6: Backend Microservice Runtime Health and Diagnostics Endpoint", get_pg("fig_6"))

    p_sp2 = doc.add_paragraph()
    p_sp2.paragraph_format.space_before = Pt(12)

    # LIST OF TABLES
    add_heading_1(doc, "LIST OF TABLES")
    add_leader_line(doc, "Table 1: Stakeholders and Access Roles in NIRVAAN", get_pg("tab_1"))
    add_leader_line(doc, "Table 2: Centralized Database Systems vs. NIRVAAN Blockchain Architecture", get_pg("tab_2"))
    add_leader_line(doc, "Table 3: Mapping Procurement Problems to Blockchain Properties", get_pg("tab_3"))
    add_leader_line(doc, "Table 4: Declared Software Stack, Versions, and Architectural Roles", get_pg("tab_4"))
    add_leader_line(doc, "Table 5: Smart Contract External and Public Functions Reference", get_pg("tab_5"))
    add_leader_line(doc, "Table 6: Smart Contract Gas Consumption Profile Measured on Hardhat EVM", get_pg("tab_6"))
    add_leader_line(doc, "Table 7: Test Suite Execution Summary", get_pg("tab_7"))

    doc.add_page_break()

    # =============================================================
    # SECTION 1: PROJECT TITLE
    # =============================================================
    add_heading_1(doc, "1. Project Title")
    add_body_p(doc, "NIRVAAN: A Blockchain-Based E-Tendering Platform for Oil PSUs")
    add_bullet_p(doc, "BACSE350", "Course Code: ")
    add_bullet_p(doc, "Blockchain Architecture and Design", "Course Name: ")
    add_bullet_p(doc, "Malathi G", "Course Faculty: ")
    add_bullet_p(doc, "October 2026 (Due: 29 October 2026, 11:59 PM)", "Submission Date: ")

    # =============================================================
    # SECTION 2: TEAM MEMBERS
    # =============================================================
    add_heading_1(doc, "2. Team Members with Name and Registration Number")
    add_body_p(doc, "This is an individual capstone project developed by a single student:")
    
    tbl_team = doc.add_table(rows=2, cols=3)
    tbl_team.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row in tbl_team.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
    
    headers_t = ["Student Name", "Registration Number", "Project Contributions"]
    for i, h in enumerate(headers_t):
        cell = tbl_team.cell(0, i)
        set_cell_shading(cell, "0B1A30")
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        r.font.size = Pt(10)
    
    data_t = ["Tharun Revinth V S", "25BCE5268", "Platform architecture design, prompt-guided AI code generation, code review, test execution, backend integration, Sepolia deployment."]
    for i, val in enumerate(data_t):
        cell = tbl_team.cell(1, i)
        set_cell_shading(cell, "F8FAFC")
        p = cell.paragraphs[0]
        r = p.add_run(val)
        r.font.size = Pt(9.5)

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(4)

    # =============================================================
    # SECTION 3: PROBLEM DEFINITION
    # =============================================================
    add_heading_1(doc, "3. Problem Definition")

    add_heading_2(doc, "3.1 Procurement Context in Strategic PSUs")
    add_body_p(
        doc,
        "Public Sector Undertakings (PSUs) in the Indian hydrocarbon sector—including Indian Oil Corporation Limited (IOCL), "
        "Bharat Petroleum Corporation Limited (BPCL), Hindustan Petroleum Corporation Limited (HPCL), and Oil and Natural Gas "
        "Corporation (ONGC)—procure industrial equipment, refinery maintenance services, and pipeline infrastructure through public "
        "electronic tenders. These procurement exercises are subject to the Central Vigilance Commission (CVC) guidelines [3] "
        "and the General Financial Rules (GFR) 2017 [4]. Under GFR 2017 Rule 170, participating bidders submit bid security (Earnest "
        "Money Deposit or EMD) typically ranging between 2% and 5% of the estimated tender value to ensure bid seriousness."
    )

    add_heading_2(doc, "3.2 Vulnerabilities of Centralized E-Tendering")
    add_body_p(
        doc,
        "While government e-procurement portals have digitized tender notices and file submissions, their architectures remain "
        "centralized around institutional database administrators and centralized application servers. This concentration of authority "
        "introduces several operational vulnerabilities:"
    )
    add_bullet_p(doc, "Premature Bid Leakage: In centralized architectures, commercial quotes submitted by vendors reside on databases managed by portal administrators. Insider access or compromised credentials can expose sensitive financial figures prior to the official opening time, enabling favored bidders to adjust quotes.", "1. ")
    add_bullet_p(doc, "Database and Audit Trail Modification: Relational database logs and audit tables can be directly modified by privileged administrators (DBAs) with write access, making post-facto audit trails susceptible to undetected manipulation.", "2. ")
    add_bullet_p(doc, "Subjective Technical Disqualification: Officers evaluating technical proposals can disqualify qualified bidders on subjective grounds without an unalterable public record of evaluated criteria.", "3. ")
    add_bullet_p(doc, "Bidder Cartelization: Without automated commitment checks, collusive bidders can coordinate bids off-line or submit matching figures through straw companies.", "4. ")
    add_bullet_p(doc, "Delayed EMD Capital Refunds: Traditional bank guarantee or payment gateway refunds require manual reconciliation by PSU finance departments, locking up vendor working capital for extended periods.", "5. ")
    add_bullet_p(doc, "Disputed Awards and Absence of Standstill Windows: When an award is contested, work orders are frequently issued before grievances can be evaluated by an independent vigilance monitor.", "6. ")

    add_heading_2(doc, "3.3 Stakeholders and System Boundaries")
    add_body_p(
        doc,
        "To address these issues, NIRVAAN defines five operational roles with distinct responsibilities and authentication vectors, "
        "as summarized in Table 1."
    )

    add_table_title(doc, "Table 1: Stakeholders and Access Roles in NIRVAAN")
    tbl_s = doc.add_table(rows=6, cols=3)
    tbl_s.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row in tbl_s.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=50, bottom=50, left=80, right=80)
    
    headers_s = ["Stakeholder Role", "System Responsibilities", "Authentication Vector"]
    for i, h in enumerate(headers_s):
        cell = tbl_s.cell(0, i)
        set_cell_shading(cell, "0B1A30")
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        r.font.size = Pt(9.5)

    data_s = [
        ("PSU Procurement Officer", "Publishes Notice Inviting Tenders (NIT), evaluates opened technical bids, scores compliance, and initiates L1 award.", "Scoped JWT issued after bcrypt password validation."),
        ("Commercial Vendor / Bidder", "Applies for corporate KYC, submits cryptographically salted bid commitments, unseals bids, and files standstill appeals.", "MetaMask Web3 wallet (EIP-1193) with challenge nonce signatures."),
        ("CVC Vigilance Auditor", "Inspects unalterable event logs on-chain, reviews dispute claims, and resolves standstill appeals on-chain.", "Dedicated vigilance wallet registered in smart contract storage."),
        ("System Admin (Single Wallet in Prototype)", "Deploys initial contracts, configures system addresses, registers PSU officer entities, and authorizes UUPS upgrades.", "Contract deployer private key with onlyAdmin modifiers."),
        ("Autonomous Keeper Service", "Polls blockchain clock, executes scheduled bid openings, and finalizes tenders following appeal deadline expiry.", "Whitelisted server wallet executing keeper cron tasks.")
    ]
    for r_idx, row_data in enumerate(data_s):
        for c_idx, val in enumerate(row_data):
            cell = tbl_s.cell(r_idx + 1, c_idx)
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(4)

    add_body_p(
        doc,
        "System Boundaries: In this capstone prototype, the platform targets procurement for IOCL, BPCL, HPCL, ONGC, and GAIL. "
        "The scope encompasses tender notice publishing, client-salted sealed bidding, automated unsealing, on-chain technical scoring, "
        "L1 award determination, standstill dispute handling, and pull-payment EMD withdrawals. Off-chain document storage is handled "
        "via IPFS. Out of scope for this prototype are fiat banking integration, physical inspection workflows, and post-award contract delivery tracking."
    )

    # =============================================================
    # SECTION 4: NEED FOR BLOCKCHAIN
    # =============================================================
    add_heading_1(doc, "4. Need for Blockchain")

    add_heading_2(doc, "4.1 Limitations of Centralized Databases")
    add_body_p(
        doc,
        "A relational database management system (RDBMS) relies on access control lists and discretionary database privileges. "
        "Even when rows are encrypted, the database administrator or an attacker with superuser credentials can modify table "
        "records, delete audit trail rows, or alter bid values before the official opening timestamp. Applying Wüst and Gervais' "
        "methodology for blockchain suitability [5], procurement involves multiple distrusting participants (competing commercial suppliers "
        "and procurement agencies), requires immutable auditability, and benefits from deterministic execution of award rules. "
        "Table 2 highlights the structural differences between a traditional database approach and the NIRVAAN prototype."
    )

    add_table_title(doc, "Table 2: Centralized Database Systems vs. NIRVAAN Blockchain Architecture")
    tbl_db = doc.add_table(rows=8, cols=3)
    tbl_db.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row in tbl_db.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=50, bottom=50, left=80, right=80)

    headers_db = ["Architectural Dimension", "Traditional Centralized Database", "NIRVAAN Blockchain Prototype"]
    for i, h in enumerate(headers_db):
        cell = tbl_db.cell(0, i)
        set_cell_shading(cell, "0B1A30")
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        r.font.size = Pt(9.5)

    data_db = [
        ("Bid Confidentiality", "Commercial figures stored in server tables; vulnerable to insider preview.", "Client-salted Keccak-256 commitments; quotes cannot be unsealed before keeper triggers opening."),
        ("Audit Trail Integrity", "Stored in database audit tables; modifiable by privileged administrators.", "Append-only blockchain event logs on Ethereum Sepolia; immutable once confirmed."),
        ("Award Decision Logic", "Executed in closed server-side code; subject to manual override.", "Enforced on-chain by OilTenderingV1; contract requires winning bid to be lowest qualified (L1)."),
        ("Bid Security (EMD) Custody", "Funds held in central institutional accounts; manual reconciliation.", "Escrowed in smart contract; refunded via pull payments directly to bidder wallet."),
        ("Dispute Redressal", "Submitted through internal complaints; reviewed without fixed time bounds.", "7-day standstill on-chain with independent CVC ruling and 14-day inactivity timeout."),
        ("Single Point of Failure", "Central database server failure halts platform operations.", "Blockchain ledger is decentralized across Sepolia; backend and keeper run on a single Render instance in this prototype."),
        ("System Trust Model", "Requires trust in the platform hosting provider and administrators.", "Smart contract rules executed deterministically by the Ethereum Virtual Machine.")
    ]
    for r_idx, row_data in enumerate(data_db):
        for c_idx, val in enumerate(row_data):
            cell = tbl_db.cell(r_idx + 1, c_idx)
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(4)

    add_heading_2(doc, "4.2 Blockchain Properties Applied to Tendering")
    add_body_p(
        doc,
        "Table 3 maps specific procurement failure modes to the corresponding blockchain properties and their implementation in NIRVAAN."
    )

    add_table_title(doc, "Table 3: Mapping Procurement Problems to Blockchain Properties")
    tbl_map = doc.add_table(rows=7, cols=3)
    tbl_map.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row in tbl_map.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=50, bottom=50, left=80, right=80)

    headers_map = ["Procurement Failure Mode", "Blockchain Security Property", "Implementation in NIRVAAN"]
    for i, h in enumerate(headers_map):
        cell = tbl_map.cell(0, i)
        set_cell_shading(cell, "0B1A30")
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        r.font.size = Pt(9.5)

    data_map = [
        ("Premature Commercial Leakage", "Cryptographic Commitment", "Vendors compute keccak256(vendor, amount, salt, tenderId) locally. Only the commitment hash is broadcast during bidding."),
        ("Post-Submission Bid Tampering", "Immutability & Integrity", "Smart contract rejects reveal calls whose salt and quote do not match the stored commitment hash."),
        ("Subjective Award Selection", "Deterministic State Machine", "awardTender() iterates over opened bids on-chain and verifies that the winner has the lowest quote among qualified bidders."),
        ("Locked EMD Working Capital", "Escrow Pull Payments", "Non-winning bidders withdraw EMDs asynchronously through withdraw() once finalization or cancellation occurs."),
        ("Unchecked Dispute Dismissal", "Independent Smart Contract Role", "The CVC Auditor wallet adjudicates disputes on-chain; inactivity exceeding 14 days triggers automated timeout resolution."),
        ("Unauthorized Parameter Modification", "Access Control Modifiers", "Role-based modifiers (onlyPSU, onlyVendor, onlyKeeper, onlyCVC, onlyAdmin) guard state transitions.")
    ]
    for r_idx, row_data in enumerate(data_map):
        for c_idx, val in enumerate(row_data):
            cell = tbl_map.cell(r_idx + 1, c_idx)
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(4)

    add_heading_2(doc, "4.3 Related Systems")
    add_body_p(
        doc,
        "Existing public procurement platforms such as the Central Public Procurement Portal (CPPP) and Government e-Marketplace (GeM) "
        "in India rely on centralized relational databases and administrative access controls. While they digitalize tender document submission, "
        "premature bid visibility and audit log modification remain technically possible by privileged database administrators. "
        "Ukraine's ProZorro system introduced an open contracting data model using the Open Contracting Data Standard, but its underlying "
        "storage and bid opening procedures remain hosted on centralized institutional infrastructure. In the blockchain domain, "
        "the Ethereum Name Service (ENS) popularized commit-reveal auctions to prevent front-running in domain name registrations. "
        "NIRVAAN adapts this commit-reveal mechanism to multi-stage public tendering, combining client-side salting with automated on-chain "
        "L1 evaluation, a standstill appeal window, and pull-payment deposits that remove administrative custody over bidder funds."
    )

    # =============================================================
    # SECTION 5: YOUTUBE UPLOAD LINK
    # =============================================================
    add_heading_1(doc, "5. YouTube Upload Link")
    add_body_p(doc, "YouTube link: [ADD LINK AFTER UPLOAD]")
    add_body_p(
        doc,
        "This video demonstrates the end-to-end tender lifecycle in the NIRVAAN prototype, including officer tender creation, "
        "vendor sealed bid submission with client-side salt generation, automated keeper opening, bid reveal, technical scoring, "
        "L1 award, and withdrawal of refunded deposits."
    )

    # =============================================================
    # SECTION 6: PROJECT LAUNCH LINK
    # =============================================================
    add_heading_1(doc, "6. Project Launch Link")
    add_body_p(doc, "The prototype is deployed across public cloud and blockchain hosting environments:")
    
    p = doc.add_paragraph()
    r = p.add_run("Web Application (Vercel): "); r.font.bold = True
    add_hyperlink(p, "https://nirvaan-flame.vercel.app/", "https://nirvaan-flame.vercel.app/")

    p = doc.add_paragraph()
    r = p.add_run("Backend API Runtime Health (Render): "); r.font.bold = True
    add_hyperlink(p, "https://nirvaan-backend-84fc.onrender.com/api/health", "https://nirvaan-backend-84fc.onrender.com/api/health")

    p = doc.add_paragraph()
    r = p.add_run("Sepolia Proxy Contract: "); r.font.bold = True
    add_hyperlink(p, "https://sepolia.etherscan.io/address/0xe9649E82dC4fEdf86dFbE5120a3fE79BDde88663", "0xe9649E82dC4fEdf86dFbE5120a3fE79BDde88663")

    p = doc.add_paragraph()
    r = p.add_run("Sepolia Implementation Contract: "); r.font.bold = True
    add_hyperlink(p, "https://sepolia.etherscan.io/address/0xd5451fe17e92B9A9A8Abce4C6c1fc5bFF86f6606", "0xd5451fe17e92B9A9A8Abce4C6c1fc5bFF86f6606")

    add_bullet_p(doc, "11155111 (Ethereum Sepolia Testnet)", "Network Chain ID: ")
    add_bullet_p(doc, "11959326 (Block confirmation)", "Deployment Block: ")

    # =============================================================
    # SECTION 7: SOFTWARES USED
    # =============================================================
    add_heading_1(doc, "7. Softwares Used")
    add_body_p(
        doc,
        "Table 4 lists the software components and libraries used across the NIRVAAN prototype. On Render, the Node.js runtime "
        "resolved to version 26.12.0 (based on the package engines declaration >=22.0.0), while local development and testing ran on Node.js v24.17.0."
    )

    add_table_title(doc, "Table 4: Declared Software Stack, Versions, and Architectural Roles")
    tbl_sw = doc.add_table(rows=17, cols=3)
    tbl_sw.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row in tbl_sw.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=50, bottom=50, left=80, right=80)

    headers_sw = ["Software Component", "Declared version", "Architectural Role"]
    for i, h in enumerate(headers_sw):
        cell = tbl_sw.cell(0, i)
        set_cell_shading(cell, "0B1A30")
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        r.font.size = Pt(9.5)

    data_sw = [
        ("Solidity", "^0.8.24", "Smart contract language with support for Cancun EVM opcodes and transient storage."),
        ("Hardhat", "^2.22.8", "EVM development environment for contract compilation, test suites, and deployment scripts."),
        ("@openzeppelin/contracts-upgradeable", "^5.0.0", "UUPS proxy base contracts, Initializable modifier, and ReentrancyGuardUpgradeable [6]."),
        ("Ethers.js (Contracts)", "^6.13.2", "JavaScript interface for contract interaction, wallet signing, and ABI encoding."),
        ("Node.js (Backend)", "Render: 26.12.0 / Local: 24.17.0", "Runtime environment for backend API gateway, indexer, and keeper bot."),
        ("Express.js", "^4.19.2", "REST API server framework for officer authentication, nonces, and gas relays."),
        ("node:sqlite", "Native Node.js built-in", "Zero-dependency embedded database for read caching and off-chain indexing."),
        ("jsonwebtoken", "^9.0.2", "Issues and verifies scoped officer session tokens with PSU tenant claims."),
        ("bcryptjs", "^2.4.3", "Salted hashing of officer authentication passwords in SQLite database."),
        ("@pinata/sdk", "^2.1.0", "Pushes tender specification files and KYC documents to the IPFS network."),
        ("React", "^18.3.1", "Frontend library for the single-page user interface."),
        ("Vite", "^5.4.1", "Build tool and frontend development server."),
        ("Tailwind CSS", "^3.4.10", "Utility-first CSS framework adhering to GIGW design standards."),
        ("Lucide React", "^0.435.0", "Accessible UI iconography across tender stages."),
        ("Canvas Confetti", "^1.9.4", "User interface celebration animations upon successful tender award."),
        ("LibreOffice Headless", "7.6.x (Linux)", "Generates identical PDF documents from built DOCX submissions.")
    ]
    for r_idx, row_data in enumerate(data_sw):
        for c_idx, val in enumerate(row_data):
            cell = tbl_sw.cell(r_idx + 1, c_idx)
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(4)

    # =============================================================
    # SECTION 8: AI MODELS USED
    # =============================================================
    add_heading_1(doc, "8. AI Models Used")
    add_body_p(
        doc,
        "During this project, I used several large language model assistants as programming aids. The code, test suites, and "
        "configuration scripts in the repository were generated by these tools based on my technical instructions and specifications:"
    )
    add_bullet_p(doc, "Used for initial scaffolding of the Solidity smart contract, UUPS proxy setup, and Hardhat test assertions.", "Claude 3.5 Sonnet: ")
    add_bullet_p(doc, "Used for structuring backend event indexer fallback logic, SQLite schema setup, and test debugging.", "Claude 3.7 Sonnet: ")
    add_bullet_p(doc, "Used for generating React component layouts, GIGW accessibility styling, and Tailwind design adjustments.", "GPT-4o: ")
    add_bullet_p(doc, "Used for analyzing EVM gas optimization trade-offs and verifying edge cases in dispute timeout logic.", "DeepSeek-R1: ")

    add_heading_2(doc, "Student Responsibility Statement")
    add_body_p(
        doc,
        "I used AI tools as assistive programming aids for code scaffolding, documentation drafting, and test generation under "
        "my direction. I reviewed all generated smart contract code, backend routes, and test suites, verified them against the "
        "procurement rules, ran the test suites locally, and deployed the contracts and web services to their respective platforms. "
        "I take full responsibility for the design, architectural decisions, and final implementation presented in this report."
    )

    # =============================================================
    # SECTION 9: DETAILED ARCHITECTURE DIAGRAM
    # =============================================================
    add_heading_1(doc, "9. Detailed Architecture Diagram")

    add_heading_2(doc, "9.1 System Architecture")
    add_body_p(
        doc,
        "Figure 1 illustrates the multi-tier system architecture of NIRVAAN, showing the relationship between client browsers, "
        "Vercel CDN hosting, the Express backend and SQLite indexer on Render, Pinata IPFS, and the Ethereum Sepolia blockchain."
    )
    fig1_path = os.path.join(DIAGRAMS_DIR, "detailed_architecture.png")
    add_figure_image(doc, fig1_path, "Figure 1: System Architecture of the NIRVAAN Platform", width_inches=4.4)
    add_body_p(
        doc,
        "In this architecture, users interact with the React single-page frontend hosted on Vercel. Commercial bidders sign on-chain "
        "transactions directly using MetaMask, while officers authenticate through scoped JWTs with backend gas relays. The backend "
        "runs an event indexer that mirrors on-chain state into local SQLite, an embedded keeper that triggers time-dependent transitions, "
        "and pins documents to IPFS via Pinata."
    )

    add_heading_2(doc, "9.2 Tender State Machine Model")
    add_body_p(
        doc,
        "Figure 2 illustrates the finite state machine encoded in the smart contract enum TenderStatus, covering all seven contract "
        "states: Created, UnderEvaluation, Awarded, Disputed, DisputeResolved, Finalized, and Cancelled."
    )
    fig2_path = os.path.join(DIAGRAMS_DIR, "tender_state_machine.png")
    add_figure_image(doc, fig2_path, "Figure 2: Tender Lifecycle Finite State Machine Model", width_inches=4.4)
    add_body_p(
        doc,
        "Tenders begin in Created and move to UnderEvaluation once keeper triggers openBids() after the submission deadline. "
        "Following reveal and scoring, the officer awards the tender to the lowest responsive bidder, initiating a 7-day standstill. "
        "If appealed, an upheld dispute or a 14-day timeout clears the winner and returns the tender to UnderEvaluation; a dismissed "
        "dispute transitions status to DisputeResolved and forfeits the bond to the treasury. FinalizeTender() moves eligible tenders "
        "to Finalized, and cancelTender() cancels any active tender while refunding EMDs."
    )

    add_heading_2(doc, "9.3 Bid Lifecycle Sequence Model")
    add_body_p(
        doc,
        "Figure 3 depicts the chronological sequence of interactions across all seven lifecycle phases between the Vendor, "
        "PSU Officer, CVC Auditor, Express Backend, Autonomous Keeper, and the OilTenderingV1 smart contract."
    )
    fig3_path = os.path.join(DIAGRAMS_DIR, "bid_lifecycle_sequence.png")
    add_figure_image(doc, fig3_path, "Figure 3: End-to-End Bid Lifecycle Sequence Model", width_inches=4.4)
    add_body_p(
        doc,
        "The sequence starts with the vendor computing a client-salted hash and submitting a sealed bid with EMD. After keeper unsealing "
        "and vendor reveal, the officer scores proposals and executes the award on-chain. During the standstill window, disputes can be "
        "filed and adjudicated before the keeper finalizes the tender, enabling pull-payment withdrawals."
    )

    add_heading_2(doc, "9.4 Data Partitioning and ER Model")
    add_body_p(
        doc,
        "Figure 4 models the data partitioning strategy between on-chain storage, the off-chain SQLite database, and decentralized IPFS storage."
    )
    fig4_path = os.path.join(DIAGRAMS_DIR, "data_partition_er.png")
    add_figure_image(doc, fig4_path, "Figure 4: Data Partitioning and Entity-Relationship Model", width_inches=4.4)
    add_body_p(
        doc,
        "The smart contract holds core state including tender metadata, bid commitments, dispute records, and pull-payment balances. "
        "SQLite acts as an off-chain query cache rebuilt from on-chain event logs on server boot, while IPFS stores large tender specifications "
        "and vendor qualification filings referenced by their Content Identifiers (CIDs)."
    )

    # =============================================================
    # SECTION 10: COMPONENTS OF BLOCKCHAIN & SMART CONTRACT
    # =============================================================
    add_heading_1(doc, "10. Components of Blockchain and Explanation of the Smart Contract Used")

    add_heading_2(doc, "10.1 Blockchain Primitives and UUPS Proxy Pattern")
    add_body_p(
        doc,
        "The core protocol is built on the Ethereum Virtual Machine (EVM) and utilizes several standard blockchain primitives [1], [2]:"
    )
    add_bullet_p(doc, "Used for computing sealed bid commitments keccak256(vendor, amount, salt, tenderId) and hashing corporate GSTIN/PAN numbers for vendor privacy.", "Keccak-256 Cryptographic Hashing: ")
    add_bullet_p(doc, "Implemented using OpenZeppelin's ERC1967Proxy and UUPSUpgradeable pattern [7], [8]. The proxy delegates execution calls to the implementation contract via delegatecall while maintaining persistent state storage.", "Universal Upgradeable Proxy Standard (UUPS): ")
    add_bullet_p(doc, "To prevent re-entrancy attacks during ETH transfers, the contract uses OpenZeppelin's ReentrancyGuardUpgradeable and adopts a pull-payment withdrawal pattern where balances are credited to a mapping before withdrawal.", "Pull-Payment Escrow Pattern: ")

    add_heading_2(doc, "10.2 Data Structures and Functions Reference")
    add_body_p(
        doc,
        "The implementation contract OilTenderingV1 defines four primary data structures in Solidity storage:"
    )
    add_code_block(doc, 
"""struct Tender {
    uint256 id;
    address psuAddress;
    string ipfsHashDoc;
    uint256 submissionDeadline;
    uint256 openingTime;
    uint256 revealDeadline;
    uint256 appealDeadline;
    uint256 minEMDAmount;
    TenderStatus status;
    address winner;
    uint256 winningBidId;
    uint256 winningBidAmount;
}

struct Bid {
    uint256 id;
    uint256 tenderId;
    address vendorAddress;
    string encryptedBidIpfsHash;
    bytes32 bidCommitment;
    uint256 submissionTime;
    uint256 bidAmount;
    BidStatus status;
    bool isTechQualified;
    uint256 techScore;
    uint256 emdDeposited;
}

struct Dispute {
    uint256 tenderId;
    address challenger;
    string reasonIpfsHash;
    uint256 filedAt;
    uint256 timeoutAt;
    bool isResolved;
    bool isUpheld;
    string cvcReasonIpfsHash;
    uint256 disputeBondDeposited;
}

struct VendorKYC {
    bytes32 gstinHash;
    bytes32 panHash;
    string kycIpfsHash;
    uint256 registeredAt;
    bool isActive;
}"""
    )

    add_body_p(
        doc,
        "Table 5 details the complete public and external function interface of OilTenderingV1.sol, verifying access control "
        "guards and core invariants."
    )

    add_table_title(doc, "Table 5: Smart Contract External and Public Functions Reference")
    tbl_fn = doc.add_table(rows=18, cols=4)
    tbl_fn.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row in tbl_fn.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=50, bottom=50, left=80, right=80)

    headers_fn = ["Function Signature", "Access Guard", "Payable", "Purpose and Core Invariants Enforced"]
    for i, h in enumerate(headers_fn):
        cell = tbl_fn.cell(0, i)
        set_cell_shading(cell, "0B1A30")
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        r.font.size = Pt(9.5)

    data_fn = [
        ("initialize(admin, keeper, cvc, treasury, bond, emd)", "External (Initializer)", "No", "Initializes proxy storage. Configures admin, keeper, CVC auditor, treasury, dispute bond, and default EMD."),
        ("registerPSU(psuAddress)", "onlyAdmin", "No", "Accredits an institutional PSU procurement address to create and manage tenders."),
        ("registerVendor(vendor, gstinHash, panHash, kycCid)", "onlyAdmin", "No", "Registers a vendor address with hashed tax credentials and IPFS qualification documents."),
        ("createTender(ipfsDoc, subDead, openTime, revDead, minEMD)", "onlyPSU", "No", "Publishes a new tender. Enforces subDead > now, openTime >= subDead, revDead > openTime."),
        ("cancelTender(tenderId, reason)", "onlyPSU", "No", "Cancels tender prior to finalization and refunds all deposited EMDs inline to pendingWithdrawals."),
        ("submitBid(tenderId, encryptedDoc, commitment)", "onlyVendor", "Yes", "Accepts sealed bid commitment. Enforces deadline, minimum EMD, and blocks duplicate bids per vendor."),
        ("openBids(tenderId)", "onlyKeeper", "No", "Transitions tender to UnderEvaluation once block.timestamp >= openingTime."),
        ("revealBid(tenderId, bidIndex, bidAmount, salt)", "onlyVendor", "No", "Verifies salt and quote match stored commitment. Updates bid status to Opened."),
        ("setTechnicalScore(tenderId, bidIndex, qualified, score)", "onlyPSU", "No", "Records technical score (0-100) and qualification flag for opened proposals."),
        ("awardTender(tenderId, winner, bidId, bidAmount)", "onlyPSU", "No", "Enforces lowest qualified bid (L1) on-chain. Marks unrevealed bids Rejected and starts 7-day standstill."),
        ("disputeTender(tenderId, reasonIpfs)", "onlyVendor", "Yes", "Accepts standstill challenge with required dispute bond (0.01 ETH). Sets status to Disputed."),
        ("resolveDispute(tenderId, upheld, cvcReasonIpfs)", "onlyCVC", "No", "If upheld: clears winner, refunds bond, returns to UnderEvaluation. If dismissed: status to DisputeResolved, bond to treasury."),
        ("resolveDisputeTimeout(tenderId)", "Public", "No", "If CVC does not rule within 14 days, clears winner, refunds bond, and returns tender to UnderEvaluation."),
        ("finalizeTender(tenderId)", "onlyKeeper", "No", "Callable after standstill window expires. Invokes _creditRefunds() for non-rejected bids."),
        ("withdraw()", "External (nonReentrant)", "No", "Transfers pendingWithdrawals balance to msg.sender using low-level call."),
        ("setKeeperAddress(newKeeper)", "onlyAdmin", "No", "Updates the authorized keeper wallet address."),
        ("setCVCAuditorAddress(newCVC)", "onlyAdmin", "No", "Updates the authorized Central Vigilance Commission auditor wallet address.")
    ]
    for r_idx, row_data in enumerate(data_fn):
        for c_idx, val in enumerate(row_data):
            cell = tbl_fn.cell(r_idx + 1, c_idx)
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(8.5)

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(4)

    add_heading_2(doc, "10.3 Security Patterns and Measured Gas Profile")
    add_body_p(
        doc,
        "Table 6 reports the exact gas consumption measured from transaction execution receipts on the Hardhat local network. "
        "No values are rounded or estimated."
    )

    add_table_title(doc, "Table 6: Smart Contract Gas Consumption Profile Measured on Hardhat EVM")
    tbl_gas = doc.add_table(rows=18, cols=3)
    tbl_gas.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row in tbl_gas.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=50, bottom=50, left=80, right=80)

    headers_gas = ["Smart Contract Transaction", "Execution Context", "Measured Gas (Units)"]
    for i, h in enumerate(headers_gas):
        cell = tbl_gas.cell(0, i)
        set_cell_shading(cell, "0B1A30")
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        r.font.size = Pt(9.5)

    data_gas = [
        ("Implementation Deployment", "Initial contract compilation and bytecode deployment", "3,971,912"),
        ("ERC1967Proxy Deployment", "UUPS Proxy deployment pointing to implementation", "313,204"),
        ("registerPSU", "Admin registration of issuing PSU address", "52,451"),
        ("registerVendor", "Admin onboarding with GSTIN/PAN hashes", "166,350"),
        ("createTender", "Publishing tender notice and parameters", "264,487"),
        ("submitBid (First Bid)", "First sealed commitment and EMD storage allocation", "270,488"),
        ("submitBid (Subsequent)", "Subsequent bidder commitment storage", "236,288"),
        ("openBids", "Keeper state transition to UnderEvaluation", "56,274"),
        ("revealBid (First Reveal)", "Commitment hash check and quote unsealing", "87,187"),
        ("revealBid (Subsequent)", "Subsequent bidder quote unsealing", "87,199"),
        ("setTechnicalScore", "Officer technical compliance scoring", "65,407"),
        ("awardTender", "On-chain L1 validation loop and winner assignment", "132,698"),
        ("disputeTender", "Standstill challenge and dispute bond deposit", "203,739"),
        ("resolveDispute (Dismissed)", "CVC ruling with bond transfer to treasury", "110,642"),
        ("finalizeTender", "Keeper finalization and refund balance credits", "95,452"),
        ("withdraw", "Pull-payment transfer to caller wallet", "34,948"),
        ("cancelTender", "Tender cancellation with inline bidder refunds", "84,511")
    ]
    for r_idx, row_data in enumerate(data_gas):
        for c_idx, val in enumerate(row_data):
            cell = tbl_gas.cell(r_idx + 1, c_idx)
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(4)

    add_heading_2(doc, "10.4 Known Limitations and Prototype Scope")
    add_body_p(
        doc,
        "Review of the smart contract and backend architecture reveals several technical limitations in this prototype:"
    )
    add_bullet_p(doc, "Under awardTender(), any unrevealed bids remain in BidStatus.Submitted and are marked Rejected. In _creditRefunds(), only non-rejected bids receive refunds. Consequently, the EMD of unrevealed bids is not redistributed or transferred to the treasury, remaining locked in the contract balance.", "Unrevealed Bid EMD Retention: ")
    add_bullet_p(doc, "While bid amounts are concealed during the submission window, reveal transactions publish plaintext quotes to public mempools before confirmation. On a public network, front-running by competing revealers is mitigated by the fixed reveal deadline, but transaction ordering dependencies remain.", "Public Mempool Exposure During Reveal: ")
    add_bullet_p(doc, "In this prototype, the backend API server, event indexer, and keeper cron run on a single Render instance. If this instance experiences downtime, scheduled state transitions (such as openBids) pause until the service restarts.", "Centralized Worker and Keeper Deployment: ")
    add_bullet_p(doc, "The admin role is controlled by a single private key rather than a multi-signature consortium wallet (such as Gnosis Safe), which would be required for a production multi-PSU consortium.", "Single Admin Private Key: ")

    # =============================================================
    # SECTION 11: SAMPLE SCREENSHOTS
    # =============================================================
    add_heading_1(doc, "11. Sample Screenshots")
    add_body_p(
        doc,
        "Below are screenshots of the running platform components captured from the live deployment environments."
    )

    s1_path = os.path.join(SCREENSHOTS_DIR, "02_officer_login.png")
    add_figure_image(doc, s1_path, "Figure 5: PSU Officer Authentication Portal (Live at https://nirvaan-flame.vercel.app/)", width_inches=4.4)
    add_body_p(
        doc,
        "Figure 5 shows the authentication portal for PSU officers from IOCL, BPCL, HPCL, ONGC, and GAIL. Officers enter their assigned "
        "credentials to receive a scoped JSON Web Token (JWT) that enforces tenant isolation across administrative routes."
    )

    s2_path = os.path.join(SCREENSHOTS_DIR, "11_backend_health.png")
    add_figure_image(doc, s2_path, "Figure 6: Backend Microservice Runtime Health and Diagnostics Endpoint (Live on Render)", width_inches=4.4)
    add_body_p(
        doc,
        "Figure 6 displays the runtime health endpoint (/api/health) on Render. The JSON payload verifies that the backend relay is "
        "operational, the event indexer is synchronized with Sepolia block height with zero block lag, and the autonomous keeper is running."
    )

    # =============================================================
    # SECTION 12: CONCLUSION
    # =============================================================
    add_heading_1(doc, "12. Conclusion")
    add_body_p(
        doc,
        "In this capstone project, I designed, integrated, and verified NIRVAAN, an open e-tendering platform prototype for Indian "
        "oil and gas PSUs. The smart contract, backend services, and user interface were scaffolded using AI coding tools based on my "
        "architectural specifications, after which I reviewed, debugged, tested, and deployed the implementation. By combining client-side "
        "salted commitments, on-chain L1 award verification, an escrow pull-payment model, and an independent CVC standstill arbitration window, "
        "the prototype demonstrates how core procurement rules can be enforced deterministically."
    )

    add_body_p(
        doc,
        "Table 7 summarizes the automated verification test suites executed across all platform components before deployment."
    )

    add_table_title(doc, "Table 7: Test Suite Execution Summary")
    tbl_t = doc.add_table(rows=5, cols=4)
    tbl_t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for row in tbl_t.rows:
        for cell in row.cells:
            set_cell_margins(cell, top=50, bottom=50, left=80, right=80)

    headers_t = ["Test Suite Level", "Scope and Execution Harness", "Passing / Total", "Pass Rate"]
    for i, h in enumerate(headers_t):
        cell = tbl_t.cell(0, i)
        set_cell_shading(cell, "0B1A30")
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        r.font.size = Pt(9.5)

    data_t = [
        ("Smart Contract Unit Tests", "Hardhat EVM tests for proxy initialization, access guards, commit-reveal hashing, L1 awards, and dispute timeouts.", "13 / 13", "100%"),
        ("Backend Integration Tests", "Node.js test runner for SQLite indexer fallback, Alchemy 10-block batch recovery, and KYC application workflows.", "24 / 24", "100%"),
        ("End-to-End Smoke Tests", "Full lifecycle verification across tender creation, vendor onboarding, bid submission, scoring, and award.", "36 / 36", "100%"),
        ("Repository Secrets Audit", "Automated regex scan across all 127 tracked repository files for exposed private keys and API tokens.", "127 / 127 clean", "100%")
    ]
    for r_idx, row_data in enumerate(data_t):
        for c_idx, val in enumerate(row_data):
            cell = tbl_t.cell(r_idx + 1, c_idx)
            set_cell_shading(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)

    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(4)

    add_body_p(
        doc,
        "Lessons Learned: Working with smart contracts highlighted the importance of clear state machine definitions and minimal "
        "on-chain loops to keep gas costs manageable. Writing automated tests for keeper state transitions and error fallback in the "
        "event indexer was critical for reliable synchronization between Sepolia and the off-chain cache."
    )
    add_body_p(
        doc,
        "Future Work: For a production deployment, future iterations should transition the single administrator wallet to a multi-signature "
        "consortium wallet (e.g. Gnosis Safe), implement decentralized keeper networks (e.g. Chainlink Automation), add zero-knowledge "
        "proofs for technical qualification scoring, and address unrevealed EMD redistribution."
    )

    # =============================================================
    # REFERENCES
    # =============================================================
    add_heading_1(doc, "References")
    
    refs = [
        ("[1] ", "S. Nakamoto, \"Bitcoin: A Peer-to-Peer Electronic Cash System,\" 2008. Available: https://bitcoin.org/bitcoin.pdf"),
        ("[2] ", "V. Buterin, \"A Next-Generation Smart Contract and Decentralized Application Platform,\" Ethereum White Paper, 2014. Available: https://ethereum.org/en/whitepaper/"),
        ("[3] ", "Central Vigilance Commission, Government of India, \"Vigilance Manual,\" 2021. Available: https://www.cvc.gov.in/"),
        ("[4] ", "Ministry of Finance, Department of Expenditure, Government of India, \"General Financial Rules (GFR),\" Rule 170 (Bid Security), 2017. Available: https://doe.gov.in/order-rules/general-financial-rules-2017"),
        ("[5] ", "K. Wüst and A. Gervais, \"Do you need a Blockchain?,\" in Proceedings of the 2018 Crypto Valley Conference on Blockchain Technology (CVCBT), Zug, Switzerland, 2018, pp. 45–54. doi: 10.1109/CVCBT.2018.00011."),
        ("[6] ", "OpenZeppelin, \"OpenZeppelin Contracts (v5.0.0),\" 2023. Available: https://github.com/OpenZeppelin/openzeppelin-contracts"),
        ("[7] ", "Ethereum Foundation, \"ERC-1967: Standard Proxy Storage Slots,\" EIP-1967, 2019. Available: https://eips.ethereum.org/EIPS/eip-1967"),
        ("[8] ", "Ethereum Foundation, \"ERC-1822: Universal Upgradeable Proxy Standard (UUPS),\" EIP-1822, 2019. Available: https://eips.ethereum.org/EIPS/eip-1822")
    ]
    for num, cit in refs:
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.left_indent = Inches(0.25)
        p.paragraph_format.first_line_indent = Inches(-0.25)
        r1 = p.add_run(num)
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(10)
        r1.font.bold = True
        r2 = p.add_run(cit)
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(10)

    return doc

# -------------------------------------------------------------
# Main Execution with Two-Pass Page Calculation
# -------------------------------------------------------------
def extract_page_lookup_from_pdf(pdf_path):
    res = subprocess.run(["pdftotext", pdf_path, "-"], capture_output=True, text=True, check=True)
    raw_pages = res.stdout.split("\x0c")
    
    # Map of search pattern to page lookup key
    patterns = {
        "sec_1": r"^1\.\s+Project Title",
        "sec_2": r"^2\.\s+Team Members with Name",
        "sec_3": r"^3\.\s+Problem Definition",
        "sec_3_1": r"^3\.1\s+Procurement Context",
        "sec_3_2": r"^3\.2\s+Vulnerabilities of Centralized",
        "sec_3_3": r"^3\.3\s+Stakeholders and System Boundaries",
        "sec_4": r"^4\.\s+Need for Blockchain",
        "sec_4_1": r"^4\.1\s+Limitations of Centralized",
        "sec_4_2": r"^4\.2\s+Blockchain Properties Applied",
        "sec_4_3": r"^4\.3\s+Related Systems",
        "sec_5": r"^5\.\s+YouTube Upload Link",
        "sec_6": r"^6\.\s+Project Launch Link",
        "sec_7": r"^7\.\s+Softwares Used",
        "sec_8": r"^8\.\s+AI Models Used",
        "sec_8_stmt": r"^Student Responsibility Statement",
        "sec_9": r"^9\.\s+Detailed Architecture Diagram",
        "sec_9_1": r"^9\.1\s+System Architecture",
        "sec_9_2": r"^9\.2\s+Tender State Machine Model",
        "sec_9_3": r"^9\.3\s+Bid Lifecycle Sequence Model",
        "sec_9_4": r"^9\.4\s+Data Partitioning and ER Model",
        "sec_10": r"^10\.\s+Components of Blockchain and Explanation",
        "sec_10_1": r"^10\.1\s+Blockchain Primitives and UUPS",
        "sec_10_2": r"^10\.2\s+Data Structures and Functions Reference",
        "sec_10_3": r"^10\.3\s+Security Patterns and Measured Gas",
        "sec_10_4": r"^10\.4\s+Known Limitations and Prototype Scope",
        "sec_11": r"^11\.\s+Sample Screenshots",
        "sec_12": r"^12\.\s+Conclusion",
        "sec_refs": r"^References$",
        "fig_1": r"^Figure 1:\s+System Architecture",
        "fig_2": r"^Figure 2:\s+Tender Lifecycle",
        "fig_3": r"^Figure 3:\s+End-to-End Bid Lifecycle",
        "fig_4": r"^Figure 4:\s+Data Partitioning and Entity-Relationship",
        "fig_5": r"^Figure 5:\s+PSU Officer Authentication",
        "fig_6": r"^Figure 6:\s+Backend Microservice Runtime",
        "tab_1": r"^Table 1:\s+Stakeholders and Access Roles",
        "tab_2": r"^Table 2:\s+Centralized Database Systems",
        "tab_3": r"^Table 3:\s+Mapping Procurement Problems",
        "tab_4": r"^Table 4:\s+Declared Software Stack",
        "tab_5": r"^Table 5:\s+Smart Contract External and Public",
        "tab_6": r"^Table 6:\s+Smart Contract Gas Consumption",
        "tab_7": r"^Table 7:\s+Test Suite Execution Summary"
    }
    
    lookup = {}
    # Scan from page index 4 onwards (Page 5 where body begins) to avoid matching TOC entries
    for pg_idx in range(4, len(raw_pages) - 1):
        pg_num = pg_idx + 1
        pg_text = raw_pages[pg_idx]
        for line in pg_text.splitlines():
            line_s = line.strip()
            for key, pat in patterns.items():
                if key not in lookup and re.search(pat, line_s, re.IGNORECASE):
                    lookup[key] = pg_num

    print(f"Extracted {len(lookup)}/{len(patterns)} anchor locations from PDF.")
    return lookup

def main():
    print("Executing Pass 1 (Draft build for page geometry)...")
    doc_pass1 = build_submission_doc()
    doc_pass1.save(DOCX_OUT)
    
    print("Converting Pass 1 to PDF with headless LibreOffice...")
    subprocess.run(["libreoffice", "--headless", "--convert-to", "pdf", DOCX_OUT, "--outdir", "/home/cybernode/Projects/nirvaan/docs"], check=True)
    
    print("Analyzing Pass 1 PDF to extract exact heading and figure page numbers...")
    page_lookup = extract_page_lookup_from_pdf(PDF_OUT)
    
    print("Executing Pass 2 (Final build with populated TOC, List of Figures, and List of Tables)...")
    doc_pass2 = build_submission_doc(page_lookup=page_lookup)
    doc_pass2.save(DOCX_OUT)
    
    print("Converting Pass 2 to PDF...")
    subprocess.run(["libreoffice", "--headless", "--convert-to", "pdf", DOCX_OUT, "--outdir", "/home/cybernode/Projects/nirvaan/docs"], check=True)
    
    # Final check
    res = subprocess.run(["pdfinfo", PDF_OUT], capture_output=True, text=True, check=True)
    for line in res.stdout.splitlines():
        if "Pages:" in line:
            print(f"FINAL PDF RESULT: {line.strip()}")

if __name__ == "__main__":
    main()
