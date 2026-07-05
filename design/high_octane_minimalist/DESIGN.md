---
name: High-Octane Minimalist
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1b1b1b'
  on-surface-variant: '#4c4546'
  inverse-surface: '#303030'
  inverse-on-surface: '#f1f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5d5f5f'
  on-secondary: '#ffffff'
  secondary-container: '#dfe0e0'
  on-secondary-container: '#616363'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1b'
  on-tertiary-container: '#848484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1b1b1b'
  on-tertiary-fixed-variant: '#474747'
  background: '#f9f9f9'
  on-background: '#1b1b1b'
  surface-variant: '#e2e2e2'
  action-red: '#FF0000'
  neon-accent: '#CCFF00'
  surface-muted: '#EBEBEB'
  border-high-contrast: '#000000'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 28px
    fontWeight: '800'
    lineHeight: '1.2'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  button-text:
    fontFamily: Montserrat
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1'
spacing:
  base: 8px
  margin-mobile: 20px
  gutter-mobile: 12px
  section-gap: 64px
---

## Brand & Style

The design system is engineered for the high-performance automotive enthusiast. It evokes a premium, mechanical, and precise emotional response, mirroring the engineering of the vehicles featured in the posters. The aesthetic is built on **Brutalist Minimalism**: a marriage of raw, bold structural elements with clean, intentional whitespace.

Key brand pillars include:
- **Authority:** Heavy-weight typography and a monochromatic foundation.
- **Precision:** Sharp corners and a strict grid system that avoids soft shadows or organic shapes.
- **Contrast:** A "stark" visual language where information is prioritized through massive scale shifts and high-visibility accent hits.
- **Automotive Heritage:** Visual cues drawn from racing livery, dashboard instrumentation, and technical spec sheets.

## Colors

The palette is strictly functional. It relies on a "Tuxedo" base of pure black and white to maintain a premium, editorial feel. 

- **Primary & Secondary:** Used to create the core interface structure. Black is the primary driver for text and borders; white provides the expansive negative space.
- **Surface Muted:** A subtle gray used exclusively for product card backgrounds to provide a soft container for poster artwork without introducing distracting shadows.
- **High-Visibility Accents:** `action-red` and `neon-accent` are reserved for critical calls-to-action (CTAs) and status indicators, mimicking the "redline" on a tachometer.
- **Contrast Rules:** Avoid mid-tone grays. Elements are either starkly defined or recede entirely into the background.

## Typography

Typography functions as a structural element. We use **Montserrat** for headlines to provide a heavy, geometric weight that feels like automotive branding. 

- **Hierarchy:** Extreme scale differences between headlines and body text are encouraged.
- **Casing:** Headlines, buttons, and labels should be set in **all-caps** to reinforce the bold, industrial tone.
- **Readability:** **Hanken Grotesk** is used for body copy to ensure high legibility on mobile screens, providing a clean, contemporary balance to the aggressive headlines.
- **Technical Flair:** **Space Grotesk** is utilized for labels and metadata (e.g., pricing, dimensions) to give a nod to technical specifications.

## Layout & Spacing

This design system uses a **Fixed Grid** model for mobile to ensure the high-contrast borders and containers maintain their geometric integrity.

- **Grid:** A 4-column grid for mobile, expanding to 12 columns for tablet/desktop. 
- **Rhythm:** An 8px base unit governs all padding and margins.
- **Negative Space:** Generous vertical spacing (Section Gaps) is required between major content blocks to prevent the bold typography from feeling cluttered.
- **Mobile Reflow:** For product lists, use a 2-column "stacked" layout to maintain artwork detail, reverting to a single-column wide format for featured "New Launch" items.

## Elevation & Depth

In keeping with the Brutalist approach, this design system **completely rejects soft shadows and gradients**. Depth is communicated through:

- **Bold Borders:** Use 2px or 3px solid black borders to define containers.
- **Tonal Layering:** The `surface-muted` gray provides the only sense of "depth" by differentiating product areas from the main white canvas.
- **Hard Offsets:** If a "lifted" effect is needed, use a hard, solid-color offset (e.g., a black box 4px behind a white box) rather than a blur.
- **Stark Overlays:** Modals and menus should use 100% opaque backgrounds or high-contrast inverted colors (white text on black background) to demand immediate focus.

## Shapes

The shape language is **Sharp (0)**. 

Every UI element—including buttons, input fields, product cards, and images—must have 0px corner radii. This reinforces the high-performance, precision-engineered aesthetic of the automotive world. Circles are permitted only for specific iconography or status pips where a square would be illegible.

## Components

### Buttons
- **Primary:** Solid black background, white `button-text`, sharp corners. High-impact.
- **Secondary/CTA:** Solid `action-red` or `neon-accent` background with black text for "Buy Now" or "Checkout."
- **Ghost:** 2px solid black border, no background, black text.

### Product Cards
- **Container:** `surface-muted` background, sharp corners, no border.
- **Image:** Inset with a 1px solid border to separate the white poster margins from the gray container.
- **Details:** Text left-aligned or centered, using `label-caps` for pricing and `headline-sm` for titles.

### Input Fields
- **Style:** 2px solid black bottom border only (minimalist) or full 4-sided 2px border. 
- **Active State:** Border color shifts to `action-red`.

### Chips & Badges
- **Style:** Solid black background with white `label-caps` text. Used for "New," "Limited Edition," or "Sold Out."

### Navigation
- **Top Bar:** Fixed, pure white background, 1px solid black bottom border. Logo centered or left-aligned in a heavy weight.