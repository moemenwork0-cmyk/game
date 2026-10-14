# JELLYFIT — Complete Game Specification & Build Instructions for Claude Code

> **Kickoff instruction:** Read this entire document before writing any code. Then create `PLAN.md` (architecture summary + the milestone checklist from Section 19) and start Milestone M1. This document is the single source of truth.

---

## 0. Who you are and how you work

You are a senior web game engineer AND a game-feel/polish specialist at a top mobile puzzle studio. You are building a block puzzle game that must feel as good as the best block puzzles on the market (Block Blast–level quality), first for the web (CrazyGames), later wrapped as a mobile app.

**The game's mechanics are deliberately familiar.** The genre is proven by hundreds of millions of players. Success will come from: (1) flawless feel, (2) premium visuals, (3) a smart piece generator that creates "almost lost… saved it!" moments, and (4) strong reasons to come back. Do not "improve" the core rules. Spend your creativity on polish.

### Success metrics (CrazyGames Basic Launch)

- Average playtime per session: 10+ minutes.
- Day-1 retention: 10–15%+.
- Conversion (players who play 1+ minute): 80%+.
- Playable in under 2 seconds; total build under 3 MB.

### Working rules (strict)

1. **Spec first.** Read everything, write `PLAN.md`, then build milestone by milestone (Section 19).
2. **Stop at every milestone.** Run typecheck, tests, and build; update `DEVLOG.md` (what was done, how to test, known issues, bundle size); commit; then STOP and wait for the user.
3. **Ambiguity:** pick the simplest option that matches the pillars; record it in `DECISIONS.md`. Never silently change a number from this spec — log old value, new value, reason.
4. **No scope creep.** Ideas go in `IDEAS.md`.
5. **Hard constraints:** no backend, server, database, accounts, or runtime network calls (except the CrazyGames SDK script, Section 16). Persistence only via `localStorage` behind one Storage module. No third-party analytics. Fonts bundled locally.
6. **All tunable numbers live in `src/config/balance.ts`** (and visual numbers in `src/config/theme.ts`).
7. **Code:** TypeScript strict, small modules, no UI framework, no game engine. Seeded RNG for all gameplay randomness.
8. **Visual self-review is mandatory.** Use Playwright (install it as a dev dependency) to take screenshots at 390×844 (phone portrait), 820×1180 (tablet), and 1440×900 (desktop) of: menu, board mid-game, drag with clear preview, a 3-line clear moment, combo banner, game-over screen. Look at them yourself and fix anything that looks cheap, misaligned, cramped, blurry, or off-palette **before** reporting a milestone.
9. **Reference images:** if the folder `/references` exists, it contains screenshots the user likes. Treat them as the **quality bar** (polish, juiciness, clarity). Never copy their layouts, colors, or assets one-to-one.
10. **Never end a milestone with a broken build.**

---

## 1. Product summary

- **Working title:** JELLYFIT (constant `GAME_TITLE` in `src/config/config.ts`; the name will be verified and may change).
- **One-line pitch:** The block puzzle you know — with squishy jelly blocks that wobble, splat, and chain into combos, plus missions that grow your score multiplier forever.
- **Genre:** casual block puzzle (8×8 grid, place pieces, clear rows and columns).
- **Platforms:** CrazyGames web (desktop mouse + mobile touch) now; iOS/Android app later (Section 17).
- **Orientation:** portrait-first layout; on wide screens the same portrait column is centered with side panels (Section 3).
- **Audience:** everyone 13+; cheerful, never childish.

### Design pillars

- **P1 — Zero learning:** understood in 3 seconds by anyone who has seen a block puzzle; taught in 10 seconds to anyone who hasn't.
- **P2 — Every touch feels delicious:** pick up, drag, drop, clear — each with squash-and-stretch, sound, and particles.
- **P3 — Hope engine:** the piece generator keeps players in the "almost lost but still alive" zone, producing comebacks and "one more game".
- **P4 — Always a reason to return:** missions → permanent multiplier, daily puzzle + streak, coins → block skins, personal records.

### What makes it distinct (protect this identity)

1. **Jelly physics feel:** every block is a soft jelly with spring-based squash, neighbor jiggle, and splat clears. No other block puzzle in the portal should look or feel like this.
2. **Special jellies:** Star jelly (clears its row and column) and Bomb jelly (clears a 3×3), creating chain reactions.
3. **Jelly Rush:** a combo-fed fever state with doubled score and guaranteed special jellies.
4. **Missions → permanent score multiplier** (inspired by the endless-runner meta): complete mission sets to raise your multiplier permanently, so every high-score attempt keeps getting bigger.

---

## 2. Tech stack and structure

- **Vite + TypeScript (strict)**, Vitest, ESLint + Prettier (minimal), Playwright (dev only, screenshots and smoke tests).
- **Rendering:** one `<canvas>` (2D) for board, pieces, particles, popups; HTML/CSS overlay for menus, HUD text, dialogs.
- **Font:** `@fontsource/baloo-2` (SIL OFL), weights 600 and 800, latin subset, bundled.
- **`vite.config.ts`:** `base: './'`, `build.target: 'es2019'`, no sourcemaps in production, output `dist/`.
- **Scripts:** `dev`, `build`, `preview`, `typecheck`, `test`, `lint`, `zip` (Node script, no external binaries), `shots` (Playwright screenshots into `/screenshots`), `sim` (headless bot simulation, Section 18).

