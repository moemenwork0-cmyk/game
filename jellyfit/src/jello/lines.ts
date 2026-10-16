/**
 * Everything Jello can say, by situation. Arabic in a light Egyptian dialect (Jello is a character,
 * not the UI), and English with the same playful voice.
 * Lines are drawn from shuffled bags so the same line never repeats back to back.
 */
import type { Rng } from '../core/rng';
import { LANG } from '../config/strings';

export const LINES = {
  greet: ['أهلاً يا بطل!', 'يلا نلعب؟', 'وحشتني والله!', 'جاهز؟ أنا جاهز!', 'منوّر يا كبير!'],
  greetBest: ['رقمك {best}… هنكسره النهارده؟', 'فاكر رقمك {best}؟ يلا نعدّيه!'],
  menuIdle: ['الزرار الأصفر ده مستنيك…', 'أنا زهقت… يلا نلعب!', 'هنفضل واقفين كده؟', 'دوس العب الآن بقى!'],
  tap: ['هيهي! بتزغزغ!', 'براحة عليّا!', 'أنا جيلي مش زرار!', 'تاني؟ ماشي!', 'بووينج!', 'إيه يا عم؟', 'هههه!'],
  boing: ['بووينج!', 'تاني تاني!', 'أنا مرن على فكرة!', 'هيييه!', 'وييي!'],
  pet: ['ممم… حلو كده', 'بحب الطبطبة!', 'كمان شوية…', 'إنت طيب أوي'],
  cool: ['دلوقتي بقيت كوول!', 'نضارة الكومبو!', 'إحنا في المود!'],
  peek: ['مش قادر أبص!', 'قولّي لما تخلص…', 'مغمّض عيني!'],
  holdGot: ['معايا!', 'شايلهالك!', 'في الحفظ والصون!', 'أنا أمين عليها!'],
  holdSwap: ['خد دي، وهات دي!', 'بدّلنا!', 'تبديل سريع!'],
  holdGive: ['اتفضل!', 'خدها!', 'دي بتاعتك!'],
  holdBack: ['رجعتلي تاني!', 'خلاص أشيلها شوية'],
  holdTip: ['اسحب أي قطعة وإديهالي، أشيلهالك!'],
  holdLearned: ['برافو! كده عرفت السر', 'شاطر! أشيلها لحد ما تحتاجها'],
  holdOnlyFits: ['خد اللي معايا! هي اللي تنفع', 'استنى! القطعة اللي معايا تنفع'],
  dizzy: ['دوخت! كفاية!', 'الدنيا بتلف…', 'خلاص خلاص!'],
  start: ['يلا بينا!', 'ركّز معايا!', 'النهارده يومنا!', 'وريني هتعمل إيه!'],
  again: ['المرة دي بقى!', 'يلا تاني!', 'دور جديد، حظ جديد!'],
  resume: ['رجعنا!', 'كمّلنا!', 'أنا هنا!'],
  lines2: ['حلوة دي!', 'جميل!', 'أيوه كده!', 'برافو!'],
  lines3: ['يا سلااام!', 'إيه الحلاوة دي!', 'تحفة!', 'عاش!'],
  lines4: ['مستحيييل!', 'إنت وحش!', 'أسطورة!', 'إيه اللي بيحصل ده!'],
  combo3: ['كمّل كمّل!', 'متوقفش!', 'سخّنت!'],
  combo5: ['مولّعة!', 'نار يا جدع!', 'محدش قدّك!'],
  combo8: ['محدش يقدر يوقفك!', 'إنت مش طبيعي!'],
  perfect: ['اللوحة فاضية!! أسطوري!', 'ولا بلوكة! إزاي؟!'],
  danger: ['يا ساتر… ضيّقة!', 'خلّي بالك!', 'هنتزنق كده!', 'إحنا في خطر!'],
  comeback: ['فيووو! نفدنا!', 'إنت أنقذتنا!', 'قلبي كان هيقف!', 'كانت هتروح!'],
  newBest: ['رقم قياسي جديد!', 'كسرت رقمك! أنا فخور بيك!', 'إنت الملك!'],
  idle: ['خد وقتك… أنا مستني', 'فكّر براحتك', 'في مكان حلو هناك…'],
  wake: ['ها؟ أنا صاحي!', 'مكنتش نايم والله!'],
  gameOver: ['يا خسارة… مرة كمان؟', 'كانت حلوة! جرّب تاني', 'مش مشكلة، الجاية أحلى'],
  gameOverClose: ['كنت قريب جداً من رقمك!', 'فاضل حبة صغيرين!'],
  gameOverBest: ['رقم قياسي!! إنت جامد!', 'أحسن دور لعبته! عاش!'],
} as const;

