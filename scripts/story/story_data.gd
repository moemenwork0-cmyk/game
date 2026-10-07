class_name StoryData
extends RefCounted
## All narrative content, in English and Arabic.
## Every playthrough rolls one BACKSTORY (who you are) and one MYSTERY (why the
## Murjan really sank). Missions, letters, events and the finale change with both,
## and your choices are written into your journal and shape what comes next.

static func t(d: Variant) -> String:
	if d is Dictionary:
		var lang: String = Settings.language
		return String(d.get(lang, d.get("en", "")))
	return str(d)


const SHIP := {"en": "the Murjan", "ar": "«المرجان»"}

const BACKSTORIES := {
	"engineer": {
		"name": {"en": "Adam", "ar": "آدم"},
		"role": {"en": "Second engineer of the Murjan", "ar": "المهندس الثاني على متن «المرجان»"},
		"memory": {"en": "I heard the hull groan below the waterline. I had heard it before. I said nothing.",
			"ar": "سمعتُ الهيكل يئنّ تحت خط الماء. كنتُ قد سمعته من قبل… ولم أقل شيئًا."},
		"perk": {"en": "Engineer — your tools wear out 25% slower.", "ar": "مهندس — أدواتك تتآكل أبطأ بنسبة ٢٥٪."},
		"guilt": {"en": "If I had spoken up, would they all still be alive?", "ar": "لو أنني تكلّمت… هل كانوا جميعًا سيبقون أحياء؟"},
	},
	"stowaway": {
		"name": {"en": "Ziad", "ar": "زياد"},
		"role": {"en": "Stowaway in container 14", "ar": "متسلّل في الحاوية رقم ١٤"},
		"memory": {"en": "No one knew I was aboard. No one will ever know I am gone.",
			"ar": "لم يكن أحد يعلم أنني على متن السفينة. ولن يعلم أحد أنني اختفيت."},
		"perk": {"en": "Stowaway — you have known hunger; it drains 25% slower.", "ar": "متسلّل — عرفتَ الجوع من قبل؛ يستنزفك أبطأ بنسبة ٢٥٪."},
		"guilt": {"en": "Nobody is searching for me. Nobody ever was.", "ar": "لا أحد يبحث عني. لم يبحث عني أحد قط."},
	},
	"medic": {
		"name": {"en": "Karim", "ar": "كريم"},
		"role": {"en": "Ship's medic", "ar": "طبيب السفينة"},
		"memory": {"en": "I was holding her hand when the deck tilted. Then the water took us both.",
			"ar": "كنتُ أمسك يدها حين مال سطح السفينة… ثم أخذنا الماء معًا."},
		"perk": {"en": "Medic — raw food rarely makes you sick, and you heal faster.", "ar": "طبيب — نادرًا ما يمرضك الطعام النيء، وتُشفى أسرع."},
		"guilt": {"en": "I let go of her hand. I have to believe she let go of mine first.", "ar": "أفلتُّ يدها. يجب أن أصدّق أنها هي من أفلتت يدي أولًا."},
	},
}

const MYSTERIES := ["cargo", "survivor", "nasser"]

const INTRO := [
	{"en": "Twelve days at sea. The Murjan had never failed us.", "ar": "اثنا عشر يومًا في عرض البحر. لم تخذلنا «المرجان» قط."},
	{"en": "Then the sky turned black… and the sea stood up like a wall.", "ar": "ثم اسودّت السماء… ووقف البحر أمامنا كالجدار."},
	"MEMORY",
	{"en": "Then — nothing. Only the cold.", "ar": "ثم… لا شيء. لا شيء سوى البرد."},
]
const WAKE := {"en": "…Salt. Sand. Sun. — I'm alive.", "ar": "…ملح. رمل. شمس. — أنا… حيّ."}