```
src/
  main.ts
  config/      config.ts  balance.ts  theme.ts  pieces.ts  missions.ts  skins.ts
  core/        loop.ts  rng.ts  tween.ts  spring.ts  pool.ts  events.ts  bitboard.ts
  game/
    board.ts          8×8 state as two Uint32 masks + per-cell color/special arrays
    rules.ts          PURE: canPlace, place, findFullLines, clear, anyFit (unit tested)
    generator.ts      smart piece generator (Section 6)
    scoring.ts        score, combo, words, rush
    specials.ts       star / bomb resolution with cascade guard
    session.ts        one game: deals, moves, game over, revive
    daily.ts          daily puzzle (seeded)
  input/      drag.ts  (Pointer Events: mouse, touch, pen)
  render/
    renderer.ts  blockSprites.ts  board.ts  tray.ts  ghost.ts  particles.ts
    popups.ts  background.ts  camera.ts (shake)  jelly.ts (per-cell springs)
  audio/      audio.ts  sfx.ts  music.ts
  meta/       save.ts  coins.ts  missions.ts  skins.ts  stats.ts  achievements.ts
  ui/         screens/ (boot, menu, hud, pause, gameover, missions, shop, daily, settings)  ui.css  tutorial.ts
  platform/   platform.ts (interface)  crazygames.ts  none.ts  ads.ts  haptics.ts
  debug/      debugPanel.ts  playtestLog.ts
sim/          bot.ts  simulate.ts   (Node script using src/game pure modules)
tests/        rules.test.ts  generator.test.ts  scoring.test.ts  specials.test.ts  save.test.ts  daily.test.ts  missions.test.ts
```

---

## 3. Layout (portrait-first, responsive)

### 3.1 Portrait (phones, tall windows)

Top to bottom inside a centered column (max width 520 CSS px):

```
┌──────────────────────────────┐
│ [pause]   ★ 12,450   👑 best │  top bar (safe-area aware)
│        x7 multiplier         │  small pill under score
│                              │
│   ┌──────────────────────┐   │
│   │                      │   │
│   │     8 × 8 board      │   │  board: square, width = column width − 2×16 px
│   │                      │   │
│   └──────────────────────┘   │
│                              │
│   [piece]  [piece]  [piece]  │  tray: 3 equal slots, height ≈ 0.42 × board
│                              │
└──────────────────────────────┘
```

### 3.2 Landscape / desktop (aspect > 1.1)

- The same portrait column is centered (height-fitted: board size = min(available height × 0.62, 620 px)).
- **Left panel:** current missions (3 cards with progress) and multiplier.
- **Right panel:** best score, today's daily status + streak, coins.
- Panels hide when the window is too narrow; content never overlaps the board.

### 3.3 Sizing rules

- Cell size `cs` = board inner width / 8, rounded to whole device pixels.
- Tray pieces render at 0.6 × `cs` scale (desktop 0.65).
- Minimum interactive target 44 × 44 CSS px.
- Canvas backing resolution = CSS size × `min(devicePixelRatio, 3)`; adaptive quality may drop to 2.
- No page scroll, no pinch zoom, `touch-action: none`, context menu disabled on the canvas.
- Resize/orientation change re-layouts instantly without losing state (including mid-drag: cancel the drag and return the piece).

---

## 4. Core rules (do not change)

1. Board 8 × 8, initially empty (Classic mode).
2. The player receives a **deal of 3 pieces** in the tray.
3. Drag a piece onto the board. It may be placed only where all its cells are inside the board and empty. **No rotation.**
4. After placement, every **full row and full column** is cleared simultaneously (a cell in both a full row and a full column is cleared once).
5. When all 3 pieces of a deal are placed, a new deal of 3 arrives.
6. **Game over:** when none of the remaining tray pieces can be placed anywhere.
7. Placing a piece always gives points for its cells; clearing lines gives more (Section 7).

**Unit tests (`rules.test.ts`):** placement validity at edges, overlapping, simultaneous row+column clears, cross-cell counted once, game-over detection, bitboard helpers vs a naive reference implementation (randomized property test, 10,000 cases).

**Implementation note:** represent the board occupancy as two `Uint32` masks (rows 0–3 and rows 4–7) and precompute, for every piece, all valid placement masks (piece shape shifted to each position). `canPlace` = `(boardMask & pieceMask) === 0` on both halves. This makes the generator's search fast (Section 6).

---

## 5. Drag-and-drop feel (the heart of the game)

All numbers in `theme.ts`.

### 5.1 Pick up

- Pointer down on a tray piece (hit area = its whole slot) picks it up.
- The piece animates from tray scale to board cell scale in 120 ms (easeOutBack, overshoot 1.15).
- **Touch:** the piece is drawn so that its bottom edge sits `1.4 × cs` above the finger (the finger never covers the piece). **Mouse:** the piece's center sits at the cursor, offset upward by `0.25 × cs`.
- Shadow under the dragged piece grows (offset 8 px, alpha 0.35). Soft "pick" sound. Haptic tick 8 ms on mobile.

