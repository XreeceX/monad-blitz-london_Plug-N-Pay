# Design System — iOS 18 / macOS Sequoia vibrancy

Source: [jerald-devOfficial/apple-ui-portfolio](https://github.com/jerald-devOfficial/apple-ui-portfolio)
— a macOS Sequoia / iOS 18 / iPadOS 18 interface study. The material recipe
below is lifted from its `src/app/globals.css`.

Applied to the Plug-N-Pay booth UI (Vite/React). Game mechanics and honesty
labels are unchanged; chrome, palette, type, surfaces, and motion follow the
Sequoia material language. Supersedes the earlier Apple Wallet pass styling.

## 1. Visual theme

An ambient wallpaper (`--wallpaper`: three dim radial gradients over `#000`)
sits behind every screen, so translucent panels have something to sample.
Panels are **vibrancy materials**, not flat fills: a translucent tint, a heavy
backdrop blur with saturation lift, a 0.5px hairline, an inset specular edge,
and two stacked shadows. Corners are iOS 18 continuous squircles.

```css
background: rgba(44, 44, 46, 0.82);
backdrop-filter: blur(40px) saturate(180%);
border: 0.5px solid rgba(255, 255, 255, 0.12);
box-shadow: 0 8px 28px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.25),
            inset 0 0 0 0.5px rgba(255,255,255,.06);
```

## 2. Color palette & roles

| Token | Value | Role |
|---|---|---|
| `--ink` | `#000000` | Page ground, under the wallpaper |
| `--wallpaper` | 3 radial gradients | Ambient Sequoia backdrop |
| `--mat-thick` | `rgba(44,44,46,.82)` | Cards, lists, sheets |
| `--mat-regular` | `rgba(58,58,60,.58)` | Inset groups |
| `--mat-thin` | `rgba(120,120,128,.24)` | Chips, controls, track fills |
| `--mat-bar` | `rgba(0,0,0,.6)` | Menu-bar / status chrome |
| `--mat-line` | `rgba(255,255,255,.12)` | Hairlines on a material |
| `--mat-edge` | `inset 0 0 0 .5px rgba(255,255,255,.06)` | Specular edge |
| `--surface` `--line` | `#1C1C1E` `#262629` | **Opaque** — SVG fills only; SVG cannot sample a backdrop |
| `--text` / `--muted` / `--muted-3` | `#FFFFFF` / `#A0A0A5` / `#636368` | Type ramp |
| `--cyan` | `#0A84FF` | System blue: accent, links, energy flow |
| `--success` / `--danger` | `#30D158` / `#FF453A` | V2G success, errors |
| `--titanium` | `#E8E8EB → #A8A8AD → #3D3D3F` | Score pass face |

Legacy names `--cyan` / `--cyan-dim` / `--cyan-hot` / `--surface` / `--line`
are kept because game SVG paths resolve them directly.

## 3. Geometry

`--radius` 18px (card / grouped panel) · `--radius-cta` 14px (buttons, sheets)
· `--radius-sm` 12px (QR frames, inner tiles) · 999px capsules for chips.

## 4. Typography

`-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display',
'Segoe UI', Inter, 'Helvetica Neue', sans-serif` — the Segoe UI / Inter
fallbacks matter because the booth runs on Windows and Android hardware.

- Display (≥20pt): bold titles, balance heroes
- Text (≤17pt): body, rows
- Section labels: 13pt semibold uppercase
- Amounts: `font-variant-numeric: tabular-nums`, except masked claim codes

## 5. Components

- **Card / list** — material recipe above; rows separated by `--mat-line`
- **Primary CTA** — `.primary`: white fill, black label, 14px radius, ~54pt tall
- **Secondary button** — thin material capsule with hairline + specular edge
- **Tertiary button** — borderless text (`.host-back`, `.lb-back`)
- **Chip** — `.nick-chip` / `.plate-chip` / `.phase-chip`: thin material capsule
- **Status capsule** — `.sim-label` / `.degraded-note`: menu-bar material, always legible

## 6. Motion

`--ease` `cubic-bezier(.4, 0, .2, 1)` for state changes (Apple standard, 150–160ms);
`--ease-spring` `cubic-bezier(.16, 1, .3, 1)` for presentation. Game beats
(latch, flip flash, ripples) stay as specified in the booth frontend spec.

## 7. Performance and honesty constraints

- Backdrop blur is confined to static chrome. The per-tick game stages
  (`.garage`, `.charging`) carry no blurred panels — their rAF loop writes
  straight to the DOM and must not fight a compositor blur.
- A `@supports not (backdrop-filter: …)` fallback drops every material to the
  opaque `--surface`, so no panel ever renders as unreadable transparency.
- Honesty labels (FR-MET-5, FR-DASH-6, NFR-R-3) keep their wording and stay
  permanently visible. Vibrancy changed their frame, never their text or
  their contrast against the ground.
- The V2G flip still works by swapping tokens under `[data-phase='v2g']`;
  the material tokens are overridden there too, and `--wallpaper` goes to
  `none` so the green takeover is total.