## Act One. Each mission: title, goal, start / done voice lines.
const MISSIONS := [
	{"id": "alive", "title": {"en": "Alive", "ar": "على قيد الحياة"},
		"goal": {"en": "Get up and look around", "ar": "انهض وتفقّد ما حولك"},
		"done": {"en": "An island. Small. Silent. How many of us made it?", "ar": "جزيرة. صغيرة… صامتة. كم منّا نجا؟"}},
	{"id": "thirst", "title": {"en": "Thirst", "ar": "العطش"},
		"goal": {"en": "Find something to drink — coconuts hold water (X to eat)", "ar": "ابحث عن شيء تشربه — جوز الهند يحمل الماء (X للأكل)"},
		"start": {"en": "My throat is on fire. Water everywhere, and not a drop I can drink.", "ar": "حلقي يحترق. الماء في كل مكان… ولا قطرة أستطيع شربها."},
		"done": {"en": "Sweet. Warm. The best thing I have ever tasted.", "ar": "حلو… دافئ. أطيب ما ذقتُ في حياتي."}},
	{"id": "wood", "title": {"en": "Driftwood", "ar": "خشب البحر"},
		"goal": {"en": "Collect 3 logs — driftwood on the beach, or fell a tree", "ar": "اجمع ٣ جذوع — من خشب الشاطئ أو باقتلاع شجرة"},
		"start": {"en": "The sun won't wait for me. I need wood before dark.", "ar": "الشمس لن تنتظرني. أحتاج إلى الحطب قبل حلول الظلام."},
		"done": {"en": "My hands are bleeding. Good. It means I'm still here.", "ar": "يداي تنزفان. جيد… هذا يعني أنني ما زلتُ هنا."}},
	{"id": "fire", "title": {"en": "Fire", "ar": "النار"},
		"goal": {"en": "Craft a campfire kit (Tab) and place it (slot 8)", "ar": "اصنع عُدّة نار (Tab) وضعها على الأرض (الخانة ٨)"},
		"done": {"en": "Fire. For the first time since the storm, I am not afraid.", "ar": "نار. لأول مرة منذ العاصفة… لستُ خائفًا."}},
	{"id": "night", "title": {"en": "The First Night", "ar": "الليلة الأولى"},
		"goal": {"en": "Survive until dawn — stay warm, stay by the fire", "ar": "انجُ حتى الفجر — ابقَ دافئًا، قرب النار"},
		"start": {"en": "The dark here is complete. Things move in it.", "ar": "الظلام هنا كامل… وثمّة أشياء تتحرك فيه."},
		"done": {"en": "Morning. I made it through one night. Only one.", "ar": "الصباح. نجوتُ من ليلة واحدة… واحدة فقط."}},
	{"id": "wreck", "title": {"en": "The Murjan", "ar": "«المرجان»"},
		"goal": {"en": "Swim out to the wreck on the reef and search it", "ar": "اسبح إلى الحطام فوق الشعاب وفتّشه"},
		"start": {"en": "There — on the reef. Her bow, still above the water. The Murjan.", "ar": "هناك، فوق الشعاب… مقدّمتها ما زالت فوق الماء. «المرجان»."}},
	{"id": "shelter", "title": {"en": "Shelter", "ar": "المأوى"},
		"goal": {"en": "Build a shelter — 4 building pieces, or a bed", "ar": "ابنِ مأوى — ٤ قطع بناء أو سريرًا"},
		"start": {"en": "Another storm will come. I can feel it in the air.", "ar": "عاصفة أخرى قادمة. أشعر بها في الهواء."},
		"done": {"en": "Four walls of driftwood. It is not home. But it is mine.", "ar": "جدران من خشب البحر. ليست بيتًا… لكنها لي."}},
	{"id": "signal", "title": {"en": "A Signal", "ar": "إشارة"},
		"goal": {"en": "Light a signal fire on the highest ground", "ar": "أشعل نار إشارة على أعلى نقطة في الجزيرة"},
		"start": {"en": "If anyone is out there, they have to see me.", "ar": "إن كان هناك أحد… فلا بد أن يراني."},
		"done": {"en": "It burns. Now I wait. The waiting is the hardest part.", "ar": "إنها تشتعل. والآن أنتظر… والانتظار أصعب ما في الأمر."}},
	{"id": "finale", "title": {"en": "The Night of the Signal", "ar": "ليلة الإشارة"},
		"goal": {"en": "Wait for night by your signal fire", "ar": "انتظر الليل قرب نار الإشارة"}},
]

