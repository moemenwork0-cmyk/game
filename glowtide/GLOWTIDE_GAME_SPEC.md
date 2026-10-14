# GLOWTIDE — Complete Game Specification & Build Instructions for Claude Code

> Kickoff instruction: Read this entire document before writing any code. Then create `PLAN.md` (architecture summary + milestone checklist copied from Section 18), then start Milestone M1. This document is the single source of truth for the project.

---

## 0. Who you are and how you work

You are a senior web game engineer and game-feel specialist. You are building a commercial-quality HTML5 game for the CrazyGames platform. The game's success is judged by CrazyGames "Basic Launch" metrics measured on real players over 7–21 days:

- **Average playtime per session:** target 10+ minutes.
- **Day-1 retention:** target 10–15% or higher.
- **Conversion** (players who play at least 1 minute after the game starts): target 80%+.
- **Load:** playable in under 10 seconds; initial download under 20 MB (we target under 3 MB total).

Every engineering and design decision must serve these four numbers.

### Working rules (follow strictly)

1. **Spec first.** Read everything, write `PLAN.md`, then build milestone by milestone (Section 18). Do not skip ahead.
2. **Stop at every milestone.** At the end of each milestone: run typecheck, tests, and production build; update `DEVLOG.md` with what was done, how to test it, known issues, and bundle size; then STOP and wait for the user's go-ahead.
3. **Ambiguity:** choose the simplest option consistent with the design pillars (Section 1) and record it in `DECISIONS.md`. Never silently change numbers from this spec; if you change one, log the old value, new value, and reason.
4. **No scope creep:** do not add features that are not in this spec. Put ideas in `IDEAS.md`.
5. **Hard technical constraints:**
   - No backend, no server, no database, no user accounts, no external APIs at runtime.
   - No third-party analytics. No CDNs. Fonts are bundled locally.
   - The only external script allowed is the CrazyGames SDK, loaded so that the game works perfectly even if it fails to load (Section 15).
   - Persistence is **only** via `localStorage`, accessed through one Storage module (Section 14).
6. **All tunable numbers live in `src/config/balance.ts`.** No magic numbers in gameplay code.
7. **Code quality:** TypeScript strict mode, small focused modules, no UI framework (vanilla DOM + CSS), no game engine. Gameplay randomness goes through a seeded RNG.
8. **Git:** initialize a repo; commit after every meaningful step with clear messages.
9. **Verify, don't assume:** run the game, test landscape and portrait viewport sizes, test mouse and touch (device emulation). If Playwright or another headless browser is available, take screenshots of key states and review them yourself before reporting.
10. **Never end a milestone with a broken build.**

---

## 1. Product summary

- **Working title:** GLOWTIDE (store in `GAME_TITLE` constant in `src/config/config.ts`; the name may change).
- **One-line pitch:** Drag through same-colored sea creatures swimming toward your pearl to link and pop them — longer chains, bigger blasts. Survive 20 tides, build your power, grow your reef.
- **Genre:** action-puzzle roguelite (match-by-linking × wave defense × survivors-style upgrade picks).
- **Platform:** CrazyGames web. Desktop (mouse) and mobile (touch). Any orientation. Primary browsers Chrome and Edge; must also work on Firefox and Safari.
- **Audience:** 13+, PEGI-12 safe. Cute glowing creatures, no blood, no gore. Popping is bubbles and sparkles. Copy should not feel babyish.
- **First-session timing targets:**
  - Interactive within 2 seconds of load.
  - First link attempt within 8 seconds.
  - First pop within 15 seconds.
  - First upgrade pick within 40 seconds.
  - A full 20-tide run lasts 12–16 minutes.

### Design pillars

- **P1 — Instant fun:** one verb (drag). Playable without reading.
- **P2 — Satisfying feel:** every link and every pop gives escalating, musical sound and visual feedback.
- **P3 — Calm to frantic:** linking slows time, turning chaos into readable decisions.
- **P4 — Always a next goal:** inside a run (next level-up, next tide, boss) and across days (Daily Tide, unlocks, reef upgrades).

### What makes it distinct (protect this)

- Targets are **moving creatures on an open field**, linked in real time. There is **no grid and no tile swapping**.
- **Holding a link slows time**, limited by a Focus meter.
- **Prism creatures** let a chain switch color mid-chain.
- Creatures swim toward a **central pearl** you must protect.

---

## 2. Tech stack and project structure

- **Vite + TypeScript (strict).** Vitest for unit tests. ESLint and Prettier with minimal config.
- **Rendering:** a single `<canvas>` (2D context) for the game world, plus an HTML/CSS overlay for all UI (menus, cards, HUD text).
- **Audio:** Web Audio API. All sounds and music are synthesized at runtime. No audio files.
- **Font:** `@fontsource/fredoka` (SIL OFL license), weights 500 and 700, latin subset only, bundled by Vite. No Google Fonts requests.
- **`vite.config.ts`:**
  - `base: './'` (relative asset paths are required for hosting in a subfolder).
  - `build.target: 'es2019'`.
  - `sourcemap: false` for production.
  - Output to `dist/`.
