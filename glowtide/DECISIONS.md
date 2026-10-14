# Decisions

Choices made where the spec was ambiguous or silent, plus every deviation from a spec number
(with old value, new value and reason).

## Project setup

- **Location:** the repository root already holds an unrelated Godot project ("Jazira"), so Glowtide lives in
  the self-contained `glowtide/` folder with its own `package.json`. All commands run from that folder.
- **TypeScript 5.9** (not 7.x): typescript-eslint supports TypeScript only up to < 6.1.
- **Font files:** `@fontsource/fredoka` latin 500/700 ships a woff2 file and a woff fallback per weight
  (4 files, ~72 KB). Kept for older Safari; still far under the budget.
- **App controller:** `src/app.ts` (not in the spec's folder list) holds the state machine (playing / paused /
  over), wiring and screens, so `main.ts` stays a small boot sequence.

## M1 prototype scope

- **Ramp:** M1 "endless spawning with a simple ramp" reuses the real tide formulas (Section 7) with a
  *virtual tide* that advances every 25 s (`BALANCE.prototype.secondsPerTide`). The HUD shows it as "Tide N".
  Replaced by real tides in M2.
- **Opening trio (prototype only):** 0.3 s into a run, three same-color Drifters enter side by side
  (60 apart) from the nearest screen edge, so a first chain is possible within a few seconds for the
  M1 hallway test. The M5 tutorial replaces this.
- **Ripple and Surge are off in M1** (their thresholds are `Infinity` in `World.thresholds`), because the
  spec schedules them for M2. Only the Burst label and tone appear while dragging.
- **HUD:** no score yet (scoring is M2). The HUD shows tide, run time and critters popped. The run-end screen
  shows time survived, tide reached, critters popped and longest chain.
- **Pause screen:** a minimal pause screen (Resume, Restart run with confirmation) exists already, because the
  loop stops when the tab is hidden and needs a resume path. Settings and Quit to menu come with M3/M4.

## Linking details (Section 4)

- **Hit choice while dragging:** when the pointer's hit area overlaps several critters, the nearest critter
  that can legally be added wins, even if a nearer non-addable critter exists. This makes linking reliable in
  crowds, especially with the larger touch pad.
- **Backtrack trigger:** the undo fires when the hovered critter *changes to* node n−2, not on every frame
  over it. A node removed by backtracking cannot be re-added until the pointer leaves its hit area. Without
  this, overlapping hit areas made the chain flicker between add and undo.
- **Fast drags:** the pointer path is sampled every 8 world units (`link.pathSampleStep`) so quick swipes
  don't skip critters.
- **Burst range:** a critter is hit when its edge is inside the shockwave (center distance ≤ 70 + critter
  radius).
- **Pause mid-drag:** pausing (button, P, tab hidden, window blur) dissolves the current chain without
  popping it.
- **Linked critters:** the 0.5× held-speed multiplier also scales their sideways wobble, so held critters
  visibly calm down.
- **Popping critters:** nodes waiting for their 35 ms stagger pop are frozen and no longer interactive.

## Pearl (Section 5)

- **Invulnerability:** during the 0.25 s damage invulnerability, critters that touch the pearl still burst
  harmlessly but deal no damage.
- **Death slow motion:** the spec says "1 s slow-motion" without a scale. It uses time scale 0.2
  (`pearl.deathTimeScale`).

## Unspecified tuning values (all in `balance.ts`)

- Separation stiffness 8 (velocity per unit of overlap).
- Blink every 2–5 s for 0.12 s.
- Screen-shake trauma: pearl hit 0.35, burst 0.12, death 0.6.
- Spawn-group angle jitter ±0.14 rad, depth spacing 34.

## Debug

- **Extra cheat key `S`** (spawn 50 critters) is not in the spec's list. It exists to verify the
  "60 FPS with 150 critters" acceptance check and only works with `?debug=1`.
- With `?debug=1`, `window.__glowtide` exposes the world and renderer for automated playtests.
