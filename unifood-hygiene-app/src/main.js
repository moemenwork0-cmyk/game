"use strict";
import "./fonts.css";
import "./styles.css";
import { DATA } from "./data.js";
import * as DB from "./firebase.js";
import * as N from "./native.js";

const DEPTS = DATA.depts, DK = DEPTS.map(d=>d.k), DBY = Object.fromEntries(DEPTS.map(d=>[d.k,d]));
const AREAS = DATA.areas, ABY = Object.fromEntries(AREAS.map(a=>[a.k,a]));
const P = DATA.points, PBY = Object.fromEntries(P.map(p=>[p.id,p]));
const SHIFTS = ["S1","S2","S3"];
const TARGET = 95, AMBER = 85, COVER_MIN = 80;
const KEY = "uf_hyg_v3";          // same local keys as the web version (name / language / view options)
const MAXPX = 1280, JPGQ = 0.72, THUMB = 256, MAXPH = 6;
const FREE_MB = 1024;             // free database storage
const ZONES = {
  all:{en:"All areas",ar:"كل المناطق"}, ext:{en:"External",ar:"خارجية"}, staff:{en:"Staff facilities",ar:"مرافق العاملين"},
  low:{en:"Low hygiene",ar:"نظافة منخفضة"}, med:{en:"Medium hygiene",ar:"نظافة متوسطة"}, high:{en:"High hygiene",ar:"نظافة عالية"},
  restricted:{en:"Restricted access",ar:"دخول مقيد"}, allergen:{en:"Allergen line",ar:"خط مسببات الحساسية"}
};
const T = {
  title:{en:"UNIFOOD Hygiene Score",ar:"مؤشر النظافة – يونيفود"},
  sub:{en:"F-C&S-01-04 · morning round, once a day · works offline",ar:"F-C&S-01-04 · جولة صباحية مرة يومياً · يعمل بدون إنترنت"},
  today:{en:"Daily score",ar:"نتيجة اليوم"}, inspect:{en:"Inspect",ar:"الفحص"}, trend:{en:"Trend",ar:"الاتجاه"}, send:{en:"Send",ar:"إرسال"}, guide:{en:"Guide",ar:"الدليل"},
  now:{en:"Today",ar:"اليوم"}, prodDay:{en:"Day",ar:"اليوم"}, round:{en:"Morning round",ar:"جولة الصباح"}, during:{en:"During production",ar:"أثناء التشغيل"}, time:{en:"Time",ar:"الوقت"}, progress:{en:"points checked today",ar:"بند تم فحصه اليوم"},
  facility:{en:"Facility score",ar:"نتيجة المصنع"}, target:{en:"Target",ar:"الهدف"},
  ok:{en:"OK",ar:"مطابق"}, nc:{en:"Not OK",ar:"غير مطابق"}, na:{en:"N/A",ar:"لا ينطبق"},
  coverage:{en:"Coverage",ar:"نسبة الفحص"}, checked:{en:"checked",ar:"تم فحصها"}, of:{en:"of",ar:"من"},
  shiftsRec:{en:"Shifts recorded",ar:"الورديات المسجلة"}, critical:{en:"Critical",ar:"حرج"}, criticalN:{en:"Critical ✗",ar:"بنود حرجة ✗"},
  incomplete:{en:"Incomplete",ar:"غير مكتمل"}, noData:{en:"No data",ar:"لا توجد بيانات"},
  method:{en:"Facility score = average of the 6 department scores (each department counts the same). Department score = ✓ ÷ (✓ + ✗). N/A is not counted. Target ≥ 95 %; coverage below 80 % = incomplete; any critical ✗ = critical day.",
          ar:"نتيجة المصنع = متوسط نتائج الأقسام الستة (كل قسم له نفس الوزن). نتيجة القسم = المطابق ÷ (المطابق + غير المطابق). لا ينطبق لا يحسب. الهدف ≥ 95 %؛ نسبة فحص أقل من 80 % = غير مكتمل؛ أي بند حرج غير مطابق = يوم حرج."},
  methodT:{en:"How the score is calculated",ar:"طريقة حساب النتيجة"},
  depts:{en:"Departments",ar:"الأقسام"}, map:{en:"Plant map – today's score by area",ar:"خريطة المصنع – نتيجة اليوم لكل منطقة"},
  mapNote:{en:"Schematic, not to scale (from the plant schematic in the HACCP plan Rev 24). Tap an area to open its checklist.",ar:"مخطط توضيحي وليس بمقياس رسم (من مخطط المصنع بخطة الهاسب إصدار 24). اضغط على أي منطقة لفتح بنودها."},
  open:{en:"Not-OK points to close",ar:"بنود غير مطابقة تحتاج إغلاق"}, none:{en:"Nothing recorded yet",ar:"لم يسجل شيء بعد"},
  critBanner:{en:"Critical point failed – stop / hold and inform the QA Manager now",ar:"فشل بند حرج – إيقاف / حجز وإبلاغ مدير توكيد الجودة فوراً"},
  emptyDay:{en:"Nothing recorded for this day yet. Open Inspect and mark each point during the morning round.",ar:"لم يسجل أي فحص لهذا اليوم بعد. افتح تبويب الفحص وسجل كل بند أثناء جولة الصباح."},
  showDemo:{en:"Show example data",ar:"عرض بيانات مثال"}, hideDemo:{en:"Hide example",ar:"إخفاء المثال"},
  demoNote:{en:"EXAMPLE DATA – generated to show how the page works. Not saved and not real results.",ar:"بيانات مثال – لعرض طريقة عمل الصفحة فقط، غير محفوظة وليست نتائج حقيقية."},
  shift:{en:"Shift",ar:"الوردية"}, daily:{en:"Daily",ar:"يومي"}, everyShift:{en:"Every shift",ar:"كل وردية"}, onceDay:{en:"Once a day",ar:"مرة يومياً"},
  shiftPts:{en:"shift points",ar:"بنود الوردية"}, dayPts:{en:"daily points",ar:"البنود اليومية"},
  allAreas:{en:"All areas",ar:"كل المناطق"}, allDepts:{en:"All departments",ar:"كل الأقسام"}, onlyOpen:{en:"Not checked only",ar:"غير المفحوص فقط"},
  search:{en:"Search points…",ar:"بحث في البنود…"}, naRest:{en:"Line / area not running today → N/A for its production points",ar:"الخط / المنطقة لا تعمل اليوم ← لا ينطبق لبنود التشغيل"},
  action:{en:"Corrective action taken / reported to…",ar:"الإجراء التصحيحي المتخذ / تم الإبلاغ إلى…"},
  saved:{en:"Saved",ar:"تم الحفظ"}, saveErr:{en:"Not saved – try again",ar:"لم يتم الحفظ – حاول مرة أخرى"},
  nostore:{en:"The database could not be opened on this phone – restart the app.",ar:"تعذر فتح قاعدة البيانات على الهاتف – أعد تشغيل التطبيق."},
  noMatch:{en:"No points match the filters.",ar:"لا توجد بنود مطابقة للفلاتر."},
  last30:{en:"Facility score – last 30 days",ar:"نتيجة المصنع – آخر 30 يوم"},
  heatD:{en:"Department score by day",ar:"نتيجة الأقسام يومياً"}, heatA:{en:"Area score by day",ar:"نتيجة المناطق يومياً"},
  avg30:{en:"30-day",ar:"30 يوم"}, recurring:{en:"Most frequent Not-OK points (30 days)",ar:"أكثر البنود غير المطابقة تكراراً (30 يوم)"},
  times:{en:"times",ar:"مرة"}, point:{en:"Point",ar:"البند"}, dept:{en:"Department",ar:"القسم"}, area:{en:"Area",ar:"المنطقة"},
  inspector:{en:"Inspector name",ar:"اسم القائم بالفحص"}, namePh:{en:"Your name",ar:"اسمك"},
  sendHelp:{en:"Results and photos are shared automatically: every phone with the app sees the same data. Without internet everything is kept on the phone and uploaded when the connection returns. After the morning round send the WhatsApp summary, then the NC report with photos.",
            ar:"النتائج والصور تتشارك تلقائياً: كل الهواتف اللي عليها التطبيق بتشوف نفس البيانات. بدون إنترنت يتحفظ كل شيء على الهاتف ويترفع لوحده لما النت يرجع. بعد جولة الصباح أرسل ملخص واتساب ثم تقرير عدم المطابقة بالصور."},
  waTitle:{en:"Daily summary (WhatsApp)",ar:"ملخص اليوم (واتساب)"}, waBtn:{en:"Send on WhatsApp",ar:"إرسال على واتساب"}, copyBtn:{en:"Copy summary",ar:"نسخ الملخص"},
  copied:{en:"Copied",ar:"تم النسخ"}, copyFail:{en:"Copy not allowed – use the WhatsApp button",ar:"النسخ غير متاح – استخدم زر واتساب"},
  fileTitle:{en:"Data file / backup",ar:"ملف البيانات / نسخة احتياطية"}, fileHelp:{en:"A copy of the data to keep or send (WhatsApp / email). The day file carries the day's photos; the full backup carries the records only. All phones already share the data automatically.",ar:"نسخة من البيانات للاحتفاظ بها أو إرسالها (واتساب / بريد). ملف اليوم يحمل صور اليوم، والنسخة الكاملة تحمل السجلات فقط. كل الهواتف تتشارك البيانات تلقائياً."},
  dayBtn:{en:"Day file",ar:"ملف اليوم"}, allBtn:{en:"Full backup (records)",ar:"نسخة كاملة (السجلات)"},
  csvTitle:{en:"Excel export",ar:"تصدير إلى Excel"}, csvHelp:{en:"All records as CSV (opens in Excel) for monthly KPI reports.",ar:"كل السجلات بصيغة CSV تفتح في Excel لتقارير المؤشرات الشهرية."}, csvBtn:{en:"Download CSV",ar:"تحميل CSV"},
  impTitle:{en:"Import files",ar:"استيراد الملفات"}, impHelp:{en:"Choose day files or backups (also the files saved by the old web page). They are added to the shared data; the newest entry for each point is kept.",ar:"اختر ملفات الأيام أو النسخ الاحتياطية (ومنها ملفات صفحة الويب القديمة). تضاف للبيانات المشتركة، ويتم الاحتفاظ بأحدث تسجيل لكل بند."}, impBtn:{en:"Choose files…",ar:"اختر الملفات…"},
  imported:{en:"Points merged",ar:"بنود تم دمجها"}, badFiles:{en:"unreadable files",ar:"ملفات غير صالحة"},
  clearTitle:{en:"Database storage",ar:"مساحة قاعدة البيانات"}, clearHelp:{en:"Deleting here deletes for ALL phones. Send the day files and a full backup before deleting anything.",ar:"الحذف هنا يحذف من كل الهواتف. أرسل ملفات الأيام ونسخة كاملة قبل حذف أي شيء."},
  clearBtn:{en:"Delete all records and photos…",ar:"حذف كل السجلات والصور…"}, clearSure:{en:"Yes, delete everything",ar:"نعم، احذف الكل"}, cancel:{en:"Cancel",ar:"إلغاء"}, cleared:{en:"All records and photos deleted",ar:"تم حذف كل السجلات والصور"},
  clearType:{en:"This deletes every record and photo on ALL phones. Type DELETE to confirm:",ar:"سيتم حذف كل السجلات والصور من كل الهواتف. اكتب كلمة حذف للتأكيد:"}, clearWord:{en:"DELETE",ar:"حذف"},
  pts:{en:"points",ar:"بند"}, more:{en:"more",ar:"أخرى"},
  status:{en:"Status",ar:"الحالة"}, onTarget:{en:"On target",ar:"ضمن الهدف"}, watch:{en:"Watch",ar:"تحت المتابعة"}, below:{en:"Below target",ar:"أقل من الهدف"},
  howTo:{en:"How to check",ar:"كيف تقيّم"}, showHow:{en:"Show how to check",ar:"إظهار طريقة التقييم"},
  photo:{en:"Photo",ar:"صورة"}, photos:{en:"Photos",ar:"الصور"}, camera:{en:"Camera",ar:"الكاميرا"}, gallery:{en:"Gallery",ar:"المعرض"},
  photoSaving:{en:"Saving photo…",ar:"جاري حفظ الصورة…"}, photoErr:{en:"A photo could not be read – try the camera",ar:"تعذرت قراءة صورة – جرّب الكاميرا"},
  photoMax:{en:"Max 6 photos per point",ar:"الحد الأقصى 6 صور للبند"},
  photoOff:{en:"Photos can't be saved right now",ar:"لا يمكن حفظ الصور الآن"},
  photoReload:{en:"The app reloaded – if the photo you just took is not shown, add it again.",ar:"تمت إعادة تحميل التطبيق – إذا لم تظهر الصورة التي التقطتها أضفها مرة أخرى."},
  share:{en:"Share",ar:"مشاركة"}, del:{en:"Delete",ar:"حذف"}, close:{en:"Close",ar:"إغلاق"}, prev:{en:"Previous",ar:"السابق"}, next:{en:"Next",ar:"التالي"},
  delSure:{en:"Delete this photo?",ar:"حذف هذه الصورة؟"}, yesDel:{en:"Yes, delete",ar:"نعم، احذف"},
  reportTitle:{en:"NC report with photos",ar:"تقرير عدم المطابقة بالصور"},
  reportHelp:{en:"One file with the day's score, every ✗ point, its action and its photos. Opens in any browser and can be printed as PDF.",ar:"ملف واحد فيه نتيجة اليوم وكل بند ✗ والإجراء وصوره. يفتح في أي متصفح ويمكن طباعته PDF."},
  reportBtn:{en:"NC report",ar:"تقرير عدم المطابقة"}, sharePhotos:{en:"Share the day's photos",ar:"مشاركة صور اليوم"},
  noPhotos:{en:"No photos for this day",ar:"لا توجد صور لهذا اليوم"}, preparing:{en:"Preparing…",ar:"جاري التجهيز…"},
  photosAdded:{en:"Photos added",ar:"صور تمت إضافتها"}, photosOnPhone:{en:"Photos in the database",ar:"الصور في قاعدة البيانات"}, used:{en:"space used",ar:"المساحة المستخدمة"},
  pruneBtn:{en:"Delete photos older than 30 days…",ar:"حذف الصور الأقدم من 30 يوم…"}, pruneSure:{en:"Yes, delete old photos",ar:"نعم، احذف الصور القديمة"}, pruned:{en:"Photos deleted",ar:"صور تم حذفها"},
  otherPhotos:{en:"Photos on points that are no longer ✗",ar:"صور لبنود لم تعد غير مطابقة"},
  generated:{en:"Generated",ar:"تاريخ الإنشاء"}, action2:{en:"Action",ar:"الإجراء"},
  allShort:{en:"All",ar:"الكل"}, areasRoute:{en:"Areas in round order",ar:"المناطق بترتيب الجولة"},
  areaDone:{en:"Area finished – go to the next one.",ar:"تم فحص المنطقة – انتقل للمنطقة التالية."},
  roundDone:{en:"Round complete – send the results.",ar:"اكتملت الجولة – أرسل النتائج."}, goSend:{en:"Send",ar:"إرسال"},
  showRefs:{en:"Show references",ar:"إظهار المراجع"},
  wasNcY:{en:"was ✗ yesterday",ar:"كان ✗ أمس"}, yesterday:{en:"Yesterday",ar:"أمس"},
  yList:{en:"✗ yesterday",ar:"بنود ✗ أمس"}, noneY:{en:"none",ar:"لا يوجد"},
  filters:{en:"Filters",ar:"الفلاتر"}, done:{en:"Done",ar:"تم"}, reset:{en:"Reset",ar:"مسح الفلاتر"},
  synced:{en:"Synced",ar:"متزامن"}, syncing:{en:"Uploading…",ar:"جاري الرفع…"}, offline:{en:"Offline",ar:"بدون نت"}, syncErr:{en:"Sync error",ar:"خطأ مزامنة"},
  syncHelpOk:{en:"All data is uploaded – every phone sees the same results.",ar:"كل البيانات مرفوعة – كل الهواتف تشوف نفس النتائج."},
  syncHelpBusy:{en:"Changes are being uploaded to the other phones…",ar:"جاري رفع التعديلات لباقي الهواتف…"},
  syncHelpOff:{en:"No internet. Keep working – everything is saved on this phone and uploads on its own when the connection returns.",ar:"مفيش إنترنت. كمّل شغلك عادي – كل حاجة محفوظة على الهاتف وهتترفع لوحدها لما النت يرجع."},
  syncHelpErr:{en:"The last change could not be uploaded. Check the internet and try again.",ar:"تعذر رفع آخر تعديل. تأكد من الإنترنت وحاول مرة أخرى."},
  loading:{en:"Loading data…",ar:"جاري تحميل البيانات…"}, zoomIn:{en:"Zoom in",ar:"تكبير"}, zoomOut:{en:"Zoom out",ar:"تصغير"},
  by:{en:"by",ar:"بواسطة"}, prevDay:{en:"Previous day",ar:"اليوم السابق"}, nextDay:{en:"Next day",ar:"اليوم التالي"},
  nameNeeded:{en:"Write your name in the Send tab so your checks carry it.",ar:"اكتب اسمك في تبويب إرسال عشان يتسجل على الفحص."}
};
const QN={ar:["تم التنظيف فوراً","أبلغت مشرف القسم","أبلغت الصيانة","أبلغت فريق النظافة","أبلغت مدير الجودة","تم حجز المنتج / إيقاف الخط"],
          en:["Cleaned on the spot","Section supervisor informed","Maintenance informed","Hygiene team informed","QA Manager informed","Product held / line stopped"]};
