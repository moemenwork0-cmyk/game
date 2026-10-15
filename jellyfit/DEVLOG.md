# Dev log

## Jello holds a piece + Android APK (2026-10-15)

- **Hold via Jello:** drag a tray piece onto Jello → his stretchy arm catches it and he holds it (bobs, tosses it, swaps when given another). Drag it from his hand onto the board when needed; an invalid drop returns it to his hand. The held piece counts for game over (only-held-fits makes him wave it) and is saved with the game. Session API: `hold(slot)`, `place(HOLD, r, c)`.
- **First-time tip:** at the first moment a piece doesn't fit (or after 9 placements), the screen dims with spotlights on the piece and Jello, a caption card says «اسحب أي قطعة وإديهالي، أشيلهالك!», and a cartoon finger carries a ghost copy into his hand in a loop. Shown at most 3 games; never again once the player has used it.
- **Android:** Capacitor 7 (`android/`), portrait, immersive full screen, vibration, the user's icon (adaptive + round + legacy + splash), release-signed APK. Rebuild with `npm run apk` (needs `ANDROID_HOME` and `android/keystore.properties`). `scripts/android_setup.py` re-applies the customisation after `cap sync`.
- Tests: 35 passing (hold logic incl. swap, new deal, game over, save/restore).

## UI redesign + Jello 2.0 (2026-10-15)

- **UI, candy style:** 3D buttons (dark outline, glossy band, coloured lip, press-down), outlined text for scores and titles, panels with pink title ribbons, candy toggles, crown badge pills, rotating "new record" burst, moving shine on the main buttons.
- **Canvas:** brighter calm royal-blue background with a slowly drifting jelly pattern and a soft light behind the board; rotating light rays on the home screen; the board is now a chunky raised tray with a dark outline and a recessed well.
- **Jello 2.0:** sparkly kawaii eyes with lashes, ω cat mouth, gradient blush, drifting bubbles inside his body, rim light, feet; soaks up the colour of cleared jelly; sunglasses at combo 5 (off when the combo breaks); hands over his eyes when the board is nearly full; pull him to stretch and let go for a boing (big pulls flip him); rub him to pet him (hearts + purr); idle repertoire (wink, look around, head tilt, wiggle, bounce, blow a bubble, hum with notes, wave, yawn, tuft flick), calmer in game; eyes widen when a piece passes close by; new sounds (boing, purr, bubble, hum, yawn, sunglasses).
- `scripts/jello-shots.mjs` captures close-ups of all his states (`screenshots/jello/`).
- Tests: 31 passing (new: pull/pet, sunglasses).

## Jello the mascot (2026-10-14)

- `src/jello/`: **jello.ts** (soft-body springs: squash/stretch, wobble modes, poke dents, lean, lagging tuft, arms, jumps with spins, moods, face, blink, eye tracking, speech, fx), **jelloDraw.ts** (procedural glossy jelly body, kawaii face with 7 eye styles and 6 mouths, brows, blush, crown, sweat/tears/Zzz/hearts/sparkles, speech bubble with word-by-word reveal), **director.ts** (game events → reactions with speech cooldowns, one line per move), **lines.ts** (Egyptian-dialect lines in no-repeat bags).
- Voice: synthesized babble (one blip per syllable, mouth flaps in sync) + squish, giggle, jump, land, aww, snore, pop.
- He greets on the home screen standing on the logo, sits on the board's top corner in game, follows the dragged piece with his eyes, cheers/spins on clears, dances on combos, sweats in danger, celebrates comebacks, wears a crown on a new best, melts and cries on game over, giggles when tapped, gets dizzy after 5 quick taps, chats when idle and falls asleep after 30 s.
- Settings: «كلام جيلو» toggles his bubbles and voice.
- HUD: score moved to the top row (shrinks to fit), combo badge to the board's top-left, Jello on the top-right.
- Tests: 29 passing (5 new for Jello: no repeated lines, no chatter on plain moves, danger → comeback, dizzy + sleep, talk toggle). Smoke test taps Jello with mouse and touch.

## Feedback round 1 (2026-10-14)

- Whole game in Arabic (RTL, Baloo Bhaijaan 2), calm deep-blue palette, new home screen (logo, best score, settings gear, one play button), settings and pause dialogs, home button on results.
- Touch drag speed-up so pieces reach the top rows easily (smoke test drags to row 0 with real touch events).
- Tray area now sits in a soft rounded panel.
- New `npm run single` builds `jellyfit.html`, one file that plays offline.
- Checks: typecheck, lint, 24 tests, screenshots (incl. menu/settings/pause), smoke test — all pass, no console errors.

## M1 — Core game with premium feel (2026-10-14)

### Done