- **Scripts in `package.json`:** `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `test` (vitest run), `lint`, `zip` (zips `dist/` into `glowtide-build.zip` using a small Node script, no external binaries).

### Folder structure

```
src/
  main.ts                    boot sequence
  config/
    config.ts                GAME_TITLE, VERSION, feature flags (ADS_ENABLED=false, DEBUG from ?debug=1)
    balance.ts               every tunable number
    palette.ts               colors, color→shape mapping
  core/
    loop.ts                  fixed-timestep update (60 Hz), render every RAF
    rng.ts                   mulberry32 + string hash seeding
    math.ts                  vec helpers, lerp, clamp, easing
    pool.ts                  generic object pool
    events.ts                tiny typed event bus
    time.ts                  global timeScale with smooth lerp, hit-stop
    spatialHash.ts           uniform grid for queries
  input/
    pointer.ts               Pointer Events (mouse + touch + pen unified)
    keyboard.ts
  game/
    world.ts                 owns all entities and systems for one run
    pearl.ts
    critters/                one file per type + shared base
    spawner.ts
    tides.ts                 tide formulas and type weights
    chain.ts                 PURE link-validation logic (unit tested)
    effects.ts               burst, ripple, surge, lightning, ember patches
    glow.ts                  XP motes
    upgrades/definitions.ts  data for all 24 upgrades
    upgrades/apply.ts        derived stats from picked upgrades
    boss.ts                  Abyss Eel
    scoring.ts               score + combo
  render/
    renderer.ts
    sprites.ts               pre-rendered glow sprites (offscreen canvases)
    background.ts
    particles.ts
    camera.ts                screen shake
    popups.ts                floating numbers
  audio/
    audio.ts                 context unlock, buses, compressor, limiter
    sfx.ts
    music.ts                 generative adaptive music
  meta/
    save.ts                  versioned save + migrations
    progression.ts           pearls currency, reef upgrades
    characters.ts            pearl characters + unlock conditions
    achievements.ts
    daily.ts                 Daily Tide seed, modifiers, streak
  ui/
    screens/                 boot, menu, hud, levelup, pause, gameover, reef, characters, achievements, settings, daily
    tutorial.ts
    ui.css
  platform/
    crazygames.ts            SDK wrapper with no-op fallback
    ads.ts                   ad interface, disabled for now
  debug/
    debugPanel.ts
    playtestLog.ts
tests/
  chain.test.ts  rng.test.ts  save.test.ts  tides.test.ts  daily.test.ts