let S = { lang:"ar", view:"today", date:"", shift:"S1", docs:new Map(), demo:false, name:"", areaF:"", deptF:"", onlyOpen:false, q:"", storageOff:false, status:"",
          how:true, refs:false, pickAll:false, photoOff:false, ready:false, lastPt:"", restorePt:"", zoom:(typeof window!=="undefined"&&window.innerWidth<600)?2:1 };
const LS = {
  get(k,d){ try{ const v=localStorage.getItem(KEY+k); return v==null?d:v; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(KEY+k,v); }catch(e){} },
  del(k){ try{ localStorage.removeItem(KEY+k); }catch(e){} }
};
S.lang = LS.get("_lang","ar");

/* ---------- helpers ---------- */
function tr(k){ return (T[k]||{})[S.lang] ?? k }
function L(o){ return o ? (o[S.lang] ?? o.en) : "" }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])) }
function ymd(d){ const z=n=>String(n).padStart(2,"0"); return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate()) }
function addDays(s,n){ const d=new Date(s+"T12:00:00"); d.setDate(d.getDate()+n); return ymd(d) }
function prodNow(){ return {date:ymd(new Date()), shift:"D"}; }
function hhmm(iso){ if(!iso) return ""; const d=new Date(iso); if(isNaN(d)) return ""; return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0") }
function fmt(p){ if(p==null) return "—"; const r=Math.round(p*10)/10; return (r%1===0? r.toFixed(0) : r.toFixed(1)) }
function cls(p,crit){ if(crit) return "s-crit"; return p==null?"s-none":p>=TARGET?"s-good":p>=AMBER?"s-warn":"s-bad" }
function dayLabel(date){
  try{ const d=new Date(date+"T12:00:00"), loc=S.lang==="ar"?"ar-EG-u-nu-latn":"en-GB";
    const dm=d.toLocaleDateString(loc,{day:"numeric",month:"long"});
    if(date===prodNow().date) return tr("now")+" · "+dm;
    return d.toLocaleDateString(loc,{weekday:"short"})+" · "+dm; }catch(e){ return date; }
}
const ICON = {
  today:`<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 12l5-5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>`,
  inspect:`<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M8.5 12.5l2.2 2.2 4.8-4.8"/></svg>`,
  trend:`<svg viewBox="0 0 24 24"><path d="M3 20h18"/><path d="M4 16l5-5 4 3 7-8"/></svg>`,
  send:`<svg viewBox="0 0 24 24"><path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/></svg>`,
  guide:`<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M8 7h7"/></svg>`,
  filter:`<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>`,
  search:`<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>`,
  cam:`<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
  gal:`<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>`,
  chev:`<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>`,
  cal:`<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>`,
  wa:`<svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z" fill="currentColor" stroke="none"/></svg>`
};

/* ---------- data: shared Firestore records ---------- */
function src(){ return S.demo ? DEMO : S.docs }
function setSave(st){
  S.status=st; const el=document.getElementById("saveState");
  if(el){ el.textContent = st==="err"?tr("saveErr"):"✓ "+tr("saved"); el.className="saving "+(st==="err"?"s-bad":""); }
}
function docKey(date,p,shift){ return date+"_"+(p.f==="D"?"D":shift) }
function blankDoc(date,sh){ return {date,shift:sh,marks:{},notes:{},at:{},who:{},nat:{}} }
function cloneDoc(d){ return {...d,marks:{...d.marks},notes:{...(d.notes||{})},at:{...(d.at||{})},who:{...(d.who||{})},nat:{...(d.nat||{})}} }
function normDoc(d,k){ const [date,shift]=k.split("_"); return {date:d.date||date, shift:d.shift||shift, marks:d.marks||{}, notes:d.notes||{}, at:d.at||{}, who:d.who||{}, nat:d.nat||{}} }
function canon(v){ return v && typeof v==="object" ? "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canon(v[k])).join(",")+"}" : JSON.stringify(v??null) }
function markOf(date,shift,p){ const d=src().get(docKey(date,p,shift)); return d ? d.marks[p.id] : undefined }
function docOf(date,shift,p){ return src().get(docKey(date,p,shift)) }
function save(k,fields){
  setSave("saved");
  DB.writeDoc(k,fields).catch(()=>setSave("err"));
}
function setMark(p,v){
  if(S.demo) return;
  const k=docKey(S.date,p,S.shift), sh=p.f==="D"?"D":S.shift;
  const d=cloneDoc(S.docs.get(k)||blankDoc(S.date,sh)), at=new Date().toISOString();
  d.marks[p.id]=v; d.at[p.id]=at; d.who[p.id]=S.name||"";
  S.docs.set(k,d);
  save(k,{date:S.date,shift:sh,marks:{[p.id]:v},at:{[p.id]:at},who:{[p.id]:S.name||""}});
}
const noteTimers=new Map();
function setNote(p,text,now){
  if(S.demo) return;
  const k=docKey(S.date,p,S.shift), sh=p.f==="D"?"D":S.shift, date=S.date;
  const d=cloneDoc(S.docs.get(k)||blankDoc(S.date,sh)), at=new Date().toISOString();
  d.notes[p.id]=text; d.nat[p.id]=at;
  S.docs.set(k,d);
  clearTimeout(noteTimers.get(p.id));
  const go=()=>{ noteTimers.delete(p.id); save(k,{date,shift:sh,notes:{[p.id]:text},nat:{[p.id]:at}}); };
  if(now) go(); else noteTimers.set(p.id,setTimeout(go,700));   // typing: upload after a short pause
}
function flushNotes(){ for(const [id,t] of [...noteTimers]){ clearTimeout(t); noteTimers.delete(id); const ta=document.getElementById("n_"+id); if(ta) setNote(PBY[id],ta.value,true); } }
function mergeDocs(list){
  let n=0; const changed=new Map();
  for(const inc of list){
    if(!inc || !inc.date || !inc.shift || !inc.marks || typeof inc.marks!=="object") continue;
    const k=inc.date+"_"+inc.shift; const cur=changed.get(k)||S.docs.get(k); const out=cloneDoc(cur||blankDoc(inc.date,inc.shift)); let ch=false;
    for(const [id,v] of Object.entries(inc.marks)){
      if(!PBY[id]) continue;
      const ta=(inc.at||{})[id]||"", tb=(out.at||{})[id]||"";
      if(!(id in out.marks) || ta>tb){ out.marks[id]=v; out.at[id]=ta; out.who[id]=(inc.who||{})[id]||""; n++; ch=true; }
    }
    for(const [id,txt] of Object.entries(inc.notes||{})){
      if(!PBY[id]) continue;
      const ta=(inc.nat||{})[id]||"", tb=(out.nat||{})[id]||"";
      if(!(id in out.notes) || ta>tb){ out.notes[id]=String(txt??""); out.nat[id]=ta; ch=true; }
    }
    if(ch){ S.docs.set(k,out); changed.set(k,out); }
  }
  for(const [k,d] of changed) save(k,{date:d.date,shift:d.shift,marks:d.marks,notes:d.notes,at:d.at,who:d.who,nat:d.nat});
  return n;
}

/* ---------- photos (shared) ---------- */
const PH={byDate:new Map(), subs:new Map(), local:new Map()};
function phIndexSet(date,list){
  const dm=new Map();
  const all=[...list, ...[...PH.local.values()].filter(m=>m.date===date && !list.some(x=>x.id===m.id))];
  for(const m of all){ if(!PBY[m.point]) continue; const a=dm.get(m.point)||[]; a.push(m); dm.set(m.point,a); }
  for(const a of dm.values()) a.sort((x,y)=>String(x.at).localeCompare(String(y.at)));
  PH.byDate.set(date,dm);
}
function phIndexAdd(m){
  PH.local.set(m.id,m);
  const dm=PH.byDate.get(m.date); if(!dm) return;
  const a=dm.get(m.point)||[]; if(!a.some(x=>x.id===m.id)) a.push(m);
  a.sort((x,y)=>String(x.at).localeCompare(String(y.at))); dm.set(m.point,a);
}
function phIndexDel(id){
  PH.local.delete(id);
  for(const dm of PH.byDate.values()) for(const [pt,a] of dm){ const i=a.findIndex(x=>x.id===id);
    if(i>=0){ const [m]=a.splice(i,1); if(!a.length) dm.delete(pt); return m; } }
}
function photosOf(date,pid){ if(S.demo) return []; const dm=PH.byDate.get(date); return dm ? (dm.get(pid)||[]) : [] }
function photosDay(date){ if(S.demo) return []; const dm=PH.byDate.get(date); return dm ? [...dm.values()].flat().filter(m=>PBY[m.point]) : [] }
function ensurePhotos(date){
  if(PH.subs.has(date)) return PH.subs.get(date).ready;
  let res; const ready=new Promise(r=>res=r);
  const unsub=DB.listenPhotosOfDay(date,list=>{
    if(list) phIndexSet(date,list); else if(!PH.byDate.has(date)) PH.byDate.set(date,new Map());
    res();
    if(date===S.date && S.ready && !S.demo) softRender();
  });
  PH.subs.set(date,{unsub,ready});
  // keep only a few days listened to
  if(PH.subs.size>6){ for(const [d,s] of PH.subs){ if(d!==date && d!==S.date){ s.unsub(); PH.subs.delete(d); PH.byDate.delete(d); break; } } }
  return ready;
}
function dataToBlob(dataURL){
  const i=dataURL.indexOf(","), head=dataURL.slice(0,i), type=(head.match(/^data:([^;,]+)/)||[])[1]||"image/jpeg";
  const bin=atob(dataURL.slice(i+1)), u=new Uint8Array(bin.length); for(let j=0;j<bin.length;j++) u[j]=bin.charCodeAt(j);
  return new Blob([u],{type});
}
function blobToData(b){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>rej(fr.error); fr.readAsDataURL(b); }) }
function turl(m){ return m.thumb }
const getFull=id=>DB.getFullPhoto(id);
function loadImg(blob){
  return new Promise((res,rej)=>{ const u=URL.createObjectURL(blob), im=new Image();
    im.onload=()=>res({im,u}); im.onerror=()=>{ URL.revokeObjectURL(u); rej(new Error("decode")); }; im.src=u; });
}
function fitText(g,t,max){
  if(g.measureText(t).width<=max) return t;
  let lo=0,hi=t.length; while(lo<hi){ const m=(lo+hi+1)>>1; if(g.measureText(t.slice(0,m)+"…").width<=max) lo=m; else hi=m-1; }
  return t.slice(0,lo)+"…";
}
function stampPhoto(g,w,h,p,atIso){
  const fs=Math.max(12,Math.round(Math.min(w,h)/30)), pad=Math.round(fs*.5), lh=Math.round(fs*1.35), bh=pad*2+lh*2;
  const fam='"Cairo","Segoe UI","Noto Sans Arabic",Roboto,Tahoma,sans-serif';
  g.fillStyle="rgba(0,0,0,.6)"; g.fillRect(0,h-bh,w,bh); g.fillStyle="#fff"; g.textBaseline="middle";
  const day=ymd(new Date(atIso));   // real capture date; the round date is added only if it differs
  g.font=`700 ${fs}px ${fam}`; g.direction="ltr"; g.textAlign="left";
  g.fillText(fitText(g,`UNIFOOD · ${p.id} · ${day} ${hhmm(atIso)}${S.date!==day?` [${S.date}]`:""}${S.name?" · "+S.name:""}`,w-2*pad),pad,h-bh+pad+lh/2);
  const ar=S.lang==="ar"; g.font=`400 ${Math.round(fs*.92)}px ${fam}`; g.direction=ar?"rtl":"ltr"; g.textAlign=ar?"right":"left";
  g.fillText(fitText(g,L(p),w-2*pad),ar?w-pad:pad,h-bh+pad+lh*1.5);
}
function canvasBlob(c){ return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("encode")),"image/jpeg",JPGQ)) }
function thumbOf(srcEl,w,h){
  const s=Math.min(1,THUMB/Math.max(w,h)), t=document.createElement("canvas");
  t.width=Math.max(1,Math.round(w*s)); t.height=Math.max(1,Math.round(h*s));
  t.getContext("2d").drawImage(srcEl,0,0,t.width,t.height);
  return t.toDataURL("image/jpeg",0.6);
}
async function compress(file,p,atIso){
  const {im,u}=await loadImg(file);
  try{
    let w=im.naturalWidth, h=im.naturalHeight; if(!w||!h) throw new Error("size");
    const s=Math.min(1,MAXPX/Math.max(w,h)); w=Math.max(1,Math.round(w*s)); h=Math.max(1,Math.round(h*s));
    const c=document.createElement("canvas"); c.width=w; c.height=h; const g=c.getContext("2d");
    g.fillStyle="#fff"; g.fillRect(0,0,w,h); g.drawImage(im,0,0,w,h);
    const thumb=thumbOf(c,w,h);
    stampPhoto(g,w,h,p,atIso);
    const full=await canvasBlob(c); c.width=c.height=0;
    return {full,thumb,w,h};
  } finally { URL.revokeObjectURL(u); }
}
async function makeThumb(blob){ const {im,u}=await loadImg(blob); try{ return thumbOf(im,im.naturalWidth,im.naturalHeight); } finally { URL.revokeObjectURL(u); } }
async function addPhotos(pid,files,input){
  const p=PBY[pid]; const say=t=>{ const el=document.getElementById("pm_"+pid); if(el) el.textContent=t; };
  if(S.demo){ say(tr("photoOff")); return; }
  await ensurePhotos(S.date);
  let added=0,bad=0,full=false;
  for(const f of files){
    if(photosOf(S.date,pid).length>=MAXPH){ full=true; break; }
    say(tr("photoSaving"));
    try{
      const at=new Date().toISOString(), r=await compress(f,p,at);
      const id=`${S.date}_${pid}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
      const meta={id,date:S.date,point:pid,at,who:S.name||"",w:r.w,h:r.h,size:r.full.size,thumb:r.thumb};
      await DB.putPhoto(meta,r.full);
      if(!PH.byDate.has(meta.date)) PH.byDate.set(meta.date,new Map());
      phIndexAdd(meta); added++;
    }catch(e){ console.error(e); bad++; }
  }
  if(input) try{ input.value=""; }catch(e){}
  S.lastPt=""; saveUI(true);
  render(true);
  say([bad?tr("photoErr"):"", full?tr("photoMax"):""].filter(Boolean).join(" · "));
}
async function importPhotos(list){
  if(!Array.isArray(list)) return 0; let n=0;
  for(const x of list){
    try{
      if(!x || typeof x.id!=="string" || !/^\d{4}-\d{2}-\d{2}_[A-Za-z0-9-]+_[a-z0-9]+$/.test(x.id)) continue;
      const [date,point]=x.id.split("_"); if(!PBY[point] || typeof x.data!=="string" || !x.data.startsWith("data:image/")) continue;
      if(await DB.photoExists(x.id)) continue;
      const blob=dataToBlob(x.data);
      const thumb=(typeof x.thumb==="string" && x.thumb.startsWith("data:image/")) ? x.thumb : await makeThumb(blob);
      const meta={id:x.id,date,point,at:String(x.at||""),who:String(x.who||""),w:+x.w||0,h:+x.h||0,size:blob.size,thumb};
      await DB.putPhoto(meta,blob); phIndexAdd(meta); n++;
    }catch(e){}
  }
  return n;
}
async function pruneOld(days){
  const cut=addDays(ymd(new Date()),-days);
  const ids=(await DB.photoMetasBefore(cut)).map(m=>m.id);
  if(ids.length){ await DB.deletePhotos(ids); ids.forEach(phIndexDel); }
  return ids.length;
}
async function photoCounts(){
  const cnt={};
  try{ for(const m of await DB.allPhotoMetas()){ const k=m.date+"_"+m.point; cnt[k]=(cnt[k]||0)+1; } }catch(e){}
  return cnt;
}
/* keep the place on the page if Android restarts the app while the camera is open */
function saveUI(clear){
  if(clear){ LS.del("_ui"); return; }
  LS.set("_ui",JSON.stringify({t:Date.now(),date:S.date,areaF:S.areaF,deptF:S.deptF,onlyOpen:S.onlyOpen,q:S.q,pt:S.lastPt}));
}
function restoreUI(){
  try{ const o=JSON.parse(LS.get("_ui","null")); LS.del("_ui");
    if(!o || Date.now()-o.t>20*60*1000 || !o.pt || !PBY[o.pt]) return;
    S.date=o.date||S.date; S.areaF=o.areaF||""; S.deptF=o.deptF||""; S.onlyOpen=!!o.onlyOpen; S.q=o.q||""; S.restorePt=o.pt; }catch(e){}
}

/* ---------- scoring (unchanged) ---------- */
function activeShifts(date){
  const m=src(), act=[];
  for(const sh of SHIFTS){ const d=m.get(date+"_"+sh); if(d && Object.entries(d.marks||{}).some(([id,v])=>v && PBY[id] && PBY[id].f==="S")) act.push(sh); }
  return act;
}
function stats(date,pred,onlyShift){
  let ok=0,nc=0,na=0; const crit=[], ncList=[]; const m=src();
  const keys = onlyShift ? [onlyShift] : [...SHIFTS,"D"];
  for(const sh of keys){
    const d=m.get(date+"_"+sh); if(!d) continue;
    for(const [id,v] of Object.entries(d.marks||{})){
      const p=PBY[id]; if(!p || !v) continue; if(pred && !pred(p)) continue;
      if(v==="ok") ok++;
      else if(v==="nc"){ nc++; ncList.push({p,sh,note:(d.notes||{})[id]||"",at:(d.at||{})[id]||"",who:(d.who||{})[id]||""}); if(p.c) crit.push({p,sh}); }
      else if(v==="na") na++;
    }
  }
  const pool=P.filter(p=>!pred||pred(p));
  const nAct=Math.max(1,activeShifts(date).length);
  const expected = onlyShift ? pool.filter(p=>p.f===(onlyShift==="D"?"D":"S")).length : pool.filter(p=>p.f==="S").length*nAct + pool.filter(p=>p.f==="D").length;
  const done=ok+nc+na;
  return { ok,nc,na,done,expected, pct: ok+nc ? ok/(ok+nc)*100 : null, cov: expected? Math.min(100,done/expected*100) : null, crit, ncList };
}
function deptStats(date,k){ return stats(date,p=>p.d===k) }
function facility(date){
  const all=stats(date); const per=DK.map(k=>deptStats(date,k)); const vals=per.map(s=>s.pct).filter(v=>v!=null);
  const pct = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  return {...all, pct, per};
}

/* ---------- example data (never saved) ---------- */
const DEMO=new Map();
function buildDemo(){
  DEMO.clear(); let seed=11; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const weakA={Z02:.10,Z07:.08,Z09:.09,Z14:.07,Z15:.08}, weakD={MNT:.06,ADM:.04};
  const today=prodNow().date;
  for(let i=29;i>=0;i--){
    const date=addDays(today,-i), better=i<12?0.7:1.15;
    for(const sh of [...SHIFTS,"D"]){
      const d=blankDoc(date,sh);
      for(const p of P){
        if((sh==="D")!==(p.f==="D")) continue;
        if(rnd()<0.04) continue; // not checked
        const base=((weakA[p.a]||0.025)+(weakD[p.d]||0))*better*(p.c?0.08:1);
        const r=rnd(); const v= r<base ? "nc" : (r>0.985 ? "na" : "ok");
        d.marks[p.id]=v; d.at[p.id]=date+"T"+(sh==="S2"?"18":sh==="S3"?"02":"10")+":15:00"; d.who[p.id]="Example";
        if(v==="nc") d.notes[p.id]= S.lang==="ar" ? "تم الإبلاغ وإعادة التنظيف" : "Reported and re-cleaned";
      }
      DEMO.set(date+"_"+sh,d);
    }
  }
}

/* ---------- plant map (schematic) ---------- */
const MAP=[
 ["Z01",20,20,90,60,{en:"Security & gate",ar:"الأمن والبوابة"}],["Z06",115,20,90,60,{en:"Raw lab",ar:"معمل الخام"}],
 ["Z05",20,110,130,85,{en:"Mosque",ar:"المسجد"}],["Z01",20,220,130,70,{en:"Truck scale",ar:"الباسكول"}],
 ["Z15",20,320,130,80,{en:"Water tank",ar:"خزان المياه"}],["Z15",20,550,150,70,{en:"Workshop",ar:"الورشة"}],
 ["Z13",250,50,230,100,{en:"Packaging store",ar:"مخزن التغليف"}],["Z15",490,50,160,110,{en:"Boilers & air",ar:"الغلايات والهواء"}],
 ["Z12",660,50,190,140,{en:"Line 2 (V.A.)",ar:"خط 2 (القيمة المضافة)"}],["Z05",860,50,100,90,{en:"Cafeteria",ar:"الكافتيريا"}],
 ["Z04",860,145,100,38,{en:"WC",ar:"دورات المياه"}],["Z13",860,190,100,95,{en:"Batter stores",ar:"مخازن البتر"}],
 ["Z14",240,170,32,110,{en:"Docks",ar:"الأرصفة"}],["Z13",290,245,90,50,{en:"Spare parts",ar:"قطع الغيار"}],
 ["Z15",390,245,100,50,{en:"Ammonia",ar:"الأمونيا"}],["Z14",600,180,150,110,{en:"Final product store",ar:"ثلاجة المنتج النهائي"}],
 ["Z14",250,320,220,150,{en:"Stores 4–5",ar:"الثلاجات 4–5"}],["Z03",760,300,200,38,{en:"Hygiene room & lockers",ar:"الهايجين والدواليب"}],
 ["Z10",480,345,200,95,{en:"Cooling, freezing & packing",ar:"التبريد والتجميد والتعبئة"}],["Z16",690,345,62,40,{en:"QC lab",ar:"المعمل"}],
 ["Z09",760,345,200,95,{en:"Drying, batter & frying",ar:"التجفيف والبتر والقلي"}],["Z08",600,448,288,32,{en:"Cutting & blanching",ar:"التقطيع والسلق"}],
 ["Z11",895,448,65,32,{en:"Batter",ar:"البتر"}],["Z07",380,488,580,32,{en:"Feeding & peeling",ar:"التغذية والتقشير"}],
 ["Z15",250,478,120,40,{en:"Veg hall (idle)",ar:"صالة الخضار"}],["Z02",560,528,120,24,{en:"Waste 1",ar:"نفايات 1"}],
 ["Z02",470,562,190,85,{en:"Waste 2",ar:"نفايات 2"}],["Z06",700,562,220,85,{en:"Raw stores 1–6",ar:"عنابر الخام 1–6"}],
 ["Z15",935,562,55,70,{en:"Elec.",ar:"كهرباء"}],["Z15",930,4,62,30,{en:"Gas",ar:"غاز"}]
];
function mapSvg(date){
  const sc={}; for(const a of AREAS){ const s=stats(date,p=>p.a===a.k); sc[a.k]=s; }
  let g=`<rect x="240" y="40" width="730" height="485" fill="none" stroke="var(--line)" stroke-dasharray="6 5" stroke-width="2"/>`;
  for(const [k,x,y,w,h,lab] of MAP){
    const s=sc[k], c=cls(s.pct,s.crit.length);
    const fill = c==="s-good"?"var(--good-bg)":c==="s-warn"?"var(--warn-bg)":(c==="s-bad"||c==="s-crit")?"var(--bad-bg)":"var(--sunk)";
    const stroke = c==="s-good"?"var(--good)":c==="s-warn"?"var(--warn)":(c==="s-bad"||c==="s-crit")?"var(--bad)":"var(--line)";
    const name=L(lab), score=s.pct==null?"":fmt(s.pct)+"%"+(s.crit.length?" !":"");
    const cx=x+w/2, cy=y+h/2;
    let txt;
    if(w<45){ txt=`<text x="${cx}" y="${cy}" text-anchor="middle" transform="rotate(-90 ${cx} ${cy})" dominant-baseline="middle">${esc(name)}</text>`; }
    else if(h<36){ txt = w>=150 ? `<text x="${x+10}" y="${cy+4}" text-anchor="start">${esc(name)}</text>${score?`<text class="sc" x="${x+w-10}" y="${cy+4}" text-anchor="end" style="direction:ltr">${esc(score)}</text>`:""}` : `<text x="${cx}" y="${cy+4}" text-anchor="middle">${esc(name)}</text>`; }
    else { txt=`<text x="${cx}" y="${cy-2}" text-anchor="middle">${esc(name)}</text>${score?`<text class="sc" x="${cx}" y="${cy+14}" text-anchor="middle" style="direction:ltr">${esc(score)}</text>`:""}`; }
    g+=`<g class="zone" data-area="${k}" role="button" tabindex="0" aria-label="${esc(L(ABY[k]))}"><title>${esc(L(ABY[k]))}${score?" – "+score:""}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}"/>${txt}</g>`;
  }
  return `<div class="mapwrap" id="mapwrap"><svg viewBox="0 0 1000 655" role="img" aria-label="${esc(tr("map"))}" style="direction:ltr;width:${S.zoom*100}%">${g}</svg></div>`;
}

