---
name: Sovereign Ledger
colors:
  surface: '#f9f9ff'
  surface-dim: '#d8dae2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3fc'
  surface-container: '#ecedf6'
  surface-container-high: '#e6e8f0'
  surface-container-highest: '#e1e2eb'
  on-surface: '#191c22'
  on-surface-variant: '#564339'
  inverse-surface: '#2d3037'
  inverse-on-surface: '#eff0f9'
  outline: '#897268'
  outline-variant: '#ddc1b5'
  surface-tint: '#9d4307'
  primary: '#702c00'
  on-primary: '#ffffff'
  primary-container: '#953d00'
  on-primary-container: '#ffc1a3'
  inverse-primary: '#ffb692'
  secondary: '#44617b'
  on-secondary: '#ffffff'
  secondary-container: '#c2e0ff'
  on-secondary-container: '#47647e'
  tertiary: '#003f81'
  on-tertiary: '#ffffff'
  tertiary-container: '#0056ac'
  on-tertiary-container: '#b6cfff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcb'
  primary-fixed-dim: '#ffb692'
  on-primary-fixed: '#341100'
  on-primary-fixed-variant: '#793000'
  secondary-fixed: '#cde5ff'
  secondary-fixed-dim: '#accae8'
  on-secondary-fixed: '#001d32'
  on-secondary-fixed-variant: '#2c4962'
  tertiary-fixed: '#d6e3ff'
  tertiary-fixed-dim: '#aac7ff'
  on-tertiary-fixed: '#001b3e'
  on-tertiary-fixed-variant: '#00458d'
  background: '#f9f9ff'
  on-background: '#191c22'
  surface-variant: '#e1e2eb'
  national-identity-bar: '#ffffff'
  accessibility-bar: '#2d3038'
  surface-ledger: '#f9f9ff'
  border-hairline: rgba(25, 28, 34, 0.15)
typography:
  headline-lg:
    fontFamily: Noto Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Noto Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Noto Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Noto Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Noto Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Noto Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  label-caps:
    fontFamily: Noto Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  container-max: 1200px
---

## Brand & Style
The design system is an official, institutional framework designed for the Indian Government’s digital infrastructure. It transitions from a technical industrial aesthetic to a **GIGW-compliant (Guidelines for Indian Government Websites)** portal, prioritizing accessibility, neutrality, and bilingual readiness. The brand personality is authoritative, transparent, and stable, evoking the trust associated with a national record or public ledger.

The design style is **Bureaucratic Minimalism**. It avoids all decorative flourishes, shadows, and rounded corners in favor of a strict document-like structure. The interface is defined by clean lines, high legibility, and a rhythmic use of hairline borders. It follows a "ledger" metaphor where information is treated as a permanent entry in an official registry.

## Colors
The palette is professional and grounded, meeting contrast requirements for universal accessibility.

- **National Identity Bar:** A pure white or very light gray (`#ffffff`) reserved for the top-most header containing the National Emblem and "Government of India" branding.
- **Accessibility Bar:** A high-contrast dark utility bar (`#2d3038`) providing tools for font resizing, screen reader optimization, and color scheme switching.
- **Primary & Secondary:** Retained for branding continuity but applied with restraint to functional elements like official seals and verified badges.
- **Surface & Borders:** The design uses a neutral surface (`#f9f9ff`) paired with hairline borders (`border-on-surface/15`) instead of shadows to delineate content zones and containers.

## Typography
The system uses **Noto Sans** as the primary typeface for its neutral, authoritative tone and exceptional support for Indic scripts, ensuring GIGW compliance for bilingual content.

- **Headlines:** Set in Noto Sans to replace the previous condensed style, providing a more approachable yet official appearance.
- **Body & Labels:** Noto Sans maintains high legibility across document-heavy pages.
- **Monospace:** **IBM Plex Mono** is reserved exclusively for cryptographic hashes, timestamps, and transaction reference numbers to ensure character alignment and a "ledger" feel.
- **Copy Style:** Use plain language. "Execute Submission" is replaced by "Submit Bid." Identification tokens should use "Officer ID" or "Authorized User ID," and sessions are referred to as "Reference No." or "Transaction Reference."

## Layout & Spacing
The layout follows a **Fixed Grid** model to ensure content remains centered and readable on large displays, mirroring the structure of official government gazettes.

- **Grid:** A 12-column system with a 1200px max-width container for desktop.
- **Rhythm:** A 4px baseline grid governs all vertical spacing.
- **Margins:** 24px side margins are maintained on all devices to ensure content does not touch the edge of the viewport.
- **Adaptation:** On mobile, the layout transitions to a single-column stack. Data tables should allow for horizontal scrolling within their containers rather than reflowing, to preserve the integrity of row-based data.

## Elevation & Depth
In accordance with a ledger-based aesthetic, this design system **forgoes shadows entirely**. Depth is communicated through structural hierarchy and tonal shifts.

- **Hairline Outlines:** All containers and cards use a 1px solid border (`#191c22` at 15% opacity).
- **Tonal Layering:** The National Identity Bar and main content containers sit on the base surface, while the Accessibility Bar provides a dark contrast at the top.
- **Flat UI:** Interaction states (hover/active) are indicated by fill color changes or weight increases in borders rather than an "elevation lift."

## Shapes
The design system enforces a **strict Zero Border-Radius policy**. All elements—including buttons, cards, input fields, and alerts—must have sharp, 90-degree corners. This evokes the feel of a physical paper document and reinforces the institutional, unyielding nature of a government portal.

## Components

### National Identity & Accessibility Bars
- **Identity Bar:** Contains the State Emblem of India (left-aligned) and the "Government of India" text. Background is pure white.
- **Accessibility Bar:** Sits above the Identity Bar. Includes buttons for `A+`, `A`, `A-` font sizing and a high-contrast toggle.

### Official Buttons
- **Primary:** Sharp corners, solid `#953d00` background, white text. Labels must be direct (e.g., "SUBMIT BID").
- **Secondary:** Sharp corners, 1px hairline border, no background.
- **States:** Focus states must use a 2px high-contrast outline to meet GIGW accessibility standards.

### Data Ledger Tables
- **Header:** Light gray background (`#ecedf7`) with bold Noto Sans text.
- **Cells:** 1px hairline bottom borders. Reference numbers and timestamps use `code-md`.
- **Labels:** Use "Transaction Reference" for all unique IDs.

### Input Fields
- **Structure:** Sharp corners, 1px border. Labels are placed above the field for clarity.
- **Reference Info:** Fields for User IDs should be labeled "Officer ID" or "Authorized User ID."

### Cards & Containers
- **Visuals:** White background, sharp corners, 1px border (`#191c22` at 15% opacity). No shadow.
- **Padding:** Generous internal padding (24px) to ensure clear separation of form groups and text blocks.