```

---

## 3. Coordinate system, scaling, and screen

- **World units.** The pearl sits at world origin (0, 0), always at the center of the screen.
- **Scale factor:** `k = clamp(min(viewW, viewH) / 640, 0.55, 1.6)`, where `viewW`/`viewH` are CSS pixels. One world unit = `k` CSS pixels. The visible world is `viewW / k` by `viewH / k` world units, centered on the pearl.
- **Canvas backing resolution:** CSS size × `min(devicePixelRatio, 2)` (reduced to 1 under adaptive quality, Section 16).
- **Resize and orientation change:** recompute `k`, rebuild cached background, and keep entity world positions (clamp entities that end up far outside the view).
- **Spawning:** pick an angle θ uniformly in [0, 2π), cast a ray from the pearl, and find where it exits the visible rectangle expanded by 40 world units. Spawn there with a 0.5-second fade/scale-in ("emerging from the deep"). Uniform angle keeps spawn density fair in both portrait and landscape.
- **Safe areas:** respect `env(safe-area-inset-*)` for UI.
- **Page behavior:**
  - `touch-action: none` and `overscroll-behavior: none` on the game container.
  - No page scrolling.
  - Context menu disabled on the canvas.
  - Prevent default for Space and arrow keys while the game has focus.

---

## 4. Core mechanic: Linking (build first; make it feel amazing)

### 4.1 Rules

1. **Start a chain.** On pointer down, hit-test critters: a critter is hit if `distance(pointer, critter) ≤ critter.radius + HIT_PAD`, where `HIT_PAD = 14` world units for mouse and `22` for touch. If several are hit, choose the nearest. That critter becomes node 0 and its color becomes the **chain color**. Pointer down on empty water shows a small ripple and does nothing else.
2. **Add a node.** While held, when the pointer passes over critter C (same hit test), add C if **all** of these hold:
   - C is not already in the chain.
   - C's color equals the chain color, **or** C is a Prism, **or** the previous node is a Prism (then C's color becomes the new chain color).
   - `distance(C, lastNode) ≤ LINK_REACH` (base 150 world units).
3. **Too far.** If the pointer is over a valid-color critter that is out of reach, draw the dangling rope segment red and flickering. Do not add it.
4. **Backtrack.** If the pointer moves onto node n−2 (the node before the last), remove the last node (undo), with a soft "unlink" sound.
5. **Moving nodes.** The rope always connects the current positions of nodes (they keep moving), plus a dangling segment from the last node to the pointer.
6. **Break.** Each update, if the distance between two consecutive nodes exceeds `LINK_REACH × BREAK_FACTOR` (base 1.35), the chain breaks at that link: all nodes after it are released, with a "snap" sound and a small spark.
7. **Lost nodes.** If a linked critter dies (hits the pearl or is killed by an effect), remove it and re-validate the chain (break at that point).
8. **Held speed.** Linked critters move at `HELD_SPEED_MULT = 0.5` of their speed (stacking with time slow).
9. **Release (pointer up, or pointercancel):**
   - If chain length ≥ `MIN_CHAIN = 3`: pop all nodes in order with a 35 ms stagger (a light pulse travels along the rope; notes ascend), then apply chain-length effects (4.3).
   - If length < 3: the chain dissolves. No penalty.
10. **One chain at a time.** Ignore extra simultaneous touches.

### 4.2 Focus (bullet time)

- While a chain has ≥ 1 node and Focus > 0, global `timeScale` lerps to `FOCUS_TIMESCALE = 0.35` over 120 ms.
- Focus drains at 1.0 per real second while linking. Max Focus = 3.0.
- When Focus hits 0, `timeScale` lerps back to 1 over 150 ms; the chain stays active.
- On release, `timeScale` lerps back to 1 over 150 ms.
- Focus regenerates at 0.7 per real second, starting 0.5 s after release.
- Shown as a diegetic arc around the pearl (inner ring); it turns pale when empty.
- Music and ambience get a subtle low-pass filter while time is slowed (sells the effect).

### 4.3 Chain-length effects (base thresholds)

| Chain length | Effect |
|---|---|
| 3–4 | Pop only. |
| 5–7 | **Burst:** each popped node emits a shockwave, radius 70, dealing 1 damage to every critter of any color in range. |
| 8–11 | Burst, plus **Ripple:** every critter on screen is pushed outward by 120 world units over 0.4 s and slowed 50% for 1.5 s. |
| 12+ | Burst and Ripple, plus **Surge:** every critter of the chain's final color on screen pops (cascade, 20 ms stagger, gives glow and score). |

- When the chain reaches a threshold while dragging, show a label on the rope ("Burst", "Ripple", "Surge"), brighten and thicken the rope, and play a rising "charge" tone. This preview is critical: players must feel the reward building.

### 4.4 Affordance

- While dragging, every critter that can legally be added next (valid color and within reach of the last node) gets a soft pulsing outline. This is key to readability and onboarding.

### 4.5 Linking audio

- Each added node plays the next note of a C-major pentatonic scale spanning 2.5 octaves (node 0 = lowest note). Sine plus soft triangle, ~120 ms, gentle attack.
- On release, the pop sequence replays the notes faster, then a final chord whose richness grows with chain length.
- Pentatonic guarantees every chain sounds good. This musical feedback is the game's signature; polish it.

### 4.6 Unit tests (required, `tests/chain.test.ts`)

Test add/reject by color, reach, duplicates, backtrack, Prism color switching, break at overstretched link, removal of dead nodes, and min-chain release logic. Keep `chain.ts` free of rendering and DOM so it is testable.

---

## 5. The pearl (player core)

- Center of the world; radius 46.
- **Shell HP:** 10 segments (base), drawn as a ring of segments around the pearl (outer ring). The Focus arc is the inner ring.
- **Contact:** when a critter touches the pearl (`distance ≤ pearl.r + critter.r`), the critter bursts harmlessly (no glow, no score), and the pearl loses that critter's damage value. Effects: small screen shake, red flash on the lost segment, low "thud" sound, 0.25 s damage invulnerability.
- **Leech** critters attach instead (Section 6).
- **0 shell:** 1 s slow-motion, the pearl cracks with a soft light flash, then the run-end screen.

---

## 6. Critters (enemies)

### 6.1 Shared rules

- **Colors and shapes** (colorblind support; the shape is always shown):
  - Coral = circle
  - Kelp = triangle
  - Sun = rounded square
  - Lilac = diamond
  - Sky = five-point star
- **Look:** cute. Two eyes that look toward the pearl, random blinks, tiny procedural fins or tentacles that wiggle with a sine wave. No mouths with teeth.
- **Movement:** velocity toward the pearl plus a perpendicular sine wobble (amplitude 12, frequency random in 0.8–1.4 Hz). Soft separation from neighbors via the spatial hash so they don't stack on top of each other.
- **Speeds** below are base world-units per second, multiplied by the tide speed multiplier.

### 6.2 Types

| Type | First tide | Radius | Base speed | HP | Pearl damage | Glow | Behavior |
|---|---|---|---|---|---|---|---|
| Drifter | 1 | 22 | 36 | 1 | 1 | 1 | Steady swim with wobble. |
| Darter | 3 | 18 | 30 / 110 | 1 | 1 | 1 | Moves in dashes: 0.5 s fast (110), 0.6 s glide (30). Telegraph each dash with a quick squash. |
| Prism | 4 | 20 | 32 | 1 | 1 | 3 | Wildcard: links into any chain and lets the next node be any color (Section 4.1). Iridescent white body with a hue-cycling rim; ring shape. |
| Shellback | 5 | 26 | 26 | 2 | 2 | 2 | Outer shell ring. The first link pop or first burst hit cracks the shell (it then behaves like a Drifter with HP 1). In a chain it counts toward chain length but survives with its shell cracked. |
| Splitter | 7 | 28 | 30 | 1 | 1 | 1 | When killed by any means, splits into 2 Mini-Drifters (radius 14, same color, 0 glow) placed 40 units outward. |
| Chameleon | 9 | 22 | 40 | 1 | 1 | 2 | Changes color every 2.5 s. Telegraph: 0.4 s color fade before the switch. Its color locks while it is in a chain. |
| Leech | 11 | 20 | 48 | 1 | Drains | 2 | On reaching the pearl, it attaches to the pearl edge (slowly orbits) and drains 1 shell every 4 s until popped. Can be linked normally while attached. |

### 6.3 Boss: Abyss Eel (tides 5, 10, 15, 20)

- A long segmented creature: `8 + 2 × bossIndex` segments (bossIndex 0..3). Each segment is a colored orb (colors drawn from the active palette, arranged in short same-color runs of 2–3) plus a head with eyes.
- It circles the pearl at radius 330, spiraling inward at 6 units/s.
- **Segments are linkable** like critters (same rules, same chain). Popping a segment removes it; the body closes the gap. The eel dies when all segments are popped (the head pops last automatically with a big burst).
- Every 4 s it releases 2 Drifters from its head.
- If its orbit radius reaches `pearl.r + 30`, it deals 3 damage and retreats to radius 330, then dives again.
- A boss HP bar appears at top center (segments remaining).
- **Variants:**
  - Tide 10: segment colors shuffle every 5 s (0.5 s telegraph).
  - Tide 15: every third segment has a shell (2 hits).
  - Tide 20: two eels at once, smaller (8 segments each), orbiting in opposite directions.
- **Reward:** +50 score per segment popped, heal 1 shell, and one guaranteed Rare-or-better upgrade pick.
- Boss intro: a 1.5 s "Abyss Eel" banner with a deep swell sound; spawns pause during the intro.

---

## 7. Tides (waves) and difficulty

- A **run** is 20 tides. A tide ends when its spawn budget is exhausted and all critters (and the boss) are gone. Then a 2.5 s calm with a "Tide X cleared" banner and score tally; the next tide starts automatically.
- **Formulas** (n = tide number, 1-based), all in `balance.ts`:
  - `count = round(8 + 3.2 × n)`; on boss tides, `count × 0.5` plus the boss.
  - `spawnInterval = max(0.32, 1.5 × 0.94^(n−1))` seconds.
  - Group size: 1 for n < 3; 1–2 for n < 8; 1–3 afterward. Groups pick the same color 60% of the time (enables chains).
  - `speedMult = 1 + 0.03 × (n − 1)`.
  - Active colors: 3 (n ≤ 2), 4 (n 3–8), 5 (n ≥ 9).
- **Type weights** (relative, per tide range):

| Tides | Drifter | Darter | Shellback | Splitter | Chameleon | Leech |
|---|---|---|---|---|---|---|
| 1–2 | 100 | 0 | 0 | 0 | 0 | 0 |
| 3–4 | 80 | 20 | 0 | 0 | 0 | 0 |
| 5–6 | 65 | 20 | 15 | 0 | 0 | 0 |
| 7–8 | 55 | 20 | 15 | 10 | 0 | 0 |
| 9–10 | 45 | 20 | 15 | 10 | 10 | 0 |
| 11–20 | 38 | 18 | 15 | 10 | 11 | 8 |

  - Prisms are spawned separately: 1 per tide from tide 4, at a random moment in the middle third of the tide (plus upgrades and modifiers).
- **First-run assist:** if the player has completed 0 runs, tides 1–2 use `speedMult × 0.85`.
- **Depth (difficulty tiers):** unlocked after the first victory. Depth d (1–10): `count × (1 + 0.12d)`, `speed × (1 + 0.05d)`, the 4th and 5th colors arrive 1 tide earlier per 2 depths (min tide 2), pearl max shell −1 at depths 5 and 9, and pearls earned × (1 + 0.15d). The player chooses depth before a run (only unlocked depths).
- **Endless:** unlocked after the first victory. Continues the formulas past tide 20, with a boss every 5 tides (cycling variants). Its own best record.
- **Tuning targets** (validate later with playtest logs): tides 1–3 feel easy; first real pressure at tides 4–5; the tide-5 boss is beaten by most new players; a new player's first run typically ends around tides 7–10.

---

## 8. Glow, levels, and upgrades (in-run roguelite)

### 8.1 Glow and levels

- Popped critters drop glow motes (their Glow value). After 0.3 s, motes are magnetized to the pearl; collecting them adds XP.
- XP required for level L → L+1: `round(4 + 3 × (L − 1)^1.15)`. Level 1 → 2 needs 4 XP, so the first upgrade comes after roughly the first two chains (target: within 40 s of the first tide).
- Thin XP bar at top center of the HUD.

### 8.2 Level-up screen

- Simulation pauses (and `gameplayStop` is called, Section 15). Background dims.
- Show 3 upgrade cards, drawn by rarity weight: Common 60, Rare 30, Epic 10 (modified by Luck). No duplicates in one offer. Maxed upgrades are excluded. Epic upgrades can be picked once.
- Each card shows: a simple vector icon, name, one-line effect with exact numbers, rarity color edge, and current stack (for example "2/5").
- 1 reroll per run (more from upgrades and meta). Reroll button shows remaining count.
- Input: click or tap a card; keys 1/2/3 to pick, R to reroll.
- On pick: short card-fly animation, sound, resume (`gameplayStart`).
- If multiple level-ups are pending, show them one after another.

### 8.3 Upgrade list (24)

| # | Name | Rarity | Max | Effect per stack |
|---|---|---|---|---|
| 1 | Long Reach | Common | 5 | +15% link reach |
| 2 | Deep Breath | Common | 5 | +20% max Focus |
| 3 | Quick Recovery | Common | 5 | +25% Focus regen |
| 4 | Slower Tide | Rare | 3 | Focus time scale −0.06 (0.35 → 0.29 → 0.23 → 0.17) |
| 5 | Bigger Burst | Common | 4 | +20% burst radius |
| 6 | Early Burst | Rare | 2 | Burst threshold −1 (minimum 4); Ripple and Surge thresholds also −1 |
| 7 | Static Spark | Rare | 3 | When a chain pops, 1 lightning arc per stack hits a random critter within 220 (1 damage) |
| 8 | Twin Pop | Epic | 1 | Chains of 6+ also pop all same-color critters within 120 of any node |
| 9 | Prism Tide | Rare | 3 | +1 Prism spawn per tide |
| 10 | Rainbow Bonus | Rare | 2 | Multi-color chains give +1 glow per node |
| 11 | Shell Mender | Common | 3 | 34% / 67% / 100% chance to heal 1 shell at the end of each tide |
| 12 | Thick Shell | Common | 3 | +2 max shell and heal 2 |
| 13 | Undertow | Rare | 3 | Critters within 180 of the pearl move 12% slower |
| 14 | Magnet Glow | Common | 3 | +10% XP and +30% mote pickup speed |
| 15 | Combo Keeper | Common | 3 | +0.6 s combo window |
| 16 | Frost Link | Epic | 1 | Critters in your chain are frozen in place |
| 17 | Cascade | Epic | 1 | A critter killed by a burst emits a mini-burst (radius 50). Mini-bursts do not chain further |
| 18 | Lucky Current | Rare | 3 | +1 reroll and +5% Rare/Epic weight |
| 19 | Ember Trail | Rare | 2 | Popped nodes leave a burning patch for 2 s (1 damage per 0.5 s to critters in it); stack 2 = 3 s and larger patch |
| 20 | Gravity Pearl | Epic | 1 | Every 12 s the pearl pulses, pushing critters within 200 back by 100 |
| 21 | Wave Rider | Rare | 2 | Ripple pushes 40% farther and slows for +1 s |
| 22 | Second Wind | Epic | 1 | Once per run, at 0 shell, revive with 3 shell and a free Ripple |
| 23 | Steady Hands | Common | 2 | +20% break factor (links snap less) |
| 24 | Glow Burst | Rare | 2 | Every 50 glow collected, auto-burst around the pearl (radius 160 / 220) |

- Implement upgrades as data (`definitions.ts`) plus a function that derives final stats (`apply.ts`), so balance changes never touch gameplay code.

---

## 9. Meta progression (cross-run) — the retention engine

### 9.1 Pearls (currency)

- Earned at run end: `floor(tidesCleared × 3 + score / 800) + bossKills × 5`, then multiplied by meta bonuses and Depth.
- Daily Tide bonus: first Daily completion of the day +15 pearls; streak bonus +2 per consecutive day, capped at +14.
- Achievements give one-time pearl rewards.
- Show earned pearls at run end with a count-up animation.

### 9.2 Reef (permanent upgrades)

The Reef screen shows a reef scene that visibly grows a new coral branch or glow plant for every level purchased (the meta progress is visual, not just numbers).

| Node | Effect per level | Levels | Costs |
|---|---|---|---|
| Hardened Pearl | +1 max shell | 5 | 20, 35, 55, 80, 110 |
| Calm Waters | +6% max Focus | 5 | 15, 25, 40, 60, 85 |
| Wide Current | +4% link reach | 5 | 15, 25, 40, 60, 85 |
| Bright Glow | +6% XP | 5 | 15, 25, 40, 60, 85 |
| Fortune Coral | +1 reroll per run | 2 | 60, 120 |
| Head Start | Start each run at level 2 with one free pick | 1 | 150 |
| Pearl Diver | +10% pearls earned | 5 | 25, 45, 70, 100, 140 |
| Lucky Reef | +5% Rare/Epic weight | 3 | 40, 80, 130 |

- Purchase button shows cost; disabled with a clear reason when unaffordable. A badge on the menu "Reef" button appears whenever something is affordable.

### 9.3 Pearl characters

| Pearl | Unlock condition | Passive |
|---|---|---|
| Moon Pearl | Default | None (balanced) |
| Ember Pearl | Reach tide 10 | Chains of 5+ leave Ember Trail patches (as upgrade level 1) |
| Frost Pearl | Make a chain of 10 | Focus time scale starts at 0.25; max Focus −20% |
| Storm Pearl | Defeat 2 bosses in total | Starts with Static Spark level 1 |
| Prism Pearl | Make a chain using 3 colors | +1 Prism per tide; multi-color chains +25% score |
| Abyss Pearl | Win a run (clear tide 20) | +25% pearls earned; critters +10% speed |

- Locked pearls show a silhouette, the unlock condition, and progress ("Best tide: 8 / 10").
- Each pearl has a distinct look (color sheen and particle style) so unlocks feel rewarding.

### 9.4 Achievements (20)

Each gives pearls (5–40). Examples to implement exactly: First pop; Chain of 5; Chain of 8; Chain of 12; Combo ×10; Reach tide 5 / 10 / 15; Win a run; Defeat your first eel; Defeat 10 eels; 3-color chain; Pop 1,000 critters (total); Pop 10,000 critters (total); Clear a tide of 10+ without losing shell; Play Daily Tide 3 days in a row; 7-day streak; Reach Depth 3; Buy 10 reef levels; Unlock all pearls.

### 9.5 Daily Tide

- Seed = hash of the player's **local** date string `YYYY-MM-DD` → mulberry32. Resets at local midnight.
- Each day: a fixed pearl character (rotates through all 6 by day index, even locked ones — a free taste), one fixed modifier from the list below, and a 10-tide run (boss at tides 5 and 10).
- Modifiers (pick by seed): Fast Current (+20% speed, +30% pearls); Rainbow Day (Prisms ×2); Glass Pearl (max shell 5, score ×2); Big Fish (critters +20% size and +1 HP on Shellbacks); Short Breath (Focus −40%, burst threshold −1); Calm Seas (−20% speed, score ×0.7); Swarm (+40% count, Drifters only on odd tides); Chameleon Night (Chameleons from tide 1).
- Unlimited attempts; the first completion each day grants the daily reward; the best score per day is stored (keep the last 14 days).
- Streak = consecutive local days with at least one completed Daily run. Show a flame icon with the streak number.
- Menu shows "New Daily Tide in HH:MM:SS" countdown after today's is done, and a "New" badge when today's is unplayed.
- Unit-test seed determinism and streak logic across date changes (mock the date).

### 9.6 "Next goals" panel

At run end, show the two goals closest to completion with progress bars (for example "Reach tide 10 to unlock Ember Pearl — best 8/10", "Hardened Pearl level 2 is affordable", "Daily Tide: 1 day to a 3-day streak"). This panel exists to make the player press Play again and to come back tomorrow.

---

## 10. Scoring and combo

- Chain score = `10 × n² × comboMult × (multiColor ? 1.5 : 1)`, where n = chain length.
- Burst kill +15 each. Boss segment +50.
- **Combo:** if a chain pops within `COMBO_WINDOW = 3.0 s` of the previous pop, combo +1; otherwise it resets to 0. `comboMult = 1 + 0.1 × combo`, max 3.0. Show combo next to the score with a draining timer ring.
- Floating score popups at the chain's last node ("+1,240"), drawn on canvas, pooled.
- Personal bests stored: best score (normal and per Depth), best tide, longest chain, best combo, Endless best tide.

---

## 11. Visual and audio direction

### 11.1 Visual direction: "bioluminescent reef at night"

Deep ocean blues and teals; creatures glow in saturated hues; calm and beautiful when quiet, dazzling when chains explode. Do not use a generic neon-on-black look.

**Palette (define in `palette.ts`):**

- Background gradient: `#04131F` at the edges → `#0A2C40` at the center; a soft halo above the pearl `#10475E` at 40% alpha.
- Reef silhouettes: `#0D3A4A`; foreground parallax `#082636`.
- UI surface: `#0F3B52` at 88% alpha, 1 px border `#2A6B85`, radius 14 px for panels, 12 px for buttons.
- UI text `#EAF7FF`; secondary text `#9CC7D9`.
- Primary button: pearl white `#F4F1FF` with text `#0A2C40`; hover/focus glow `#B388FF`.
- Critter colors: Coral `#FF6B6B`, Kelp `#3DDC97`, Sun `#FFD166`, Lilac `#B388FF`, Sky `#4CC9F0`. Prism: white with hue-cycling rim.
- Pearl: core `#F4F1FF` with lavender sheen; shell segments `#CDE7F2`; damaged flash `#FF6B6B`.
- Rarity edges: Common `#9CC7D9`, Rare `#4CC9F0`, Epic `#B388FF`.