- **Rules + bitboard engine** (`src/core/bitboard.ts`, `src/game/rules.ts`, `src/game/board.ts`): board = two 32-bit masks, all 37 pieces have their placements precomputed as mask pairs. Simultaneous row + column clears, cross cell counted once, game-over detection.
- **Smart generator** (`src/game/generator.ts`): 40 weighted candidate triples per deal, tier weight shift, DFS solvability + clear potential (2,000-node cap, clearing moves first), mercy / normal / open zones, hope injection (max once every 4 deals), first-3-games mercy guarantee. Plus the tuning additions in DECISIONS.md.
- **Scoring** (`src/game/scoring.ts`): cell points, line table, combo with 3-placement grace, combo multiplier (max ×6), perfect clear bonus, feedback words.
- **Session** (`src/game/session.ts`): deals, placements, stats, snapshot/restore for resume.
- **Drag and drop** (`src/input/drag.ts`): Pointer Events (mouse/touch/pen), 120 ms easeOutBack pickup, touch lift 1.4 cells / mouse 0.25, frame-rate independent follow (0.55), velocity tilt ±6° + stretch 6% on springs, snapping with 0.45-cell tolerance, ghost at 35%, clear preview (blocks take the dragged colour and pulse + white line glow), 70 ms snap, 220 ms fly-back, no input lock during clears, drag cancelled on resize.
- **Rendering** (`src/render/*`): pre-rendered jelly sprites following the 6-step recipe (shadow, body gradient, core, rim, specular, subsurface glow), recessed sockets, framed board, gradient + drifting bokeh background, per-cell jelly springs (squash 0.82/1.14, k 320, d 15, neighbour wobble at 30%), idle breathing, clear sequence spreading from the placed piece (16 ms stagger, grow to 1.18, 6–9 droplets + ring), light sweeps for multi-line clears, shake for 3+ lines, score popups, bouncy feedback words, combo badge with draining grace ring, game-over "No space left" with one-by-one desaturation, pooled particles (500).
- **Audio** (`src/audio/*`): context on first gesture, SFX + music buses, compressor, 24-voice cap, synthesized pick / bloop (±5% pitch) / boing / pentatonic cell pops / multi-line chords / combo ding / game over / click / perfect. Files in `public/audio/` override recipes automatically.
- **UI**: HTML HUD (score with 300 ms count-up, best with crown), results panel (score count-up, New best! ribbon, best, lines, best combo, Play again focused, Enter/Space).
- **Persistence** (`src/meta/save.ts`): one key `jellyfit.save.v1`, versioned + migrate, corrupt data backed up, in-memory fallback. The game is saved after every placement and on tab hide; reload resumes the exact game (same RNG state → same future deals).
- **Debug** (`?debug=1`): FPS/frame time, fill, zone, tier, solvable/clearPotential, combo; keys D (deal), F (fill 60%), X (force game over). `?test=1` exposes `window.__jf` for scripted scenes.
- **Tooling**: `npm run sim`, `npm run shots`, `npm run smoke`, `npm run zip`.

### How to test

```bash
cd jellyfit
npm install
npm run dev            # http://localhost:5173  (add ?debug=1 for the overlay)
npm run typecheck && npm run lint && npm test
npm run build && npm run shots && npm run smoke
npm run sim -- --games 2000 --seed 1
```

### Results

- Typecheck, lint: clean. Tests: 24 passing (rules incl. 10,000-case property test vs a naive reference, generator incl. benchmark, scoring, save/resume).
- Generator benchmark: average deal < 2.5 ms on the CI machine (asserted in the test; phone budget 8 ms).
- Smoke test (real frame loop, Chromium): mouse and touch drags place pieces, reload resumes the exact game, works with `localStorage` blocked, interactive in ~190 ms, no console errors.
- **Bundle:** `dist/` = 120 KB, 5 files (JS 63 KB / 23 KB gzip, CSS 4 KB, 2 font files 38 KB).
- **Bot sim** (2,000 games, seed 1): median **119** placements (p10 58, p90 251) ✅ target 90–160. Comeback rate **0.8%** ❌ target ≥ 25% — see DECISIONS.md. Unsolvable deals 2.1%.
- Screenshots reviewed at 390×844, 820×1180, 1440×900: start, mid-game, drag with clear preview, 2-line drop, 3-line clear + burst, combo badge + word, game-over moment, results.

### Known issues / not yet done

- Comeback-rate target not met with the greedy bot (see above).
- FPS only measured in headless Chromium without a GPU (JS ~0.7 ms per frame); needs a check on a real mid-range phone / Chromebook.
- "Menu" screenshot does not exist yet (no menu until M3). No pause button until M2 (the spec layout shows one).
- Second chance, specials, Rush, meta, onboarding, platform layer: later milestones as planned.