/* ---------- views ---------- */
function gauge(p,crit){
  const r=62,c=2*Math.PI*r,f=p==null?0:Math.max(0,Math.min(100,p))/100;
  return `<div class="gauge ${cls(p,crit)}"><svg viewBox="0 0 150 150" aria-hidden="true">
    <circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--sunk)" stroke-width="13"/>
    <circle cx="75" cy="75" r="${r}" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(c*f).toFixed(1)} ${c.toFixed(1)}" ${f?"":'stroke-opacity="0"'} transform="rotate(-90 75 75)"/></svg>
    <div class="val"><b class="num">${fmt(p)}${p==null?"":"%"}</b><span>${tr("target")} ≥ ${TARGET}%</span></div></div>`;
}
function statusPill(s,crit){
  if(crit) return `<span class="pill s-crit">${tr("critical")}</span>`;
  if(s.pct==null) return `<span class="pill s-none">${tr("noData")}</span>`;
  return `<span class="pill ${cls(s.pct)}">${fmt(s.pct)}%</span>`;
}
function dayStatus(F){
  if(F.crit.length) return `<span class="pill s-crit">${tr("critical")}</span>`;
  if(F.pct==null) return `<span class="pill s-none">${tr("noData")}</span>`;
  if(F.cov!=null && F.cov<COVER_MIN) return `<span class="pill inc">${tr("incomplete")}</span>`;
  return F.pct>=TARGET?`<span class="pill s-good">${tr("onTarget")}</span>`:F.pct>=AMBER?`<span class="pill s-warn">${tr("watch")}</span>`:`<span class="pill s-bad">${tr("below")}</span>`;
}
function roundInfo(date){
  const d=src().get(date+"_D"); if(!d) return "—";
  const ts=Object.entries(d.at||{}).filter(([id,t])=>t && d.marks[id]).map(([,t])=>t).sort();
  const who=[...new Set(Object.entries(d.who||{}).filter(([id,w])=>w && d.marks[id]).map(([,w])=>w))];
  if(!ts.length) return "—";
  return `<span class="num">${esc(hhmm(ts[0])+"–"+hhmm(ts[ts.length-1]))}</span>`+(who.length?`<small>${esc(who.join("، "))}</small>`:"");
}
function banners(){
  let h="";
  if(S.demo) h+=`<div class="slim demo"><span>${tr("demoNote")}</span><button type="button" class="linkbtn" data-act="demo">${tr("hideDemo")}</button></div>`;
  if(S.storageOff) h+=`<div class="slim bad">${tr("nostore")}</div>`;
  return h;
}
function viewToday(){
  const F=facility(S.date);
  let h=banners();
  if(F.crit.length) h+=`<div class="alert"><b>⚠ ${tr("critBanner")}</b><div>${F.crit.map(c=>`<span class="num">${c.p.id}</span> – ${esc(L(c.p))}`).join("<br>")}</div></div>`;
  h+=`<section class="card hero">
    <div class="hero-top">${gauge(F.pct,F.crit.length)}
      <div class="hero-info"><span class="lbl">${tr("facility")}</span>${dayStatus(F)}
        <div class="stats">
          <span><b class="num s-good">${F.ok}</b><small>✓ ${tr("ok")}</small></span>
          <span><b class="num s-bad">${F.nc}</b><small>✗ ${tr("nc")}</small></span>
          <span><b class="num ${F.crit.length?"s-bad":""}">${F.crit.length}</b><small>★ ${tr("critical")}</small></span>
        </div></div></div>
    <div class="hero-foot">
      <div class="lrow2"><span>${tr("coverage")}</span><b class="num">${fmt(F.cov)}%</b></div>
      <div class="meter"><i style="width:${F.cov||0}%"></i></div>
      <div class="lrow2"><span>${tr("round")}</span><span class="rinfo">${roundInfo(S.date)}</span></div>
    </div>
    <details class="method"><summary>ⓘ ${tr("methodT")}</summary><p>${tr("method")}</p></details>
  </section>`;
  if(!F.done && !S.demo) h+=`<div class="empty-card"><p>${tr("emptyDay")}</p><div class="row-btns"><a class="btn primary" href="#inspect">${tr("inspect")}</a><button type="button" class="btn ghost" data-act="demo">${tr("showDemo")}</button></div></div>`;
  const row=(attr,name,s,crit,sub)=>{ const c=cls(s.pct,crit);
    return `<div role="button" tabindex="0" class="drow" ${attr}><div class="dn"><b>${esc(name)}</b><small>${sub}</small><div class="bar ${c}"><i style="width:${s.pct==null?0:Math.max(3,s.pct)}%"></i></div></div><span class="dp num ${c}">${s.pct==null?"—":fmt(s.pct)+"%"}</span><span class="chev">${ICON.chev}</span></div>`; };
  h+=`<h2>${tr("depts")}</h2><div class="card rows">`;
  F.per.forEach((s,i)=>{ const k=DK[i];
    h+=row(`data-dept="${k}"`,L(DBY[k]),s,s.crit.length,`${tr("coverage")} <span class="num">${s.done}/${s.expected}</span>${s.nc?` · <span class="s-bad">✗ ${s.nc}</span>`:""}${s.crit.length?` · <span class="s-bad">★ ${tr("critical")}</span>`:""}`); });
  h+=`</div><div class="card rows" style="margin-top:10px">`;
  for(const k of ["P","G"]){ const s=stats(S.date,p=>p.a===k);
    h+=row(`data-area="${k}"`,shortA(ABY[k]),s,s.crit.length,`${tr("coverage")} ${fmt(s.cov)}%${s.nc?` · <span class="s-bad">✗ ${s.nc}</span>`:""}`); }
  h+=`</div>`;
  h+=`<h2>${tr("map")}</h2><div class="card mapcard">
    <div class="zoombar"><span class="muted small">${tr("mapNote")}</span><div class="zb"><button type="button" class="iconbtn sm" data-zoom="-1" aria-label="${tr("zoomOut")}">−</button><button type="button" class="iconbtn sm" data-zoom="1" aria-label="${tr("zoomIn")}">+</button></div></div>
    ${mapSvg(S.date)}
    <div class="legend"><span><i style="background:var(--good-bg);border-color:var(--good)"></i>≥ ${TARGET}%</span><span><i style="background:var(--warn-bg);border-color:var(--warn)"></i>${AMBER}–${TARGET}%</span><span><i style="background:var(--bad-bg);border-color:var(--bad)"></i>&lt; ${AMBER}% / ${tr("critical")}</span><span><i style="background:var(--sunk)"></i>${tr("noData")}</span></div></div>`;
  const ncs=F.ncList.slice().sort((a,b)=>(b.p.c||0)-(a.p.c||0));
  const nPh=ncs.reduce((n,r)=>n+photosOf(S.date,r.p.id).length,0);
  h+=`<h2>${tr("open")} <span class="count">${ncs.length}${nPh?` · 📷 ${nPh}`:""}</span></h2>`;
  if(!ncs.length) h+=`<div class="card"><p class="empty">✓ ${tr("none")}</p></div>`;
  else{
    h+=`<div class="card rows">`;
    for(const k of DK){ const rows=ncs.filter(r=>r.p.d===k); if(!rows.length) continue;
      h+=`<div class="grouph">${esc(L(DBY[k]))}<span>${rows.length} ✗</span></div>`;
      for(const r of rows) h+=`<div class="ncrow ${r.p.c?"crit":""}">
        <div class="nctop"><span class="pid num">${r.p.id}</span>${r.p.c?`<span class="tag c">★ ${tr("critical")}</span>`:""}<span class="muted small ell">${esc(shortA(ABY[r.p.a]))}</span><span class="time num">${hhmm(r.at)||""}</span></div>
        <div class="nct">${esc(L(r.p))}</div>
        <div class="ncact ${r.note?"":"none"}">${esc(r.note)||tr("action")}${r.who?` <span class="muted">· ${esc(r.who)}</span>`:""}</div>
        ${thumbs(S.date,r.p.id,true)}</div>`;
    }
    h+=`</div>`;
  }
  return h;
}