## What you find in the wreck depends on the mystery.
const WRECK_FIND := {
	"cargo": {"en": "A manifest: “Agricultural equipment.” The crates around it hold rifles, wrapped in oilcloth. So that is why we sailed at night.",
		"ar": "بيان الشحنة: «معدات زراعية». والصناديق حوله تحوي بنادق ملفوفة بقماش مشمّع. إذن… لهذا كنا نبحر ليلًا."},
	"survivor": {"en": "A bracelet, caught on a door handle. Engraved: “Layla”. The captain's daughter. Her cabin is empty — and her life jacket is gone.",
		"ar": "سوار عالق بمقبض باب، منقوش عليه «ليلى». ابنة القبطان. قمرتها فارغة… وسترة نجاتها مفقودة."},
	"nasser": {"en": "The captain's log, last entry: “We change course tonight. The crew calls the old route cursed. Good — no one will follow us there.”",
		"ar": "سجلّ القبطان، آخر سطر: «نغيّر المسار الليلة. البحّارة يسمّون الطريق القديم ملعونًا. حسنًا… لن يتبعنا أحد إلى هناك»."},
}

const LETTERS := {
	"common": [
		{"en": "To whoever finds this: tell my mother I was not afraid. That is a lie. Tell her anyway.",
			"ar": "إلى من يجد هذه الرسالة: أخبروا أمي أنني لم أكن خائفًا. هذه كذبة… لكن أخبروها على أي حال."},
		{"en": "Day 40. I have started talking to the crabs. One of them answers.",
			"ar": "اليوم الأربعون. بدأتُ أحدّث السراطين. أحدها يجيبني."},
		{"en": "If the tide brings this bottle back to me, I will know the sea is laughing.",
			"ar": "إن أعاد المدّ هذه الزجاجة إليّ… سأعرف أن البحر يضحك مني."},
		{"en": "South of the reef there is an island where the birds never sing. Do not go there. Do not.",
			"ar": "جنوب الشعاب جزيرة لا تغني فيها الطيور. لا تذهب إليها. لا تذهب."},
		{"en": "I wrote my name on the rocks a hundred times, so the island would not forget me. It forgot anyway.",
			"ar": "كتبتُ اسمي على الصخور مئة مرة، كي لا تنساني الجزيرة. ونسيتني رغم ذلك."},
		{"en": "Whoever you are — keep a fire. The dark is patient, but so are you.",
			"ar": "أيًّا كنت — أبقِ النار مشتعلة. الظلام صبور… لكنك صبور أيضًا."},
	],
	"cargo": [
		{"en": "Bosun's note: “Captain says if anyone asks, the containers are tractors. I've never seen a tractor that needs an armed guard.”",
			"ar": "ورقة لرئيس البحّارة: «القبطان يقول إن سأل أحد، فالحاويات جرّارات. لم أرَ جرّارًا يحتاج إلى حارس مسلّح»."},
		{"en": "A torn receipt. A name, a sum with too many zeros, and a date: the night we sank.",
			"ar": "إيصال ممزّق. اسم، ومبلغ فيه أصفار كثيرة، وتاريخ: الليلة التي غرقنا فيها."},
	],
	"survivor": [
		{"en": "In a child's handwriting, years old: “Baba, when I grow up I'll be a captain too.” Signed — Layla.",
			"ar": "بخط طفلة، منذ سنوات: «بابا، عندما أكبر سأصبح قبطانة مثلك». التوقيع — ليلى."},
		{"en": "Fresh charcoal on a flat stone: an arrow pointing north, and the letter L.",
			"ar": "فحم طريّ على حجر مسطّح: سهم يشير إلى الشمال… وحرف L."},
	],
	"nasser": [
		{"en": "“Nasser, 1971. Third week. The fishing boats pass at night with no lights. They are not fishing.”",
			"ar": "«ناصر، ١٩٧١. الأسبوع الثالث. قوارب الصيد تمرّ ليلًا بلا أضواء… وهي لا تصطاد»."},
		{"en": "“Nasser. I found the cave. Someone was here before me. Someone was here before them.”",
			"ar": "«ناصر. وجدتُ الكهف. كان أحدهم هنا قبلي… وكان أحدهم هنا قبله»."},
	],
}

