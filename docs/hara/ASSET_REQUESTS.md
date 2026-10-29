# طلبات الأصول — الشارع الأول (تجربة أولى)

> الهدف: نجرّب الطريق كله على حاجات قليلة قبل ما نكبّر.
> **ChatGPT يعمل الصورة ← TRELLIS.2 يحوّلها لموديل 3D ← Claude ينضّفه ويحطه في الشارع.**
> المباني والأرض والشخصيات Claude بيعملهم بنفسه. المطلوب هنا: العربيات، وحاجات الشارع، والتكسترات.

---

## 1. الأداة: TRELLIS.2 (مايكروسوفت) — ببلاش، والرخصة MIT

- الرابط: https://huggingface.co/spaces/microsoft/TRELLIS.2
- **ليه هي:** ببلاش، والتحميل ببلاش، والرخصة MIT، يعني الموديل بتاعنا نبيعه في اللعبة من غير ما نذكر اسمهم. اتأكدت إن الـ Space الرسمي شغال، والرخصة مكتوبة عليه MIT.
- **الحد:** بتشتغل على GPU مجاني ليه حصة يومية. **اعمل حساب Hugging Face مجاني وادخل بيه**، عشان حصتك تزيد. لو الحصة خلصت، استنى لتاني يوم.
- **البديل لو احتجنا:** Meshy (meshy.ai)، الخطة المجانية فيها 10 تحميلات في الشهر، ورخصتها **CC BY 4.0**: مسموح تجاري بس لازم نكتب اسمهم في الـ credits. نستخدمها بس لو TRELLIS فشل في حاجة معينة.
- **Copilot 3D:** ماتستخدمهاش دلوقتي. شروط الاستخدام التجاري بتاعتها مش واضحة.

### الخطوات
1. افتح الرابط وادخل بحسابك.
2. ارفع الصورة في خانة **Image Prompt**.
3. الإعدادات:
   - **Resolution:** `1024` (وللعربيات جرّب `1536` لو الحصة سامحة)
   - افتح **Advanced Settings**:
     - **Decimation Target:** `100000` (أقل رقم. أنا هنزّله أكتر بعدين)
     - **Texture Size:** `2048` للعربيات، و `1024` لحاجات الشارع
   - سيب الباقي زي ما هو.
4. اضغط **Generate**. وبص على المعاينة:
   - العجل مدوّر؟ مفيش حتت ناقصة أو زيادة لازقة فيه؟
   - لو وحش: علّم **Randomize Seed** واعمل Generate تاني. ولو فضل وحش، الصورة نفسها هي المشكلة، فاطلب صورة جديدة من ChatGPT.
5. اضغط **Extract**، وبعدين **Download GLB**.
6. **سمّي الملف** بالاسم المكتوب في الجدول تحت (مثلاً `veh_tuktuk_v01.glb`)، و**احفظ صورة ChatGPT جنبه بنفس الاسم** (`veh_tuktuk_v01.png`).

### إزاي تبعتلي الملفات
**فولدر في Google Drive** اسمه `hara_assets` (أقدر أقراه من هنا)، أو ارفعهم على GitHub. الأهم: **كل GLB ومعاه الصورة بتاعته.**

---

## 2. قواعد صور ChatGPT للموديلات (مهمة جداً)
TRELLIS بيبني الموديل من الصورة، فكل غلطة في الصورة هتطلع في الموديل:
- **حاجة واحدة بس** في الصورة.
- **زاوية 3/4 من قدام ومن فوق شوية** عشان يشوف وشّين وسقف.
- **الحاجة كلها باينة** ومش مقصوصة، وحواليها مسافة فاضية.
- **خلفية بيضا سادة.** من غير أرضية ولا ظل ولا انعكاس.
- **من غير كتابة ولا شعارات ولا أرقام لوحات.**
- **من غير ناس.**
- **ماتطلبش حاجات رفيعة جداً** (أسلاك، أسياخ عجل، شبك). بتطلع مكسّرة.
- صورة **مربعة**.

**الذيل الثابت:** أضف السطر ده في آخر كل طلب موديل:
```
Single object only, three-quarter front view from slightly above, the entire object fully visible and centered with empty margin around it, plain pure white background, soft even studio lighting, no cast shadow, no ground, no reflections, no people, no text, no logos, no license plate characters, no watermark, realistic used condition, sharp detailed photorealistic game asset reference, square image.
```

---

## 3. الموديلات بالترتيب

> **ابدأ بالتوك توك لوحده**: حوّله وابعتهولي على طول، قبل ما تكمّل الباقي. هجرّب عليه الطريق كله (تنضيف، عجل بيلف، يتساق، يتحط في الشارع). لو نجح، كمّل الباقي. ولو فيه مشكلة نعرفها بدري.

### العربيات (Texture Size = 2048)

