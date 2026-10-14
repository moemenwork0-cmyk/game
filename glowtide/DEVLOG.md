# Devlog

## M1 — Core loop prototype (2026-10-14)

### Done

- **Project:** Vite 8 + TypeScript 5.9 strict, Vitest, ESLint (flat config) and Prettier. Scripts: `dev`,
  `build`, `preview`, `typecheck`, `test`, `lint`, `zip` (a dependency-free Node ZIP writer).
  `base: './'`, target es2019, no sourcemaps. Fredoka 500/700 (latin) is bundled locally.
- **Core:** fixed 60 Hz loop with accumulator and 0.1 s delta clamp; mulberry32 RNG with string hashing;
  typed event bus; generic pool; time scale with linear easing; allocation-free spatial hash (cell 64).
- **Linking (`game/chain.ts`, pure and unit tested):** color/reach/duplicate validation, prism rules (built and
  tested now, used from M2), backtrack to node n−2, break at overstretched links (reach × 1.35), dead-node
  removal, min chain 3.
- **World:** hit test with 14 (mouse) / 22 (touch) pad; pointer path sampling; held critters at 0.5× speed;
  Focus bullet time (0.35 scale, eased in over 120 ms and out over 150 ms; drains 1/s, regenerates 0.7/s after 0.5 s);
  staggered pops (35 ms); Burst at 5+ (radius 70, 1 damage, any color); affordance pulse on every legal next
  node; "Burst" label and charge tone while dragging; red flickering dangling rope when the target is too far.
- **Pearl:** 10 shell segments (outer ring) and a Focus arc (inner ring). Contact pops the critter, costs
  shell, and triggers shake, a red segment flash, a thud and 0.25 s invulnerability. At 0 shell: 1 s slow
  motion, cracks, flash, then the run-end screen.
- **Critters:** Drifters only, 3 colors with their shapes (circle, triangle, rounded square), eyes that track
  the pearl, blinking, wobble and soft separation. Bodies are pre-rendered glow sprites.
- **Spawning:** uniform angle, ray to the visible rectangle + 40, 0.5 s emerge. The ramp uses the real tide
  formulas with a virtual tide every 25 s, plus an opening same-color trio (see `DECISIONS.md`).
- **Audio (Web Audio, synthesized):** pentatonic link notes (C4 up 2.5 octaves, sine + triangle), unlink,
  snap, pitched pops replaying the chain, a final chord that grows with chain length, burst thump, charge,
  pearl hit, crack and run-over motif. The context is created on the first gesture. Compressor on master;
  24-voice cap.
- **UI:** boot screen (styled inline, removed after the first frame), HUD (tide, time, popped, 44 px pause
  button), pause (Resume / Restart run with confirmation; P key; automatic on tab hidden or window blur),
  run-end screen with "Play again" focused (Enter/Space).
- **Robustness:** the loop stops while the tab is hidden; global error logging; a friendly fatal-boot
  overlay; Space and arrows never scroll; no Escape actions; context menu disabled on the canvas.
- **Debug (`?debug=1`):** FPS/frame-time/entity overlay, keys K/I/N/S.

### Verification

- `npm run typecheck`, `npm run lint`, `npm test` (33 tests: chain, rng, tide formulas) and `npm run build`
  all pass.
- Automated playtests in headless Chromium (Playwright), landscape 1280×720 with mouse and portrait 390×844
  with touch (DPR 2):
  - Interactive in 100–350 ms. No console errors or warnings, and no page scroll.
  - Scripted scenario: 6-chain → "Burst" label, time scale 0.35, release popped 6 and the bursts killed
    3 bystanders of another color. Backtrack 3 → 2 → re-add → 3. Too far → red rope. Wrong color rejected.
    Overstretch broke the chain 3 → 2. A 2-chain dissolved without popping. Holding 3.6 s drained Focus to 0
    and time returned to 1.0. Regen was 0.69 after 1.5 s (spec: 0.5 s delay, then 0.7/s).
  - Stress: 156–158 critters at a steady 60 FPS (16.7 ms average and worst frame).
  - Death → run-end screen → "Play again" (Enter or Space) restarted in 10–20 ms.
  - With no input, a run ends around 0:24 on tide 1, and debug UI is absent without `?debug=1`.
- Screenshots of early play, linking, Burst, too-far, stress, pause and game over were reviewed.

### How to test

```sh
cd glowtide
npm install
npm run dev            # open the printed URL; add ?debug=1 for the overlay
```

Drag through 3+ critters of one color and release. Try 5+ for a Burst. Move back onto the previous node to
undo a link. Watch the inner ring (Focus) drain while you hold.

### Bundle size

`dist/` holds 7 files and 128 KB in total: JS 49.5 KB (17.1 KB gzip), CSS 4.8 KB, HTML 1.8 KB and 4 font
files 72 KB. `npm run zip` produces a 90 KB archive.

### Known issues / notes

- Audio was verified only as "voices scheduled, no errors" in headless Chromium. It still needs a listen on
  real speakers.
- FPS was measured in headless Chromium on a server, not yet on a Chromebook or mid-range phone (M6
  covers the device pass and adaptive quality).
- Visuals are prototype-level by design (no fins/tentacles, light shafts or reef silhouettes yet; M4).
- With no tutorial yet (M5), first-time players rely on the opening trio and the affordance pulses.

### Next: decision gate

Before M2, have **at least 5 people who have never seen the game** play it without explanation, then
answer:

1. Did they understand what to do within 15 seconds?
2. Did they keep playing voluntarily for 3+ minutes?
3. Did anyone say "one more"?

If the answers are mostly no, change the core loop before adding content.