**Typography:** Fredoka 700 for titles and numbers; Fredoka 500 for body. Sentence case everywhere (no all-caps labels). Minimum 14 px text on mobile.

**Rendering rules:**

- Pre-render every critter body + glow into offscreen canvases once per color/type/size (sprite cache). Draw eyes and fins per frame (small and cheap). **Never** use `ctx.shadowBlur` per entity per frame.
- Background: gradient pre-rendered on resize; 3 parallax layers of drifting plankton (max 120 particles total); 2–3 soft light shafts animated by slow sine alpha; a darker vignette at the screen edges where critters emerge.
- Particles: pooled, max 600. Pop = 10–16 bubble particles + a ring flash in the critter's color. Burst = expanding ring with a soft distortion-like double stroke.
- Rope: two strokes (wide translucent glow + thin bright core) with a gentle animated wave; thickness grows with chain length; color = chain color (gradient between colors in multi-color chains).
- Screen shake: trauma-based (offset = trauma² × 10 px, decays 1.5/s). Settings toggle. Reduced-motion mode disables shake and halves flash intensity.
- Hit-stop: 50 ms on chains ≥ 8; 90 ms on Surge and boss kill.

### 11.2 Audio

- Create/resume the `AudioContext` on the first user gesture (pointerdown or keydown). Before that: no sound and no errors.
- Buses: master → music, sfx. A `DynamicsCompressor` on master. Cap concurrent voices at 24.
- Volumes and mute states persist in the save.
- **SFX (all synthesized):** link note (Section 4.5), unlink, rope snap, pop (pluck + filtered noise), burst (low thump + noise sweep), ripple (whoosh), surge (rising shimmer), pearl hit (low detuned square through a low-pass), leech drain (soft pulse), level-up (arpeggio), card pick, reroll, UI click (tiny tick), boss appear (deep swell), boss defeated (bright chord + shimmer), victory jingle, run over (soft descending motif), pearls count-up ticks.
- **Music (generative, adaptive):** slow pad chords (Cmaj7 → Am7 → Fmaj7 → G6, ~8 s each) through a low-pass filter, plus a soft pulse layer. Intensity (filter cutoff and a quiet noise hi-hat layer) follows "pressure" = number of critters on screen and their proximity to the pearl. Use a lookahead scheduler. Separate calmer menu variant. Keep CPU low.

