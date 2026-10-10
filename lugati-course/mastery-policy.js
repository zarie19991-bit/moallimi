// محرك سياسة الإتقان — مستقل عن الواجهة
export const MASTERY_STATUS = Object.freeze({
  NOT_STARTED:"not_started",
  LEARNING:"learning",
  CHECKING:"checking",
  NEEDS_REMEDIATION:"needs_remediation",
  RETRY_READY:"retry_ready",
  MASTERED:"mastered"
});

export const MASTERY_CONFIG = Object.freeze({
  pointQuestionCount:3,
  pointRequiredCorrect:2,
  lessonMasteryPercent:85,
  unitMasteryPercent:85,
  minimumCoreObjectivePercent:80,
  enhancedExplanationAfterWrong:2,
  remediationAfterWrong:3,
  retentionCheckDays:[7,21],
  maxConsecutiveSameVariant:0,
  serverAuthoritative:true
});

export const RUBRICS = {
  handwriting:{
    scale:4,
    criteria:[
      {id:"shape",label:"صحة شكل الحرف",core:true},
      {id:"baseline",label:"الموضع على السطر",core:true},
      {id:"balance",label:"الاتزان والمسافات",core:true},
      {id:"legibility",label:"الوضوح العام",core:true}
    ],
    pass:3
  },
  ceremonial_speech_writing:{
    scale:4,
    criteria:[
      {id:"purpose",label:"وضوح المناسبة والهدف",core:true},
      {id:"structure",label:"مقدمة وعرض وخاتمة",core:true},
      {id:"ideas",label:"ترابط الأفكار والشواهد",core:true},
      {id:"language",label:"سلامة اللغة والأسلوب",core:true},
      {id:"revision",label:"المراجعة والتنقيح",core:false}
    ],
    pass:3
  },
  speech_delivery:{
    scale:4,
    criteria:[
      {id:"voice",label:"وضوح الصوت",core:true},
      {id:"pauses",label:"الوقفات والتنغيم",core:true},
      {id:"sequence",label:"التسلسل",core:true},
      {id:"audience",label:"التواصل مع الجمهور",core:true}
    ],
    pass:3
  },
  biography_writing:{
    scale:4,
    criteria:[
      {id:"accuracy",label:"دقة المعلومات",core:true},
      {id:"sources",label:"توثيق المصادر",core:true},
      {id:"organization",label:"تنظيم السيرة وتسلسلها",core:true},
      {id:"language",label:"سلامة اللغة",core:true},
      {id:"revision",label:"المراجعة",core:false}
    ],
    pass:3
  },
  expansion_writing:{
    scale:4,
    criteria:[
      {id:"main_idea",label:"الحفاظ على الفكرة الأصلية",core:true},
      {id:"details",label:"إضافة تفاصيل ذات صلة",core:true},
      {id:"cohesion",label:"الترابط",core:true},
      {id:"language",label:"سلامة اللغة",core:true}
    ],
    pass:3
  },
  group_dialogue:{
    scale:4,
    criteria:[
      {id:"clarity",label:"وضوح الرأي",core:true},
      {id:"listening",label:"الإنصات وعدم المقاطعة",core:true},
      {id:"evidence",label:"التعليل والدليل",core:true},
      {id:"respect",label:"احترام الآراء",core:true}
    ],
    pass:3
  }
};

export function evaluatePoint(attempts=[]){
  const valid=attempts.filter(x=>x && x.countsForMastery!==false && x.answerRevealed!==true);
  const latest=valid.slice(-MASTERY_CONFIG.pointQuestionCount);
  const correct=latest.filter(x=>x.correct===true).length;
  if(latest.length<MASTERY_CONFIG.pointQuestionCount) return {status:MASTERY_STATUS.CHECKING,correct,total:latest.length};
  if(correct>=MASTERY_CONFIG.pointRequiredCorrect) return {status:MASTERY_STATUS.MASTERED,correct,total:latest.length};
  return {status:MASTERY_STATUS.NEEDS_REMEDIATION,correct,total:latest.length};
}

export function nextAdaptiveStep({wrongOnSkill=0, mastered=false, retentionDue=false}={}){
  if(retentionDue) return "retention_check";
  if(mastered) return "next_point";
  if(wrongOnSkill>=MASTERY_CONFIG.remediationAfterWrong) return "micro_remediation";
  if(wrongOnSkill>=MASTERY_CONFIG.enhancedExplanationAfterWrong) return "enhanced_explanation";
  if(wrongOnSkill>=1) return "hint_and_fresh_variant";
  return "standard_check";
}

export function evaluateLesson({objectivePercents={},finalPercent=0,requiredObjectiveIds=[]}={}){
  const coreOk=requiredObjectiveIds.every(id=>Number(objectivePercents[id]??0)>=MASTERY_CONFIG.minimumCoreObjectivePercent);
  const finalOk=Number(finalPercent)>=MASTERY_CONFIG.lessonMasteryPercent;
  return {
    mastered:coreOk&&finalOk,
    coreOk,
    finalOk,
    status:coreOk&&finalOk?MASTERY_STATUS.MASTERED:MASTERY_STATUS.NEEDS_REMEDIATION
  };
}

export function evaluateUnit({lessonStates=[],unitFinalPercent=0,performancePassed=false}={}){
  const lessonsOk=lessonStates.length>0 && lessonStates.every(x=>x===MASTERY_STATUS.MASTERED);
  const finalOk=Number(unitFinalPercent)>=MASTERY_CONFIG.unitMasteryPercent;
  const mastered=lessonsOk&&finalOk&&performancePassed;
  return {mastered,lessonsOk,finalOk,performancePassed};
}

export const KPI_EVENTS = Object.freeze([
  "point_started",
  "point_mastered",
  "question_answered",
  "hint_used",
  "enhanced_explanation_opened",
  "remediation_started",
  "remediation_completed",
  "lesson_mastered",
  "unit_mastered",
  "forced_transition_attempt",
  "retention_check_completed",
  "lesson_abandoned"
]);

export const FEEDBACK_RULES = Object.freeze({
  wrong:[
    "حدد المطلوب في السؤال.",
    "اشرح سبب عدم مناسبة الاختيار دون كشف الإجابة مباشرة.",
    "أعد عرض القاعدة أو الفكرة المرتبطة بالخطأ فقط.",
    "اعرض مثالًا جديدًا.",
    "قدم سؤال تحقق مختلفًا من نفس المهارة."
  ],
  correct:[
    "أكد سبب صحة الإجابة باختصار.",
    "اربط الإجابة بالهدف أو القاعدة.",
    "انتقل إلى تنويع جديد بدل تكرار السؤال نفسه."
  ],
  never:[
    "لا تستخدم عبارة «خطأ» وحدها.",
    "لا تكشف الإجابة ثم تعيد السؤال نفسه للاعتماد.",
    "لا تمنح الإتقان بسبب المشاهدة أو الزمن."
  ]
});
