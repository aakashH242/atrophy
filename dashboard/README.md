# dashboard

Single self-contained HTML page (no build step, no CDN, nothing leaves your machine).

- `atrophy serve` hosts it on `127.0.0.1` with live data from your SQLite file
  (`/data.json`, re-read on every refresh)
- opened directly (file://), it accepts an `atrophy export` JSON via file picker

Views:
- **KPI tiles** — per-axis rating, freshness state, rep count, recency
- **Decay curves** — rating line + ±RD confidence band per axis; the band widening
  through idle gaps is the "cracking" visual (the rating itself never moves
  without evidence)
- **Unaided vs AI-assisted** — per-drill scores with rolling trend lines; the gap
  between the two lines is the product's reason to exist
- **Recent sessions table** — the accessible, WCAG-clean twin of every chart

All decay math lives in `engine/` (TypeScript); timelines arrive precomputed in
the payload so this page only draws.