---

## 12. Screens and UX flow

- **Boot:** minimal loading (game title text + thin progress bar). Should last under 1 s. Calls `loadingStart` / `loadingStop` (Section 15).
- **First-ever launch (no save):** skip the menu entirely and go straight into the in-gameplay tutorial (Section 13).
- **Returning player → Main menu:**
  - Animated title with a few critters swimming behind it.
  - Large primary "Play" button (keyboard: Enter/Space).
  - "Daily Tide" button showing streak flame and either a "New" badge or the countdown.
  - "Reef" (badge when something is affordable), "Pearls" (characters), "Achievements", settings gear, sound toggle.
  - Pearl currency shown top-right.
- **Pressing Play:** if more than one pearl is unlocked or Depth is unlocked, show a quick select (pearl carousel + Depth stepper, defaults to last used, one tap to start). Otherwise start immediately.
- **HUD:**
  - Top-left: "Tide 4/20" + tide progress bar.
  - Top-right: score, combo indicator, pause button (minimum 44 × 44 px).
  - Top center: thin XP bar with level number.
  - Around the pearl: shell ring (outer), Focus arc (inner).
  - Boss bar under the XP bar during boss fights.
- **Level-up:** Section 8.2.
- **Pause:** pause button, P key, or automatic on tab hidden / window blur. Options: Resume, Restart run (confirm), Settings, Quit to menu (confirm).
- **Run end (defeat or victory):**
  - Big score; "New best!" badge when applicable.
  - Tide reached, longest chain, best combo, critters popped.
  - Pearls earned (count-up), achievements unlocked this run.
  - "Next goals" panel (Section 9.6).
  - Buttons: "Play again" (primary, focused by default, Enter/Space), "Reef", "Menu".
  - "Play again" must start a new run in under 1 second.
