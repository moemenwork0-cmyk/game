# Decisions

Ambiguities resolved with the simplest option that fits the pillars, and every change to a spec number (old → new, why).

## Project

- **Location:** the repository already holds a Godot project (Jazira). JellyFit lives in its own folder `jellyfit/` with a `.gdignore` so Godot never imports it. Nothing outside the folder was touched.
- **Tool versions:** TypeScript 5.9, Vite 6.4, Vitest 3.2, Playwright 1.56 (matches the pre-installed Chromium), ESLint 9 + typescript-eslint. Stable, well-known majors rather than the newest.
- **Fonts:** only the Baloo 2 latin woff2 files (600, 800) are imported, loaded with `FontFace` and a 1.2 s cap so fonts can never block the first frame.
- **Optional audio files:** a tiny Vite plugin lists `public/audio/*` at build time (`virtual:audio-manifest`), so the game only requests files that exist (no 404s in the console).

## Rules and feel

- **Snapping tolerance (5.2):** "nearest valid placement within 0.45 cells" read as: the 3×3 integer positions around the rounded position are candidates, a candidate is accepted when its distance on each axis is ≤ 0.5 + 0.45 cells, and the closest valid one wins. Plain rounding plus 0.45 extra reach, so near-misses snap to an adjacent valid spot and there is no dead zone between cells.
- **Pen input** uses the mouse offset (centre at the pointer, 0.25 cell up). Only `touch` gets the 1.4-cell lift.
- **easeOutBack "overshoot 1.15"** is used as the easeOutBack constant (s = 1.15).
- **Feedback word priority:** Perfect! > Unstoppable (combo ≥ 8) > Amazing (5+ lines) > On fire (combo ≥ 5) > lines word. A 1-line clear with combo < 5 shows no word.
- **Combo grace:** after a clear, 3 consecutive non-clearing placements break the combo (the 3rd one resets it).
- **Score popup** shows the line score (+ perfect bonus), not the per-cell points.
- **Game-over desaturation** uses pre-rendered gray sprites (no per-frame canvas filters, which Safari lacks).

## Generator tuning (numbers changed or added — logged as required)

Measured with `npm run sim -- --games 2000 --seed 1` (greedy bot).

| Setting | Spec | Now | Why |
|---|---|---|---|
| `pressureByTier` (new) | — | `[0.2, 0.4, 0.6, 0.8, 0.9, 1.0]` | With only the spec rules the bot's median game was 536 placements (target 90–160). In the open/normal zones the generator now, with this per-tier probability, deals the solvable candidate with the most cells. Every such deal is still solvable. |
| `mercyMissPick` (new) | random candidate | `'hardest'` (most cells) | When the mercy roll fails in the mercy zone, the spec picks a random candidate. Picking the biggest one makes the "mercy failed" case decisive, which shortens the long tail. |
| All spec numbers | — | unchanged | mercyP 0.90 − 0.06/tier (min 0.55), zones 0.30 / 0.55, 0.80 normal solvable, open ≥11 cells at 0.6, hope injection, tier weights. |

**Bot search:** an exhaustive search over every order and placement is far too slow for thousands of games, so the bot uses a beam search (width 6) scored by the spec's formula, plus an exhaustive fallback whenever the beam finds no way to place all remaining pieces. Bumpiness = filled/empty transitions between neighbouring cells ÷ 4 (no gravity in this genre, so column heights don't apply). Holes = empty cells whose four neighbours are filled or walls.

**Open issue — comeback rate:** the target "≥ 25% of games contain a comeback" is not met (0.8%). With this bot, comebacks scale with game length: every setting that gave ≥ 25% comebacks also gave median games of 1,000+ placements. The bot keeps the board below 75% almost always (median peak fill 66%), which humans don't. I chose the game-length target and will revisit comebacks with real playtest data (playtest logger, M4) rather than tune toward a bot artefact.

## Player feedback round 1 (after M1)

- **Arabic UI:** every player-facing string lives in `src/config/strings.ts`; the page is `lang="ar" dir="rtl"`. Font switched from Baloo 2 to **Baloo Bhaijaan 2** (same family, Arabic + Latin, SIL OFL). Numbers stay in Western digits with separators for legibility at small sizes. Title shown as «جيلي فيت» (change `GAME_TITLE_AR` to rename).
- **Palette (spec 9.1 changed on request):** background `#2B1660 → #5B2A86 → #B4457F` replaced by a calm deep blue `#1A2547 → #22305A → #2A3B6B`; board `#131C38`, sockets `#1C2749`, panels `rgba(23,33,64,.96)`. Jelly colours slightly softened (e.g. Strawberry `#FF3D6E → #F4517A`). Bokeh alpha 4–8% → 2.5–5%.
- **Home screen (M3 item pulled forward on request):** logo, best score top-left, settings gear top-right, one big play button («كمّل اللعب» when a game is in progress). Settings (sound, music, haptics, reduced motion) and the pause dialog (M2 items) came along with it.
- **Touch drag reach:** on touch the piece moves faster than the finger — ×1.6 upward, ×1.2 sideways, ×1.0 downward (`theme.ts` `touchGain*`), and is kept fully on screen. Reaching the top row from the tray now needs ~230 px of finger travel on a 390×844 phone, so the thumb stays in the lower half. Mouse is unchanged.
