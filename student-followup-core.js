(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudentFollowup=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const policy={days:90,minQuestions:5,minAttempts:2,mastery:80,support:60};
 function diagnose(indicators,attempts,plans,now=Date.now()){
  const reviews={};for(const p of plans||[])for(const [id,r] of Object.entries(p.payload?.reviews||{}))reviews[p.subject+'|'+id]=r;
  const rows=indicators.map(i=>({...i,evidence:[],observed:0,excluded:0,cognitive:{},latest:null,status:'لم تُقَس',percent:null})),byKey=new Map(rows.map(i=>[i.key,i])),seen=new Set();
  for(const a of [...attempts].sort((x,y)=>Date.parse(x.submitted_at||x.started_at)-Date.parse(y.submitted_at||y.started_at))){
   const timestamp=Date.parse(a.submitted_at),age=now-timestamp;
   for(const q of a.questions||[]){const skill=byKey.get(q.indicator_key);if(!skill)continue;skill.observed++;
    const review=reviews[q.subject+'|'+a.source+':'+a.id]||{},key=skill.key+'|'+(q.question_fingerprint||String(q.question||q.id).replace(/\s+/g,' ').trim());
    // The first exposure owns the item: a later repeat is not fresh evidence.
    const repeat=seen.has(key);if(a.submitted_at&&q.answer!==null&&q.answer!==undefined)seen.add(key);
    if(!a.submitted_at||!Number.isFinite(timestamp)||age<0||age>policy.days*86400000||a.snapshot_warning||a.recovery_pending||q.answer===null||q.answer===undefined||q.scorable===false||typeof q.correct!=='boolean'||repeat||review.mode!=='independent'){skill.excluded++;continue;}
    skill.evidence.push({correct:q.correct,time:timestamp,attempt:a.source+':'+a.id,level:q.cognitive_level});
   }
  }
  for(const s of rows){const e=s.evidence,sessions=new Set(e.map(q=>q.attempt));s.count=e.length;s.attempts=sessions.size;s.percent=e.length?Math.round(e.filter(q=>q.correct).length*100/e.length):null;s.latest=e.length?new Date(Math.max(...e.map(q=>q.time))).toISOString():null;
   for(const q of e){const k=q.level||'غير مصنف',c=s.cognitive[k]||(s.cognitive[k]={total:0,correct:0});c.total++;c.correct+=Number(q.correct);}
   s.status=!s.observed?'لم تُقَس':e.length<policy.minQuestions||sessions.size<policy.minAttempts?'أدلة غير كافية':s.percent<policy.support?'تحتاج دعمًا':s.percent<policy.mastery?'في طور الإتقان':'متقنة';
   // Stability requires a later, distinct set of >=3 items after at least 7 days.
   s.stable=false;
   for(const cutoff of [...new Set(e.map(q=>q.time))]){const baseline=e.filter(q=>q.time<=cutoff),later=e.filter(q=>q.time>=cutoff+7*86400000);if(s.status==='متقنة'&&baseline.length>=policy.minQuestions&&new Set(baseline.map(q=>q.attempt)).size>=policy.minAttempts&&baseline.filter(q=>q.correct).length/baseline.length>=.8&&later.length>=3&&later.filter(q=>q.correct).length/later.length>=.8){s.stable=true;break;}}
  }
  return rows;
 }
 return {policy,diagnose};
});
