(()=>{
'use strict';

const VERSION='internal-corrector-v1';
const ARABIC='\u0621-\u064A\u066E-\u06D3';
const UI_SKIP='script,style,pre,code,textarea,input,select,option,svg,canvas,.question,.semantic-question,.student-name,.questions-flow,.paper-page,.indicator p,.outcome-title,.data-table tbody,.report-sheet,.official-analysis-sheet,.nafes-absence-sheet,[data-no-autocorrect]';

const wordFixes=[
  ['تغييوا','تغيبوا'],
  ['الاسئله','الأسئلة'],['الاسئلة','الأسئلة'],
  ['الاجابات','الإجابات'],['الاجابة','الإجابة'],
  ['المراجعه','المراجعة'],
  ['انشاء','إنشاء'],['الانشاء','الإنشاء'],
  ['اعدادات','إعدادات'],['اعداد','إعداد'],
  ['اوامر','أوامر'],['اخطاء','أخطاء'],
  ['مساحه','مساحة'],['قراءه','قراءة'],
  ['الاختبار الالي','الاختبار الآلي'],
  ['التصحيح الالي','التصحيح الآلي'],
  ['إختبار','اختبار'],['إختبارات','اختبارات'],
  ['إسم','اسم']
];

function escapeRegExp(v){return String(v).replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');}
function issue(severity,kind,message,applied=false){return{severity,kind,message,applied};}
function replaceWord(text,from,to,issues){
  const re=new RegExp('(^|[^'+ARABIC+'])'+escapeRegExp(from)+'(?=$|[^'+ARABIC+'])','gu');
  let changed=false;
  const out=text.replace(re,(m,p1)=>{changed=true;return p1+to;});
  if(changed)issues.push(issue('info','spelling','استبدال «'+from+'» بـ «'+to+'».',true));
  return out;
}
function baseTextFix(value){
  const issues=[];
  let text=String(value??'').normalize('NFKC').replace(/\u0640+/g,'');
  const original=text;

  const beforeSpaces=text;
  text=text.replace(/[ \t]{2,}/g,' ');
  if(text!==beforeSpaces)issues.push(issue('info','spacing','إزالة المسافات الزائدة.',true));

  for(const [from,to] of wordFixes)text=replaceWord(text,from,to,issues);

  let next=text.replace(new RegExp('(['+ARABIC+'])\\?','gu'),'$1؟')
    .replace(new RegExp('(['+ARABIC+']);','gu'),'$1؛')
    .replace(new RegExp('(['+ARABIC+']),(?=['+ARABIC+'])','gu'),'$1،');
  if(next!==text){issues.push(issue('info','punctuation','توحيد علامات الترقيم العربية.',true));text=next;}

  next=text.replace(/\s+([،؛؟!:.])/g,'$1').replace(/([،؛؟!:.])(?=[^\s\n،؛؟!:.])/g,'$1 ');
  if(next!==text){issues.push(issue('info','spacing','ضبط المسافات حول علامات الترقيم.',true));text=next;}

  next=text.replace(/([؟!،؛])\1+/g,'$1');
  if(next!==text){issues.push(issue('info','punctuation','إزالة تكرار علامات الترقيم.',true));text=next;}

  return{original,corrected:text,issues};
}

function balanced(text,pairs){
  const stack=[],open=Object.keys(pairs),close=Object.values(pairs);
  let quote='',escape=false,lineComment=false,blockComment=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],n=text[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue;}
    if(blockComment){if(ch==='*'&&n==='/'){blockComment=false;i++;}continue;}
    if(quote){
      if(escape){escape=false;continue;}
      if(ch==='\\'){escape=true;continue;}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='/'&&n==='/'){lineComment=true;i++;continue;}
    if(ch==='/'&&n==='*'){blockComment=true;i++;continue;}
    if(ch==='"'||ch==="'"||ch==='\x60'){quote=ch;continue;}
    const oi=open.indexOf(ch);
    if(oi>=0){stack.push(ch);continue;}
    const ci=close.indexOf(ch);
    if(ci>=0){if(!stack.length||pairs[stack.pop()]!==ch)return false;}
  }
  return !stack.length&&!quote&&!blockComment;
}

function instructionIssues(text){
  const out=[];
  if(/(?:احذف|حذف|امسح|مسح)\s+(?:كل|جميع)/i.test(text))out.push(issue('critical','destructive','أمر حذف واسع: يجب تحديد العنصر أو الاختبار أو المعرّف صراحةً قبل التنفيذ.'));
  if(/(?:بدون|دون)\s+(?:مراجعة|تأكيد|تحقق)/i.test(text))out.push(issue('warning','safety','التعليمات تطلب تجاوز المراجعة أو التحقق؛ أبقِ خطوة تأكيد للعمليات الحساسة.'));
  if(/(?:عدل|عدّل|نفذ|نفّذ|ارفع|commit).{0,45}\bmain\b/i.test(text))out.push(issue('critical','deployment','التعليمات تشير إلى تعديل مباشر على main؛ استخدم فرعًا مخصصًا واختبار نشر قبل الدمج.'));
  if(/delete\s+from\s+[\w.]+\s*;?/i.test(text)&&!/where\s+/i.test(text))out.push(issue('critical','database','يوجد DELETE بلا WHERE؛ هذا نمط حذف واسع غير آمن.'));
  return out;
}
function sqlIssues(text){
  const out=[];
  const statements=String(text).split(';').map(x=>x.trim()).filter(Boolean);
  for(const s of statements){
    if(/^delete\s+from\s+/i.test(s)&&!/\bwhere\b/i.test(s))out.push(issue('critical','sql','DELETE بلا WHERE.'));
    if(/^update\s+/i.test(s)&&/\bset\b/i.test(s)&&!/\bwhere\b/i.test(s))out.push(issue('critical','sql','UPDATE بلا WHERE.'));
    if(/^truncate\b/i.test(s))out.push(issue('critical','sql','TRUNCATE عملية حذف شاملة وتحتاج تأكيدًا صريحًا.'));
    if(/^drop\s+(table|schema|database)\b/i.test(s))out.push(issue('critical','sql','DROP عملية مدمرة وتحتاج خطة استعادة وموافقة صريحة.'));
    if(/disable\s+row\s+level\s+security/i.test(s))out.push(issue('critical','sql','تعطيل RLS قد يفتح البيانات عبر Data API.'));
    if(/security\s+definer/i.test(s))out.push(issue('warning','sql','SECURITY DEFINER يحتاج مراجعة صلاحيات وsearch_path بدقة.'));
    if(/grant\s+all/i.test(s))out.push(issue('warning','sql','GRANT ALL أوسع من مبدأ أقل صلاحية.'));
  }
  return out;
}
function jsIssues(text){
  const out=[];
  if(!balanced(text,{'{':'}','(':')','[':']'}))out.push(issue('critical','javascript','الأقواس أو علامات الاقتباس غير متوازنة.'));
  if(/\beval\s*\(/.test(text))out.push(issue('critical','javascript','استخدام eval غير آمن في واجهة المنصة.'));
  if(/\.innerHTML\s*=\s*[^'"`]/.test(text))out.push(issue('warning','javascript','إسناد innerHTML من قيمة متغيرة يحتاج تعقيمًا لمنع XSS.'));
  if(/localStorage\.setItem\([^)]*(?:password|secret|service[_-]?role|teacher[_-]?key)/i.test(text))out.push(issue('critical','javascript','لا تخزّن كلمات المرور أو المفاتيح الحساسة في localStorage.'));
  return out;
}
function cssIssues(text){
  const out=[];
  if(!balanced(text,{'{':'}'}))out.push(issue('critical','css','أقواس CSS غير متوازنة.'));
  const important=(text.match(/!important/g)||[]).length;
  if(important>8)out.push(issue('warning','css','يوجد '+important+' استخدامًا لـ !important؛ قد يسبب تعارضات في cascade.'));
  if(/height\s*:\s*297mm/i.test(text))out.push(issue('warning','print','ارتفاع A4 ثابت 297mm قد يسبب فراغات أو قصًا عند وجود هوامش.'));
  if(/(?:page-break-after\s*:\s*always|break-after\s*:\s*page)/i.test(text))out.push(issue('warning','print','كسر صفحة إجباري قد يترك فراغات كبيرة في الطباعة.'));
  return out;
}
function htmlIssues(text){
  const out=[];
  if(/\\n/.test(text))out.push(issue('warning','html','يوجد \\n حرفي داخل HTML؛ راجعه لأنه قد يظهر للمستخدم كنص.'));
  const imgs=[...text.matchAll(/<img\b([^>]*)>/gi)];
  for(const m of imgs)if(!/\balt\s*=/.test(m[1]))out.push(issue('warning','accessibility','عنصر img بدون alt.'));
  return out;
}

function analyze(value,mode='arabic'){
  mode=String(mode||'arabic').toLowerCase();
  const source=String(value??'');
  const textModes=mode==='arabic'||mode==='instruction';
  const base=textModes?baseTextFix(source):{original:source,corrected:source.replace(/[ \t]+$/gm,''),issues:[]};
  const issues=[...base.issues];
  if(mode==='instruction')issues.push(...instructionIssues(base.corrected));
  if(mode==='sql')issues.push(...sqlIssues(base.corrected));
  if(mode==='javascript')issues.push(...jsIssues(base.corrected));
  if(mode==='css')issues.push(...cssIssues(base.corrected));
  if(mode==='html'){
    const htmlBase=baseTextFix(source);
    base.corrected=htmlBase.corrected;
    issues.push(...htmlBase.issues,...htmlIssues(base.corrected));
  }
  const auto=issues.filter(x=>x.applied).length;
  const review=issues.filter(x=>!x.applied).length;
  return{version:VERSION,mode,original:source,corrected:base.corrected,issues,auto_fix_count:auto,review_count:review,changed:source!==base.corrected};
}

function correctUiNode(node){
  if(!node||!node.parentElement||node.parentElement.closest(UI_SKIP))return 0;
  const raw=node.nodeValue||'';
  if(!/[\u0600-\u06FF]/.test(raw))return 0;
  const res=baseTextFix(raw);
  if(res.corrected!==raw){node.nodeValue=res.corrected;return 1;}
  return 0;
}
function correctUi(root=document.body){
  if(!root||!document.createTreeWalker)return 0;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let count=0,node;
  while((node=walker.nextNode()))count+=correctUiNode(node);
  if(count)window.dispatchEvent(new CustomEvent('moallimi:autocorrect',{detail:{count,version:VERSION}}));
  return count;
}
function startUiAutoCorrect(){
  const run=()=>correctUi(document.body);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  const obs=new MutationObserver(records=>{
    let count=0;
    for(const r of records)for(const n of r.addedNodes||[]){
      if(n.nodeType===Node.TEXT_NODE)count+=correctUiNode(n);
      else if(n.nodeType===Node.ELEMENT_NODE&&!n.matches?.(UI_SKIP)&&!n.closest?.(UI_SKIP))count+=correctUi(n);
    }
    if(count)window.dispatchEvent(new CustomEvent('moallimi:autocorrect',{detail:{count,version:VERSION}}));
  });
  const begin=()=>document.body&&obs.observe(document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
  return obs;
}

window.MoallimiCorrector={version:VERSION,analyze,correctUi,startUiAutoCorrect};
startUiAutoCorrect();
})();