- **Settings:** music volume, sound effects volume, screen shake on/off, reduced motion on/off, replay tutorial, reset progress (double confirm).
- **Copy style:** English, sentence case, short, plain verbs. A button says exactly what it does ("Play again", "Buy", "Skip tutorial"). No fake buttons, no artificial delays, no misleading sizes.

---

## 13. Onboarding (conversion-critical)

Goal: first link attempt within 8 s of load; tutorial done within 45 s; always skippable; no text walls.

- **Step 0:** The world fades in. Three Coral Drifters approach slowly in a line (spaced 90 apart, speed 15). They cannot damage the pearl during the tutorial. A ghost hand (drawn on canvas) loops a drag through all three. One-line caption at the bottom: "Drag through 3 of the same color".
- **Step 1:** On success → pop, "Nice!" popup, satisfying sound. Spawn 3 Kelp and 3 Sun critters interleaved. Caption: "Only matching colors link".
- **Step 2:** On success → highlight the Focus arc with a pulse. Caption: "Linking slows time — use it". Spawn 5 Coral in a loose arc. Caption while dragging past 4: "Link 5 for a burst". If the player pops fewer than 5 twice, advance anyway.
- **Step 3:** Caption: "Protect the pearl". Tide 1 begins seamlessly with the "Tide 1" banner.
- **Rules:**
  - "Skip tutorial" button top-right.
  - Any step auto-advances after 20 s without success (with a stronger hint pulse at 10 s).
  - Save `tutorialDone = true` when finished or skipped.
  - On mobile and desktop alike, the ghost hand demonstrates dragging (no keyboard required anywhere in the game).

