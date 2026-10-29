# ABYSS RACER — Deep-Sea Grand Prix

A mobile racing game set on a circuit at the bottom of the sea. Eight cars race three laps of the
**Abyssal Circuit** (2.5 km): through a sunken city, across a shallow coral reef, a kelp forest, a jump over
a canyon, past a galleon wreck, down into a pitch-black hydrothermal trench and back up to the light.

**Download:** [`release/AbyssRacer.apk`](release/AbyssRacer.apk) (Android 8.0+, arm/x86, ~24 MB). Screenshots are in [`screenshots/`](screenshots/).

## What's in it

**Driving physics** (custom, on top of the Rapier rigid-body engine, 120 Hz fixed step)
- Per-wheel raycast suspension: progressive springs, separate bump/rebound damping, bump stops, anti-roll bars.
- Combined-slip tyre model (normalised slip vector, load sensitivity, surface grip for asphalt / gravel /
  sand), semi-implicit force limiting so it is stable from a standstill to 300 km/h.
- Engine torque curves, rev limiter, engine braking, clutch launch, 7-speed auto box with shift cuts,
  limited-slip differentials, AWD/RWD layouts, brake bias, ABS, traction control, handbrake.
- Aero drag and front/rear downforce; losing the rear wing really does loosen the back end.
- Three cars with different character: Marlin GT-R (AWD), Orca V12 (heavy RWD), Barracuda LMP (light prototype).

**Collisions and damage**
- Car bodies are dense meshes that crumple where they are hit (impulse-scaled, with crumple noise and an
  intrusion limit), paint scrapes to primer and bare metal, glass cracks.
- Wings, splitters, diffusers and mirrors tear off and become physics debris; a big corner hit can rip a
  wheel off. Hits knock the steering out of true and a broken engine loses power. Wrecks trigger a
  slow-motion crash camera. Wreck a rival for a TAKEDOWN.
- Sparks, bubbles, silt clouds and paint chips on every impact; continuous sparks while scraping a wall;
  roadside barrels, crates and column drums are physics props.

**Graphics** (three.js / WebGL2, HDR pipeline)
- Underwater light transport: spectral absorption + in-scattering fog, depth-dependent ambient,
  physically traced looping caustics with chromatic dispersion, Snell's window and rippling surface overhead,
  god rays, marine snow / bioluminescent plankton.
- Sculpted (signed-distance-field) car bodies with clear-coat metallic paint, carbon fibre, LED head and tail
  lights, liveries and door numbers drawn in the shader, volumetric headlight beams; detailed multi-spoke
  wheels with brake discs and calipers.
- CC0 photo-scanned textures and models from Poly Haven (asphalt, sand, rock, sandstone, a Dutch galleon,
  bronze statues, boulders…), plus procedural coral, kelp, ruins, vents, tube worms, fish schools that
  scatter from passing cars, manta rays, jellyfish and a whale.
- HDR bloom, ACES tone mapping, speed radial blur, chromatic aberration, impact flashes, film grain,
  skid marks, dynamic resolution and four quality presets.

**Audio** (all synthesised at runtime with the Web Audio API)
- Engines are a physical firing-pulse model in an AudioWorklet: per-cylinder combustion pulses with
  cycle-to-cycle variation and uneven cross-plane V8 firing, exhaust-pipe waveguide, muffler formants, intake
  roar, gear whine, turbo whistle, blow-off valve and over-run pops. Three engine voices (V8 / V12 / V10);
  the nearest rivals are spatialised with doppler.
- Modal-synthesis crash library (metal crunch, glass, debris, sand, wood), tyre squeal, scraping, gravel,
  water rush, hydro-jet nitro, underwater convolution reverb, ambient drone, whale song, sonar, bubbles and
  a generative score.

**Game**
- 8-car races, countdown, laps, positions, best laps, results; AI drivers that follow a minimum-curvature
  racing line with a physics-based speed profile, overtake, slipstream and recover from crashes.
- Nitro earned by drifting, air time, slipstreaming, near misses and takedowns.
- Touch controls (buttons or tilt steering, optional auto-accelerate), keyboard and gamepad, haptics.

## Controls
| Touch | Keyboard | |
|---|---|---|
| ◀ ▶ (or tilt) | ← → / A D | steer |
| GAS / BRAKE | ↑ ↓ / W S | throttle / brake (hold brake when stopped to reverse) |
| DRIFT | Space | handbrake |
| NITRO | Shift | hydro-jet boost |
| 📷 | C | camera (chase / far / bumper) |
| ⏸ | Esc | pause |

## Building
```bash
npm install
npm run dev            # play in a browser at http://127.0.0.1:5173
npm run apk            # vite build + android/build_apk.sh -> release/AbyssRacer.apk
```
The APK is assembled directly with the Android SDK build tools (`aapt2`, `javac`, `d8`, `zipalign`,
`apksigner`) — no Gradle needed. The native shell (`android/`) is a full-screen, immersive WebView that serves
the game from the APK's assets and exposes vibration to the game.

Asset pipeline (only needed to regenerate assets): `tools/fetch_polyhaven.py`, `tools/process_textures.py`,
`tools/process_models.mjs`, `tools/gen_cars.py` (car bodies), `tools/gen_caustics.py`.
Tests: `node tools/simtest.mjs marlin,orca,barracuda 150` (AI laps the circuit headless),
`node tools/dragtest.mjs orca` (straight-line performance), `node tools/enginetest.mjs <dir>` (engine audio).

## Credits
Textures and models: [Poly Haven](https://polyhaven.com) (CC0). Fonts: Orbitron and Rajdhani (SIL OFL).
Everything else — code, cars, audio, music — was made for this game.