| # | اسم الملف | الطلب (+ الذيل الثابت) |
|---|---|---|
| 1 | `veh_tuktuk_v01` | **عندك صورته خلاص.** لو هتعملها تاني: `Egyptian tuk-tuk auto rickshaw (Bajaj RE style), glossy black body with chrome trim and small colorful decorative stickers, black canvas roof, dark tinted windshield, three wheels (one front, two rear) with solid black hubcaps.` |
| 2 | `veh_sedan128_v01` | `Old 1980s small boxy European sedan as commonly used in Egypt (Fiat 128 style), faded white paint, light rust spots near the wheel arches, chrome bumpers, dark tinted windows, simple steel wheels with hubcaps, no emblems.` |
| 3 | `veh_moto_v01` | `Cheap Chinese 150cc street motorcycle common in Egypt, red and black fairing, round headlight, solid alloy wheels (no spokes), black seat, small rear rack, slightly dirty.` |

### حاجات الشارع (Texture Size = 1024)

| # | اسم الملف | الطلب (+ الذيل الثابت) |
|---|---|---|
| 4 | `prop_ahwa_chair_v01` | `Classic Egyptian street coffeehouse (ahwa) chair, simple dark wood frame with woven straw seat, worn and scratched.` |
| 5 | `prop_ahwa_table_v01` | `Small round Egyptian street cafe table, dented aluminum top, thin black metal legs, worn.` |
| 6 | `prop_shisha_v01` | `Traditional Egyptian shisha water pipe, brass stem, green glass base, clay bowl on top, coiled hose resting against the stem.` |
| 7 | `prop_fruit_cart_v01` | `Egyptian street vendor wooden fruit and vegetable cart with two big wheels, piled with oranges, tomatoes, bananas and green peppers, faded painted wood.` |
| 8 | `prop_ac_unit_v01` | `Outdoor split air conditioner unit, off-white plastic and metal casing with rust stains and dust, round fan grille on the front, metal mounting bracket.` |
| 9 | `prop_sat_dish_v01` | `Small white satellite dish on a short metal wall bracket, slightly dirty, LNB arm in front.` |
| 10 | `prop_gas_cyl_v01` | `Dented steel butane gas cylinder, faded paint, metal valve and protective ring on top.` |
| 11 | `prop_elec_box_v01` | `Green metal electrical street cabinet, rectangular, scratched paint, stickers removed leaving marks, dust at the bottom.` |
| 12 | `prop_crates_v01` | `Stack of three red plastic vegetable crates, scratched and dirty.` |
| 13 | `prop_trash_v01` | `Small pile of black and blue garbage bags with a few cardboard boxes, street trash.` |
| 14 | `prop_plant_tin_v01` | `Green leafy plant growing in an old rusty metal tin can used as a pot.` |

---

## 4. التكسترات (صور بس، من غير TRELLIS)
**القواعد:** صورة مستوية من قدام بالظبط، من غير منظور ولا ظلال ولا إضاءة جانبية، مربعة، ويُفضّل إنها تتكرر من غير حواف واضحة. لو مش متكررة 100% أنا بصلحها.

**الذيل الثابت للتكسترات:**
```
Seamless tileable texture, flat straight-on orthographic view, perfectly even flat lighting with no shadows and no highlights, no perspective, no objects, no text, fills the whole square image.
```

| # | اسم الملف | الطلب (+ الذيل) |
|---|---|---|
| 15 | `tex_plaster_ochre` | `Old Cairo building wall, faded ochre painted plaster, cracks, small patches peeling to show red brick underneath, water stains near the bottom, dust.` |
| 16 | `tex_plaster_gray` | `Old pale blue-gray painted plaster wall from an old Cairo building, faded, dirty, small cracks, rain streaks.` |
| 17 | `tex_brick_red` | `Exposed red clay brick wall with rough gray cement mortar, unfinished Egyptian building, irregular mortar, dust.` |
| 18 | `tex_ground_stone` | `Old worn stone pavement of a narrow Cairo alley, irregular dark gray basalt stones, dust and dirt between the stones, slightly wet.` |
| 19 | `tex_asphalt_old` | `Old cracked asphalt road with patched repairs, dust, oil stains, faded.` |
| 20 | `tex_shutter` | `Closed rolling metal shop shutter, horizontal corrugated slats, gray painted metal with rust stains and dents.` |
| 21 | `tex_wood_green` | `Old wooden door planks painted dark green, paint peeling and cracked, gray wood showing through.` |

### اليافطات (من غير كتابة. أنا هحط الكلام بخط عربي حقيقي)
| # | اسم الملف | الطلب |
|---|---|---|
| 22 | `sign_blank_01` | `Flat front-facing hand-painted Egyptian shop sign board, rectangular, dark green background with a simple illustration on the left side, the rest of the sign is EMPTY with no letters or text at all, slightly weathered paint, straight-on view, white background around the sign, wide 2:1 image.` |
| 23 | `sign_blank_02` | نفس الطلب، بس `red background, coffee cup illustration`. |
| 24 | `sign_blank_03` | نفس الطلب، بس `blue background, mobile phone illustration`. |