### 5.2 Dragging

- The piece follows the pointer with a light smoothing (lerp factor 0.55 per frame at 60 FPS, frame-rate independent).
- **Jelly drag:** the piece tilts up to ±6° and stretches up to 6% in the movement direction based on velocity, springing back when the pointer stops.
- **Snap target:** compute the board cell under the piece's top-left cell; if the placement is valid, show the **ghost**:
  - Ghost = the piece drawn in its own color at 35% alpha in the target cells.
  - **Clear preview:** every row/column that would be completed is highlighted: existing blocks in those lines temporarily take the dragged piece's color and pulse (scale 1.0↔1.05, 600 ms loop), plus a soft white line glow. This preview is a major source of satisfaction; make it gorgeous.
- If the placement is invalid, no ghost (do not show red; it reads as punishment).
- Snapping tolerance: choose the valid placement nearest to the raw position within 0.45 cells, so near-misses still snap.

### 5.3 Drop

- **Valid:** the piece snaps into the cells in 70 ms (easeOutQuad), then each placed block does a **squash**: scaleY 0.82 / scaleX 1.14 then springs back (spring stiffness 320, damping 15; settles in ~350 ms). Neighbor blocks within 1 cell receive a smaller jiggle impulse (30% amplitude), giving a wobble wave. Sound "bloop" (pitch varies ±5% randomly). Haptic 12 ms.
- **Invalid or dropped outside:** the piece flies back to its tray slot in 220 ms (easeOutCubic) with a soft "boing".
- Input lock during clear animations: **none** — the player can start the next drag immediately; clears resolve logically at drop time and only the visuals animate.

### 5.4 Tray

- 3 slots, pieces centered and scaled to fit.
- A piece that currently cannot fit anywhere is shown at 45% opacity (desaturated) — clear information, no text needed.
- When a new deal arrives, the 3 pieces pop in left-to-right with 60 ms stagger (scale 0 → 1, easeOutBack).

---

## 6. Pieces and the smart generator (the secret sauce)

### 6.1 Piece set (`pieces.ts`)

| Group | Shapes (all listed orientations are separate pieces) | Base weight |
|---|---|---|
| Single | 1×1 | 3 |
| Bars | 1×2, 2×1, 1×3, 3×1, 1×4, 4×1, 1×5, 5×1 | 5 each (1×5/5×1: 3) |
| Squares | 2×2, 3×3 | 2×2: 6, 3×3: 3 |
| Rectangles | 2×3, 3×2 | 3 each |
| Small L (3 cells) | 4 orientations | 4 each |
| L (4 cells) | 8 orientations (L and J) | 3 each |
| Big L (5 cells, 3×3 corner) | 4 orientations | 2 each |
| T | 4 orientations | 2 each |
| S / Z | 4 orientations | 2 each |

Each piece gets a color from the active skin's 7 jelly colors, assigned randomly but never the same color for two pieces in one deal.

### 6.2 Generator algorithm (`generator.ts`, pure and unit tested)

On every new deal:

1. Compute board fill ratio `f` (occupied cells / 64) and the current difficulty tier `d` from the game's score (`balance.ts`: tiers at 0, 1,500, 4,000, 8,000, 15,000, 25,000).
2. Sample `N = 40` candidate triples from the weighted bag (tier `d` shifts weight toward bigger pieces: +10% per tier for pieces with ≥ 5 cells, −5% per tier for singles and 1×2).
3. For each candidate, compute with the bitboard search:
   - `solvable`: there exists an order (6 permutations) and placements such that all 3 pieces can be placed, applying line clears after each placement. Early-exit on the first solution.
   - `clearPotential`: the maximum number of lines clearable during that best sequence (cap the search at 2,000 nodes per candidate; if the cap is hit, use the best found).
   - `fitCount`: how many of the 3 pieces fit right now.
4. Choose using these rules (all probabilities in `balance.ts`):
   - **Mercy zone** (`f ≥ 0.55`): with probability `mercyP` (0.90 at tier 0, minus 0.06 per tier, minimum 0.55), pick a **solvable** candidate with the **highest** `clearPotential` (ties random). Otherwise pick a random candidate.
   - **Normal zone** (`0.30 ≤ f < 0.55`): with probability 0.80 pick a random solvable candidate; otherwise random.
   - **Open zone** (`f < 0.30`): pick a random solvable candidate, preferring those whose total cells ≥ 11 (challenge) with probability 0.6.
5. **Hope injection:** if `f ≥ 0.5` and the previous 2 deals produced no clears, replace one piece with a piece that immediately completes ≥ 2 lines if such a piece exists in the set (choose the one that completes the most). Max once every 4 deals.
6. **Mercy guarantee for new players:** during the player's first 3 games ever, never deal an unsolvable triple.
7. Special jellies (Section 8) are assigned after the triple is chosen.