---

## 14. Persistence (no database)

- One `localStorage` key: `glowtide.save.v1`, JSON.
- Schema has an integer `version` and a `migrate(old)` function. Unknown or corrupt data → back up the raw string to `glowtide.save.corrupt`, start fresh, never crash.
- Every storage access is wrapped in try/catch. If `localStorage` is unavailable (private mode, blocked iframe storage), fall back to in-memory storage and continue silently.
- **Save on:** run end, any purchase, settings change, achievement unlock, end of each tide, and `visibilitychange` → hidden.
- **Save data:** version; createdAt; totals (runs, wins, critters popped, bosses killed, chains by length bucket); bests (Section 10); pearls; reef levels; unlocked pearls; selected pearl; selected depth; unlocked depth max; achievements map; daily { lastCompletedDate, streak, bestByDate (last 14), rewardClaimedDate }; settings; tutorialDone; endlessUnlocked.
- Expose a `Storage` interface (`load`, `save`, `flush`) so a later Full Launch can switch to the CrazyGames SDK Data module without touching game code.
- Store nothing personal.
- Unit tests: save → load round trip, migration from a fake older version, corrupt data recovery, unavailable storage fallback.

---

## 15. CrazyGames platform integration (Basic Launch scope)

- In `index.html`, load the SDK asynchronously before the game bundle:
  `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js" async onerror="window.__cgSdkFailed=true"></script>`
- `platform/crazygames.ts`:
  - Wait for `window.CrazyGames?.SDK` (max 3 s), then `await window.CrazyGames.SDK.init()` inside try/catch with a 3 s timeout.
  - If anything fails or times out, the wrapper becomes a no-op. **The game must never wait on, or break because of, the SDK.**
  - Wrapper methods (all safe to call any time): `loadingStart()`, `loadingStop()`, `gameplayStart()`, `gameplayStop()`, `happytime()`, `isMuted()`, `onMuteChange(cb)`.
- Calls to the SDK `game` module:
  - `loadingStart()` at boot start; `loadingStop()` when the first interactive frame is shown.
  - `gameplayStart()` whenever actual play begins or resumes.
  - `gameplayStop()` on pause, level-up screen, menus, run end, and tab hidden. Track state so start/stop are never sent twice in a row.
  - `happytime()` only for rare big moments (boss defeated, run victory, new best score), at most once per 60 s.
