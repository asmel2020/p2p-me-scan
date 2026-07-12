# P2P.me Design System Analysis

> Analysis Date: 2026-07-11
> URL: https://app.p2p.me/

---

## 1. Brand & Logo

| Element | Detail |
|---|---|
| **Logo** | Custom SVG icon — a stylized geometric shape resembling interconnected paths/nodes |
| **Logo Colors** | `#493FEE` (indigo/violet) on transparent |
| **Favicon** | Same SVG logo (`/favicon.svg`) + fallback `.ico` + Apple Touch Icon |
| **Tagline** | "P2P.me - Pay with USDC at any QR" |
| **PWA** | Full PWA support with manifest, standalone display, maskable icons |

---

## 2. Color System

Built entirely on **OKLCH** color space with Tailwind CSS v4. Themed variables switch between **light** and **dark** modes via `:root` / `.dark` / `[data-theme=dark]`.

### 2.1 Core Semantic Tokens

| Token | Light (OKLCH) | Dark (OKLCH) | Approx Hex |
|---|---|---|---|
| `--background` | `1 0 0` (white) | `.19 .0122 285.15` | #FFFFFF / #0B0F1A |
| `--foreground` | `.19 0 0` | `1 0 0` | #0B0F1A / #FFFFFF |
| `--card` | `1 0 0` | `.19 .0122 285.15` | #FFFFFF / #0B0F1A |
| `--card-foreground` | `.19 0 0` | `1 0 0` | #0B0F1A / #FFFFFF |
| `--popover` | `1 0 0` | `.24 0 0` | #FFFFFF / #14142B |
| `--popover-foreground` | `.19 0 0` | `1 0 0` | #0B0F1A / #FFFFFF |
| `--muted` | `.97 0 0` | `.24 0 0` | #F7F7F7 / #14142B |
| `--muted-foreground` | `.39 0 0` | `.76 0 0` | #636363 / #C2C2C2 |
| `--accent` | `.97 0 0` | `.24 0 0` | #F7F7F7 / #14142B |
| `--accent-foreground` | `.19 0 0` | `1 0 0` | #0B0F1A / #FFFFFF |
| `--border` | `.92 0 0` | `1 0 0 / 10%` | #EBEBEB / rgba(255,255,255,0.1) |
| `--ring` | `.51 .2488 275.3` | `.59 .2287 279.81` | #4D66F4 / #6B82FF |

### 2.2 Brand / Primary

| Token | Light (OKLCH) | Dark (OKLCH) | Hex Equivalent |
|---|---|---|---|
| `--primary` | `.51 .2488 275.3` | `.6939 .1345 285.27` | **#4D66F4** / **#8B9CFF** |
| `--primary-foreground` | `1 0 0` | `1 0 0` | #FFFFFF / #FFFFFF |
| `--primary-shadow` | inferred `#4D66F4` at 25% | inferred | #4D66F440 |

**Primary color: `#4D66F4`** — a vivid **indigo-blue** hue (~275° hue angle). It's the dominant interactive color for buttons, links, focus rings, and active states.

### 2.3 Semantic / Status Colors

