# Credits & third-party assets

- **Icons** — [game-icons.net](https://game-icons.net) by Lorc, Delapouite, Zeromancer and contributors,
  licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Background squares removed.
- **Fonts** — Rajdhani (Indian Type Foundry), Barlow Condensed (Jeremy Tribby), Cinzel (Natanael Gama),
  Cormorant Garamond (Christian Thalmann), Cairo (Mohamed Gaber), Reem Kufi (Khaled Hosny), Amiri (Khaled Hosny),
  Aref Ruqaa (Abdullah Aref) — all SIL Open Font License 1.1, via Google Fonts.
- **Player character & animations** — [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox)
  (avatars Male_Adult_01, Pilot_Male_03, Female_Adult_04, Construction_Male_03 and motion-captured animations),
  © 2020 Microsoft, **MIT License**
  (see `assets/characters/ROCKETBOX_LICENSE.md`). Commercial use allowed; keep the licence notice.
- Engine: [Godot Engine](https://godotengine.org) (MIT). Physics: Jolt (MIT).
- **Sound effects and music** — synthesised in code for this game (physical modelling, Karplus–Strong); no samples.
- **Terrain3D** — terrain system by Cory Petkovsek, Roope Palmroos and contributors, **MIT License**
  (`addons/terrain_3d/LICENSE.txt`), built from source (commit 854a457) for Linux and Windows, with two
  local fixes: region size is set before regions load, and shader array indices are clamped.
- **Ocean waves** — FFT wave simulation from [GodotOceanWaves](https://github.com/2Retr0/GodotOceanWaves)
  by Ethan Truong, **MIT License** (`addons/ocean_waves/LICENSE`); adapted for Godot 4.7 and our island shader.
- **Volumetric clouds** — [SunshineClouds2](https://github.com/Bonkahe/SunshineClouds2) by David House,
  **MIT License** (`addons/SunshineClouds2/LICENSE`).
- **Nature scans and ground textures** — [Poly Haven](https://polyhaven.com), **CC0** (public domain):
  coast_rocks_01/02/03/05, coast_land_rocks_02/03, coastal_cliff_01/02, sand_rocks_small_01, boulder_01,
  rock_moss_set_01/02, rock_07, rock_09, stone_01, lambis_shell, dead_tree_trunk(_02), tree_stump_01,
  root_cluster_01, dry_branches_medium_01, island_tree_01/02/03, shrub_01-04, pachira_aquatica_01, fern_02,
  grass_medium_01/02, grass_bermuda_01, nettle_plant, weed_plant_02; textures coast_sand_01, damp_sand,
  coral_gravel, coast_sand_rocks_02, forest_ground_04, leaves_forest_ground, aerial_grass_rock, cliff_side,
  dark_rock, mossy_rock, palm_tree_bark. Decimated and repacked for the game (`tools/assets/`).
- **Coconut palms, island terrain and sky** — generated procedurally for this game (`tools/assets/gen_palm.py`,
  `tools/assets/gen_island.py`, `shaders/island_sky.gdshader`).