## Inner voice for situations — the director picks one, with cooldowns.
const VOICE := {
	"dusk_no_fire": [{"en": "The sun is going. I have no fire. I have no fire.", "ar": "الشمس تغيب… ولا نار عندي. لا نار عندي."}],
	"hungry": [{"en": "My stomach has stopped complaining. That scares me more.", "ar": "توقّفت معدتي عن الشكوى. وهذا يخيفني أكثر."}],
	"thirsty": [{"en": "My tongue is sand. I keep looking at the sea.", "ar": "لساني رمل. ولا أكفّ عن النظر إلى البحر."}],
	"cold": [{"en": "I can't stop shaking. Fire. Dry clothes. Anything.", "ar": "لا أستطيع التوقف عن الارتجاف. نار… ثياب جافة… أي شيء."}],
	"storm": [{"en": "The birds have gone quiet. The sea is holding its breath.", "ar": "صمتت الطيور. البحر يحبس أنفاسه."}],
	"low_morale": [
		{"en": "What's the point. What is the point.", "ar": "ما الجدوى؟ ما الجدوى أصلًا؟"},
		{"en": "I keep hearing my name in the wind.", "ar": "أسمع اسمي في الريح… مرة بعد مرة."},
	],
	"first_fish": [{"en": "Got you. Forgive me, little one.", "ar": "أمسكتُك. سامحني يا صغير."}],
	"first_tree": [{"en": "It fell like a giant. The whole island heard it.", "ar": "سقطت كالعملاق. سمعتها الجزيرة كلها."}],
	"collapse": [{"en": "Too greedy. Build it again — better this time.", "ar": "طمعتُ أكثر من اللازم. سأبنيها من جديد… أفضل هذه المرة."}],
	"near_death": [{"en": "Not like this. Not alone on a beach. Get up.", "ar": "ليس هكذا. ليس وحيدًا على شاطئ. انهض."}],
	"crate": [{"en": "A crate from the Murjan. The sea is giving her back to me piece by piece.", "ar": "صندوق من «المرجان». البحر يعيدها إليّ قطعةً قطعة."}],
	"ship_passed": [{"en": "It didn't see me. It didn't even slow down.", "ar": "لم ترَني. لم تُبطئ حتى."}],
	"morning": [
		{"en": "Another sunrise. I'm starting to count them.", "ar": "شروق آخر. بدأتُ أعدّها."},
		{"en": "I dreamed of home. I woke up here.", "ar": "حلمتُ بالبيت… واستيقظتُ هنا."},
	],
}

const NIGHTMARE := [
	{"en": "I was back on the deck. Everyone was there. They all turned to look at me.", "ar": "عدتُ إلى سطح السفينة. كانوا جميعًا هناك… والتفتوا كلهم ينظرون إليّ."},
	{"en": "Water filling the cabin. A hand on the glass. I woke before I could see whose.", "ar": "الماء يملأ القمرة. يدٌ على الزجاج. استيقظتُ قبل أن أرى يد من كانت."},
]

## Events offered by the storyteller. Some ask you to choose.
const GULL := {
	"text": {"en": "A seagull lies on the sand, one wing bent wrong. It watches you, too tired to be afraid.",
		"ar": "نورس ممدّد على الرمل، أحد جناحيه ملتوٍ. يراقبك… أتعب من أن يخاف."},
	"feed": {"en": "Feed it (2 berries)", "ar": "أطعمه (حبّتا توت)"},
	"eat": {"en": "Eat it", "ar": "كُله"},
	"leave": {"en": "Leave it be", "ar": "اتركه"},
	"fed": {"en": "It ate from my hand. I think I have a friend.", "ar": "أكل من يدي. أظنّ أن لديّ صديقًا الآن."},
	"ate": {"en": "I did what I had to. I'll keep telling myself that.", "ar": "فعلتُ ما كان عليّ فعله. سأظل أقول لنفسي ذلك."},
	"left": {"en": "It was gone in the morning. I hope it flew.", "ar": "اختفى في الصباح. أتمنى أنه طار."},
}

