# الشارع الأول «درب السعادة»: برومتات النموذج اللي بيعمل 3D من نص

## شكل الشارع (أنا هرصّه بالظبط كده في اللعبة)
- شارع طوله حوالي 120 متر، **بيلف لفة خفيفة** في النص، والمسافة بين الواجهتين 8 متر.
- **حارتين جانبيين** ضيقين (3 متر): واحدة بعد L4 وواحدة بعد R4.
- **ميدان صغير** على اليمين قدام القهوة (L2)، مساحته 10×12 متر، والمبنى R5 بيبص عليه.
- **الجامع والمئذنة** في آخر الشارع، بيقفلوه من قدام.
- الترتيب من أول الشارع لآخره:

```
        [  الجامع والمئذنة  ]
  L8  |                 | R8
  L7  |                 | R7
  L6  |                 | R6
  L5  |                 | R5  ← بيبص على الميدان
 ---- حارة              | [ميدان صغير]
  L4  |                 | R4
  L3  |                 | ---- حارة
  L2 (القهوة)           | R3
  L1  |                 | R2
      |  مدخل الشارع     | R1
```

## السطر الثابت: حطه في أول كل برومت
```
Game-ready 3D model of ONE single building from an old poor Cairo neighbourhood (Egyptian hara), realistic style, real-world scale in metres, flat roof, the FRONT facade is the detailed side and faces forward, the two side walls are plain exposed red brick with grey mortar, plain back wall, the ground floor sits exactly at the bottom of the model, no ground plane, no street, no pavement, no people, no cars, no text or letters anywhere (shop sign boards are blank), PBR textures, sharp facade details, moderate polygon count.
```

## المباني (السطر الثابت + الوصف)

### الناحية الشمال
| الاسم | الوصف |
|---|---|
| `bld_L1` | `Corner apartment building, 5 storeys, 10 m wide, 15 m tall, faded cream-yellow painted concrete, balconies enclosed with aluminium and glass, outdoor AC units, two satellite dishes on the roof edge. Ground floor: a koshary restaurant with a wide glass front and a juice shop with a rolling metal shutter half open.` |
| `bld_L2` | `Old 1930s building, 4 storeys, 8 m wide, 14 m tall, faded ochre plaster with cracks, tall windows with dark green wooden louvered shutters, small wrought-iron balconies, carved cornice at the top. Ground floor: a traditional Egyptian coffeehouse (ahwa) with a wide open wooden front and warm light inside.` |
| `bld_L3` | `Unfinished building, 6 storeys, 9 m wide, 18 m tall, exposed red brick walls inside a grey concrete column-and-slab frame, steel rebar sticking up from the roof columns, laundry on one balcony without railing. Ground floor: a car mechanic workshop with a wide dark opening and oil stains.` |
| `bld_L4` | `Narrow tall apartment building, 7 storeys, 6 m wide, 21 m tall, faded pale green paint, small balconies with simple metal railings and clothes drying, water pipes on the facade. Ground floor: a small pharmacy with a glass door.` |
| `bld_L5` | `Old Islamic Cairo house, 3 storeys, 7 m wide, 11 m tall, ground floor of large worn limestone blocks with a big arched wooden double door, upper floors in pale plaster with two projecting dark wooden mashrabiya bay windows with fine lattice.` |
| `bld_L6` | `Apartment building, 5 storeys, 9 m wide, 15 m tall, faded light blue paint with dirt streaks, open balconies with metal railings, many AC units and satellite dishes. Ground floor: a barber shop and a mobile phone shop, both with rolling metal shutters open.` |
| `bld_L7` | `Half-finished building, 4 storeys, 8 m wide, 12 m tall, first floor plastered and painted dusty pink, upper floors exposed red brick, rebar on the roof. Ground floor: a small grocery shop with crates in the opening.` |
| `bld_L8` | `Old building, 4 storeys, 9 m wide, 13 m tall, pale peach plaster, moulded window frames, simple cornice. Ground floor: a traditional Egyptian bread bakery with a dark wide opening and a wooden counter.` |

### الناحية اليمين
| الاسم | الوصف |
|---|---|
| `bld_R1` | `Apartment building, 6 storeys, 10 m wide, 18 m tall, faded dusty pink paint, balconies enclosed with aluminium and glass, AC units. Ground floor: two shops with grey rolling metal shutters, one closed and one half open.` |
| `bld_R2` | `Old house, 3 storeys, 7 m wide, 10 m tall, whitewashed plaster peeling to show stone underneath, one wooden balcony. Ground floor: a carpenter workshop with an open wooden door and planks leaning outside.` |
| `bld_R3` | `Newer tall building, 8 storeys, 9 m wide, 24 m tall, concrete frame with red brick infill partly plastered beige, small balconies, satellite dishes. Ground floor: a stair entrance with a metal door and a phone accessories shop.` |
| `bld_R4` | `Small old house, 2 storeys, 6 m wide, 7 m tall, faded yellow plaster, wooden pigeon tower (ghayya) on the roof made of wooden posts and slats. Ground floor: a tiny tea and cigarette kiosk window.` |
| `bld_R5` | `Old building facing a small square, 5 storeys, 11 m wide, 16 m tall, ochre and cream plaster, ground floor with three stone arches forming a covered arcade, wrought-iron balconies above. Ground floor: a fabric shop with rolls of cloth inside the arches.` |
| `bld_R6` | `Unfinished building, 5 storeys, 8 m wide, 15 m tall, exposed red brick and grey concrete frame, rebar on the roof. Ground floor: a large rusty metal garage door.` |
| `bld_R7` | `Apartment building, 6 storeys, 9 m wide, 18 m tall, beige paint with dirt streaks, enclosed aluminium balconies, AC units. Ground floor: a butcher shop with a white tiled front.` |
| `bld_R8` | `Building, 4 storeys, 8 m wide, 13 m tall, faded turquoise paint, simple balconies with laundry. Ground floor: a small clinic entrance and a stationery shop.` |

### الجامع (من غير السطر الثابت)
`mosque_01`:
```
Game-ready 3D model of a Mamluk-style Cairo mosque, realistic, real-world scale: a stone mosque block 18 m wide and 13 m tall with alternating light and dark stone bands (ablaq), crenellations along the roof edge, a tall recessed entrance portal with a pointed arch and muqarnas, a stone dome 9 m wide on the roof, and a 50 m tall minaret at the front corner with square base, octagonal middle, round top section, two carved balconies and a bulb top with a brass crescent. No ground plane, no people, no text.
```

## الأرض: أنا اللي هعملها
الأرض مسطحة وطويلة، وموديلات الـ 3D بتطلّعها متعرّجة ومتكتّلة، فبعملها بنفسي.
اللي هعمله بالظبط:
- أسفلت مرقّع ومليان تراب.
- رصيف مختلف قدام كل بيت: ارتفاع مختلف وبلاط مختلف، وفيه حتت مكسورة.
- بلاعات، وبقع مية وزيت، وكوم رمل.
- خطوط الكهربا والغسيل اللي معدّية الشارع، واللمبات.

اللي محتاجه منك للأرض **صور تكسترات بس** (ChatGPT): القسم 4 و6 في `ASSET_REQUESTS.md`.

## التسمية والتسليم
- **الصيغة:** GLB.
- **التسمية:** `bld_L1_v01.glb` وهكذا.
- **حطهم في فولدر `hara_assets`** زي ما اتفقنا.