| Token | OKLCH (Light) | OKLCH (Dark) | Hex/Description |
|---|---|---|---|
| `--destructive` | `.577 .245 27.325` | `.704 .191 22.216` | **Red** (#E53E3E / #FF5C5C) |
| `--warning` | `.769 .188 70.08` | `.83 .1539 77.11` | **Amber** (#EAA22F / #FFC14D) |
| `--success` | (inferred) `.696 .17 162.48` | (inferred) `.68 .1432 164.63` | **Green** (#14F195 / #5EE9B5) |
| `--info` | (inferred) `.6 .118 184.704` | — | **Cyan** (#22D3EE) |

### 2.4 Extended Color Palette (used in dynamic theming)

| Hex | Usage |
|---|---|
| `#91CFFF` | Light blue accents |
| `#14F195` | Success / green highlights |
| `#9945FF` | Purple accents |
| `#4D66F4` | Primary brand |
| `#0B0F1A` | Dark background |
| `#14142B` | Dark card background |
| `#020618` | Darkest bg variant |

---

## 3. Typography

### 3.1 Font Stack

- **Primary Font**: `"Outfit"` (Google Fonts, weights 100–900)
- **Fallback**: `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`
- **Monospace Font**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
- **Secondary Display Font**: `Nohemi` (used in specific brand contexts)

Outfit is a modern geometric sans-serif typeface with clean, rounded letterforms — aligns with the fintech/crypto aesthetic.

### 3.2 Font Weights

| Token | Value |
|---|---|
| `--font-weight-thin` | 100 |
| `--font-weight-light` | 300 |
| `--font-weight-normal` | 400 |
| `--font-weight-medium` | 500 |
| `--font-weight-semibold` | 600 |
| `--font-weight-bold` | 700 |
| `--font-weight-extrabold` | 800 |
| `--font-weight-black` | 900 |

---

## 4. Borders & Radius

| Token | Value |
|---|---|
| `--radius` | `0.625rem` (**10px**) — base radius |
| `--radius-md` | `calc(var(--radius) - 2px)` → 8px |
| `--radius-xs` | `0.125rem` (**2px**) |
| `--radius-sm` | `calc(var(--radius) - 4px)` → 6px |
| `--radius-lg` | `var(--radius)` → 10px |
| `--radius-xl` | `calc(var(--radius) + 4px)` → 14px |
| `--radius-2xl` | (Tailwind default) → 16px |

Border style is always `solid`. Border colors inherit from `--border` token.

---

## 5. Shadows

Shadow style leans **glow-based** rather than hard drop shadows — consistent with modern Web3/fintech design.

### 5.1 Glow Shadows (Primary color-based)

| Class | Shadow |
|---|---|
| `shadow-[0_0_12px_var(--primary-shadow)]` | Soft primary glow |
| `shadow-[0_0_14px_0_var(--primary-shadow)]` | Medium primary glow |
| `shadow-[0_0_19px_0_var(--primary-shadow)]` | Strong primary glow |
| `shadow-[0_0_20px_var(--primary-shadow)]` | Large primary glow |
| `shadow-[0_0_32px_var(--primary-shadow)]` | Extra-large primary glow |
| `shadow-[0_-4px_16px_var(--primary-shadow)]` | Upward primary glow (bottom nav) |

### 5.2 Colored Glow Shadows

| Class | Shadow |
|---|---|
| `shadow-[0_0_5px_1px_rgba(165,180,252,0.7)]` | Indigo/periwinkle glow |
| `shadow-[0_0_6px_1px_rgba(165,243,252,0.7)]` | Cyan glow |
| `shadow-[0_0_6px_1px_rgba(221,214,254,0.7)]` | Lavender glow |
| `shadow-[0_0_14px_-2px_rgba(34,211,238,0.7)]` | Bright cyan glow |
| `shadow-[0_0_14px_-2px_rgba(167,139,250,0.7)]` | Purple glow |
| `shadow-[0_0_5px_1px_rgba(255,255,255,0.6)]` | White glow (dark mode) |

### 5.3 Standard Elevation Shadows

| Class | Shadow |
|---|---|
| `shadow` | `0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)` |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` |
| `shadow-2xl` | `0 25px 50px -12px rgba(0,0,0,0.25)` |

---

## 6. Icons

Icons are used extensively via **`<img>` tags** (not inline SVGs or icon fonts). Key icon locations:

| Location | Icon Purpose |
|---|---|
| **Top Nav** | P2P.me logo SVG |
| **Bottom Tab Bar** | 4 buttons: Home/Wallet, Pay/Scan, Buy USDC, Sell USDC |
| **Main Actions** | Wallet, Depositar, Retirar, Soporte |
| **Feature Cards** | coins.me icon, Cashback, Perps, P2P ↔ USDC |
| **Referral** | Progress indicator icon |
| **Banners** | Background images on promotional cards |

Icon style appears to be:
- **Monoline / outline** style for action icons
- **Flat fill** for brand/logos
- **Gradient/pattern** backgrounds for promotional banners

---

## 7. Layout & Structure

| Element | Description |
|---|---|
| **Framework** | React (SPA) with Tailwind CSS v4 |
| **Design Language** | Modern neumorphism + glassmorphism hybrid with glow effects |
| **Top Bar** | Logo + "Hacé más con coins.me" + "Instalar aplicación" buttons |
| **Main Content** | Price widget, balance card, 4 action buttons, promotional cards, limits, referral |
| **Bottom Tab Bar** | Fixed bottom navigation with 4 tabs: Comprar USDC, Scan/Pay, Vender USDC, (wallet) |
| **Cards** | Rounded-2xl cards with subtle border and primary shadow glow |
| **Banners** | Full-width promotional cards with background images |
| **Progress** | Step progress bar for referral program |

### Page Sections (top to bottom)

1. **Notification bar** (alt+T shortcut)
2. **Top banner** — Wallet check / connection status
3. **Header** — Logo + utility buttons
4. **Price widget** — Compra / Venta (Buy/Sell) prices in Bs.S (Bolívares)
5. **Balance card** — Available USDC + fiat balance
6. **Quick actions** — Wallet, Depositar, Retirar, Soporte
7. **Promotional cards** — Cashback, coins.me, P2P↔USDC, Merchant program, App install, Quick tour
8. **Rewards** — Credits badge (lotpot.fun)
9. **Transaction limits** — Buy/Sell limits with increase link
10. **Referral program** — 1% referral rewards with progress tracker
11. **Bottom tab bar** — Primary navigation

---

## 8. Dark Mode

- **Auto-detection**: `prefers-color-scheme: dark` media query in initial loader
- **Toggle**: Via `.dark` class or `[data-theme=dark]` attribute
- **Strategy**: All CSS custom properties swap values — no hardcoded light colors
- **Loader**: Dark mode respected even before JS loads via CSS

Dark mode inverts the entire color system:
- Background → near-black (`#0B0F1A`)
- Cards → slightly lighter dark (`#14142B`)
- Text → white
- Borders → subtle white at 10% opacity
- Primary → lighter indigo (`#8B9CFF`)
- Shadows → white glow instead of dark

---

## 9. Design Patterns & Observations

### Visual Style
- **Dark-first experience**: The dark mode is clearly the primary experience (richer, more polished)
- **Glow-heavy**: Uses colored glow shadows extensively — a hallmark of Web3/crypto UI design
- **High contrast**: Primary #4D66F4 against dark backgrounds creates strong visual hierarchy
- **Rounded everywhere**: Generous border-radius (10px base) creates approachable, friendly UI
- **Gradient-aware**: Uses `oklab` color interpolation in gradients for smoother transitions
- **Mobile-first**: Viewport locked (`user-scalable=no`), bottom tab bar, card-based layout

### UI Framework
- **shadcn/ui** components (Radix UI primitives + Tailwind)
- **Dynamic Labs** wallet connect integration (RPC-based wallet connection)
- **Tailwind CSS v4** with CSS-first configuration
- **OKLCH color space** throughout — modern, perceptually uniform color model

### Key Colors Summary

```
PRIMARY    #4D66F4 (indigo-blue)
SUCCESS    #14F195 (vibrant green)
DANGER     #E53E3E (red)
WARNING    #EAA22F (amber)
BG LIGHT   #FFFFFF
BG DARK    #0B0F1A
CARD DARK  #14142B
TEXT DARK  #FFFFFF
TEXT LIGHT #0B0F1A
```

### Brand Voice
- **Spanish-first** UI (Argentinian market focus with Bs.S pricing)
- Tone: friendly, approachable, encouraging ("Ganes o pierdas, siempre recibes un 10% de cashback")
- Crypto-native terminology: USDC, P2P, Perps, Wallet, Cashback