function pointMatches(p){
  if(S.areaF && p.a!==S.areaF) return false;
  if(S.deptF && p.d!==S.deptF) return false;
  if(S.onlyOpen && markOf(S.date,S.shift,p)) return false;
  if(S.q){ const q=S.q.toLowerCase(); if(!(p.en.toLowerCase().includes(q)||p.ar.includes(S.q)||p.id.toLowerCase().includes(q)||p.r.toLowerCase().includes(q))) return false; }
  return true;
}
/* guided round: areas are stored in walking order (clean → dirty, Line 2 after Line 1, toilets last) */
function shortA(a){ return S.lang==="ar" ? (a.s_ar||a.ar) : (a.s_en||a.en) }
function areaSt(k){
  let total=0,done=0,nc=0;
  for(const p of P){ if(p.a!==k || (S.deptF && p.d!==S.deptF)) continue; total++; const v=markOf(S.date,S.shift,p); if(v){ done++; if(v==="nc") nc++; } }
  return {total,done,nc,rem:total-done};
}
function firstOpenArea(){ for(const a of AREAS){ if(areaSt(a.k).rem) return a.k; } return "" }
function stepper(){
  let h=`<nav class="stepper" id="stepper" aria-label="${tr("areasRoute")}"><button type="button" class="step ${!S.areaF?"cur":""}" data-step="*" aria-pressed="${!S.areaF}">${tr("allShort")}</button>`;
  AREAS.forEach((a,i)=>{ const s=areaSt(a.k); if(!s.total) return;
    const st=s.nc?"bad":!s.rem?"good":s.done?"part":"", badge=s.nc?`✗${s.nc}`:!s.rem?"✓":`${s.done}/${s.total}`;
    h+=`<button type="button" class="step ${st} ${S.areaF===a.k?"cur":""}" data-step="${a.k}" aria-pressed="${S.areaF===a.k}" title="${esc(L(a))}"><span class="sn num">${i+1}</span><span class="st">${esc(shortA(a))}</span><small class="num">${badge}</small></button>`; });
  return h+`</nav>`;
}
function nFilters(){ return (S.deptF?1:0)+(S.onlyOpen?1:0) }
function ptCard(p,ym,yno,ro){
  const v=markOf(S.date,S.shift,p)||"", d=docOf(S.date,S.shift,p)||{}, note=(d.notes||{})[p.id]||"", at=(d.at||{})[p.id], who=(d.who||{})[p.id];
  const ph=photosOf(S.date,p.id);
  const wasNc=ym[p.id]==="nc";
  const yIds=p.fu ? Object.entries(ym).filter(([id,x])=>x==="nc"&&PBY[id]).map(([id])=>id) : [];
  return `<article class="pt ${v}" data-id="${p.id}">
    <div class="meta"><span class="pid num">${p.id}</span>${p.c?`<span class="tag c">★ ${tr("critical")}</span>`:""}${p.op?`<span class="tag d">${tr("during")}</span>`:""}${wasNc?`<span class="tag y">✗ ${tr("yesterday")}</span>`:""}${ph.length?`<span class="tag">📷 ${ph.length}</span>`:""}${v&&at?`<span class="stamp">${hhmm(at)}${who?" · "+esc(who):""}</span>`:""}</div>
    <div class="t">${esc(L(p))}</div><div class="alt">${esc(S.lang==="ar"?p.en:p.ar)}</div>
    ${S.how?`<div class="how"><b>${tr("howTo")}:</b> ${esc(S.lang==="ar"?p.h_ar:p.h_en)}</div>`:""}
    ${wasNc?`<div class="yline">⚠ ${tr("wasNcY")}${yno[p.id]?`: ${esc(yno[p.id])}`:""}</div>`:""}
    ${p.fu?`<div class="yline"><b>${tr("yList")}:</b> ${yIds.length?yIds.join("، "):tr("noneY")}</div>`:""}
    ${S.refs?`<div class="refs">${esc(L(DBY[p.d]))} · ${esc(p.r)} · BRCGS ${esc(p.b)}</div>`:""}
    <div class="marks">${["ok","nc","na"].map(x=>`<button type="button" class="mk mk-${x}" ${ro?"disabled":""} data-v="${x}" aria-pressed="${v===x}" aria-label="${tr(x)}"><b>${x==="ok"?"✓":x==="nc"?"✗":"N/A"}</b>${x==="na"?"":`<span>${tr(x)}</span>`}</button>`).join("")}</div>
    ${v==="nc"&&p.c?`<div class="critnote" role="alert">⚠ ${tr("critBanner")}</div>`:""}
    ${v==="nc"?`<div class="ncbox"><textarea ${ro?"disabled":""} id="n_${p.id}" rows="2" class="${note.trim()?"":"need"}" placeholder="${tr("action")}">${esc(note)}</textarea>
      ${!ro?`<div class="qn">${QN[S.lang].map((t,i)=>`<button type="button" data-qn="${i}" class="${note.includes(t)?"on":""}">${esc(t)}</button>`).join("")}</div>`:""}
      ${photoRow(p,ph,ro,true)}</div>`:(ph.length?photoRow(p,ph,ro,false):"")}
  </article>`;
}
function viewInspect(){
  const ro = S.demo;
  const dp=P.filter(p=>!S.deptF||p.d===S.deptF), dd=dp.filter(p=>markOf(S.date,S.shift,p)).length, left=dp.length-dd;
  const yd=src().get(addDays(S.date,-1)+"_D"), ym=(yd&&yd.marks)||{}, yno=(yd&&yd.notes)||{};
  const nf=nFilters();
  let h=`<div class="insp-bar" id="inspHead">${stepper()}<div class="progline"><i style="width:${dp.length?dd/dp.length*100:0}%"></i></div></div>`;
  h+=banners();
  if(!S.name && !S.demo) h+=`<a class="slim" href="#send"><span>✎ ${tr("nameNeeded")}</span><span class="linkbtn">${tr("send")}</span></a>`;
  h+=`<div class="toolrow"><label class="search">${ICON.search}<input id="fQ" type="search" value="${esc(S.q)}" placeholder="${tr("search")}" enterkeyhint="search"></label>
      <button type="button" class="iconbtn filt ${nf?"on":""}" data-act="filters" aria-label="${tr("filters")}">${ICON.filter}${nf?`<i>${nf}</i>`:""}</button></div>
    <div class="progtxt"><span><b class="num">${dd}</b> / <span class="num">${dp.length}</span> ${tr("progress")}</span><span id="saveState" class="saving"></span></div>`;
  if(S.deptF) h+=`<div class="activef"><span class="fchip">${esc(L(DBY[S.deptF]))}<button type="button" data-act="clrdept" aria-label="✕">✕</button></span></div>`;
  if(!left && dp.length && !S.demo) h+=`<div class="donecard"><b>✓ ${tr("roundDone")}</b><a class="btn primary" href="#send">${tr("goSend")}</a></div>`;
  let any=false;
  const head=(a,all,big)=>{ let ok=0,nc=0,na=0,rem=0,nph=0; for(const p of all){ const v=markOf(S.date,S.shift,p); if(v==="ok")ok++; else if(v==="nc")nc++; else if(v==="na")na++; else rem++; nph+=photosOf(S.date,p.id).length; }
    return {rem, html:`<span class="k num">${a.k}</span><span class="sname"><b>${esc(L(a))}</b><small>${esc(L(ZONES[a.z]))} · <span class="s-good">✓${ok}</span> <span class="s-bad">✗${nc}</span> N/A ${na}${rem?` · ${rem} ${S.lang==="ar"?"متبقي":"left"}`:""}${nph?` · 📷${nph}`:""}</small></span>`}; };
  const naBtn=(a,all)=> (!ro && all.some(p=>p.op&&!markOf(S.date,S.shift,p))) ? `<button type="button" class="btn ghost sm wide" data-na="${a.k}">${tr("naRest")}</button>` : "";
  if(S.areaF && ABY[S.areaF]){
    const a=ABY[S.areaF], all=P.filter(p=>p.a===a.k), pts=all.filter(pointMatches);
    const hd=head(a,all);
    h+=`<div class="areahead">${hd.html}</div>${naBtn(a,all)}`;
    if(pts.length){ any=true; h+=`<div class="pts">${pts.map(p=>ptCard(p,ym,yno,ro)).join("")}</div>`; }
  } else {
    for(const a of AREAS){
      const all=P.filter(p=>p.a===a.k), pts=all.filter(pointMatches);
      if(!pts.length) continue; any=true;
      const hd=head(a,all);
      h+=`<details class="sec" data-sec="${a.k}" ${hd.rem>0?"open":""}><summary>${hd.html}<span class="chev">${ICON.chev}</span></summary>${naBtn(a,all)}<div class="pts">${pts.map(p=>ptCard(p,ym,yno,ro)).join("")}</div></details>`;
    }
  }
  if(!any) h+=`<p class="empty">${tr("noMatch")}</p>`;
  if(S.areaF && ABY[S.areaF]){
    const vis=AREAS.filter(a=>areaSt(a.k).total), i=vis.findIndex(a=>a.k===S.areaF), prev=vis[i-1], next=vis[i+1], s=areaSt(S.areaF);
    const rtl=S.lang==="ar", ap=rtl?"→":"←", an=rtl?"←":"→";
    if(!s.rem && left) h+=`<div class="slim good">✓ ${tr("areaDone")}</div>`;
    h+=`<div class="areanav">${prev?`<button type="button" class="btn ghost" data-step="${prev.k}">${ap} ${esc(shortA(prev))}</button>`:"<span></span>"}${
      next?`<button type="button" class="btn primary" data-step="${next.k}">${esc(shortA(next))} ${an}</button>`:`<a class="btn primary" href="#send">${tr("goSend")}</a>`}</div>`;
  }
  return h;
}
function thumbs(date,pid,small){
  const a=photosOf(date,pid); if(!a.length) return "";
  return `<div class="ths">${a.map((m,i)=>`<button type="button" class="th${small?" sm":""}" data-ph="${m.id}" aria-label="${tr("photo")} ${i+1} – ${pid}"><img src="${turl(m)}" alt=""></button>`).join("")}</div>`;
}
function photoRow(p,ph,ro,canAdd){
  let h=`<div class="ph">`+ph.map((m,i)=>`<button type="button" class="th" data-ph="${m.id}" aria-label="${tr("photo")} ${i+1}"><img src="${turl(m)}" alt=""></button>`).join("");
  if(canAdd && !ro){
    if(S.photoOff) h+=`<span class="muted">${tr("photoOff")}</span>`;
    else if(ph.length<MAXPH) h+=`<button type="button" class="btn phbtn" data-cam="camera" data-photo="${p.id}">${ICON.cam}<span>${tr("camera")}</span></button>`
      +`<button type="button" class="btn phbtn" data-cam="gallery" data-photo="${p.id}">${ICON.gal}<span>${tr("gallery")}</span></button>`;
  }
  const msg = S.restorePt===p.id ? tr("photoReload") : "";
  return h+`<span class="saving" id="pm_${p.id}" role="status">${esc(msg)}</span></div>`;
}