**Performance:** the full deal computation must take < 8 ms on a mid-range phone; benchmark it in a test. Run it in the same frame as the deal (no worker needed if within budget).

**Tuning target (verify with the bot, Section 18):** with the greedy bot, the median Classic game length is 90–160 placements, and at least 25% of games contain a "comeback" (board fill ≥ 75% followed by fill ≤ 40% within 6 placements).

---

## 7. Scoring, combo, and feedback

- **Placement:** +1 point per cell placed.
- **Line clear** (L lines cleared by one placement): base = `[0, 100, 300, 600, 1000, 1500, 2100, 2800][L]` (beyond 7: +800 per extra line).
- **Combo:** a placement that clears ≥ 1 line increments `combo`. The combo stays alive while the player clears at least once within any **3 consecutive placements** (grace window); otherwise it resets to 0. `comboMult = 1 + 0.5 × (combo − 1)` for combo ≥ 1, max 6.
- **Line score** = `base × comboMult × rushMult × missionMultiplier` (Classic). Score popups show the final number.
- **Perfect clear** (board empty after a clear): +3,000 × multipliers, special celebration.
- **Feedback words** (big bouncy text over the board): 2 lines "Good", 3 "Great", 4 "Excellent", 5+ "Amazing", combo ≥ 5 "On fire", combo ≥ 8 "Unstoppable", perfect clear "Perfect!". Sentence case, Baloo 2 800, white with a thick colored outline matching the last cleared color.
- **Combo badge:** when combo ≥ 2, a "Combo ×N" badge appears above the board with a bounce and stays (with a draining ring showing the grace window).

---

## 8. Special jellies and Jelly Rush

### 8.1 Special jellies

A special jelly is **one cell inside a piece**, marked with an icon drawn into the block.

- **Star jelly** (white star icon, sparkle shimmer): when this cell is cleared as part of any line, it also clears its **entire row and column** (a cross).
- **Bomb jelly** (round dark core with a glowing fuse ring): when cleared, it also clears the **3 × 3 area** centered on it.
- **Cascades:** cells removed by a special effect that are themselves specials trigger too. Resolve breadth-first with a guard (max 12 triggers per placement). Cells cleared by specials score +20 each (× multipliers) and count toward missions but **do not** count as "lines" for the line-score table.
- **Spawn rules:** none before the player's score reaches 2,000 in that game (first game ever: none before 1,000 so they see one early). After that, each deal has a 14% chance to contain exactly one special (Star 60% / Bomb 40%), placed on a random cell of a random piece. Jelly Rush guarantees one (8.2).
- **Visuals:** Star clear = two light beams sweeping out along the row and column (180 ms) with sparkles; Bomb clear = a round shockwave + jelly chunks flying out + 6 px shake.

### 8.2 Jelly Rush (fever)

- A **Rush meter** (a jelly-filled bar under the score) fills by +1 per line cleared and +2 per combo step ≥ 3. Capacity 10 (`balance.ts`).
- When full: **Jelly Rush** activates for the **next 6 placements**: line score ×2, the background warms and pulses, the board border glows in rainbow jelly colors, a quick "Jelly rush!" banner appears, and the next deal contains a guaranteed special jelly.
- Meter resets to 0 when Rush ends. Rush cannot be refilled while active.

---

## 9. Visual direction (premium, juicy, cohesive)

### 9.1 Palette (default skin "Classic Jelly")

- **Background:** vertical gradient `#2B1660` (top) → `#5B2A86` (middle) → `#B4457F` (bottom), plus 10–14 large, very soft bokeh circles (white, 4–8% alpha, slow drift 4–10 px/s). Pre-render the gradient on resize.
- **Board frame:** rounded rect radius 18 px, fill `#1C0F3D`, 3 px inner border `#3A2470`, soft outer shadow (0 10 30 rgba(0,0,0,0.35)).
- **Empty cell sockets:** rounded squares (radius 18% of cs), fill `#2A1856`, inner shadow at the top (1 px `#1A0D38`) and a faint highlight at the bottom (1 px `#3B2575`) so they look recessed.
- **Jelly colors (7):** Strawberry `#FF3D6E`, Tangerine `#FF8C2B`, Lemon `#FFD23F`, Lime `#45D65C`, Ocean `#2E8CFF`, Grape `#A35CFF`, Aqua `#14D2C8`.
- **UI:** primary gold `#FFC93C` (text `#4A2A00`); panels `#24124F` at 92% alpha with 2 px border `#4B2E8F`, radius 20 px; text `#FFFFFF`, secondary `#C9B8F2`; coins gold `#FFD54A`.

### 9.2 Jelly block rendering recipe (`blockSprites.ts`)

Pre-render each (color × special × size) once to an offscreen canvas at device pixel resolution; draw sprites with transforms per frame. **Never** use `shadowBlur` per block per frame. For cell size `s` and base color `c`:

1. **Drop shadow:** same rounded shape, offset y `0.07s`, color `rgba(0,0,0,0.30)`, blurred once at pre-render.
2. **Body:** rounded square, inset `0.04s`, radius `0.24s`, vertical linear gradient `lighten(c,16%)` → `c` (55%) → `darken(c,14%)`.
3. **Translucency core:** radial gradient centered at (0.5s, 0.62s), radius `0.45s`, `lighten(c,28%)` at 35% alpha → transparent.
4. **Bevel rim:** inner stroke `0.05s`: top-left arc `lighten(c,35%)` at 70% alpha, bottom-right arc `darken(c,25%)` at 60% alpha.
5. **Specular highlight:** white ellipse at (0.32s, 0.27s), radii (0.17s, 0.09s), rotated −22°, 80% alpha; plus a small white dot at (0.55s, 0.20s), radius `0.035s`, 90% alpha.
6. **Subsurface glow:** a soft curved band near the bottom, `lighten(c,30%)` at 30% alpha.

The result must read as a glossy, squishy jelly cube — not a flat square. Verify with screenshots at 3 sizes.

### 9.3 Jelly physics (`jelly.ts`)

- Every occupied cell has a 2D spring state (scaleX, scaleY, offsetY) with stiffness and damping from `theme.ts`.
- Idle: very subtle breathing (scale ±0.6%, random phase, 2.4–3.2 s period) so the board feels alive. Disabled in reduced-motion mode.
- Impulses: placement (5.3), neighbor jiggle, special explosions push nearby cells outward slightly.

### 9.4 Clear animation

- Cells in cleared lines pop in sequence starting from the cell nearest the placed piece and spreading outward along each line, 16 ms stagger.
- Each cell: scale up to 1.18 (60 ms) → squash and burst into 6–9 jelly droplets of its color (gravity, slight bounce off nothing, fade 450 ms) + a ring splash.
- Multi-line clears add a full-line light sweep; 3+ lines add screen shake (3 lines 3 px, 4 lines 5 px, 5+ 8 px; decays in 250 ms). Reduced-motion: no shake.
- Score popup at the centroid of the cleared cells: "+1,350", rises 40 px and fades in 700 ms.
- Particles pooled, max 500.

### 9.5 Other moments

- **New best score during play:** a crown icon pops next to the score with a sparkle (once per game).
- **Perfect clear:** board flashes white 120 ms, confetti of jelly colors (150 particles), "Perfect!" word, special sound.
- **Game over:** "No space left" text over the board; occupied cells desaturate one by one from top-left (8 ms stagger) — then the results panel slides up (Section 11).
- **Typography:** Baloo 2 800 for score, words, titles; 600 for body. Sentence case only. Score uses tabular-looking spacing (no jitter while counting up: animate score count-up over 300 ms).

### 9.6 Skins (cosmetic, purchasable)

Each skin changes jelly colors and render parameters and optionally board/background colors (`skins.ts`):

| Skin | Look | Price (coins) |
|---|---|---|
| Classic Jelly | Default (above) | Free |
| Gummy Bears | More translucent, stronger core glow, softer rim | 400 |
| Glass Candy | Crisp, high-gloss, strong specular, slight inner facet line | 700 |
| Frosted Ice Pop | Pastel colors, frosted noise texture (pre-rendered), cool background | 900 |
| Neon Gel | Saturated colors with outer glow halo on a near-black-violet board | 1,200 |
| Honey Drop | Warm amber family palette with golden highlights, warm wood-brown board | 1,500 |

The shop shows a live mini-board preview of each skin.

---

## 10. Audio (polished, never cheap)

- `AudioContext` created/resumed on the first gesture; no errors before that.
- Master → SFX bus + music bus; `DynamicsCompressor` on master; max 24 voices.
- **Asset override:** if files exist in `public/audio/` (`pick.ogg`, `drop.ogg`, `clear1.ogg`…, `music.ogg`), use them. The user may add CC0 sound packs there later. Otherwise use the synthesized recipes below.
- **Synthesized SFX recipes:**
  - Pick: sine 600 → 780 Hz over 60 ms, gain 0.15, fast attack, 80 ms release.
  - Drop "bloop": sine 420 → 220 Hz over 90 ms + a 5 ms filtered-noise click, gain 0.3; random pitch ±5%.
  - Invalid return "boing": triangle 300 → 380 → 260 Hz over 160 ms, gain 0.12.
  - Cell pop (per cell during clears): short pluck (triangle + sine, 70 ms) whose pitch climbs a major-pentatonic scale along the clear sequence; gain 0.12 each.
  - Multi-line chord: 2 lines = major triad, 3 = add 7th, 4+ = add 9th + shimmer (high sine arpeggio).
  - Combo step: rising "ding" (sine with slight vibrato), pitch +1 semitone per combo step.
  - Star beam: filtered noise sweep up + bright sine sparkle. Bomb: low thump (sine 120 → 50 Hz) + noise burst.
  - Rush start: rising sweep + chord. Perfect clear: 6-note arpeggio + shimmer. Game over: soft descending 3-note motif.
  - UI click: tiny 2 ms tick.
- **Music:** only if `public/audio/music.ogg` exists (looped, default volume 35%). **Do not synthesize music** (it sounds cheap).
- Settings: SFX on/off, music on/off, haptics on/off.

---

## 11. Game-over flow ("one more game" design)

