# Design System Inspiration of Apple Wallet (iOS)

Source: [meliwat/awesome-ios-design-md — apple-wallet](https://github.com/Meliwat/awesome-ios-design-md/tree/main/design-md/finance/apple-wallet)

Applied to the Plug-N-Pay booth phone UI (Vite/React). Game mechanics and honesty labels are unchanged; chrome, palette, type, and surfaces follow Wallet / Apple HIG.

## 1. Visual Theme & Atmosphere

True black canvas (`#000000`) so passes and meters float. Almost no chrome — large nav titles, glass circular controls, inset-grouped lists. Cards use a fixed **10pt** radius and heavy shadows. Primary CTAs mirror Apple Pay / “Pay Now”: white fill, black label, **14pt** radius.

## 2. Color Palette & Roles

| Token | Hex | Role |
|---|---|---|
| Canvas | `#000000` | Page ground |
| Surface 1 | `#1C1C1E` | Grouped panels, chips |
| Surface 2 | `#2C2C2E` | Pressed / inset |
| Glass | `rgba(255,255,255,0.12)` | Circular icon buttons |
| Hairline | `#262629` | Separators |
| Text primary | `#FFFFFF` | Titles, body |
| Text secondary | `#A0A0A5` | Captions |
| Text tertiary | `#636368` | Footnotes |
| System Blue | `#0A84FF` | Accent, links, energy flow (maps to `--cyan`) |
| Success Green | `#30D158` | V2G / success |
| Error Red | `#FF453A` | Errors |
| Titanium | `#E8E8EB → #A8A8AD → #3D3D3F` | Pass / score card face |

CSS keeps legacy names `--cyan` / `--cyan-dim` / `--cyan-hot` so SVG game paths keep working; values are Wallet blue luminance, not the old instrument cyan.

## 3. Typography

`-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif`

- Display (≥20pt): Bold titles, balance heroes
- Text (≤17pt): Body, rows
- Section labels: 13pt Semibold UPPERCASE, tracking
- Amounts: `font-variant-numeric: tabular-nums` on system text (not mono), except masked claim codes

## 4. Components (booth mapping)

- **Pass card** — results score, host QR panel: 10pt radius, heavy shadow, optional titanium gradient face
- **Pay Now CTA** — `.primary`: white / black, 14pt radius, ~54pt tall
- **Grouped list** — leaderboard / player list: `#1C1C1E` rows, `#262629` hairlines
- **Glass chip** — nickname / plate chips: glass fill, no hard neon borders

## 5. Motion

Card-like springs where we animate UI chrome: ~0.5s, damping ~0.8. Game beats (latch, flip flash, ripples) stay as specified in the booth frontend spec.
