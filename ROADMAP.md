# Jazira — Roadmap

**The goal:** a realistic life-sim / survival / nation-builder. You wash up alone on a tiny island,
survive, then grow it into a living settlement and finally a full nation. You sail a boat you build
yourself to other islands, meet people, trade, take on missions and follow a story. Target: a Steam release.

Each phase ends with a playable build. Phases are done in order; each one is tested before moving on.

---

## Phase 0 — Prototype ✅ (done)
Smooth editable voxel island, Jolt physics, choppable trees, buoyancy, structural-integrity building,
ocean, day/night, procedural audio, Windows/Linux/Web exports.

## Phase 1 — Foundation ✅ (done)
The base everything else sits on.
- Graphics presets (Low / Medium / High / Ultra) + auto-detect + render scale (FSR) → runs on normal PCs
- Own splash screen and loading screen (no Godot logo)
- Main menu: New game / Continue / Settings / Quit
- Settings: graphics, resolution scale, fullscreen, mouse sensitivity, volume — saved to disk
- Save / load the whole world (terrain edits, trees, items, buildings, inventory, time) + autosave

## Phase 2 — The body: survival & the player character ✅ (done)
- ✅ Health, hunger, thirst, energy/sleep, body temperature, wetness, food poisoning, fall damage, drowning
- ✅ Food: coconuts (shake them loose by chopping palms), berry bushes that regrow, fish schools + spear,
  cooking on the campfire; water: coconuts and rain collectors
- ✅ Crafting screen (Tab), tool durability, carry weight that slows you down
- ✅ Weather: clear / cloudy / rain / storm with lightning & thunder, wind that bends grass and trees and
  raises real waves (buoyancy follows them), rain fills collectors and soaks you
- ✅ Bed: sleep through the night, respawn point; death → wake up at your bed and lose half your load
- ✅ Third-person camera (V) with a realistic human (Microsoft Rocketbox, MIT) and motion-capture animations
- ✅ Physically modelled sound: breaking waves, gusting wind, rain, footsteps per surface, impacts, wildlife

## Phase 3 — The opening story ✅ (Act One done)
- ✅ Intro: the Murjan in a night storm, riding the real waves, sinks → you wake on the beach facing her wreck
- ✅ Every game rolls WHO you are (engineer / stowaway / medic — each with a memory, a guilt and a perk)
  and WHY the ship sank (smuggled guns / a missing girl / the captain's cursed route)
- ✅ Act One missions woven into the story: alive → thirst → driftwood → fire → first night → the wreck →
  shelter → signal fire → the night of the signal (a finale choice that differs per mystery)
- ✅ Mind (morale): isolation, darkness, hunger and storms wear it down; fire, sleep, company and hope restore it.
  Low morale → nightmares, whispers, a figure at the edge of sight, lights of ships that are not there
- ✅ Storyteller: crates and bottled letters wash ashore, a wounded gull (save it / eat it / leave it),
  ships that pass on the horizon (unless your signal fire is burning), footprints that are not yours
- ✅ Inner voice subtitles, journal that writes itself (Tab → Journal), objectives on screen
- ✅ English and Arabic (Settings → Story language)
- ⏭ Act Two: the consequences of your finale choice, the first other survivor, the boat

## Phase 3.5 — First impression ✅
- ✅ Cinematic loading screen (key art, stages, tips), branded title screen with its own music
- ✅ Prologue film in-engine: wheelhouse with four actors (faces driven by facial bones), dialogue,
  impact with ragdoll physics, sinking, underwater, title card, waking up on the beach
- ✅ First launch → prologue; later → Continue; Start over hidden in a corner with confirmation
- ✅ Full settings with key rebinding, audio buses, HUD options; English / Arabic for everything
- ⏭ Recorded voice acting (Arabic + English) for the prologue lines

## Phase 4 — The sea: boats and other islands
- Build a raft, then a sailing boat (physical buoyancy, sail + rudder, wind direction matters)
- Board and steer it; anchor; storms at sea
- 4–6 handcrafted islands with different biomes and resources (rock, clay, iron, jungle, volcanic)
- World map / navigation (compass, stars at night)
- Streaming: islands load/unload as you sail

## Phase 5 — People
- NPCs with schedules (sleep, work, eat), needs and moods
- Dialogue system (Arabic + English) with choices
- Rescue castaways / recruit settlers from other islands
- Assign jobs: woodcutter, fisher, farmer, builder, guard
- Settlers walk, carry resources, build what you plan

## Phase 6 — From camp to village to town
- Building blueprints: houses, storage, workshop, farm plots, docks, wells, walls
- Farming & animals; production chains (wood → planks → furniture; clay → bricks)
- Economy: resources, coins, trade with passing ships
- Town happiness, housing, food supply

## Phase 7 — From town to nation
- Stages: Camp → Village → Town → City → Nation (each unlocks buildings, laws, missions)
- Government: name the nation, flag, laws and policies with real trade-offs
- Diplomacy with the other islands: trade, alliances, rivalry, conflict
- Big story arc and the ending: being recognised as a nation

## Phase 8 — Polish & Steam release
- Art pass (models, animations, UI), music, sound design
- Performance pass, bug fixing, balancing
- Steam page ("Coming Soon" + wishlists), trailer, screenshots
- Steamworks: achievements, cloud saves; release

---

### Art assets
Code, systems, physics, shaders, terrain and world are generated in code. Characters, animals and
detailed props need 3D models + animations: free packs (Quaternius, Kenney, Mixamo animations) or
paid packs (e.g. Synty), or a 3D artist.