1. "No space left" moment (Section 9.5), 900 ms.
2. **Second chance (once per game):** a dialog "Keep going?" with two options: "Clear 3 lines — 150 coins" (removes the 3 most-filled rows; disabled with a clear reason if not enough coins) and "No thanks". When ads become enabled (Full Launch), add "Watch an ad" as a free option (Section 16). Skip this dialog entirely in the player's first game (avoid confusion).
3. **Results panel:** big score with count-up; "New best!" ribbon if applicable; best score; coins earned (count-up); mission progress made this game (animated ticks); multiplier status.
4. **Next goal line:** one sentence showing the closest goal ("2 missions left to reach ×8", "120 points from your best", "Daily puzzle is waiting").
5. Buttons: **"Play again"** (primary, large, focused, Enter/Space) and "Menu". Play again starts a new game in under 500 ms with the deal pop-in animation.

---

## 12. Meta progression (retention engine)

### 12.1 Coins

- Earned per Classic game: `floor(score / 250)` (min 5), plus mission rewards, daily rewards, achievements.
- Spent on skins (9.6) and the second chance (11).

### 12.2 Missions → permanent multiplier

- The player always has **3 active missions** from the current **set**. Completing all 3 in a set: celebration screen, **multiplier +1** (starts at ×1, max ×30), +50 coins, and the next set appears.
- Missions progress during Classic games only (and Daily where noted). Progress persists across games unless the mission says "in one game".
- Mission sets are ordered and get harder (`missions.ts`, at least 30 sets; after the last set, generate sets procedurally from templates with scaled targets).
- **Mission templates** (with targets per set tier):
  - Clear N lines (total).
  - Clear 2+ lines at once N times.
  - Clear 3+ lines at once N times.
  - Reach combo ×N in one game.
  - Score N points in one game.
  - Place N pieces (total).
  - Trigger N Star jellies / N Bomb jellies.
  - Activate Jelly Rush N times.
  - Get a perfect clear.
  - Play the daily puzzle N times.
  - Fill the board above 75% and survive (clear back below 40%) N times.
- Example first sets: Set 1: clear 10 lines · place 30 pieces · score 1,000 in one game. Set 2: clear 2 lines at once 3 times · reach combo ×3 · score 2,000 in one game. Set 3: trigger 1 Star jelly · clear 40 lines · activate Jelly Rush once.
- Missions panel: accessible from the menu and visible on the desktop side panel; each card shows icon, short text, progress bar, reward.

### 12.3 Daily puzzle and streak

- Seed = hash of the local date `YYYY-MM-DD`. Each day: a pre-filled starting board (generated from the seed, 18–26 occupied cells forming interesting near-lines, validated as solvable for at least 10 deals by the bot) and a fixed seeded piece sequence.
- Goal: reach the day's target score; 3 stars at 100% / 160% / 230% of target. Unlimited retries; first completion of the day gives +60 coins (+10 per streak day, max +70).
- Streak = consecutive days with at least one completed daily. Flame icon + number on the menu. A calendar shows the last 14 days (completed / missed).
- Menu shows a "New" badge when today's daily is unplayed, otherwise the countdown "Next daily in HH:MM:SS".

### 12.4 Records and achievements

- Records: best score, longest combo, most lines in one placement, games played, total lines, perfect clears.
- 20 achievements with coin rewards (examples: first 3-line clear, combo ×5 / ×10, score 10k / 25k / 50k, 7-day streak, buy 3 skins, 3 perfect clears, multiplier ×10 / ×20).

---

## 13. Adventure mode (Milestone M6, after Basic Launch feedback)

Level-based mode for long-term retention and the future mobile app.

- **Goal types:** collect N gems (gems sit inside pre-placed blocks and occasionally inside dealt pieces; a gem is collected when its block is cleared); break ice (pre-placed ice blocks need 2 clears: the first clear cracks the ice); reach a target score.
- Level ends on goal completion (win) or game over (lose). Stars by remaining board space. Rewards: coins.
- **Content:** 100 levels in `levels/*.json` (initial board as 8 strings, goal, generator weights). Create a level generator + the bot to estimate pass rates; tune a sawtooth difficulty curve: levels 1–5 very easy, then every 5th level harder, every 10th marked "Hard level" (bot pass rate 35–50%), normal levels 65–85%.
- World map: a simple vertical path of level nodes with themed backgrounds every 20 levels.

---

## 14. Onboarding (first game)

- No menu on the very first launch: boot straight into a **scripted first game**:
  1. Board pre-filled with an almost-complete row (7 of 8 cells) and an almost-complete column. Tray has exactly the 1×1 piece that completes the row (plus two simple pieces). A ghost hand animates dragging that piece into the gap. Caption: "Drag the block to fill the line".
  2. On success: big clear + "Great" + sound. Next scripted deal lets them clear 2 lines at once with one piece. Caption: "Clear more lines at once for bigger points".
  3. Then normal Classic play continues seamlessly (the generator in full mercy mode for this game).
