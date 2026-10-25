# Pitch deck

**[Before-the-Bulldozer-deck.pdf](Before-the-Bulldozer-deck.pdf)**: 7 slides, 1920×1080 (6-slide pitch + Q&A backup).

> **Before presenting:** slide 3 has placeholder quotes in orange. Replace them with real quotes from your
> validation conversations and delete the "Fill in real quotes" banner in `deck.html`.

## Edit and rebuild

All text lives in `deck.html` (plain HTML; each slide is a `<section class="slide">`).

- **Quick:** open `deck.html` in Chrome → Print → Destination "Save as PDF", Margins "None", Background graphics on.
- **Scripted** (same output as the committed PDF):
  ```bash
  npm i --no-save playwright && npx playwright install chromium
  node docs/deck/render.js "$PWD/docs/deck/deck.html" docs/deck/Before-the-Bulldozer-deck.pdf
  ```

## What to say (about 4 minutes)

| # | Slide | Time | Script |
|---|---|---|---|
| 1 | Hook | 0:20 | Hold up the prop. "This cabinet door was headed to a landfill. Nashville throws away 400,000+ tons of construction debris a year and recycles about 3%." |
| 2 | Problem | 0:35 | C&D is a third of what Nashville buries. Its landfill borders Bordeaux, and residents have fought it for 20 years. Middle Point has 5–10 years left. The C&D ordinance skips single-family teardowns, and there were 647 of those permits last year. |
| 3 | Validation | 0:30 | 2–3 real quotes from the calls. "Here's what a Nashville contractor told us…" |
| 4 | Live demo | 1:30 | Switch to https://beforethebulldozer.duckdns.org. Radar → pick 510 S 19th St → "Use demo house photos" → scan → point at the lead-paint flag and the totals → Claim on Habitat ReStore → counter ticks up. Backup: `docs/demo.mp4`. |
| 5 | How it works | 0:30 | Metro open data + Llama 4 on OCI Generative AI + our rules, hosted on OCI. "The AI only counts; our table does the math, so every number is defensible." |
| 6 | Impact + next | 0:35 | $854 and 0.55 tons from one house's photos; × 647 permits ≈ $550K and 356 tons a year (illustrative). Next: ReStore pilot, auto-alerts, on-site check, liability. Close: "Look inside before the bulldozer does." |
| 7 | Q&A | — | Leave up during questions; QR codes for the live app and the repo. |

## Where the numbers come from

- 432,065 tons / ~3% recycled / ~⅓ of landfill / 90% to Southern Services / 5–10 years at Middle Point / ordinance exemption: build spec sources (Metro Nashville, Nashville Scene, WPLN, Waste Advantage).
- 647: residential demolition permits issued Oct 18, 2025 – Oct 18, 2026, Metro Codes *Building Permits Issued* (ArcGIS), queried Oct 18, 2026.
- $854 / 0.55 tons / 11 items: one live scan of the 7-photo demo house (scans vary run to run; recent runs ranged $760–$1,030).
- ~$550K / ~356 tons: 647 × the demo house. Illustrative, not a forecast.
- CO₂ is intentionally left off the slides until the EPA WARM factors are verified.
