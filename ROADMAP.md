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

## Phase 2 — The body: survival & the player character  ⏭ (next)
- Third-person / first-person toggle with an animated character (asset: Quaternius / Mixamo style)
- Health, hunger, thirst, stamina, temperature, sleep
- Food: fishing, coconuts, fruit, cooking on the campfire; water: rain collector, boiling
- Crafting menu + workbench; tool durability; inventory with weight
- Weather: rain, storms, wind that affects waves and fire

## Phase 3 — The opening story
- Intro: shipwreck cutscene → wake up on the beach
- Tutorial missions woven into the story (find water, make fire, build shelter, signal fire)
- Journal / mission log UI, objectives on screen
- First message in a bottle → hints of the wider world

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

### Art assets (needed from Phase 2)
Code, systems, physics, shaders, terrain and world are generated in code. Characters, animals and
detailed props need 3D models + animations: free packs (Quaternius, Kenney, Mixamo animations) or
paid packs (e.g. Synty), or a 3D artist.