- **Audio mute:** read `SDK.game.settings.muteAudio` after init and subscribe with `SDK.game.addSettingsChangeListener`. When muted, master gain = 0 (separate from the player's own settings).
- **Ads:** create `platform/ads.ts` with `showMidgame(): Promise<void>` and `showRewarded(): Promise<boolean>`. With `ADS_ENABLED = false` (Basic Launch), midgame resolves immediately and all rewarded buttons are hidden. **Do not implement ad SDK calls now.** Planned for Full Launch (consult the official CrazyGames video-ads docs and advertisement requirements at that time): midgame only between runs on "Play again" at most once every 3 minutes; rewarded "Revive with 3 shell" once per run; rewarded "Double pearls" at run end. During any ad: mute audio and pause the game.
- No external links, no other portal's branding, no third-party ads, no "share" buttons.
- Must work inside an iframe; never touch `window.top`.
- Do not use the Escape key for game actions (it exits fullscreen). Avoid Ctrl/Cmd+W conflicts.

---

## 16. Performance budgets and robustness

- 60 FPS target on a 4 GB RAM Chromebook and mid-range Android phones. Stress case: 300 critters + 600 particles + a 15-node chain.
- Fixed simulation timestep 1/60 s with accumulator; clamp frame delta at 0.1 s (after tab switches).
- Object pools for critters, particles, glow motes, popups, effects. No per-frame allocations in hot loops (no new arrays/closures per frame).
- Spatial hash (cell size 64 world units) for hit tests, separation, and burst queries.
- **Adaptive quality:** if the average frame time exceeds 20 ms for 2 s, halve the particle cap, disable light shafts, and drop DPR to 1. Restore after 10 s of stable frames.
- Stop the loop when the document is hidden; resume paused (the player taps Resume).
- Global error handler: log to console. On a fatal boot error, show a friendly overlay ("Something went wrong. Reload the page.") instead of a blank screen.
- Build budget: total `dist/` under 3 MB (ideally under 1 MB); fewer than 50 files; time to interactive under 2 s on a typical 4G connection.

---

## 17. Debug and playtest tools (enabled only with `?debug=1`)

- Overlay: FPS, frame time, entity counts, timeScale, tide, quality level.
- Cheat keys: N skip tide, L level up, G +100 pearls, K kill all critters, I toggle invincible, B spawn boss.
- **Playtest logger** (always records locally, max 50 runs): time from load to first link attempt, to first pop, tutorial completion time, tide reached, cause of run end, run duration, chain-length histogram, upgrades picked, number of runs per session.
- A "Copy playtest data" button in the debug overlay copies all logs as JSON to the clipboard. The developer will use this when strangers playtest the game before submission.
- Debug UI must not appear in normal play.

---

## 18. Milestones and acceptance criteria

At the end of every milestone: `npm run typecheck`, `npm test`, `npm run build`; report bundle size; update `DEVLOG.md`; commit; **stop and wait for the user.**

### M1 — Core loop prototype (decision gate)

- Pearl with shell HP; Drifters only, 3 colors, endless spawning with a simple ramp.
- Full linking rules from Section 4 (reach, backtrack, break, held speed, Focus bullet time, min chain 3, Burst at 5+, affordance pulses).
- Pearl damage, run end, instant restart.
- Basic synthesized link notes and pop sound (pentatonic from day one).
- Simple shapes (final art comes in M4), but shapes per color already present.
- Mouse and touch.
- Unit tests for `chain.ts` pass. 60 FPS with 150 critters.
- **When done, tell the user:** have at least 5 people who have never seen the game play it without explanation. Check: Did they understand what to do within 15 seconds? Did they keep playing voluntarily for 3+ minutes? Did anyone say "one more"? Ask the user for these results before starting M2. If the answers are mostly no, propose concrete changes to the core loop before adding content.

### M2 — Content and run structure

- Tides with formulas and weight table; all critter types; Prism color switching; Ripple and Surge; glow, XP, level-up cards with all 24 upgrades; reroll; Abyss Eel with all variants; 20-tide run with victory; score and combo; Endless and Depth logic (UI can be basic).
- Acceptance: a full run is playable from tide 1 to victory; every number is in `balance.ts`.

### M3 — Meta and retention

- Save system, pearls currency, Reef screen, pearl characters, achievements, Daily Tide with streak and countdown, run-end "Next goals", main menu.
- Acceptance: closing and reopening the page keeps all progress; daily rollover works at local midnight (verified with mocked dates in tests).

### M4 — Juice and presentation

- Final procedural art (critters with eyes and fins, pearl, eel), background layers, particles, rope visuals, shake, hit-stop, popups, all SFX, adaptive music, UI polish, settings, accessibility, reduced motion.
- Acceptance: screenshots of menu, early tide, big chain, boss, level-up, run end look cohesive and polished.

### M5 — Onboarding and first-session tuning

- Tutorial (Section 13), first-run assist, verify timings with the playtest logger (first link < 8 s, first pop < 15 s, first upgrade < 40 s on a test playthrough).

### M6 — Platform and ship

- CrazyGames SDK wrapper, ads interface (disabled), performance pass and adaptive quality, cross-browser checks (Chrome, Edge, Firefox; Safari if possible), production build, `npm run zip`.
- Write `SUBMISSION.md` containing: upload steps for the CrazyGames developer portal; a game description (short and long, in English); controls text ("Drag through creatures of the same color to link them; release to pop"); suggested tags; and a list of required cover images and a short trailer plan for the developer to prepare.
- Acceptance: the definition-of-done checklist (Section 19) passes.

---

## 19. Definition of done (final checklist)

- [ ] Loads to interactive in under 2 s locally; `dist/` under 3 MB; under 50 files.
- [ ] Works with mouse and touch; landscape and portrait; window resize mid-run.
- [ ] First-time player lands directly in the tutorial; returning player lands in the menu.
- [ ] No sound before the first gesture; no console errors anywhere.
- [ ] Game works with the SDK script blocked, and with `localStorage` blocked.
- [ ] Tab switch pauses the game and calls `gameplayStop`.
- [ ] Progress persists across reloads; Daily Tide and streak behave correctly across midnight.
- [ ] All 24 upgrades work and stack as specified; epics only once.
- [ ] Full 20-tide run playable; boss variants work; Endless and Depth unlock after victory.
- [ ] 60 FPS in the stress case on a mid-range device profile (or adaptive quality engages smoothly).
- [ ] No Escape-key actions; Space/arrows do not scroll the page.
- [ ] Colorblind-friendly shapes always visible; text readable at 360 px width.
- [ ] No external network requests except the CrazyGames SDK script.
- [ ] Debug tools hidden unless `?debug=1`.
- [ ] Typecheck, lint, and tests pass.

---

## 20. Things you must NOT do

- No backend, database, server, accounts, or network calls (except the SDK script). No third-party analytics.
- No copyrighted names, characters, music, or assets with unclear licenses (only the OFL font).
- No auto-playing audio before a gesture; no `alert`/`confirm`/`prompt` (use in-game dialogs).
- No external links, share buttons, misleading buttons, or artificial delays.
- No violence, gore, or mature themes; keep PEGI-12. Do not aim the copy at young children.
- Do not change design numbers silently — log every change in `DECISIONS.md`.
- Do not start the next milestone without the user's approval.
