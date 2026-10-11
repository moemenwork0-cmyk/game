# Room Clear — Godot 4.7 (mobile, landscape)

Top-down tactical shooter: one safehouse, one target. Same idea as the HTML test
(`prototypes/room-clear/`), rebuilt in Godot with real 3D graphics and animation.

## بالعربي
- **الجرافيكس**: جنود حقيقيين (Microsoft Rocketbox Military) بحركات Motion Capture، وأثاث ممسوح ضوئياً PBR من Poly Haven،
  إضاءة ليلية: ضوء القمر داخل من الشباك من بين الستارة، لمبات معلّقة بظلال، كشاف على البندقية، ضباب حجمي، SSAO و Glow.
- **الأنيميشن**: الرجلين بتمشي في اتجاه الحركة والجسم بيلف ناحية التصويب، الإيدين ماسكة البندقية بـ IK،
  ارتداد مع كل طلقة، Reload كامل (الخزنة بتقع على الأرض فيزيائياً)، اهتزاز الجسم لما يتصاب، وموت Ragdoll حقيقي.
- **المستوى**: أوضتين بينهم باب حقيقي بيتزق، ترابيزة، كنبة، دولاب، رفوف، صناديق وبراميل كلها ساتر بيوقف الرصاص،
  وحاجات صغيرة (كراسي، لابتوب، جراكن) بتطير لما تضربها.
- **العدو (الهدف)**: بيلف بكشافه، بيسمع ضرب النار ويروح يدوّر، بيشتبك بطلقات متقطعة وهو بيتحرك يمين وشمال،
  ولما يتصاب بيجري على ساتر حقيقي ويقعد ويغيّر الخزنة ويطلع يضرب ويرجع. لو لفّيت عليه يسيب الساتر.
- **التحكم**: جويستيك شمال (حركة + تصويب تلقائي ناحية الاتجاه)، زرار ضرب يمين، زرار Reload.
- **الشاشات**: شاشة بداية (Play)، هدف المهمة، Mission Complete بكاميرا بطيئة على القتل، Mission Failed، و Restart.

## Run
- **Phone**: install the APK from the session (or export it yourself, below). Landscape, touch only.
- **Desktop preview**: open `prototypes/room_clear_3d/project.godot` in Godot 4.7 and press F5.
  WASD move · mouse aim · LMB fire · R reload (touch controls also work with a touchscreen).

## Export the Android APK
```
godot --headless --path prototypes/room_clear_3d --export-release "Android" build/RoomClear.apk
```
Needs the Godot 4.7.2 export templates and an Android SDK (build-tools) set in Editor Settings.
For signing, set `GODOT_ANDROID_KEYSTORE_RELEASE_PATH/_USER/_PASSWORD`.

## Dev
`godot --path prototypes/room_clear_3d -- --autoplay=win|lose|cover --shots=/tmp/shots/` plays the level
by itself, saves screenshots and prints the AI state (dev script in `tools/`, not exported).

## Layout
```
scripts/soldier.gd   avatar, mocap locomotion, rifle, recoil, reload, damage, ragdoll
scripts/aim_rig.gd   SkeletonModifier3D: torso twist, head look, two-bone arm IK onto the rifle
scripts/player.gd    joystick move/aim, soft auto-aim lock, laser sight
scripts/enemy.gd     patrol / investigate / engage / cover-peek / search AI
scripts/level.gd     safehouse, props, door, lights, A* nav grid, cover points
scripts/fx.gd        tracers, sparks, debris, blood, decals, casings, dropped mags & weapons
scripts/sfx.gd       all sounds synthesised at startup
scripts/hud.gd       HUD, touch controls, start / end screens
```

## Credits
- Soldiers and animations: [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) (Military_Male_03/04), MIT — `assets/characters/ROCKETBOX_LICENSE.md`.
- Furniture, props and surface textures: [Poly Haven](https://polyhaven.com), CC0.
- Font: Rajdhani (Indian Type Foundry), SIL OFL 1.1.
- Rifle, effects, UI icons and sound: made in code / SVG for this project.
