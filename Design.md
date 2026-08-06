---
name: Precision Procurement System
colors:
  surface: "#f7f9fb"
  surface-dim: "#d8dadc"
  surface-bright: "#f7f9fb"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f2f4f6"
  surface-container: "#eceef0"
  surface-container-high: "#e6e8ea"
  surface-container-highest: "#e0e3e5"
  on-surface: "#191c1e"
  on-surface-variant: "#3d4947"
  inverse-surface: "#2d3133"
  inverse-on-surface: "#eff1f3"
  outline: "#6d7a77"
  outline-variant: "#bcc9c6"
  surface-tint: "#006a61"
  primary: "#00685f"
  on-primary: "#ffffff"
  primary-container: "#008378"
  on-primary-container: "#f4fffc"
  inverse-primary: "#6bd8cb"
  secondary: "#565e74"
  on-secondary: "#ffffff"
  secondary-container: "#dae2fd"
  on-secondary-container: "#5c647a"
  tertiary: "#4d5d73"
  on-tertiary: "#ffffff"
  tertiary-container: "#66768d"
  on-tertiary-container: "#fdfcff"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  primary-fixed: "#89f5e7"
  primary-fixed-dim: "#6bd8cb"
  on-primary-fixed: "#00201d"
  on-primary-fixed-variant: "#005049"
  secondary-fixed: "#dae2fd"
  secondary-fixed-dim: "#bec6e0"
  on-secondary-fixed: "#131b2e"
  on-secondary-fixed-variant: "#3f465c"
  tertiary-fixed: "#d3e4fe"
  tertiary-fixed-dim: "#b7c8e1"
  on-tertiary-fixed: "#0b1c30"
  on-tertiary-fixed-variant: "#38485d"
  background: "#f7f9fb"
  on-background: "#191c1e"
  surface-variant: "#e0e3e5"
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: "700"
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: "600"
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
    letterSpacing: -0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 16px
    letterSpacing: 0.01em
  mono-label:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  stack-xs: 4px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  stack-xl: 48px
---

## Brand & Style

The design system is engineered for B2B procurement and high-stakes financial reconciliation. The personality is authoritative, calm, and hyper-efficient. It draws primarily from **Modern Corporate Minimalism**, emphasizing clarity, rigorous alignment, and a reduction of visual noise to facilitate complex decision-making.

The aesthetic prioritizes functionality over decoration, utilizing a "Software-as-an-Infrastructure" approach. It features high information density balanced by purposeful whitespace, subtle depth, and a focused color application that directs attention only where necessary.

## Colors

The palette is rooted in a structured range of Slate and Zinc grays to establish a professional foundation.

- **Primary (Teal 600):** Reserved strictly for primary actions, progress indicators, and active states. It acts as a "beacon" within a neutral environment.
- **Surface & Background:** White (#FFFFFF) is used for the primary workspace (cards, canvases), while Slate 50 (#F8FAFC) provides structural contrast for sidebars and background grounding.
- **Typography:** Slate 900 for maximum legibility in body text; Slate 500 for secondary information and metadata.
- **Borders:** Slate 200 is the standard for hair-line dividers and component boundaries, ensuring separation without visual clutter.

## Typography

This design system utilizes **Inter** for all UI elements to take advantage of its exceptional legibility and neutral tone.

- **Tracking:** Tight letter spacing (-1% to -2%) is applied to headings to create a modern, "engineered" look.
- **Hierarchy:** Contrast is achieved through weight (Medium/SemiBold) rather than extreme size shifts, maintaining a compact density suitable for data-rich dashboards.
- **Monospacing:** Use JetBrains Mono for transaction IDs, currency amounts, and SKU numbers to ensure character alignment in tables and financial reports.

## Layout & Spacing

The layout follows a **12-column fluid grid** for desktop, optimized for a maximum content width of 1440px.

- **Rhythm:** A strict 4px base unit governs all dimensions.
- **Density:** High-density views (tables, lists) use 8px or 12px vertical padding. Low-density views (settings, landing pages) use 16px or 24px.
- **Adaptation:** On mobile, columns collapse to a single stack with 16px side margins. On tablet, the grid transitions to 8 columns with 24px margins.

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **Soft Ambient Shadows**.

- **Level 0 (Flat):** Used for the main background (Slate 50).
- **Level 1 (Raised):** Cards and primary containers use White background with a 1px border (Slate 200). No shadow is used for static elements.
- **Level 2 (Overlay):** Dropdowns, tooltips, and floating menus use a very soft, diffused shadow (0px 4px 12px rgba(15, 23, 42, 0.08)) to indicate interactivity and separation from the base canvas.
- **Active State:** Elements being dragged or high-priority modals use a sharper, more defined shadow (0px 10px 25px rgba(15, 23, 42, 0.12)).

## Shapes

The shape language is controlled and precise.

- **Base (8px):** Standard for buttons, input fields, and small UI components.
- **Large (12px):** Used for cards and primary layout containers.
- **Extra Large (16px):** Reserved for modals and large-scale empty state illustrations.
- **Pill (Full):** Used exclusively for Status Badges (e.g., "Paid", "Pending") and search bars.

## Components

- **Buttons:** Primary buttons use the Teal 600 background with white text. Secondary buttons use a white background with a Slate 200 border. Hover states should involve a subtle darken (Teal 700) or a faint gray fill (Slate 100).
- **Input Fields:** 1px Slate 200 border, 8px radius. On focus, the border transitions to Teal 600 with a 2px outer glow (Teal 600 at 10% opacity).
- **Data Tables:** These are the core of the system. Use "Zebra" striping only on extremely wide tables. Default to thin 1px horizontal dividers. Header cells should use `label-md` in Slate 500 with uppercase transformation.
- **Status Chips:** High-contrast text on low-contrast backgrounds (e.g., Success is Emerald 700 text on Emerald 50 background).
- **Cards:** White background, 1px Slate 200 border, 12px corner radius. Group related data points using internal dividers rather than multiple nested cards.
- **Navigation:** Vertical sidebar using Slate 50 background. Active links should be indicated by a Teal 600 vertical bar (2px width) on the leading edge and a subtle weight change in text.