function viewTrend(){
  const end=S.date, days=[...Array(30)].map((_,i)=>addDays(end,i-29));
  const fac=days.map(d=>facility(d));
  let h=banners();
  if(!S.demo && !fac.some(f=>f.pct!=null)) h+=`<div class="note"><span>${tr("emptyDay")}</span><button type="button" class="btn sm" data-act="demo">${tr("showDemo")}</button></div>`;
  const vals=fac.map(f=>f.pct).filter(v=>v!=null); const mn=vals.length?Math.min(...vals):80;
  const W=720,H=260,pl=34,pr=12,pt=12,pb=26, lo=Math.max(0,Math.min(80,Math.floor((mn-5)/10)*10));
  const x=i=>pl+i*(W-pl-pr)/29, y=v=>pt+(100-Math.max(lo,v))*(H-pt-pb)/(100-lo);
  let path="",first=true; fac.forEach((f,i)=>{ if(f.pct==null){first=true;return} path+=(first?"M":"L")+x(i).toFixed(1)+","+y(f.pct).toFixed(1); first=false; });
  const ticks=[]; for(let g=lo; g<=100; g+=(100-lo)>40?20:10) ticks.push(g);
  const grid=ticks.map(g=>`<line x1="${pl}" x2="${W-pr}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)"/><text x="${pl-6}" y="${y(g)+3}" text-anchor="end">${g}</text>`).join("");
  const tg=`<line x1="${pl}" x2="${W-pr}" y1="${y(TARGET)}" y2="${y(TARGET)}" stroke="var(--good)" stroke-dasharray="4 4"/><text x="${pl+4}" y="${y(TARGET)-4}" style="fill:var(--good)">${TARGET}%</text>`;
  const dots=fac.map((f,i)=>f.pct==null?"":`<circle cx="${x(i)}" cy="${y(f.pct)}" r="${i===29?6:4}" class="${cls(f.pct,f.crit.length)}" fill="currentColor"><title>${days[i]}: ${fmt(f.pct)}%</title></circle>`).join("");
  const xl=[0,7,14,21,29].map(i=>`<text x="${x(i)}" y="${H-8}" text-anchor="${i===0?"start":i===29?"end":"middle"}">${days[i].slice(5)}</text>`).join("");
  const avgAll=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
  h+=`<h2>${tr("last30")}</h2><div class="card chart"><div class="chart-head"><span class="muted small">${tr("avg30")}</span><span class="pill num ${cls(avgAll)}">${fmt(avgAll)}${avgAll==null?"":"%"}</span></div><div dir="ltr"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr("last30")}">${grid}${tg}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>${dots}${xl}</svg></div></div>`;
  const order=days.map((d,i)=>i).reverse();
  const heat=(rows)=>{
    let t=`<div class="tbl heatwrap"><table class="heat"><thead><tr><th class="sticky"></th><th class="avgc">${tr("avg30")}</th>${order.map(i=>`<th class="num">${days[i].slice(8)}</th>`).join("")}</tr></thead><tbody>`;
    for(const [label,pred,isFac] of rows){ let okS=0,ncS=0;
      const cells=order.map(i=>{ const d=days[i]; let s; if(isFac){ s=fac[i]; } else { s=stats(d,pred); } okS+=s.ok; ncS+=s.nc; return `<td><div class="cell num ${cls(s.pct,s.crit.length)}">${s.pct==null?"":Math.round(s.pct)}</div></td>`; }).join("");
      let avg=okS+ncS?okS/(okS+ncS)*100:null;
      if(isFac){ const v=fac.map(f=>f.pct).filter(x=>x!=null); avg=v.length? v.reduce((a,b)=>a+b,0)/v.length : null; }
      t+=`<tr><td class="sticky"><b>${esc(label)}</b></td><td class="avgc"><span class="pill num ${cls(avg)}">${fmt(avg)}</span></td>${cells}</tr>`; }
    return t+`</tbody></table></div>`;
  };
  h+=`<h2>${tr("heatD")}</h2>`+heat([[tr("facility"),null,true],...DEPTS.map(d=>[L(d),p=>p.d===d.k])]);
  h+=`<h2>${tr("heatA")}</h2>`+heat(AREAS.map(a=>[a.k+" · "+shortA(a),p=>p.a===a.k]));
  const cnt={}; for(const d of days) for(const sh of [...SHIFTS,"D"]){ const doc=src().get(d+"_"+sh); if(!doc) continue; for(const [id,v] of Object.entries(doc.marks||{})) if(v==="nc"&&PBY[id]) cnt[id]=(cnt[id]||0)+1; }
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,12);
  h+=`<h2>${tr("recurring")}</h2>`+(top.length?`<div class="card list">${
    top.map(([id,c],i)=>`<div class="lrow"><span class="rank num">${i+1}</span><div class="lmain">${esc(L(PBY[id]))}<div class="muted small"><span class="num">${id}</span> · ${esc(L(ABY[PBY[id].a]))} · ${esc(L(DBY[PBY[id].d]))}</div></div><span class="lcount"><b class="num">${c}</b><small>${tr("times")}</small></span></div>`).join("")}</div>`:`<p class="empty">—</p>`);
  return h;
}

function daySummary(date){
  const F=facility(date), nPh=photosDay(date).length;
  const lines=[`🧼 ${tr("title")}`, `${tr("round")}: ${date}`, `${tr("facility")}: ${F.pct==null?"—":fmt(F.pct)+"%"} · ${tr("coverage")} ${fmt(F.cov)}% · ✓ ${F.ok} · ✗ ${F.nc}${nPh?` · 📷 ${nPh}`:""}`];
  if(S.name) lines.push(`${tr("inspector")}: ${S.name}`);
  if(F.crit.length) lines.push("", `⚠ ${tr("critBanner")}:`, ...F.crit.map(c=>`• ${c.p.id} ${L(c.p)}`));
  lines.push("", tr("depts")+":");
  F.per.forEach((s,i)=>lines.push(`• ${L(DBY[DK[i]])}: ${s.pct==null?"—":fmt(s.pct)+"%"}${s.nc?` – ${s.nc} ✗`:""} (${tr("coverage")} ${fmt(s.cov)}%)`));
  if(F.ncList.length){ lines.push("", tr("open")+":"); let n=0;
    for(const k of DK){ const rows=F.ncList.filter(r=>r.p.d===k); if(!rows.length) continue; lines.push(`[${L(DBY[k])}]`);
      for(const r of rows){ if(n>=45) break; n++; const c=photosOf(date,r.p.id).length; lines.push(`✗ ${r.p.id} ${L(r.p)}${r.note?" → "+r.note:""}${c?` (📷${c})`:""}`); } }
    if(F.ncList.length>45) lines.push(`… +${F.ncList.length-45} ${tr("more")}`); }
  return lines.join("\n");
}
async function csvAll(){
  const cnt=await photoCounts();
  const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const rows=[["date","point","area","area_ar","department","production_point","critical","mark","corrective_action","photos","time","inspector","point_en","point_ar","reference","brcgs"].join(",")];
  const docs=[...S.docs.values()].sort((a,b)=>(a.date+a.shift).localeCompare(b.date+b.shift));
  for(const d of docs) for(const [id,v] of Object.entries(d.marks||{})){ const p=PBY[id]; if(!p||!v) continue;
    rows.push([d.date,id,ABY[p.a].en,ABY[p.a].ar,DBY[p.d].en,p.op?"yes":"",p.c?"yes":"",v.toUpperCase(),(d.notes||{})[id]||"",cnt[d.date+"_"+id]||"",(d.at||{})[id]||"",(d.who||{})[id]||"",p.en,p.ar,p.r,p.b].map(q).join(",")); }
  return "﻿"+rows.join("\r\n");
}
const saveBlob=(name,blob)=>N.shareFile(name,blob);
const saveFile=(name,text,type)=>saveBlob(name,new Blob([text],{type}));
async function dayBlob(date){
  const docs=[S.docs.get(date+"_D")].filter(Boolean);
  const parts=[`{"app":"unifood-hygiene","v":4,"from":${JSON.stringify(S.name||"")},"date":${JSON.stringify(date)},"docs":${JSON.stringify(docs)},"photos":[`];
  let n=0;
  const metas=await DB.photoMetasOfDay(date);
  for(const m of metas){ const b=await getFull(m.id); if(!b) continue;
    parts.push((n?",":"")+JSON.stringify({id:m.id,date:m.date,point:m.point,at:m.at,who:m.who,w:m.w,h:m.h,thumb:m.thumb,data:await blobToData(b)})); n++; }
  parts.push("]}");
  return new Blob(parts,{type:"application/json"});
}
async function reportBlob(date){
  await ensurePhotos(date);
  const F=facility(date), ar=S.lang==="ar", d=src().get(date+"_D")||{};
  const who=[...new Set(Object.entries(d.who||{}).filter(([id,w])=>w&&(d.marks||{})[id]).map(([,w])=>w))].join("، ")||S.name||"—";
  const pc=v=>v==null?"—":fmt(v)+"%", col=v=>v==null?"":v>=TARGET?"g":v>=AMBER?"w":"b";
  const css=`body{font-family:"Segoe UI","Noto Sans Arabic",Tahoma,Roboto,sans-serif;margin:0 auto;max-width:960px;padding:16px;color:#15201D;background:#fff;line-height:1.45;font-size:14px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 8px;border-bottom:2px solid #0B6B57;padding-bottom:3px}h3{font-size:14px;margin:16px 0 6px;color:#0B6B57}
.m{font-size:12px;color:#5A6A65}.kp{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.kp div{border:1px solid #D2DAD7;border-radius:8px;padding:6px 10px;min-width:92px}
.kp span{display:block;font-size:11px;color:#5A6A65}.kp b{font-size:18px}table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border:1px solid #D2DAD7;padding:5px 7px;text-align:start;vertical-align:top}th{background:#E7ECEA}
.nc{border:1px solid #D2DAD7;border-inline-start:5px solid #C2362F;border-radius:8px;padding:10px 12px;margin:0 0 10px;break-inside:avoid}
.nc.ok{border-inline-start-color:#5A6A65}.alt{display:block;font-size:12px;color:#5A6A65}.crit{color:#C2362F;font-weight:700}
.alert{border:2px solid #C2362F;background:#FBE4E2;border-radius:8px;padding:8px 12px;margin:10px 0}
.imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:8px}.imgs img{width:100%;height:auto;border-radius:6px;border:1px solid #D2DAD7}
.g{color:#1D8A4B}.b{color:#C2362F}.w{color:#B4761C}.num{font-family:ui-monospace,Menlo,Consolas,monospace}footer{margin-top:24px;font-size:11px;color:#5A6A65}
@media print{body{padding:0;max-width:none}.nc{break-inside:avoid}}`;
  const parts=[`<!doctype html><html lang="${S.lang}" dir="${ar?"rtl":"ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UNIFOOD – ${esc(tr("reportTitle"))} – ${date}</title><style>${css}</style></head><body>`];
  const nPh=photosDay(date).length;
  parts.push(`<h1>UNIFOOD · ${esc(tr("reportTitle"))}</h1><div class="m">F-C&amp;S-01-04 · ${esc(tr("round"))} ${date} · ${esc(tr("inspector"))}: ${esc(who)}</div>`);
  parts.push(`<div class="kp"><div><span>${tr("facility")}</span><b class="num ${col(F.pct)}">${pc(F.pct)}</b></div><div><span>${tr("coverage")}</span><b class="num">${fmt(F.cov)}%</b></div><div><span>${tr("ok")}</span><b class="num g">${F.ok}</b></div><div><span>${tr("nc")}</span><b class="num b">${F.nc}</b></div><div><span>${tr("criticalN")}</span><b class="num ${F.crit.length?"b":""}">${F.crit.length}</b></div><div><span>📷 ${tr("photos")}</span><b class="num">${nPh}</b></div></div>`);
  if(F.crit.length) parts.push(`<div class="alert"><b>⚠ ${esc(tr("critBanner"))}</b><br>${F.crit.map(c=>`${c.p.id} – ${esc(L(c.p))}`).join("<br>")}</div>`);
  parts.push(`<h2>${tr("depts")}</h2><table><thead><tr><th>${tr("dept")}</th><th>%</th><th>✓</th><th>✗</th><th>${tr("coverage")}</th></tr></thead><tbody>${
    F.per.map((s,i)=>`<tr><td>${esc(L(DBY[DK[i]]))}</td><td class="num ${col(s.pct)}"><b>${pc(s.pct)}</b></td><td class="num">${s.ok}</td><td class="num">${s.nc}</td><td class="num">${s.done}/${s.expected}</td></tr>`).join("")}</tbody></table>`);
  const imgs=async list=>{ if(!list.length) return ""; let h=`<div class="imgs">`;
    for(const [i,m] of list.entries()){ const b=await getFull(m.id); if(b) h+=`<img src="${await blobToData(b)}" alt="${m.point} – ${i+1}">`; }
    return h+`</div>`; };
  const ncs=F.ncList.slice().sort((a,b)=>(b.p.c||0)-(a.p.c||0));
  parts.push(`<h2>${tr("open")} (${ncs.length})</h2>`);
  if(!ncs.length) parts.push(`<p class="m">—</p>`);
  for(const k of DK){ const rows=ncs.filter(r=>r.p.d===k); if(!rows.length) continue;
    parts.push(`<h3>${esc(L(DBY[k]))} – ${rows.length} ✗</h3>`);
    for(const r of rows){
      parts.push(`<div class="nc"><b class="num">${r.p.id}</b>${r.p.c?` <span class="crit">★ ${tr("critical")}</span>`:""} – <b>${esc(L(r.p))}</b><span class="alt">${esc(ar?r.p.en:r.p.ar)}</span>
        <div class="m">${esc(L(ABY[r.p.a]))} · ${esc(r.p.r)} · BRCGS ${esc(r.p.b)} · ${hhmm(r.at)||"—"}${r.who?" · "+esc(r.who):""}</div>
        <div><b>${tr("action2")}:</b> ${esc(r.note)||"—"}</div>${await imgs(photosOf(date,r.p.id))}</div>`);
    }
  }
  const ncIds=new Set(ncs.map(r=>r.p.id)), other=[...new Set(photosDay(date).map(m=>m.point))].filter(id=>!ncIds.has(id)&&PBY[id]);
  if(other.length){ parts.push(`<h2>${tr("otherPhotos")}</h2>`);
    for(const id of other){ const p=PBY[id], v=(d.marks||{})[id];
      parts.push(`<div class="nc ok"><b class="num">${id}</b> – <b>${esc(L(p))}</b> <span class="m">(${v==="ok"?"✓":v==="na"?"N/A":"—"})</span>${await imgs(photosOf(date,id))}</div>`); } }
  parts.push(`<p class="m">${esc(tr("method"))}</p><footer>F-C&amp;S-01-04 · UNIFOOD Hygiene Score · ${tr("generated")} ${ymd(new Date())} ${hhmm(new Date().toISOString())}</footer></body></html>`);
  return new Blob(parts,{type:"text/html"});
}
async function shareDayPhotos(date){
  await ensurePhotos(date);
  const list=photosDay(date); if(!list.length) return "none";
  if(list.length<=10){   // phones refuse long lists of files – above 10 photos the NC report carries them all
    const files=[]; for(const m of list){ const b=await getFull(m.id); if(b) files.push({name:`${m.point}_${m.date}_${files.length+1}.jpg`,blob:b}); }
    const r=await N.shareFiles(files,daySummary(date));
    if(r==="shared") return "shared"; if(r==="cancel") return "cancel";
  }
  await saveBlob(`NC_report_${date}_${safeName()}.html`, await reportBlob(date)); return "report";
}
async function shareOne(m){
  const b=await getFull(m.id); if(!b) return;
  const p=PBY[m.point], doc=S.docs.get(m.date+"_D")||{}, note=(doc.notes||{})[m.point]||"", name=`${m.point}_${m.date}.jpg`;
  const text=`✗ ${p.id} ${L(p)}${note?" → "+note:""}\n${m.date} ${hhmm(m.at)}${m.who?" · "+m.who:""}`;
  const r=await N.shareFiles([{name,blob:b}],text);
  if(r==="unsupported") await saveBlob(name,b);
}
function safeName(){ return (S.name||"phone").replace(/[^\w؀-ۿ-]+/g,"_") }