- "Skip" button always visible; any step auto-advances after 15 s.
- Missions panel is introduced only after the first game ends ("Complete missions to grow your multiplier"), with an arrow to the missions button.
- Second chance and shop are introduced only when relevant (enough coins).

---

## 15. Persistence (no database)

- One `localStorage` key `jellyfit.save.v1` (JSON) with `version` + `migrate()`. Corrupt data → back up the raw string, start fresh, never crash. If storage is unavailable, use in-memory storage silently.
- **Save the in-progress Classic game** after every placement (board, tray, score, combo, rush, multiplier snapshot, RNG state). On reload, resume exactly where the player left off (important for web: accidental tab closes must not lose a great run).
- Save on: every placement, game end, purchases, settings, mission/achievement progress, `visibilitychange` → hidden.
- Expose a `Storage` interface so Full Launch can use the CrazyGames SDK Data module and the mobile app can use native storage without touching game code.
- Unit tests: round trip, migration, corrupt recovery, resume-game correctness.

---

## 16. Platform layer: CrazyGames now, others later

### 16.1 Architecture

`platform/platform.ts` defines one interface used by the whole game:

```ts
interface Platform {
  init(): Promise<void>;           // never throws, never blocks > 3 s
  loadingStart(): void; loadingStop(): void;
  gameplayStart(): void; gameplayStop(): void;   // de-duplicated (never send the same twice in a row)
  happytime(): void;               // throttled to once per 60 s
  isMuted(): boolean; onMuteChange(cb: (muted: boolean) => void): void;
  showMidgame(): Promise<void>;    // resolves immediately when ads disabled
  showRewarded(): Promise<boolean>;// resolves false when ads disabled
  adsEnabled(): boolean;
}
```

Implementations: `crazygames.ts` (now), `none.ts` (local dev / fallback). Future: `poki.ts`, `capacitor.ts` (mobile). Select the implementation at boot from config/URL; game code never imports a vendor SDK directly.

### 16.2 CrazyGames (Basic Launch scope)

- `index.html`: `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js" async onerror="window.__cgSdkFailed=true"></script>` before the game bundle.
- `crazygames.ts`: wait up to 3 s for `window.CrazyGames?.SDK`, then `await window.CrazyGames.SDK.init()` in try/catch with timeout. On any failure → behave like `none.ts`. **The game must never wait on or break because of the SDK.**
- Use the SDK `game` module: `loadingStart()` at boot, `loadingStop()` at the first interactive frame; `gameplayStart()` when the board is interactive; `gameplayStop()` on pause, menus, dialogs, results screen, and tab hidden; `happytime()` on new best score and perfect clears (throttled).
- Mute: read `SDK.game.settings.muteAudio` and subscribe with `SDK.game.addSettingsChangeListener`; muted → master gain 0.
- **Ads:** `ADS_ENABLED = false` for Basic Launch: no ad calls, no ad buttons. Planned for Full Launch (implement then, after reading the official CrazyGames video-ads docs and ad requirements): rewarded "Watch an ad" second chance; rewarded "Double coins" on results; midgame only on "Play again", at most once every 3 minutes, never during a game. Mute and pause during ads.
- **Leaderboards (Full Launch, later):** the CrazyGames SDK offers leaderboards; plan a weekly best-score leaderboard then. Not now.
- No external links, other portals' branding, third-party ads, or share buttons. Must run inside an iframe; never touch `window.top`. Never use the Escape key for game actions. Prevent Space/arrow page scroll.

---

## 17. Mobile-app readiness (build it in now, ship later)

- Pure web tech so it can be wrapped with **Capacitor** later. Do **not** add Capacitor now; just respect these rules:
  - All assets local; works fully offline after first load.
  - No hover-only interactions; all UI reachable by touch.
  - Respect safe areas (`env(safe-area-inset-*)`), notch, and home indicator.
  - Haptics through `platform/haptics.ts` (web: `navigator.vibrate` where supported; mobile later: native haptics).
  - Storage, ads, and platform calls only through their interfaces.
  - App lifecycle: pause on `visibilitychange`, resume to a paused state.
  - Portrait layout is the primary design target (phones).
- Write `MOBILE_LATER.md` at M5 describing the Capacitor wrap steps, ad mediation options, and store asset needs (no implementation).

---

## 18. Performance, robustness, debug, and the bot

### 18.1 Performance

- 60 FPS on a 4 GB Chromebook and mid-range Android; stress test: 500 particles + 3-line clear + star cascade.
- Render only when something changes or animates (idle board with breathing: fine at 60 FPS but cheap; if reduced motion and nothing animating, stop rendering).
- Pooled particles and popups; no per-frame allocations in hot paths.
- Adaptive quality: average frame time > 20 ms for 2 s → halve particles, disable bokeh drift and idle breathing, DPR max 2. Restore after 10 s stable.
- Clamp frame delta at 0.1 s. Stop the loop when hidden.
- Global error handler; on fatal boot error show "Something went wrong. Reload the page." (never a blank screen).
- Budget: `dist/` < 3 MB, < 50 files, interactive < 2 s on 4G.

### 18.2 Debug (`?debug=1` only)

