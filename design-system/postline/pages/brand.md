# Postline — Pantone 2755 C analogous

Source: Pantone 2755 C analogous swatches. Live in `src/app/globals.css`.

## Raw swatches
| Name | Hex | Note |
|------|-----|------|
| Teal | `#0E4B62` | Cool end — primary CTA (light) |
| Navy | `#0E2162` | Depth / text (light) |
| Indigo | `#250E62` | Center (Pantone base*) |
| Purple | `#4F0E62` | Warm accent |
| Plum | `#620E4B` | Magenta end |

## Token mapping
| Token | Light | Dark |
|-------|-------|------|
| Primary | `#0E4B62` teal | `#2BA3C7` lifted teal |
| Background | `#F3F6FB` | `#000000` true black |
| Card | `#FFFFFF` | `#121212` |
| Foreground | `#0E2162` | `#F4F4F5` |
| Muted nest | mist | `#1C1C1C` |
| Accent wash | indigo `#EDE8F6` | zinc `#1C1C1C` (no blue) |
| Primary (dark) | — | `#3D8FA3` muted teal |

## Dark mode rule (ui-ux-pro-max)
- **Surfaces stay near-black** (`#000` / `#121212`) — no navy, slate-blue, or indigo shells
- Brand Pantone hues = **accents only** (primary muted teal, charts)
- Clear elevation: background < sidebar < card < nested muted
- Borders `#2A2A2A`; no Tailwind `blue-*` on status UI in dark