function viewSend(){
  const F=facility(S.date), nPh=photosDay(S.date).length;
  return `${banners()}<h2>${tr("send")}</h2><div class="note info">${tr("sendHelp")}</div>
  <div class="card namecard"><label for="nameIn">${tr("inspector")}</label><input id="nameIn" value="${esc(S.name)}" placeholder="${tr("namePh")}" autocomplete="name"></div>
  <div class="actions">
    <div class="card action"><div class="ah"><span class="no">1</span><b>${tr("waTitle")}</b></div><span class="muted">${S.date} · ${tr("facility")} ${F.pct==null?"—":fmt(F.pct)+"%"}</span>
      <button type="button" class="btn primary wa" data-act="wa">${ICON.wa}<span>${tr("waBtn")}</span></button>
      <button type="button" class="btn" data-act="copy">${tr("copyBtn")}</button></div>
    <div class="card action"><div class="ah"><span class="no">2</span><b>${tr("reportTitle")}</b></div><span class="muted">${tr("reportHelp")}</span>
      <button type="button" class="btn primary" data-act="report">${tr("reportBtn")} (${S.date}${nPh?` · 📷 ${nPh}`:""})</button>
      <button type="button" class="btn" data-act="sharephotos" ${nPh?"":"disabled"}>📷 ${tr("sharePhotos")} (${nPh})</button>
      <span id="repMsg" class="saving" role="status"></span></div>
    <div class="card action"><div class="ah"><span class="no">3</span><b>${tr("fileTitle")}</b></div><span class="muted">${tr("fileHelp")}</span>
      <button type="button" class="btn" data-act="dayfile">${tr("dayBtn")} (${S.date}${nPh?` · 📷 ${nPh}`:""})</button>
      <button type="button" class="btn" data-act="allfile">${tr("allBtn")} (${S.docs.size})</button>
      <span id="fileMsg" class="saving" role="status"></span></div>
    <div class="card action"><div class="ah"><span class="no">4</span><b>${tr("csvTitle")}</b></div><span class="muted">${tr("csvHelp")}</span>
      <button type="button" class="btn" data-act="csv">${tr("csvBtn")}</button><span id="csvMsg" class="saving" role="status"></span></div>
    <div class="card action"><div class="ah"><span class="no">5</span><b>${tr("impTitle")}</b></div><span class="muted">${tr("impHelp")}</span>
      <label class="btn">${tr("impBtn")}<input type="file" id="impIn" accept=".json,application/json" multiple hidden></label>
      <span id="impMsg" class="saving" role="status"></span></div>
    <div class="card action danger"><div class="ah"><span class="no">6</span><b>${tr("clearTitle")}</b></div><span id="stoInfo" class="muted">…</span><span class="muted">${tr("clearHelp")}</span>
      <button type="button" class="btn" data-act="prune1">${tr("pruneBtn")}</button>
      <div id="pruneConfirm" class="confirm" hidden><button type="button" class="btn danger" data-act="prune2">${tr("pruneSure")}</button><button type="button" class="btn" data-act="pruneConfirm0">${tr("cancel")}</button></div>
      <button type="button" class="btn" data-act="clear1">${tr("clearBtn")}</button>
      <div id="clearConfirm" class="confirm" hidden><p>${tr("clearType")} <b>${tr("clearWord")}</b></p><input id="clearWordIn" autocomplete="off"><button type="button" class="btn danger" data-act="clear2" disabled id="clear2Btn">${tr("clearSure")}</button><button type="button" class="btn" data-act="clearConfirm0">${tr("cancel")}</button></div>
      <span id="clearMsg" class="saving" role="status"></span></div>
  </div>`;
}
async function storageInfo(){
  const el=document.getElementById("stoInfo"); if(!el) return;
  try{ const r=await DB.photoStats(); const mb=(r.bytes||0)*1.4/1048576;    // ×1.4: thumbnails and database overhead
    el.textContent=`${tr("photosOnPhone")}: ${r.n} · ${tr("used")}: ~${mb.toFixed(1)} / ${FREE_MB} MB`; }
  catch(e){ const n=[...PH.byDate.values()].reduce((a,dm)=>a+[...dm.values()].flat().length,0); el.textContent=`${tr("photosOnPhone")}: ≥ ${n} · ${tr("offline")}`; }
}

function viewGuide(){
  const ar=S.lang==="ar";
  const cnt=k=>P.filter(p=>p.d===k).length;
  const crit=P.filter(p=>p.c);
  const colours=[["#1F1F1F",ar?"أسود":"Black",ar?"الإدارة + خارج صالات الإنتاج (الشارع)":"Admin + outside production halls (street)"],["#2B6CB0",ar?"أزرق":"Blue",ar?"التعبئة والمخازن":"Packing & warehouses"],["#2F855A",ar?"أخضر":"Green",ar?"منطقة الإنتاج":"Production area"],["#C53030",ar?"أحمر":"Red",ar?"منطقة التقشير":"Peeling area"],["#D69E2E",ar?"أصفر":"Yellow",ar?"دورات المياه":"Toilets"]];
  const sec=(title,body,open)=>`<details class="card gsec" ${open?"open":""}><summary><b>${title}</b><span class="chev">${ICON.chev}</span></summary><div class="gbody">${body}</div></details>`;
  return `<h2>${tr("guide")}</h2>
  ${sec(ar?"طريقة الاستخدام":"How to use",`<ul class="clean">
    <li>${ar?"اكتب اسمك مرة واحدة في تبويب إرسال.":"Write your name once in the Send tab."}</li>
    <li>${ar?"الجولة مرة واحدة يومياً صباحاً، وكلها فحص بالنظر للنظافة والنظافة الشخصية وحالة المكان – لا مراجعة سجلات أو تحاليل.":"The round is done once a day in the morning. Every point is something you look at – cleaning, personal hygiene, condition of the place. No records or lab tests."}</li>
    <li>${ar?"امشِ بترتيب الأرقام على شريط المناطق: من الأنظف إلى الأقل نظافة، وخط 2 بعد خط 1، ودورات المياه في الآخر. تبويب الفحص يفتح على أول منطقة لم تكتمل، وبعد الانتهاء اضغط (التالي).":"Walk in the order of the numbers on the area bar: cleanest areas first, Line 2 after Line 1, toilets last. Inspect opens on the first unfinished area; tap Next when done."}</li>
    <li>${ar?"اقرأ (كيف تقيّم) تحت كل بند، ثم اختر: ✓ مطابق، ✗ غير مطابق، N/A لا ينطبق.":"Read 'How to check' under each point, then tap ✓ OK, ✗ not OK or N/A."}</li>
    <li>${ar?"عند ✗: اضغط ملاحظة جاهزة (تم التنظيف فوراً – أبلغت المشرف …) أو اكتب ما تم، وصوّر المشكلة.":"On ✗: tap a ready note (cleaned on the spot, supervisor informed …) or write what was done, and take a photo."}</li>
    <li>${ar?"★ بند حرج: أي ✗ فيه = أوقف / احجز المنتج واتصل بمدير الجودة فوراً.":"★ critical point: any ✗ = stop / hold product and call the QA Manager at once."}</li>
    <li>${ar?"البنود المكتوب عليها (كان ✗ أمس) فشلت أمس – تأكد أنها أُصلحت.":"Points marked 'was ✗ yesterday' failed yesterday – check they were fixed."}</li>
    <li>${ar?"إذا كان خط أو منطقة لا تعمل اليوم استخدم زر (لا ينطبق لبنود التشغيل): يضع لا ينطبق لبنود (أثناء التشغيل) فقط، وتبقى بنود المبنى مطلوبة.":"If a line or area is not running today, use the 'N/A for its production points' button: it marks only the 'During production' points N/A; building points still need checking."}</li>
    <li>${ar?"كل الهواتف تشوف نفس البيانات: أي تسجيل أو صورة يظهر عند الباقيين خلال ثواني. العلامة أعلى الشاشة توضح حالة المزامنة، وبدون نت يتحفظ كل شيء ويترفع لوحده بعدين.":"All phones see the same data: every mark or photo appears on the others within seconds. The badge at the top shows the sync state; without internet everything is kept and uploaded later on its own."}</li>
    <li>${ar?"بعد الجولة أرسل ملخص واتساب وتقرير عدم المطابقة بالصور.":"After the round send the WhatsApp summary and the NC report with photos."}</li></ul>`,true)}
  ${sec("📷 "+(ar?"الصور":"Photos"),`<ul class="clean">
    <li>${ar?"في أي بند ✗ اضغط الكاميرا لتصوير المشكلة، أو المعرض لاختيار صور محفوظة (حتى 6 صور للبند).":"On any ✗ point tap Camera to photograph the problem, or Gallery to pick saved photos (up to 6 per point)."}</li>
    <li>${ar?"كل صورة تصغر لحوالي 0.2 ميجا ويكتب عليها رقم البند والتاريخ والوقت واسمك ونص البند.":"Each photo is reduced to about 0.2 MB and stamped with the point number, date, time, your name and the point text."}</li>
    <li>${ar?"اضغط على الصورة لعرضها كاملة أو مشاركتها على واتساب أو حذفها (اسحب يمين/شمال للتنقل).":"Tap a photo to see it full size, share it on WhatsApp or delete it (swipe to move between photos)."}</li>
    <li>${ar?"الصور تترفع لقاعدة البيانات ويشوفها الكل، وتصل لمكتب الجودة داخل تقرير عدم المطابقة وملف اليوم. النسخة الكاملة لا تحمل صوراً.":"Photos are uploaded to the shared database for everyone, and reach the QA office inside the NC report and the day file. The full backup carries no photos."}</li>
    <li>${ar?"إذا أعاد التطبيق التحميل بعد التصوير (ذاكرة الهاتف ممتلئة) أضف الصورة مرة أخرى، أو صوّر بكاميرا الهاتف ثم اختر الصورة من المعرض.":"If the app reloads after taking a photo (phone low on memory), add it again, or take it with the phone camera first and pick it from Gallery."}</li>
    <li>${ar?"المساحة المجانية لقاعدة البيانات حوالي 1 جيجا (حوالي 4000 صورة). بعد إرسال الصور يمكن حذف الصور الأقدم من 30 يوم من تبويب إرسال ← مساحة قاعدة البيانات.":"The free database space is about 1 GB (about 4000 photos). Once sent, photos older than 30 days can be deleted in Send → Database storage."}</li></ul>`)}
  ${sec(ar?"طريقة حساب النتيجة":"How the score works",`<p class="muted">${tr("method")}</p>
    <ul class="clean"><li>${ar?"تغطية القسم = البنود المفحوصة ÷ عدد بنود القسم.":"Department coverage = points checked ÷ the department's points."}</li>
    <li>${ar?"كل علامة ✓ تزيد التغطية، وكل علامة ✗ تخفض نتيجة القسم ونتيجة المصنع.":"Every ✓ raises coverage; every ✗ lowers the department score and the facility score."}</li></ul>
    <table class="simple"><tbody>${DEPTS.map(d=>`<tr><td>${esc(L(d))}</td><td class="num">${cnt(d.k)} ${tr("pts")}</td></tr>`).join("")}<tr><td><b>${ar?"الإجمالي":"Total"}</b></td><td class="num"><b>${P.length}</b></td></tr></tbody></table>`)}
  ${sec(`${ar?"البنود الحرجة":"Critical points"} (${crit.length})`,`<p class="muted">${ar?"أي ✗ في بند حرج: إيقاف / حجز المنتج وإبلاغ مدير توكيد الجودة فوراً.":"Any ✗ on a critical point: stop / hold product and inform the QA Manager immediately."}</p><ul class="clean">${crit.map(p=>`<li><span class="num">${p.id}</span> – ${esc(L(p))}</li>`).join("")}</ul>`)}
  ${sec(ar?"التكويد اللوني لأدوات وسلات النظافة (I-PRO-04-01)":"Cleaning tools & bins colour code (I-PRO-04-01)",`<table class="simple"><tbody>${colours.map(c=>`<tr><td><span class="swatch" style="background:${c[0]}"></span> ${c[1]}</td><td>${c[2]}</td></tr>`).join("")}</tbody></table>
    <p class="muted">${ar?"منتجات مسببات الحساسية (خط 2): أدوات وحاويات وزي مخصصة بلون مميز.":"Allergen products (L2): dedicated tools, containers and uniforms in a distinct colour."}</p>`)}
  ${sec(ar?"مناطق النظافة (SOP-L&B-12)":"Hygiene zones (SOP-L&B-12)",`<ul class="clean">
    <li>${ar?"منخفضة: الاستقبال وتخزين البطاطس والتغذية.":"Low: receiving, potato storage, feeding."}</li>
    <li>${ar?"متوسطة: الإنتاج والشحن – غسيل الأيدي وحوض الأقدام وتغيير الزي.":"Medium: production and shipping – hand wash, foot bath, uniform change."}</li>
    <li>${ar?"عالية: التعبئة ومخازن المنتج – غسيل الأيدي وحوض الأقدام وتغيير كامل للزي.":"High: packing and product stores – hand wash, foot bath, full uniform change."}</li>
    <li>${ar?"دخول مقيد: معمل الجودة وغرفة البتر ومخازن كيماويات النظافة والصيانة.":"Restricted: QC lab, batter room, cleaning and maintenance chemical stores."}</li>
    <li>${ar?"اتجاه الهواء من العالية إلى المنخفضة والأبواب بين المناطق مغلقة.":"Air flows from high to low; doors between zones kept closed."}</li></ul>`)}
  ${sec(ar?"مصادر البنود والمتطلبات":"Where the points come from",`<ul class="clean">
    <li>BRCGS Food Safety Issue 9 (4.1–4.16, 5.3, 7.2–7.4) · FSSC 22000 v6 / ISO 22002-100 · ${ar?"قانون الهيئة القومية لسلامة الغذاء 1/2017":"NFSA Law 1/2017"}</li>
    <li>${ar?"تقرير SGS / Simplot بتاريخ 23-07-2026 (الأرضيات – التقشر – التكثيف – المسامير – تسريب الزيت – ستارة الإشيدا – تنك الإضافات)":"SGS / Simplot audit CAR 23-07-2026 (floors, flaking paint, condensation, bolts, oil leaks, Ishida curtain, additives tank)"}</li>
    <li>${ar?"تقييمات البرامج التمهيدية أبريل 2026 (المباني – النظافة والمكافحة – العاملون)":"PRP assessments April 2026 (premises, sanitation & pest control, personnel)"}</li>
    <li>${ar?"ملاحظات فحص الأراضي والمباني الشهري 2026 (F-L&B-04-01)":"Monthly land & building inspection findings 2026 (F-L&B-04-01)"}</li>
    <li>${ar?"خطة الهاسب I-QMS-14-01 إصدار 24 وخطة سلامة الهاش براون وخريطة مكافحة الآفات":"HACCP plan I-QMS-14-01 Rev 24, Hash Brown food safety plan, pest-control site map"}</li>
    <li>SOP-PRO-01, SOP-L&B-03/06/12, SOP-PCP-01, SOP-MTN-07, SOP-C&S-16, I-C&S-01-01, I-PRO-04-01</li></ul>
    <p class="muted">${ar?"الإصدار 5 (تطبيق الموبايل): بنود الفحص بالنظر فقط (بدون السجلات ونقاط التحكم الحرجة ومسحات المعمل، فهذه يتابعها فريق الجودة). سجلات صفحة الويب القديمة تدخل التطبيق من تبويب إرسال ← استيراد الملفات.":"Version 5 (mobile app): visual checks only (records, CCP checks and lab swabs are followed by the QA team). Records from the old web page come in through Send → Import files."}</p>`)}
  <p class="muted small center">UNIFOOD Hygiene Score · F-C&amp;S-01-04 · v${APP_VERSION}</p>`;
}
const APP_VERSION = "5.1.0";

