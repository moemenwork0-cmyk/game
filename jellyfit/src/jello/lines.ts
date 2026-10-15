/**
 * Everything Jello can say, by situation. Light Egyptian dialect: Jello is a character, not the UI.
 * Lines are drawn from shuffled bags so the same line never repeats back to back.
 */
import type { Rng } from '../core/rng';

export const LINES = {
  greet: ['أهلاً يا بطل!', 'يلا نلعب؟', 'وحشتني والله!', 'جاهز؟ أنا جاهز!', 'منوّر يا كبير!'],
  greetBest: ['رقمك {best}… هنكسره النهارده؟', 'فاكر رقمك {best}؟ يلا نعدّيه!'],
  menuIdle: ['الزرار الأصفر ده مستنيك…', 'أنا زهقت… يلا نلعب!', 'هنفضل واقفين كده؟', 'دوس العب الآن بقى!'],
  tap: ['هيهي! بتزغزغ!', 'براحة عليّا!', 'أنا جيلي مش زرار!', 'تاني؟ ماشي!', 'بووينج!', 'إيه يا عم؟', 'هههه!'],
  boing: ['بووينج!', 'تاني تاني!', 'أنا مرن على فكرة!', 'هيييه!', 'وييي!'],
  pet: ['ممم… حلو كده', 'بحب الطبطبة!', 'كمان شوية…', 'إنت طيب أوي'],
  cool: ['دلوقتي بقيت كوول!', 'نضارة الكومبو!', 'إحنا في المود!'],
  peek: ['مش قادر أبص!', 'قولّي لما تخلص…', 'مغمّض عيني!'],
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

export class LineBag {
  private bags = new Map<LineKey, string[]>();
  private last = new Map<LineKey, string>();

  constructor(private readonly rng: Rng) {}

  pick(key: LineKey, vars: Record<string, string> = {}): string {
    let bag = this.bags.get(key);
    if (!bag || bag.length === 0) {
      bag = this.rng.shuffle([...LINES[key]]);
      // Avoid repeating the previous line across bag refills.
      if (bag.length > 1 && bag[bag.length - 1] === this.last.get(key)) bag.unshift(bag.pop()!);
      this.bags.set(key, bag);
    }
    const line = bag.pop()!;
    this.last.set(key, line);
    return line.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  }
}