---

## 5. Claude هيعمل إيه بالملفات دي
- **التنضيف:** ينزّل الموديل لعدد المثلثات المطلوب (توك توك ~8 آلاف، عربية ~12 ألف، حاجة شارع 1–3 آلاف). يظبط المقاس الحقيقي، والاتجاه، والأرض. يعمل LODs وشكل للتصادم.
- **العربيات:** يشيل العجل المتولد ويحط عجل بيلف، ويفصل الإزاز واللمبات، ويضيف فيزياء السواقة.
- **التكسترات:** يصلّح التكرار، ويعمل normal و roughness، ويضغطها.
- **الشارع الأول:** المباني والأرض والإضاءة (شمس العصر) والكاميرا والشخصية، مع الحاجات دي.
- **الـ credits:** أي حاجة جاية من Meshy تتكتب في `CREDITS.md`.

---

## 6. المباني: قطع صغيرة بدل واجهة كاملة (بدل القسم بتاع "الواجهات الخمسة")
صورة واجهة كاملة طلعت مقصوصة أو تفاصيلها بايظة. مولّد الصور بيبوّظ أي حاجة فيها تفاصيل متكررة كتير (20 شباك).
الحل: كل صورة فيها **قطعة واحدة بس**، يعني دور واحد في شباك واحد، وأنا أركّب منها المباني (modular facades).

**ابدأ كل مجموعة في شات جديد بالجملة دي:**
`I will ask you for several pieces of the SAME building facade, one piece per image. Keep exactly the same wall colour, plaster texture, window style and scale in every image.`

**السطر الثابت لكل قطعة:**
```
Straight-on orthographic front view of exactly ONE piece of a building facade, perfectly flat with no perspective. The wall surface continues to all four edges of the image: tightly cropped, no building corners, no sky, no ground, no neighbouring windows or balconies, the main element centered. Soft overcast daylight, no hard shadows, no people, no text or letters, photorealistic, sharp, square image.
```

### المجموعة A: عمارة أهالي بلون بمبي باهت
| الاسم | الطلب |
|---|---|
| `modA_window` | `One storey high and one window wide: faded dusty pink painted concrete wall with one aluminium window with dusty glass, a small outdoor AC unit under it, a few stains.` |
| `modA_balcony` | `One storey high and one bay wide: faded dusty pink wall with a balcony enclosed by aluminium frames and glass, seen straight from the front.` |
| `modA_shop` | `One ground-floor shop bay from the pavement line (bottom edge) to the top of the ground floor: grey rolling metal shutter half open showing a dim shop inside, a blank sign board above it, concrete pillars at both sides.` |
| `modA_top` | `Wide horizontal strip: the top edge of the same building, the roof parapet wall with a few rusty steel bars sticking up and a satellite dish edge, landscape image.` |

### المجموعة B: عمارة قديمة من التلاتينات بلون أوكر
| الاسم | الطلب |
|---|---|
| `modB_window` | `One storey high and one window wide: old faded ochre plaster wall with cracks, one tall window with dark green wooden louvered shutters half open, a moulded frame around the window.` |
| `modB_balcony` | `One storey high and one bay wide: same ochre wall with a tall door-window and a small wrought-iron balcony with laundry hanging on it.` |
| `modB_shop` | `One ground-floor bay from the pavement line to the top of the ground floor: an old coffeehouse (ahwa) opening with a worn wooden frame, warm light inside, limestone base.` |
| `modB_door` | `One ground-floor bay: a big old wooden double entrance door with an arched top inside a limestone frame, two steps at the bottom.` |
| `modB_cornice` | `Wide horizontal strip: the carved plaster cornice at the top of the same old ochre building, landscape image.` |

### المجموعة C: طوب أحمر مش متشطب
| الاسم | الطلب |
|---|---|
| `modC_window` | `One storey high and one bay wide: exposed red brick wall with rough grey mortar between grey concrete columns and a concrete slab edge, one simple window opening with a plain metal frame.` |
| `modC_shop` | `One ground-floor bay from the pavement line: a car mechanic workshop with a wide dark opening, grease stains, exposed red brick around it.` |

### بالـ 3D في TRELLIS (حاجات بارزة من المبنى)
| الاسم | الطلب (+ السطر الثابت بتاع الموديلات) |
|---|---|
| `prop_mashrabiya_v01` | `A single projecting dark wooden mashrabiya bay window with fine lattice, as a separate object, not attached to a wall.` |
| `prop_balcony_iron_v01` | `A single small wrought-iron balcony railing with a thin concrete floor slab, as a separate object.` |
