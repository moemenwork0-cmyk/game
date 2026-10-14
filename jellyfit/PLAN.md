# JELLYFIT — Plan

Source of truth: `JELLYFIT_GAME_SPEC.md` (kept in this folder). This file summarises the architecture and tracks milestones.

## Architecture

```
          ┌──────────── input/drag.ts (Pointer Events) ─────────────┐
          │                                                          ▼
  main.ts → app.ts (controller) ──► game/session.ts (pure logic, no DOM)
          │        │                    ├─ game/rules.ts      bitboard rules (pure)
          │        │                    ├─ game/generator.ts  smart deals (pure)
          │        │                    ├─ game/scoring.ts    score/combo/words (pure)
          │        │                    └─ game/board.ts      masks + colour/special arrays
          │        ├──► render/renderer.ts (one 2D canvas)
          │        │       background · board · jelly springs · ghost/preview · tray
          │        │       particles · popups · camera shake · block sprites (pre-rendered)
          │        ├──► audio/ (WebAudio, synthesized SFX, optional files in public/audio)
          │        ├──► ui/ (HTML overlay: HUD, results panel)
          │        └──► meta/save.ts (one localStorage key behind a Storage interface)
          └──► debug/ (?debug=1 overlay + test hooks for screenshots)

sim/ — Node bot that drives game/session.ts headless to tune the generator.
```

- The game logic (`src/game`, `src/core/rng.ts`, `src/core/bitboard.ts`, `src/config`) never touches the DOM, so the bot, tests and the browser all run the exact same code.
- The board is two 32-bit masks (rows 0–3, rows 4–7). Every piece has its placements precomputed as mask pairs, so "can place" is two ANDs and the generator's search is cheap.
- Rendering: the logical board resolves instantly on drop; the renderer keeps its own visual state (appearing blocks, popping blocks as transient entities), so input never locks.
- All tunables: `src/config/balance.ts` (gameplay) and `src/config/theme.ts` (visual/feel).

## Milestones

- [x] **M1 — Core game with premium feel** (done, awaiting playtest feedback; see DEVLOG.md): rules + bitboard, drag & drop feel, smart generator + bot sim, scoring/combo/words, jelly blocks + jelly physics, board/background visuals, core SFX, game over + instant play again, in-progress resume.
- [ ] **M2 — Specials, Rush, full juice**: Star/Bomb jellies + cascades, Jelly Rush, perfect clear celebration, new-best moment, remaining SFX, optional music, settings, pause menu.
- [ ] **M3 — Meta and retention**: full save, coins, missions → multiplier (30+ sets + procedural), skins shop (6), daily puzzle + streak + calendar, records, achievements, main menu, next-goal line, desktop side panels, second chance.
- [ ] **M4 — Onboarding**: scripted first game, contextual intros, first-3-games mercy guarantee verified with the playtest logger.
- [ ] **M5 — Platform and ship**: platform layer + CrazyGames wrapper (ads off), perf pass, adaptive quality, cross-browser, `npm run zip`, SUBMISSION.md, MOBILE_LATER.md.
- [ ] **M6 — Adventure mode**: 100 tuned levels + world map.