const FINALE := {
	"cargo": {
		"text": {"en": "Lights on the water. A boat with no flag is closing on the wreck. Men in dark clothes, rifles on their shoulders. Your fire is still burning on the hill.",
			"ar": "أضواء فوق الماء. قارب بلا علم يقترب من الحطام. رجال بثياب داكنة، والبنادق على أكتافهم. ونارك ما زالت مشتعلة على التل."},
		"a": {"en": "Wave your torch — they might save you", "ar": "لوّح بشعلتك — قد ينقذونك"},
		"b": {"en": "Kill the fire and hide", "ar": "أطفئ النار واختبئ"},
		"ra": {"en": "The searchlight finds you. A voice, in a language you know too well: “Where is the rest of the cargo?” They take what they came for — and they promise to come back. For you.",
			"ar": "يجدك الضوء الكاشف. صوت بلغة تعرفها جيدًا: «أين بقية الشحنة؟». أخذوا ما جاؤوا من أجله… ووعدوا بأن يعودوا. من أجلك أنت."},
		"rb": {"en": "From the dark you watch them haul crates out of the Murjan. One of them stares at the hill for a long, long time. At dawn, a red flare lies on the sand where they landed.",
			"ar": "من الظلام تراقبهم ينتشلون الصناديق من «المرجان». أحدهم يحدّق إلى التل طويلًا… طويلًا. وعند الفجر، تجد شعلة استغاثة حمراء على الرمل حيث رسا قاربهم."},
	},
	"survivor": {
		"text": {"en": "Far to the north, on top of the cliff — another fire. Small. Flickering. Someone is answering your signal.",
			"ar": "بعيدًا في الشمال، على قمة الجرف — نار أخرى. صغيرة… مرتعشة. أحدهم يردّ على إشارتك."},
		"a": {"en": "Go now, through the dark", "ar": "اذهب الآن، عبر الظلام"},
		"b": {"en": "Wait for morning", "ar": "انتظر الصباح"},
		"ra": {"en": "You climb in the dark, falling twice. The ashes are still warm. Small footprints lead down to the water — and stop. Carved into the rock: “L”.",
			"ar": "تتسلّق في الظلام وتسقط مرتين. الرماد ما زال دافئًا. آثار أقدام صغيرة تنحدر إلى الماء… ثم تختفي. ومحفور في الصخر: «L»."},
		"rb": {"en": "At dawn the ashes are cold. Scratched into the stone beside them: “Don't follow me. Not yet. — L”.",
			"ar": "عند الفجر كان الرماد باردًا. ومخدوش في الحجر بجانبه: «لا تتبعني. ليس بعد. — ل»."},
	},
	"nasser": {
		"text": {"en": "The wind dies. From the cave in the cliff comes a faint glow, and a voice that sounds like your own: “Read it.” Beside your fire lies an old notebook you never brought here.",
			"ar": "تسكن الريح. ومن الكهف في الجرف يتسلّل ضوء خافت، وصوت يشبه صوتك: «اقرأه». وبجانب نارك دفتر قديم… لم تحمله إلى هنا قط."},
		"a": {"en": "Read the last page", "ar": "اقرأ الصفحة الأخيرة"},
		"b": {"en": "Burn the notebook", "ar": "احرق الدفتر"},
		"ra": {"en": "“The ships never come for us. They come for the island.” Below it, in ink that looks fresh, a map — of islands you have never seen.",
			"ar": "«السفن لا تأتي من أجلنا أبدًا. إنها تأتي من أجل الجزيرة». وتحتها، بحبر يبدو طريًّا، خريطة… لجزر لم ترها من قبل."},
		"rb": {"en": "The pages curl and blacken. For a moment the flames burn green. Some doors are better left closed. But you will dream about this one.",
			"ar": "تتلوّى الصفحات وتسودّ. ولوهلة، تشتعل النار باللون الأخضر. بعض الأبواب الأفضل أن تبقى مغلقة… لكنك ستحلم بهذا الباب."},
	},
}

const ACT_END := {"en": "END OF ACT ONE", "ar": "نهاية الفصل الأول"}
const ACT_END_SUB := {"en": "Your story continues — and it will not be the same as anyone else's.",
	"ar": "قصتك مستمرة… ولن تشبه قصة أحد غيرك."}