/* ---------- render ---------- */
const $=id=>document.getElementById(id);
const main=$("main");
let renderPending=false;
function softRender(){       // data changed on another phone: re-render, but never while someone is typing
  const ae=document.activeElement;
  if(ae && (ae.tagName==="TEXTAREA" || (ae.tagName==="INPUT" && ae.type!=="checkbox" && ae.type!=="file"))){ renderPending=true; return; }
  render(true);
}
function render(keep){
  if(!S.ready) return;
  renderPending=false;
  if(!S.demo && !PH.byDate.has(S.date)) ensurePhotos(S.date);
  document.documentElement.lang=S.lang; document.documentElement.dir=S.lang==="ar"?"rtl":"ltr";
  document.title=tr("title");
  $("tDate").textContent=dayLabel(S.date);
  $("langBtn").textContent=S.lang==="ar"?"EN":"ع";
  main.classList.remove("anim"); if(!keep){ void main.offsetWidth; main.classList.add("anim"); }
  $("langBtn").setAttribute("aria-label",S.lang==="ar"?"English":"العربية");
  const isToday=S.date===prodNow().date;
  $("nowBtn").setAttribute("aria-label",tr("now")); $("nowBtn").hidden=isToday;
  $("prevDay").setAttribute("aria-label",tr("prevDay")); $("nextDay").setAttribute("aria-label",tr("nextDay"));
  $("dateIn").value=S.date;
  $("tabs").innerHTML=["today","inspect","trend","send","guide"].map(v=>`<a href="#${v}" ${S.view===v?'aria-current="page"':""}>${ICON[v]}<span>${tr(v)}</span></a>`).join("");
  const openState={}; main.querySelectorAll("details.sec").forEach(d=>openState[d.dataset.sec]=d.open);
  const y=window.scrollY, ae=document.activeElement, aeId=ae&&ae.id, selS=ae&&ae.selectionStart;
  main.innerHTML = S.view==="inspect"?viewInspect():S.view==="trend"?viewTrend():S.view==="send"?viewSend():S.view==="guide"?viewGuide():viewToday();
  if(keep){ main.querySelectorAll("details.sec").forEach(d=>{ if(d.dataset.sec in openState) d.open=openState[d.dataset.sec]; }); window.scrollTo(0,y);
    if(aeId){ const el=$(aeId); if(el){ el.focus({preventScroll:true}); try{ if(selS!=null) el.setSelectionRange(selS,selS); }catch(e){} } } }
  if(S.status){ const el=$("saveState"); if(el){ el.textContent=S.status==="err"?tr("saveErr"):"✓ "+tr("saved"); el.className="saving "+(S.status==="err"?"s-bad":""); } }
  if(S.view==="send") storageInfo();
  if(S.view==="inspect"){ const c=document.querySelector("#stepper .cur"); if(c) try{ c.scrollIntoView({block:"nearest",inline:"center"}); }catch(_){} }
  renderSync();
}
function renderSync(){
  const st=DB.syncState(), el=$("sync"); if(!el) return;
  const k = st.err?"err":!st.online?"off":st.busy?"busy":"ok";
  el.className="sync "+k;
  const label=k==="err"?tr("syncErr"):k==="off"?tr("offline"):k==="busy"?tr("syncing"):tr("synced");
  el.innerHTML=`<i></i>${k==="ok"?"":`<span>${label}${st.pending?` (${st.pending})`:""}</span>`}`;
  el.setAttribute("aria-label",label);
  el.dataset.k=k;
}
function toast(t,ms){
  const el=$("toast"); el.textContent=t; el.hidden=false; el.classList.add("show");
  clearTimeout(toast._t); toast._t=setTimeout(()=>{ el.classList.remove("show"); setTimeout(()=>el.hidden=true,250); },ms||2600);
}

/* ---------- filter sheet ---------- */
function openSheet(){
  const sh=$("sheet");
  sh.querySelector(".sheet-body").innerHTML=`<h3>${tr("filters")}</h3>
    <label class="fl">${tr("dept")}</label>
    <div class="chips" id="fDeptChips"><button type="button" data-dept-f="" class="${!S.deptF?"on":""}">${tr("allDepts")}</button>${DEPTS.map(d=>`<button type="button" data-dept-f="${d.k}" class="${S.deptF===d.k?"on":""}">${esc(L(d))}</button>`).join("")}</div>
    <label class="switch"><input id="fOpen" type="checkbox" ${S.onlyOpen?"checked":""}><span>${tr("onlyOpen")}</span><i></i></label>
    <label class="switch"><input id="fHow" type="checkbox" ${S.how?"checked":""}><span>${tr("showHow")}</span><i></i></label>
    <label class="switch"><input id="fRefs" type="checkbox" ${S.refs?"checked":""}><span>${tr("showRefs")}</span><i></i></label>
    <div class="sheet-btns"><button type="button" class="btn" data-sheet="reset">${tr("reset")}</button><button type="button" class="btn primary" data-sheet="close">${tr("done")}</button></div>`;
  sh.hidden=false; requestAnimationFrame(()=>sh.classList.add("open"));
}
function closeSheet(){ const sh=$("sheet"); if(sh.hidden) return false; sh.classList.remove("open"); setTimeout(()=>{ sh.hidden=true; },220); return true; }
$("sheet").addEventListener("click",e=>{
  if(e.target.id==="sheet"){ closeSheet(); return; }
  const dc=e.target.closest("[data-dept-f]"); if(dc){ S.deptF=dc.dataset.deptF; if(S.areaF && !areaSt(S.areaF).total) S.areaF="";
    $("fDeptChips").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b===dc)); render(true); return; }
  const b=e.target.closest("[data-sheet]"); if(!b) return;
  if(b.dataset.sheet==="reset"){ S.deptF=""; S.onlyOpen=false; render(true); openSheet(); return; }
  closeSheet();
});
$("sheet").addEventListener("change",e=>{
  const t=e.target;
  if(t.id==="fRefs"){ S.refs=t.checked; LS.set("_refs",S.refs?"1":"0"); render(true); return; }
  if(t.id==="fOpen"){ S.onlyOpen=t.checked; render(true); return; }
  if(t.id==="fHow"){ S.how=t.checked; LS.set("_how",S.how?"1":"0"); render(true); return; }
});