- Overlay: FPS, frame time, fill ratio, generator zone, last deal's solvable/clearPotential, tier, combo, rush.
- Keys: D new deal, F fill random 60%, S give special jelly, R trigger rush, G +500 coins, X game over.
- **Playtest logger** (always records, last 50 games): time to first drag, time to first clear, game duration, placements, max combo, lines by size, cause (game over), whether second chance used, games per session. Debug button "Copy playtest data" (JSON to clipboard).

### 18.3 Bot simulation (`npm run sim`)

- A greedy bot (Node, using the pure `game/` modules): for each deal, tries all orders and placements, scores outcomes by (lines cleared × 10) − (holes × 3) − (bumpiness × 1) + (largest empty rectangle × 0.5), picks the best.
- `npm run sim -- --games 2000 --seed 1` prints: median/mean/p10/p90 placements per game, average score, comeback rate, % of deals unsolvable, special/rush frequency.
- Use it to tune the generator to the targets in Section 6.2. Record results in `DEVLOG.md`.

---

## 19. Milestones and acceptance criteria

At the end of every milestone: typecheck, tests, build, screenshots (`npm run shots`), bundle size, `DEVLOG.md`, commit — then **STOP and wait for the user.**

### M1 — Core game with premium feel (decision gate)

- Rules (Section 4), bitboard engine, drag and drop with full feel (Section 5), smart generator (Section 6) with bot simulation, scoring/combo/words (Section 7), jelly block rendering and jelly physics (9.2–9.4), board and background visuals, core SFX (pick, drop, boing, pops, chords, combo), game over + instant Play again, in-progress game resume.
- No menus beyond a minimal results panel. No meta yet.
- Acceptance: feels great on mouse and touch; screenshots at 3 sizes look premium; 60 FPS; generator targets met in `npm run sim`.
- **When done, tell the user:** have 5+ people who never saw it play on a phone without explanation, and report: Did they start within 5 seconds? Did they play 3+ games voluntarily? Did anyone say "one more"? Did anything look or feel cheap? Fix M1 based on that before M2.

### M2 — Specials, Rush, and full juice

- Star and Bomb jellies with cascades, Jelly Rush, perfect clear, new-best moment, all remaining SFX, optional music file support, settings (sound, music, haptics, reduced motion), pause menu.

### M3 — Meta and retention

- Save system complete, coins, missions → multiplier (30+ sets + procedural continuation), skins shop (all 6 skins), daily puzzle + streak + calendar, records, achievements, main menu, results "next goal", desktop side panels, second chance (coins).

### M4 — Onboarding and first-session tuning

- Scripted first game (Section 14), contextual introductions, first-3-games mercy guarantee; verify with the playtest logger: first drag < 5 s, first clear < 12 s.

### M5 — Platform and ship (Basic Launch build)

- Platform layer + CrazyGames wrapper (ads disabled), performance pass, adaptive quality, cross-browser checks (Chrome, Edge, Firefox; Safari if possible), `npm run zip`.
- Write `SUBMISSION.md`: CrazyGames upload steps, short + long English descriptions, controls text, suggested tags, required cover/thumbnail list, and a 15-second trailer shot list (combo chain, star cascade, perfect clear).
- Write `MOBILE_LATER.md` (Section 17).
- Acceptance: Definition of Done (Section 20) passes.

### M6 — Adventure mode (after Basic Launch data)

- Section 13 complete with 100 tuned levels and world map.

---

## 20. Definition of done

- [ ] Interactive in < 2 s; `dist/` < 3 MB; < 50 files.
- [ ] Mouse, touch, and pen all work; portrait, landscape, and live resize all work.
- [ ] First launch goes straight into the scripted first game; returning players see the menu (or resume their unfinished game).
- [ ] Closing the tab mid-game and reopening resumes the exact game.
- [ ] No sound before the first gesture; no console errors anywhere.
- [ ] Works with the SDK script blocked and with `localStorage` blocked.
- [ ] Tab switch pauses and calls `gameplayStop`.
- [ ] Generator: deal computation < 8 ms on a mid-range device profile; sim targets met.
- [ ] Missions, multiplier, coins, skins, daily, streak, and achievements persist correctly; daily rolls over at local midnight (tested with mocked dates).
- [ ] 60 FPS in the stress case or adaptive quality engages smoothly.
- [ ] Screenshots at 390×844, 820×1180, 1440×900 reviewed and polished.
- [ ] No Escape-key actions; Space/arrows never scroll the page.
- [ ] No external requests except the CrazyGames SDK script.
- [ ] Debug UI hidden unless `?debug=1`.
- [ ] Typecheck, lint, tests pass.

---

## 21. Do NOT

- Do not change the core rules (8×8, 3 pieces, no rotation, rows and columns clear).
- Do not add time limits or timers to Classic mode.
- No backend, database, accounts, network calls (except the SDK script), or analytics.
- No copyrighted names, characters, music, or assets with unclear licenses (only the OFL font and user-provided CC0 audio).
- No `alert`/`confirm`/`prompt`; use in-game dialogs. No external links, share buttons, fake buttons, or artificial delays.
- No synthesized background music.
- Do not start the next milestone without the user's approval.
