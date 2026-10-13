# Room Clear — Godot 4.7 (web, mobile, desktop)

Top-down tactical shooter. Twelve-mission campaign plus endless Quick Ops; every building is
generated from a seed (rooms, doors, furniture, lights, guards), so maps load instantly and the
same mission always gives the same building.

## بالعربي
- **حملة 12 مهمة، كل مهمة مختلفة**: اغتيال هدف، سحب لابتوب، جمع 3 مستندات من غرف مختلفة، تطهير المبنى،
  إنقاذ رهينة، تفكيك قنبلة بوقت، تفخيخ 3 مخازن سلاح والهروب قبل الانفجار، تسلل من غير ما حد يشوفك
  (لو شافوك بيضرب إنذار وييجي فريق دعم)، مطاردة هدف بيهرب لعربيته، إنقاذ رهينتين، الدفاع عن غرفة اللاسلكي
  لحد ما الهليكوبتر توصل، والمهمة الأخيرة تطهير كامل. ومعاها **Quick Op**: مبنى ومهمة عشوائيين.
- **صعوبة متدرجة**: أول المهمات أسهل (الأعداء أبطأ في رد الفعل وتصويبهم أوسع)، والصحة بترجع لوحدها لما تبعد عن الضرب.
- **خريطة صغيرة دايرية** بتلف مع اللاعب، وعليها **خط متحرك بيوريك الطريق** للهدف، ومعاه أسهم مضيئة على الأرض.
- **أزرار بستايل ألعاب الموبايل**: زجاج كاكي بإطار فضي، زر ضرب كبير بطلقة، قنبلة، جري، ريلود، وجويستيك بحلقة رفيعة.
- **الخرايط بتتولد أوتوماتيك** (BSP) من رقم ثابت لكل مهمة، فبتحمل فورًا.
- **أصوات** لكل حاجة (ضرب، خطوات، انفجارات، إنذار، لاسلكي، موسيقى) جاهزة في `assets/sfx`.

## Run
- **Phone (fastest)**: install `dist/RoomClear.apk` (Android 64-bit; allow "install unknown apps"). Landscape, touch only.
- **Desktop preview**: open `prototypes/room_clear_3d/project.godot` in Godot 4.7 and press F5.
  WASD move · mouse aim · LMB fire · R reload (touch controls also work with a touchscreen).

## Export the Android APK
```
godot --headless --path prototypes/room_clear_3d --export-release "Android" build/RoomClear.apk
```
Needs the Godot 4.7.2 export templates and an Android SDK (build-tools) set in Editor Settings.
For signing, set `GODOT_ANDROID_KEYSTORE_RELEASE_PATH/_USER/_PASSWORD`.

## Dev
`godot --path prototypes/room_clear_3d -- --bot=menu|play|top|perf|reach [--mission=N] [--quality=0..2] [--shots=dir]`
drives the game by itself (screenshots, playthroughs, map overviews, render stats, reachability of every
generated map). `tools/bake_sfx.gd` re-renders the synthesised sounds into `assets/sfx/`. Nothing in
`tools/` is exported.

## Layout
```
scripts/game.gd      campaign, progress / stars / XP, settings, scene changes (autoload)
scripts/map_gen.gd   procedural building generator (seeded)
scripts/level.gd     builds the 3D building from a layout; nav grid, cover points
scripts/mission.gd   one operation: spawns, objectives, extraction, scoring, end
scripts/soldier.gd   avatar, mocap locomotion, weapons, recoil, reload, dash, grenades, ragdoll
scripts/aim_rig.gd   SkeletonModifier3D: torso twist, recoil, head look, two-bone arm IK
scripts/player.gd    twin-stick / mouse aim, aim assist, laser sight
scripts/enemy.gd     rifleman / shotgunner / heavy / target AI
scripts/hud.gd       mission HUD, minimap + route, touch controls, pause, debrief
scripts/menu.gd      3D main menu, campaign, briefing, loadout, settings
scripts/fx.gd        pooled particles, tracers, decals, explosions, popups (autoload)
scripts/sfx.gd       sounds (pre-rendered in assets/sfx, synthesised as fallback) (autoload)
```

## Credits
- Soldiers and animations: [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) (Military_Male_03/04), MIT — `assets/characters/ROCKETBOX_LICENSE.md`.
- Furniture, props and surface textures: [Poly Haven](https://polyhaven.com), CC0.
- Font: Rajdhani (Indian Type Foundry), SIL OFL 1.1.
- UI icons: [game-icons.net](https://game-icons.net) by Lorc, Delapouite, Skoll, sbed, John Colburn, Guard13007, Felbrigg, Quoting and contributors, CC BY 3.0 (`assets/ui/gi/`). Weapon silhouettes drawn for this project.
- Hostage avatar: Rocketbox "castaway" (from the main game), MIT.
- Rifle, effects, UI icons and sound: made in code / SVG for this project.