/* ---------- events ---------- */
async function pickPhotos(btn){
  const pid=btn.dataset.photo, kind=btn.dataset.cam;
  S.lastPt=pid; saveUI();
  const left=MAXPH-photosOf(S.date,pid).length;
  if(N.isNative){
    let blobs=[];
    try{ blobs=await N.takePhotos(kind,left); }catch(e){ console.error(e); const el=$("pm_"+pid); if(el) el.textContent=tr("photoErr"); }
    if(blobs && blobs.length) await addPhotos(pid,blobs,null); else { S.lastPt=""; saveUI(true); }
    return;
  }
  const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*"; if(kind==="camera") inp.capture="environment"; else inp.multiple=true;
  inp.onchange=()=>{ const files=[...(inp.files||[])]; if(files.length) addPhotos(pid,files,inp); };
  inp.click();
}
main.addEventListener("click",async e=>{
  const th=e.target.closest("[data-ph]"); if(th){ lbOpen(th.dataset.ph); return; }
  const stp=e.target.closest("[data-step]"); if(stp){ const k=stp.dataset.step;
    if(k==="*"){ S.areaF=""; S.pickAll=true; } else { S.areaF=k; S.pickAll=false; }
    S.q=""; S.onlyOpen=false; render(); window.scrollTo(0,0); return; }
  const zb=e.target.closest("[data-zoom]"); if(zb){ S.zoom=Math.max(1,Math.min(3,S.zoom+(+zb.dataset.zoom)*0.5)); render(true); return; }
  const qb=e.target.closest("[data-qn]"); if(qb){ const pt=qb.closest(".pt"); if(!pt) return; const id=pt.dataset.id, ta=$("n_"+id);
    const phrase=QN[S.lang][+qb.dataset.qn]; let cur=(ta?ta.value:"").trim();
    if(!cur.includes(phrase)) cur=cur?cur+" – "+phrase:phrase;
    if(ta){ ta.value=cur; ta.classList.remove("need"); } qb.classList.add("on"); N.tap(); setNote(PBY[id],cur,true); return; }
  const pb=e.target.closest("[data-cam]"); if(pb){ pickPhotos(pb); return; }
  const z=e.target.closest(".zone"); if(z){ S.areaF=z.dataset.area; S.deptF=""; S.onlyOpen=false; S.q=""; location.hash="#inspect"; return; }
  const dc=e.target.closest("[data-dept]"); if(dc){ S.deptF=dc.dataset.dept; S.areaF=""; S.onlyOpen=false; S.q=""; location.hash="#inspect"; return; }
  const ac=e.target.closest("div[data-area]"); if(ac){ S.areaF=ac.dataset.area; S.deptF=""; S.onlyOpen=false; S.q=""; location.hash="#inspect"; return; }
  const b=e.target.closest("button"); if(!b) return;
  const act=b.dataset.act;
  if(act==="demo"){ S.demo=!S.demo; if(S.demo) buildDemo(); render(); return; }
  if(act==="filters"){ openSheet(); return; }
  if(act==="clrdept"){ S.deptF=""; render(true); return; }
  if(b.dataset.shift){ S.shift=b.dataset.shift; render(true); return; }
  if(b.dataset.na){ const a=b.dataset.na; for(const p of P) if(p.a===a && p.op && !markOf(S.date,S.shift,p)) setMark(p,"na"); N.tap(); render(true); return; }
  if(b.dataset.v){ const id=b.closest(".pt").dataset.id, p=PBY[id]; const cur=markOf(S.date,S.shift,p);
    const v = cur===b.dataset.v ? null : b.dataset.v; setMark(p,v); render(true);
    if(v==="nc" && p.c) N.alarm(); else N.tap();
    if(v==="nc"){ const ta=$("n_"+id); if(ta) ta.focus({preventScroll:true}); } return; }
  if(act==="wa"){ N.openWhatsApp(daySummary(S.date)); return; }
  if(act==="copy"){ const ok=await N.copyText(daySummary(S.date)); b.textContent=ok?tr("copied"):tr("copyFail"); toast(ok?tr("copied"):tr("copyFail")); return; }
  const say=(id,t)=>{ const m=$(id); if(m) m.textContent=t; };
  if(act==="report"){ if(b.disabled) return; b.disabled=true; say("repMsg",tr("preparing"));
    try{ await saveBlob(`NC_report_${S.date}_${safeName()}.html`, await reportBlob(S.date)); say("repMsg",""); }catch(err){ console.error(err); say("repMsg",tr("saveErr")); }
    b.disabled=false; return; }
  if(act==="sharephotos"){ if(b.disabled) return; b.disabled=true; say("repMsg",tr("preparing"));
    let r=""; try{ r=await shareDayPhotos(S.date); }catch(err){ console.error(err); r="err"; }
    say("repMsg", r==="none"?tr("noPhotos"):r==="err"?tr("saveErr"):""); b.disabled=false; return; }
  if(act==="dayfile"){ if(b.disabled) return; b.disabled=true; say("fileMsg",tr("preparing"));
    try{ await saveBlob(`hygiene_${S.date}_${safeName()}.json`, await dayBlob(S.date)); say("fileMsg",""); }catch(err){ console.error(err); say("fileMsg",tr("saveErr")); }
    b.disabled=false; return; }
  if(act==="allfile"){ try{ await saveFile(`hygiene_ALL_${ymd(new Date())}_${safeName()}.json`, JSON.stringify({app:"unifood-hygiene",v:4,from:S.name||"",docs:[...S.docs.values()],photos:[]}), "application/json"); }catch(err){ say("fileMsg",tr("saveErr")); } return; }
  if(act==="csv"){ say("csvMsg",tr("preparing")); try{ await saveFile(`hygiene_records_${ymd(new Date())}.csv`, await csvAll(), "text/csv"); say("csvMsg",""); }catch(err){ say("csvMsg",tr("saveErr")); } return; }
  if(act==="clear1"||act==="prune1"){ $(act==="clear1"?"clearConfirm":"pruneConfirm").hidden=false; if(act==="clear1") $("clearWordIn").focus(); return; }
  if(act && act.endsWith("Confirm0")){ $(act.slice(0,-1)).hidden=true; return; }
  if(act==="prune2"){ let n=0; try{ n=await pruneOld(30); }catch(err){} render(); say("clearMsg",`${tr("pruned")}: ${n}`); return; }
  if(act==="clear2"){
    if(($("clearWordIn").value||"").trim().toLowerCase()!==tr("clearWord").toLowerCase()) return;
    b.disabled=true; say("clearMsg",tr("preparing"));
    try{
      const keys=[...S.docs.keys()]; S.docs=new Map(); await DB.deleteDocs(keys);
      const ids=(await DB.allPhotoMetas()).map(m=>m.id); await DB.deletePhotos(ids);
      PH.byDate.clear(); PH.local.clear();
    }catch(err){ console.error(err); }
    render(); say("clearMsg",tr("cleared")); return; }
});
main.addEventListener("keydown",e=>{ const z=e.target.closest&&e.target.closest(".zone,[role=button]"); if(z && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); z.dispatchEvent(new MouseEvent("click",{bubbles:true})); } });
main.addEventListener("input",e=>{
  const t=e.target;
  if(t.tagName==="TEXTAREA" && t.id.startsWith("n_")){ t.classList.toggle("need",!t.value.trim()); setNote(PBY[t.id.slice(2)],t.value); return; }
  if(t.id==="fQ"){ S.q=t.value.trim(); clearTimeout(main._qt); main._qt=setTimeout(()=>render(true),250); return; }
  if(t.id==="clearWordIn"){ $("clear2Btn").disabled = t.value.trim().toLowerCase()!==tr("clearWord").toLowerCase(); return; }
});
main.addEventListener("focusout",e=>{
  const t=e.target;
  if(t.tagName==="TEXTAREA" && t.id.startsWith("n_")) flushNotes();
  setTimeout(()=>{ if(renderPending) softRender(); },0);
});
main.addEventListener("change",async e=>{
  const t=e.target;
  if(t.id==="nameIn"){ S.name=t.value.trim(); LS.set("_name",S.name); toast("✓ "+tr("saved")); return; }
  if(t.id==="impIn"){ let n=0,ph=0,bad=0; const files=[...t.files];
    const m0=$("impMsg"); if(m0) m0.textContent=tr("preparing");
    for(const f of files){ try{ const o=JSON.parse(await f.text()); if(!o || !Array.isArray(o.docs)) throw 0; n+=mergeDocs(o.docs); ph+=await importPhotos(o.photos); }catch(_){ bad++; } }
    render(); const m=$("impMsg"); if(m) m.textContent=`${tr("imported")}: ${n} · ${tr("photosAdded")}: ${ph}${bad?` · ${tr("badFiles")}: ${bad}`:""}`; }
});

(()=>{ let x0=null,y0=0,t0=0;   // swipe left / right on Inspect = next / previous area
  main.addEventListener("touchstart",e=>{ x0=null; if(S.view!=="inspect"||!S.areaF||e.touches.length!==1) return;
    if(e.target.closest(".stepper,textarea,input,.mapwrap,.qn,.ph")) return; x0=e.touches[0].clientX; y0=e.touches[0].clientY; t0=Date.now(); },{passive:true});
  main.addEventListener("touchend",e=>{ if(x0==null) return; const dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0; x0=null;
    if(Date.now()-t0>600 || Math.abs(dx)<90 || Math.abs(dx)<Math.abs(dy)*2) return;
    const vis=AREAS.filter(a=>areaSt(a.k).total), i=vis.findIndex(a=>a.k===S.areaF), fwd=(dx<0)!==(S.lang==="ar"), nx=vis[i+(fwd?1:-1)];
    if(nx){ N.tap(); S.areaF=nx.k; S.q=""; S.onlyOpen=false; render(); window.scrollTo(0,0); } },{passive:true});
})();

/* ---------- photo viewer ---------- */
const LB={list:[],i:0,url:"",ret:"",pt:""};
function lbOpen(id){
  const m=photosDay(S.date).find(x=>x.id===id); if(!m) return;
  LB.list=photosOf(S.date,m.point).slice(); LB.i=Math.max(0,LB.list.findIndex(x=>x.id===id)); LB.ret=id; LB.pt=m.point;
  const rtl=S.lang==="ar";
  $("lbPrev").textContent=rtl?"›":"‹"; $("lbNext").textContent=rtl?"‹":"›";
  $("lbPrev").setAttribute("aria-label",tr("prev")); $("lbNext").setAttribute("aria-label",tr("next")); $("lbClose").setAttribute("aria-label",tr("close"));
  $("lbShare").textContent=tr("share"); $("lbDel").textContent=tr("del"); $("lbDel2").textContent=tr("yesDel"); $("lbDel0").textContent=tr("cancel"); $("lbSure").textContent=tr("delSure");
  $("lb").hidden=false; document.body.style.overflow="hidden";
  lbShow();
}
async function lbShow(){
  const m=LB.list[LB.i]; if(!m){ lbClose(); return; }
  const p=PBY[m.point];
  $("lbCap").innerHTML=`<b class="num">${esc(m.point)}</b> · ${esc(L(p))}<br><small class="num">${esc(m.date)} ${hhmm(m.at)}${m.who?" · "+esc(m.who):""} · ${LB.i+1}/${LB.list.length}</small>`;
  $("lbConfirm").hidden=true;
  $("lbPrev").disabled=LB.i<=0; $("lbNext").disabled=LB.i>=LB.list.length-1;
  $("lbDel").disabled=S.demo;
  const img=$("lbImg"); img.alt=`${m.point} – ${tr("photo")} ${LB.i+1}`; img.src=turl(m);
  let b=null; try{ b=await getFull(m.id); }catch(e){}
  if(LB.list[LB.i]!==m || $("lb").hidden) return;
  if(LB.url) URL.revokeObjectURL(LB.url); LB.url=b?URL.createObjectURL(b):""; if(LB.url) img.src=LB.url;
}
function lbClose(){
  const el=$("lb"); if(el.hidden) return false;
  el.hidden=true; document.body.style.overflow="";
  if(LB.url){ URL.revokeObjectURL(LB.url); LB.url=""; }
  $("lbImg").removeAttribute("src");
  return true;
}
function lbStep(dir){ const j=LB.i+dir; if(j>=0&&j<LB.list.length){ LB.i=j; lbShow(); } }
$("lb").addEventListener("click",async e=>{
  const b=e.target.closest("[data-lb]"); if(!b){ if(e.target.id==="lb"||e.target.classList.contains("lbimg")) lbClose(); return; }
  const a=b.dataset.lb, m=LB.list[LB.i];
  if(a==="close") lbClose();
  else if(a==="prev") lbStep(-1);
  else if(a==="next") lbStep(1);
  else if(a==="share" && m) shareOne(m).catch(()=>{});
  else if(a==="del" && m && !S.demo){ $("lbConfirm").hidden=false; }
  else if(a==="del0"){ $("lbConfirm").hidden=true; }
  else if(a==="del2" && m){
    try{ await DB.deletePhotos([m.id]); phIndexDel(m.id); }catch(err){}
    LB.list.splice(LB.i,1); if(LB.i>=LB.list.length) LB.i=LB.list.length-1;
    render(true);
    if(!LB.list.length){ LB.ret=""; lbClose(); } else { LB.ret=LB.list[LB.i].id; lbShow(); }
  }
});
(()=>{ let x0=null,y0=0;   // swipe between photos
  const el=$("lb");
  el.addEventListener("touchstart",e=>{ if(e.touches.length===1){ x0=e.touches[0].clientX; y0=e.touches[0].clientY; } },{passive:true});
  el.addEventListener("touchend",e=>{ if(x0==null) return; const dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0; x0=null;
    if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5){ const fwd=(dx<0)!==(S.lang==="ar"); lbStep(fwd?1:-1); } },{passive:true});
})();
document.addEventListener("keydown",e=>{
  if($("lb").hidden) return;
  const rtl=S.lang==="ar";
  if(e.key==="Escape"){ e.preventDefault(); lbClose(); }
  else if(e.key==="ArrowLeft"||e.key==="ArrowRight"){ const fwd=(e.key==="ArrowRight")!==rtl; lbStep(fwd?1:-1); }
});

/* ---------- header ---------- */
function setDate(d){ if(!d) return; flushNotes(); S.date=d; S.pickAll=false; if(S.view==="inspect" && !S.deptF && !S.q && !S.onlyOpen) S.areaF=firstOpenArea(); render(); }
$("dateIn").addEventListener("change",e=>setDate(e.target.value));
$("dateBtn").addEventListener("click",()=>{ const i=$("dateIn"); try{ i.showPicker(); }catch(e){ i.focus(); i.click(); } });
$("prevDay").addEventListener("click",()=>setDate(addDays(S.date,-1)));
$("nextDay").addEventListener("click",()=>setDate(addDays(S.date,1)));
$("nowBtn").addEventListener("click",()=>setDate(prodNow().date));
$("langBtn").addEventListener("click",()=>{ S.lang=S.lang==="ar"?"en":"ar"; LS.set("_lang",S.lang); if(S.demo) buildDemo(); render(true); });
$("sync").addEventListener("click",()=>{ const k=$("sync").dataset.k; toast(tr(k==="err"?"syncHelpErr":k==="off"?"syncHelpOff":k==="busy"?"syncHelpBusy":"syncHelpOk"),4000); });
$("tabs").addEventListener("click",()=>N.tap());
function route(){
  flushNotes();
  const v=location.hash.slice(1); S.view=["today","inspect","trend","send","guide"].includes(v)?v:"today";
  // Inspect opens on the next area of the round that still has unchecked points
  if(S.view==="inspect" && !S.pickAll && !S.areaF && !S.deptF && !S.q && !S.onlyOpen) S.areaF=firstOpenArea();
  render(); window.scrollTo(0,0);
}
window.addEventListener("hashchange",route);
N.onBack(()=>{
  if(lbClose()) return true;
  if(closeSheet()) return true;
  if(S.demo){ S.demo=false; render(); return true; }
  if(S.view!=="today"){ location.hash="#today"; return true; }
  return false;
});
N.onResume(()=>{ if(S.ready){ const t=prodNow().date; if(S.lastDay && S.lastDay!==t && S.date===S.lastDay){ S.date=t; } S.lastDay=t; render(true); } });

/* ---------- start ---------- */
(async()=>{
  N.setBars();
  S.name=LS.get("_name",""); S.how=LS.get("_how","1")!=="0"; S.refs=LS.get("_refs","0")==="1";
  S.date=prodNow().date; S.lastDay=S.date; S.shift="D"; restoreUI();
  DB.onSync(renderSync);
  let first=true;
  const start=()=>{ if(S.ready) return; S.ready=true; $("splash").classList.add("gone"); setTimeout(()=>$("splash").remove(),400);
    if(S.restorePt && location.hash!=="#inspect") history.replaceState(null,"","#inspect");
    route();
    if(S.restorePt){ const el=document.querySelector(`.pt[data-id="${S.restorePt}"]`); if(el) el.scrollIntoView({block:"center"}); S.restorePt=""; } };
  try{
    DB.listenDocs((m)=>{
      const next=new Map(); for(const [k,d] of m) next.set(k,normDoc(d,k));
      const same = !first && next.size===S.docs.size && [...next].every(([k,d])=>canon(d)===canon(normDoc(S.docs.get(k)||{},k)));
      S.docs=next;
      if(first){ first=false; start(); return; }
      if(!same) softRender();
    });
  }catch(e){ console.error(e); S.storageOff=true; start(); }
  setTimeout(start,4000);   // first start without internet: show the app anyway
  $("splashMsg").textContent=tr("loading");
})();