export type LineKey = keyof typeof LINES;

export const LINES_EN: Record<LineKey, readonly string[]> = {
  greet: ['Hi there, champ!', "Let's play?", 'I missed you!', "Ready? I'm ready!", 'Yay, you came back!'],
  greetBest: ['Your best is {best}… beat it today?', 'Remember {best}? Let’s top it!'],
  menuIdle: ['That yellow button is waiting…', "I'm bored… let's play!", 'Are we just standing here?', 'Press Play already!'],
  tap: ['Hehe! That tickles!', 'Easy there!', "I'm jelly, not a button!", 'Again? Okay!', 'Boing!', 'Hey you!', 'Hahaha!'],
  boing: ['Boing!', 'Again, again!', "I'm very stretchy!", 'Wheee!', 'Weee!'],
  pet: ['Mmm… that’s nice', 'I love pats!', 'A little more…', "You're so kind"],
  cool: ['Now I’m cool!', 'Combo shades!', "We're in the zone!"],
  peek: ["I can't look!", 'Tell me when it’s over…', 'Eyes closed!'],
  holdGot: ['Got it!', "I'll hold it!", 'Safe with me!', 'I’ll keep it safe!'],
  holdSwap: ['Take this, give me that!', 'Swapped!', 'Quick swap!'],
  holdGive: ['Here you go!', 'Take it!', "It's yours!"],
  holdBack: ['Back to me!', "Okay, I'll hold it a bit"],
  holdTip: ["Drag any piece to me, I'll hold it!"],
  holdLearned: ['Bravo! Now you know the secret', 'Nice! I’ll keep it till you need it'],
  holdOnlyFits: ['Take mine! It fits!', 'Wait! The piece I have fits'],
  dizzy: ["I'm dizzy! Stop!", 'Everything’s spinning…', 'Okay, okay!'],
  start: ["Let's go!", 'Focus with me!', 'Today’s our day!', 'Show me what you’ve got!'],
  again: ['This time for sure!', 'Again!', 'New round, new luck!'],
  resume: ["We're back!", 'Let’s keep going!', "I'm here!"],
  lines2: ['Nice one!', 'Lovely!', "That's it!", 'Bravo!'],
  lines3: ['Wowww!', 'So smooth!', 'Beautiful!', 'Yes!'],
  lines4: ['Impossible!', "You're a beast!", 'Legend!', 'What just happened?!'],
  combo3: ['Keep going!', "Don't stop!", 'Heating up!'],
  combo5: ["It's on fire!", "You're unstoppable!", 'Nobody beats you!'],
  combo8: ['Nobody can stop you!', "You're not human!"],
  perfect: ['Empty board!! Legendary!', 'Not one block! How?!'],
  danger: ["Uh-oh… it's tight!", 'Careful!', "We're getting squeezed!", 'Danger zone!'],
  comeback: ['Phew! We made it!', 'You saved us!', 'My heart almost stopped!', 'That was close!'],
  newBest: ['New best score!', "You beat your record! I'm proud!", "You're the king!"],
  idle: ["Take your time… I'll wait", 'Think it over', "There's a nice spot over there…"],
  wake: ["Huh? I'm awake!", "I wasn't sleeping, promise!"],
  gameOver: ['Aww… one more?', 'That was fun! Try again', 'No worries, next one’s better'],
  gameOverClose: ['So close to your best!', 'Just a tiny bit more!'],
  gameOverBest: ["New record!! You're awesome!", 'Your best game ever! Yes!'],
};

export class LineBag {
  private bags = new Map<LineKey, string[]>();
  private last = new Map<LineKey, string>();

  constructor(private readonly rng: Rng) {}

  pick(key: LineKey, vars: Record<string, string> = {}): string {
    let bag = this.bags.get(key);
    if (!bag || bag.length === 0) {
      bag = this.rng.shuffle([...(LANG === 'en' ? LINES_EN : LINES)[key]]);
      // Avoid repeating the previous line across bag refills.
      if (bag.length > 1 && bag[bag.length - 1] === this.last.get(key)) bag.unshift(bag.pop()!);
      this.bags.set(key, bag);
    }
    const line = bag.pop()!;
    this.last.set(key, line);
    return line.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  }
}
