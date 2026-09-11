import { FRAMEWORK } from './framework.ts';
export type Row = Record<string, any>;
export const SUBJECTS = ['reading','math','science'];
export const THRESHOLDS = { mastered:80, near:65, support:50 };
export const tidy = (x:unknown,n=160) => String(x ?? '').normalize('NFC').trim().replace(/\s+/g,' ').slice(0,n);
export function fail(message:string,status=400):never { throw Object.assign(new Error(message),{status}); }
export const hash = async (x:string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export const token = (n=24) => [...crypto.getRandomValues(new Uint8Array(n))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function randomFrom(s:string) { let v=2166136261;for(const c of s)v=Math.imul(v^c.charCodeAt(0),16777619);return ()=>{v+=0x6D2B79F5;let t=Math.imul(v^(v>>>15),1|v);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;}; }
export function shuffle<T>(xs:T[],r= Math.random):T[] {const a=xs.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function questionKey(q:Row) {return JSON.stringify([q.context ?? q.context_text ?? '',q.question ?? q.question_text ?? '',[...(q.options||[])].map(String).sort(),q.image?.url||'']);}
export function indicatorOf(q:Row) {return q.indicator_key||`${q.subject||q.subject_key}:${q.outcome||q.outcome_code}:i${q.indicator||q.indicator_index}`;}
export function cleanAnswers(questions:Row[],raw:unknown) {const result:Row={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;for(const q of questions){const x=(raw as Row)[q.id];if(typeof x==='number'&&Number.isInteger(x)&&x>=0&&x<q.options.length)result[q.id]=x;}return result;}
export function gradeQuestions(qs:Row[],answers:Row) {let score=0;for(const q of qs)if(Number.isInteger(answers[q.id])&&answers[q.id]>=0&&answers[q.id]===q.correctIndex)score++;return{score,total:qs.length,percent:qs.length?Math.round(score*10000/qs.length)/100:0};}
export function gradeSections(sections:Row[],answers:Row) {const section_scores=sections.map(s=>({subject:s.subject,...gradeQuestions(s.questions,answers)}));const score=section_scores.reduce((a,s)=>a+s.score,0),total=section_scores.reduce((a,s)=>a+s.total,0);return{score,total,percent:total?Math.round(score*10000/total)/100:0,section_scores};}
export function publicQuestions(qs:Row[]) {return qs.map(q=>({id:q.id,context:q.context,question:q.question,options:q.options,image:q.image||null}));}
export function publicSections(ss:Row[]) {return ss.map(s=>({subject:s.subject,duration_minutes:s.duration_minutes,calculator:s.calculator,questions:publicQuestions(s.questions)}));}
export function permuteQuestion(q:Row,r:()=>number) {const order=shuffle(q.options.map((_:unknown,i:number)=>i),r);return{...q,options:order.map((i:number)=>q.options[i]),correctIndex:order.indexOf(q.correctIndex)};}
export function normalizeConfig(raw:unknown):Row {
 if(!raw||typeof raw!=='object')fail('إعدادات الاختبار غير صحيحة.');const v=raw as Row;
 const kind=['indicator','multi_indicator','simulation'].includes(v.kind)?v.kind:'simulation';
 const isSimulation=v.bank_source==='simulation_bank';
 const simulation_mode=isSimulation?(v.simulation_mode==='custom'?'custom':'standard'):undefined;
 const supplied=v.settings||v;
 const date=(x:unknown)=>{if(!x)return null;const d=new Date(String(x));if(!Number.isFinite(d.getTime()))fail('تاريخ الاختبار غير صحيح.');return d.toISOString();};
 const settings:Row={show_result:supplied.show_result!==false,show_answers:supplied.show_answers===true,show_indicator_result:supplied.show_indicator_result!==false,show_correct_count:supplied.show_correct_count!==false,shuffle_questions:supplied.shuffle_questions!==false,shuffle_options:supplied.shuffle_options!==false,allow_copy:supplied.allow_copy===true,disable_right_click:supplied.disable_right_click!==false,disable_print:supplied.disable_print!==false,disable_shortcuts:supplied.disable_shortcuts!==false,allow_back:supplied.allow_back!==false,one_per_page:supplied.one_per_page!==false,lock_session:supplied.lock_session!==false,log_visibility:supplied.log_visibility!==false,watermark:supplied.watermark!==false,opens_at:date(supplied.opens_at),closes_at:date(supplied.closes_at),attempts:Number(supplied.attempts||1),break_minutes:Number(supplied.break_minutes||0)};
 if(!Number.isInteger(settings.attempts)||settings.attempts<1||settings.attempts>10)fail('عدد المحاولات يجب أن يكون من ١ إلى ١٠.');
 if(!Number.isInteger(settings.break_minutes)||settings.break_minutes<0||settings.break_minutes>30)fail('الاستراحة من صفر إلى ٣٠ دقيقة.');
 if(settings.opens_at&&settings.closes_at&&settings.opens_at>=settings.closes_at)fail('وقت النهاية يجب أن يكون بعد البداية.');
 const sections:Row[]=[];const seen=new Set();for(const x of v.sections||[]){
  if(!SUBJECTS.includes(x.subject)||seen.has(x.subject))fail('حدد مادة الاختبار دون تكرار.');seen.add(x.subject);
  const minutes=Number(x.duration_minutes);if(!Number.isInteger(minutes)||minutes<5||minutes>120)fail('مدة المادة من ٥ إلى ١٢٠ دقيقة.');
  let count=Number(x.question_count);let indicators:Row[]=[];
  const isIndicatorMode=(kind!=='simulation')||(isSimulation&&simulation_mode==='custom');
  if(isIndicatorMode){
   for(const i of x.indicators||[]){const key=typeof i==='string'?i:i.key;const entry=FRAMEWORK.find(k=>k.key===key&&k.subject===x.subject);if(!entry||indicators.some(k=>k.key===key))fail('اختيار المؤشرات غير صحيح.');indicators.push({...entry,count:Number(i.count||0)});}
   if(!indicators.length)fail('اختر مؤشرًا واحدًا على الأقل.');
   if(v.count_mode==='per_indicator') {if(indicators.some(i=>!Number.isInteger(i.count)||i.count<1||i.count>30))fail('عدد أسئلة المؤشر من ١ إلى ٣٠.');count=indicators.reduce((s,i)=>s+i.count,0);}
   else {if(count<indicators.length)fail('عدد الأسئلة أقل من عدد المؤشرات؛ يلزم سؤال واحد على الأقل لكل مؤشر.');indicators=indicators.map((i,n)=>({...i,count:Math.floor(count/indicators.length)+(n<count%indicators.length?1:0)}));}
  }
  if(!Number.isInteger(count)||count<(kind==='simulation'&&simulation_mode==='standard'?5:1)||count>60)fail('عدد الأسئلة غير صالح؛ الحد الأعلى ٦٠ سؤالًا للمادة.');
  const model=Number(x.model_no||1);if(!Number.isInteger(model)||model<1||model>60)fail('رقم المحاكاة من ١ إلى ٦٠.');
  const fixed=x.fixed_model?Number(x.fixed_model):null;if(fixed&&(![1,2].includes(fixed)||indicators.length!==1||count!==15))fail('النموذج الثابت يتكون من ١٥ سؤالًا لمؤشر واحد.');
  sections.push({subject:x.subject,question_count:count,duration_minutes:minutes,calculator:x.subject==='math'&&!!x.calculator,model_no:model,indicators,fixed_model:fixed});
 }
 if(!sections.length||sections.length>3)fail('اختر مادة واحدة على الأقل.');
 const num=sections.reduce((s,x)=>s+x.indicators.length,0);
 const identity=['manual','list','email'].includes(v.identity_mode)?v.identity_mode:'manual';
 const roster=[...new Set((Array.isArray(v.roster)?v.roster:[]).map((n:unknown)=>tidy(n,120)).filter(Boolean))].slice(0,1000);
 if(identity==='list'&&!roster.length)fail('أدخل قائمة أسماء الطلاب.');
 const defaultTitle=isSimulation?(simulation_mode==='custom'?'محاكاة مخصصة بالمؤشرات':'محاكاة شاملة'):(num===1?'اختبار مؤشر نافس':'اختبار مؤشرات مجمعة');
 return {kind:isSimulation?'simulation':kind==='simulation'?'simulation':num===1?'indicator':'multi_indicator',simulation_mode,bank_source:isSimulation?'simulation_bank':(v.bank_source||'indicator_bank'),grade_key:'middle_3',title:tidy(v.title)||defaultTitle,class_name:tidy(v.class_name,80),term:tidy(v.term||v.academic_term,80),academic_term:tidy(v.academic_term||v.term,80),school_name:tidy(v.school_name,120),teacher_name:tidy(v.teacher_name,120),principal_name:tidy(v.principal_name,120),identity_mode:identity,roster,sections,count_mode:v.count_mode==='per_indicator'?'per_indicator':'total',settings};
}
export function selectUnique(pool:Row[],count:number,seed:string,usage=new Map<string,number>(),excluded=new Set<string>()):Row[] {
 const keys=new Map(pool.map(q=>[q,questionKey(q)]));const mixed=shuffle(pool,randomFrom(seed));const picked:Row[]=[];const content=new Set(excluded),indicatorCounts=new Map<string,number>(),cognitiveCounts=new Map<string,number>();
 while(picked.length<count){let candidate:Row|undefined,best=Infinity;
  for(const q of mixed){const key=keys.get(q)!;if(content.has(key))continue;const k=indicatorOf(q);const value=(usage.get(q.id)||0)*100000+(indicatorCounts.get(k)||0)*1000+(cognitiveCounts.get(q.cognitive_level)||0)*5;
   if(value<best){best=value;candidate=q;}}
  if(!candidate)fail(`لا توجد أسئلة مستقلة كافية: المطلوب ${count} والمتاح ${picked.length}.`);
  picked.push(candidate);content.add(keys.get(candidate)!);usage.set(candidate.id,(usage.get(candidate.id)||0)+1);const k=indicatorOf(candidate);indicatorCounts.set(k,(indicatorCounts.get(k)||0)+1);cognitiveCounts.set(candidate.cognitive_level,(cognitiveCounts.get(candidate.cognitive_level)||0)+1);
 }
 return picked;
}
export function buildForms(pool:Row[],subject:string):Row[] {const usage=new Map<string,number>(),forms:Row[]=[],signatures=new Set<string>();for(let m=1;m<=60;m++){const qs=selectUnique(pool,30,`${subject}|form|${m}`,usage);const signature=qs.map(q=>q.id).sort().join('|');if(signatures.has(signature))fail('البنك لا يكفي لتكوين ٦٠ محاكاة مختلفة.');signatures.add(signature);forms.push({subject,model_no:m,questions:qs,signature});}return forms;}

export function normalizeArabicName(name: string): string {
  return String(name || '')
    .normalize('NFKC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeLast3Digits(digits: unknown): string {
  return String(digits || '')
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\D/g, '')
    .slice(-3);
}

export async function verifyStudentIdentity(db: any, rawName: string, rawLast3: string, rawClass?: string): Promise<Row> {
  const normDigits = normalizeLast3Digits(rawLast3);
  const normName = normalizeArabicName(rawName);
  const normClass = String(rawClass || '').trim();
  const MISMATCH_MSG = 'بيانات الطالب غير متطابقة، تأكد من الاسم كما هو في كشف المدرسة وآخر ثلاثة أرقام من الهوية والفصل.';

  if (!normDigits || normDigits.length !== 3 || !normName || normName.length < 2 || !normClass) {
    fail(MISMATCH_MSG, 400);
  }

  const { data: candidates, error } = await db
    .from('nafes_students')
    .select('id,full_name,name_normalized,grade,class_name,national_id_last3,is_active')
    .eq('national_id_last3', normDigits)
    .eq('class_name', normClass)
    .eq('is_active', true);
  if (error) throw error;

  const exactMatches = (candidates || []).filter((c: Row) => c.name_normalized === normName);
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) fail('تم العثور على أكثر من طالب مطابق بنفس البيانات؛ راجع المعلم لتفادي التضارب.', 409);
  fail(MISMATCH_MSG, 404);
}
