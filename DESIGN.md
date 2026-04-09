```markdown
# Design System Specification: The Digital Atelier

## 1. Overview & Creative North Star: "The Curated Canvas"

This design system is built upon the concept of **"The Curated Canvas."** In the world of high-end fashion, the garment is the protagonist, and the environment must serve as a sophisticated, quiet backdrop that elevates the subject.

We move beyond the "app-like" feel of standard UI by adopting an **Editorial Intelligence** approach. This means breaking away from rigid, boxed-in layouts in favor of intentional asymmetry, overlapping elements, and generous white space. The goal is to make the user feel like they are flipping through a premium digital lookbook rather than interacting with a cold AI tool. We prioritize breathability, tonal depth, and tactile elegance.

---

## 2. Colors: Tonal Sophistication

Our palette is rooted in organic neutrals that mimic high-quality textiles—linen, stone, and parchment—punctuated by a deep, authoritative Emerald.

### The Palette

- **Primary (Emerald Deep):** `#003527` – Used for moments of peak brand authority and primary actions.
- **Secondary (Sandstone):** `#695c50` – Used for supportive UI elements and secondary narratives.
- **Tertiary (Terracotta Clay):** `#501e12` – A warm, muted accent for specific highlights.
- **Neutrals:** A range from `surface` (`#f9f9f6`) to `surface-container-highest` (`#e2e3e0`).

### Strategic Implementation

- **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Definition must be achieved through background shifts. For example, a `surface-container-low` (`#f4f4f1`) card sitting on a `surface` (`#f9f9f6`) background.
- **The Glass & Gradient Rule:** For primary CTAs, use a subtle linear gradient from `primary` (`#003527`) to `primary_container` (`#064e3b`). For floating overlays (like an AI suggestion toast), utilize Glassmorphism: `surface` at 70% opacity with a `20px` backdrop-blur.
- **Surface Hierarchy:**
- **Level 0 (Base):** `surface` (`#f9f9f6`)
- **Level 1 (Sections):** `surface-container-low` (`#f4f4f1`)
- **Level 2 (Interactive Cards):** `surface-container-lowest` (`#ffffff`)

---

## 3. Typography: The Editorial Mix

We utilize a high-contrast typographic pairing to signal the intersection of "Traditional Craft" (Serif) and "Modern Technology" (Sans-Serif).

- **Display & Headlines (Noto Serif):** This is our "Editorial" voice. Use `display-lg` (3.5rem) for hero statements and `headline-md` (1.75rem) for category titles. The serif should feel "airy"—ensure a line-height of at least 1.2 to 1.3.
- **UI & Body (Manrope):** This is our "Functional" voice. Manrope provides a clean, geometric counterpoint. Use `body-lg` (1rem) for descriptions and `label-md` (0.75rem) for technical metadata.
- **Intentional Asymmetry:** Don't center-align everything. Use left-aligned headlines paired with slightly offset body text to create a more dynamic, "designed" feel.

---

## 4. Elevation & Depth: Tonal Layering

In this system, depth is felt, not seen. We avoid heavy drop shadows in favor of light and material behavior.

- **The Layering Principle:** Achieve "lift" by stacking light on dark. Place a `surface-container-lowest` card on a `surface-container-low` background. This creates a natural, soft distinction.
- **Ambient Shadows:** For floating elements like a "Generate" FAB, use an extra-diffused shadow: `box-shadow: 0 12px 40px rgba(26, 28, 27, 0.06)`. Note the low opacity (6%) and large blur—this mimics ambient gallery lighting.
- **The Ghost Border Fallback:** If a container requires further definition (e.g., in high-glare environments), use the `outline-variant` (`#bfc9c3`) at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components: The Wardrobe Elements

### Primary Buttons

- **Style:** `primary` background with `on_primary` text.
- **Shape:** `md` (0.75rem) or `full` (pill) for a softer feel.
- **Interaction:** On hover, transition to `primary_container`. No borders.

### The Outfit Card

- **Structure:** No dividers. Separate the garment image from the description using `24px` of vertical whitespace.
- **Background:** Use `surface-container-lowest` with an `xl` (1.5rem) corner radius.
- **Metadata:** Use `label-sm` in `secondary` (`#695c50`) to provide "DNA" details of the outfit.

### AI Input Fields

- **Style:** Minimalist. A single line using `outline` (`#707974`) at 20% opacity.
- **Active State:** The line transitions to `primary` (`#003527`) with a subtle `2px` thickness. The label moves from `body-md` to `label-sm` above the field.

### Selection Chips (The "Swatches")

- **Unselected:** `surface-container-high` background, `on_surface_variant` text.
- **Selected:** `primary` background, `on_primary` text.
- **Radius:** `full` (9999px) for a soft, tactile feel.

---

## 6. Do’s and Don’ts

### Do

- **Do** use white space as a structural element. If a layout feels cluttered, increase the margin rather than adding a divider.
- **Do** lean into asymmetry. Try placing an image slightly off-center to create visual interest.
- **Do** use the `tertiary` color (`#501e12`) sparingly for "Smart Suggestions" or AI-driven insights to distinguish them from standard UI.

### Don't

- **Don't** use pure black (`#000000`). Our "on-surface" is a sophisticated charcoal (`#1a1c1b`) which feels more natural.
- **Don't** use standard 4px "box-y" corners. Stick to the `md` (12px) or `xl` (24px) scale to maintain the premium, soft aesthetic.
- **Don't** use dividers or lines to separate list items. Use a `12px` to `16px` gap and subtle background shifts if necessary.

## 7. Signature Detail: The "Fabric" Blur

When transitioning between screens or opening the AI generation tray, use a `30px` backdrop-filter blur on the incoming surface. This creates a "frosted glass" effect that allows the underlying colors of the user's outfit selections to bleed through, making the experience feel integrated and fluid.```
```

