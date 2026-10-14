# GLOWTIDE — Plan

The design is defined in `GLOWTIDE_GAME_SPEC.md`, which is the single source of truth. This file summarizes the
architecture and tracks the milestones.

## Architecture summary

- **Stack:** Vite + TypeScript (strict), Vitest, ESLint, Prettier. No engine, no UI framework, no backend.
- **Rendering:** one `<canvas>` (2D) for the world, an HTML/CSS overlay (`#ui`) for every menu, card and HUD
  element.
- **World space:** the pearl sits at (0, 0) in the center of the screen. Scale is
  `k = clamp(min(viewW, viewH) / 640, 0.55, 1.6)` CSS px per world unit. Canvas backing store =
  CSS size × `min(dpr, 2)`.
- **Simulation:** fixed 60 Hz step with an accumulator (frame delta clamped to 0.1 s). Rendering runs on every
  requestAnimationFrame (RAF). A global `timeScale` (Focus bullet time, death slow-motion, later hit-stop)
  scales game time; Focus drains in real time.
- **Data-driven:** every tunable number is in `src/config/balance.ts`; colors and shapes are in `palette.ts`.
- **Pure logic, tested:** `game/chain.ts` (link validation), `core/rng.ts` (mulberry32 + string hash) and
  `game/tides.ts` (formulas) have no DOM dependency and are unit tested.
- **Entities:** critters, particles, effects and motes are pooled. A spatial hash (cell size 64) serves hit
  tests, separation and burst queries. Hot loops allocate nothing.
- **Decoupling:** `World` emits typed events (link, unlink, snap, pop, burst, pearl hit, and so on).
  Audio and particles subscribe to them, so gameplay code never calls rendering or audio directly.
- **Rendering performance:** critter bodies and glows are pre-rendered into offscreen sprites (rebuilt on
  resize). The game never sets `shadowBlur` per entity per frame. Eyes are drawn live because they are cheap.
- **Audio:** Web Audio, synthesized only. The context is created on the first gesture. Buses:
  master (compressor) → music, sfx. Up to 24 voices.
- **Persistence (M3):** one `localStorage` key behind a `Storage` interface with an in-memory fallback.
- **Platform (M6):** the CrazyGames SDK wrapper degrades to no-ops; the game never waits on it.

## Milestones (from spec Section 18)

### M1 — Core loop prototype (decision gate)
- [x] Pearl with shell HP; Drifters only, 3 colors, endless spawning with a simple ramp
- [x] Full linking rules (reach, backtrack, break, held speed, Focus bullet time, min chain 3, Burst at 5+,
      affordance pulses)
- [x] Pearl damage, run end, instant restart
- [x] Synthesized pentatonic link notes and pop sound
- [x] Simple shapes per color
- [x] Mouse and touch
- [x] Unit tests for `chain.ts` pass; 60 FPS with 150 critters
- [ ] Hallway test with 5+ fresh players (user)

### M2 — Content and run structure
- [ ] Tides with formulas and weight table; all critter types; Prism color switching
- [ ] Ripple and Surge; glow, XP, level-up cards with all 24 upgrades; reroll
- [ ] Abyss Eel with all variants; 20-tide run with victory; score and combo
- [ ] Endless and Depth logic (basic UI)

### M3 — Meta and retention
- [ ] Save system, pearls currency, Reef screen, pearl characters, achievements
- [ ] Daily Tide with streak and countdown, run-end "Next goals", main menu
- [ ] Progress survives reloads; daily rollover verified with mocked dates

### M4 — Juice and presentation
- [ ] Final procedural art, background layers, particles, rope, shake, hit-stop, popups
- [ ] All SFX, adaptive music, UI polish, settings, accessibility, reduced motion

### M5 — Onboarding and first-session tuning
- [ ] Tutorial, first-run assist, timings verified with the playtest logger

### M6 — Platform and ship
- [ ] CrazyGames SDK wrapper, ads interface (disabled), performance pass, adaptive quality
- [ ] Cross-browser checks, production build, `npm run zip`, `SUBMISSION.md`
- [ ] Definition of done (Section 19) passes
