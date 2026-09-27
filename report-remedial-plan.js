(){
' use strict';
const $=id=>document.getElementById(id);
const A=window.NafesAnalytics;
const DATA_CACHE='__NAFES_ANALYSIS_DATA_CACHE__';
const SUBJECT_LABEL={reading:'Ø§Ù„Ù‚Ø±Ø§Ø¡',nath:'Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§ØªÛŒØ§Ø©',science:'Ø§Ù„Ø¹Ù„ÙˆÙ…'0};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'x':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clean(s){return String(s<|'').replace(/\s+/g,' ').trim()}
function short(s,n=118){s=clean(s);return s.length<=n?s:s.slice(0,n-1).replace(/\s+\S*$/,'')+'â€¦'}
function pct(v){return Number.isFinite(Number(v))?new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v))+'%A':'â€”'}
function normSubject(v){
 const s=clean(v).toLowerCase();
 if(['reading','arabic','language','Ø§Ù„Ù‚Ø±Ø§Ø¡','Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©','Ø§Ù„Ù„ÙºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©'].includes(s))return'reading';
 if(['math','mathematics','Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§ØªÛŒØ§Ø©'].includes(s))return'math';
 if(['science','Ø§Ù„Ø¹Ù„ÙˆÙˆÙ…'].includes(s))return'science';
 return'';
}
function submitted(a){return A?.isSubmitted?A.isSubmitted(a):!!(a?.submitted_at||['submitted','completed','finished'].includes(String(a?.status||'').toLowerCase()))}
function testId(a){return String(a?.test_id||a?.assessment_id||a?.exam_id||'').trim()}
function ident(a){return A?.studentIdentity?.(a)||String(a?.student_id||a?.student_key||a?.student_no||a?.id||a?.student_name||'')}
function studentName(a){return clean(a?.student_name||a?.full_name||a?.name||'Ø·Ø§Ù„Ø©')}
function scorable(q){return A?.isScorable?A.isScorable(q):(typeof q?.correct==='boolean'||Number.isFinite(Number(q?.correct_index??q?.correctIndex)))}
function indKey(q){return clean(A?.indicatorKey?A.indicatorKey(q):(q?.indicator_key||q?.indicator_id||q?.indicator_text||''))}
function cognitive(q){
 const raw=clean(q?.bloom||q?.cognitive_level||q?.cognitive||q?.level||q?.thinking_level).toLowerCase();
 const stem=clean(q?.question||q?.stem||q?.text);
 if(/Ø§Ø³ØªÙ„Ø§Ù„|Ø§Ø³ØªÙ†ØªØ§Ø¯|infer|reason/.test(raw)||/Ø§Ø³ØªÙ†ØªØ¯|YŠØ¯Ù„Ø´Ø§Ø¯ÙŠØ«Ø³Ø±Ù„Ø§Ù„ÙŠØªØ´Ø§Ø¯ØªØ© ØªÙØ³ÙŠØ±/.test(stem))return'inference';
 if(/ØªØ·Ø¨ÙŠÙ‚Ø§Ù„Ù‰|apply|application/.test(raw)||/Ø§Ø­Ø­Ø³Øª|X§ÙˆØ¬Ø¯|X­Ù„Ø§Ø¯ÙˆØ§Ø¯ÙˆØ§Ø­ÙˆØ§Ø¨Ù…Ù…Ğ±ÙŠÙ„ÙŠÙŠÙ…ÙƒØªÙ„Ù…ÙŠÙ„ÙŠÙˆÙ…ÙƒØ±ØªØªÙˆÙ…ÙƒØ±ÙØ±ÙŠÙ…ÙƒØªÙØ³Ù„Ø§Ø¯Ù„Ø¹Ø§Ù„Ù‚Ù†Ø§Ø§Ø¹Ù„ÙŠÙÙˆØªÙŠØ±ÙØ¹Ù…Ù…ÙƒØªÙÙŠÙ„ÙŠÙƒØ­ØªÙŠÙˆÙ…ÙƒØ§ÙØ°ÙŠÙ…ÙØ±ÙŠÙƒÙˆØµÙ…ÙŠØ§Ø³Ù„ÙŠÙƒÙˆÙÙ‹Ø¾Ù…Ù‚+\İ
İ[JJ\™]\›‰Ø\XØ][Û‰ÎÂˆ™]\›‰ÚÛ›İÛYÙIÎÂŸB™[˜İ[ÛˆÛÙÛš]]™SX™[
Ê^Ü™]\›ˆÏOOIÚ[™™\™[˜ÙIÏÉö)ö,ö*¶+öa6)öa6b¶aÉÎšÏOOIØ\XØ][Û‰ÏÉö*¶-ö*6b¶`¶b‰Î‰öav.v,v`vbŠâ™[˜İ[ÛˆÛ\ÜÚYJİXš™Xİ[™XØ]Ü‹İ[\Ê^ÂˆÛÛœİXÛX[Š[™XØ]ÜŠÉÈ	ÊÜİ[\Ëš›Ú[Š	È	ÊJNÂˆYŠİXš™XİOOIÜ™XY[™ÉÊ^ÂˆYŠöav`ö,v+öa6av,v)ö+ö`v)ö-¶a6av.va¶byb¶,v`vb¶,¶)öaËË\İ

J\™]\›‰İ›ØØX[\IÎÂˆYŠö`v`ö,v*H6,v)¶,öb¶+ö`v`ö,v*¶`H6`v,v.vb¶+ö`va6`v,v*vav`ö,v)ö+öb¶)öa‹Ë\İ

J\™]\›‰ÚYX\ÉÎÂˆYŠö.va6)ö`¶*v,ö*6bˆ6a¶*¶b¶+6)öb¶a¶*¶+¶a6)ö`¶*v)ö,vb¶)öa‹Ë\İ

J\™]\›‰Ü™[][ÛœÉÎÂˆYŠö)ö,ö*¶a¶+¶*¶,ö*6av+¶ava¶b¶a¶b‹Ë\İ

J\™]\›‰Ú[™™\™[˜ÙIÎÂˆYŠöa¶b6.H6)öa6a¶-v-v)öa6aö)öa6.¶aö,v-¶aÈ6aö`v+Ë\İ

J\™]\›‰Ü\œÜÙIÎÂˆYŠö`¶)ö,va¶-6.v)öa6)ö+¶*¶a6)ö`KË\İ

J\™]\›‰ØÛÛ\\™IÎÂˆYŠö*¶,v*¶b¶*6*¶a6,öa6a6(ö(ö+v)ö*ËË\İ

J\™]\›‰ÜÙ\]Y[˜ÙIÎÂˆ™]\›‰ØÛÛ\™Z[œÚ[Û‰ÎÂˆBˆYŠİXš™XİOOIÛX]	Ê^ÂˆYŠö+¶`È6)öa6(ö.v+ö)ö+ö*¶,vb¶*6av`¶)ö,6a¶*H6.v+ö+ö)öa6a6a6a¶,ö*6+KË\İ

J\™]\›‰Û[X™\›[™IÎÂˆYŠö`ö,ö,v`ö,ö,va¶,ö*6)ö`¶.va6)ö`v*va¶)ö,ö*6*6av+vb6*H6(KË\İ

J\™]\›‰Ùœ˜Xİ[ÛœÉÎÂˆYŠöav.va6`v*6avav+6b6a6nva6.v`vav)ö-öa6)¶,vb‹Ë\İ

J\™]\›‰Ø[ÙXœ˜IÎÂˆYŠöav,ö)ö+v*vav+vb¶möav,ö.v)ö+v)öb6b¶b6av*öa6*ö*ö+ö)ö)¶aöa¶+ö,ËË\İ

J\™]\›‰ÙÙ[ÛY]IÎÂˆYŠöav*¶b6,ö-öb6,öb¶-6ava¶b6)öa6*6b¶)öa¶)ö*¶+6+öb6a6,v,öaH6*6b¶)öa¶b‹ö)ö+v*¶av)öaË\İ

J\™]\›‰Ù]IÎÂˆYŠö`¶)ö,öav-¶)ö.v`vb¶*va6.v.vb6)öa6(öb¶b6a6b‹Ë\İ

J\™]\›‰Ù˜XİÜœÉÎÂˆYŠö+6av.v-ö,v*6-¶`vb¶av.v,vb¶)ö*‹Ë\İ

J\™]\›‰ÛÜ\˜][ÛœÉÎÂˆ™]\›‰Ü›Ø›[IÎÂˆBˆYŠİXš™XİOOIÜØÚY[˜ÙIÊ^ÂˆYŠö+¶a6b¶aöa6)öb¶)öa¶,öb¶+6av.v-‹Ë\İ

J\™]\›‰ØÙ[ÉÎÂˆYŠö+öb6,v*6b6,v)ö*¶av,v+va6*KË\İ

J\™]\›‰ØŞXÛIÎÂˆYŠö-ö)ö`¶*6`¶b6*6av)ö,v*v-¶b6a¶a6aËË\İ

J\™]\›‰Ù[™\™ŞIÎÂˆYŠöav)ö+ö*v®v,v*v.v-v+ö*¶*¶.¶b¶,KË\İ

J\™]\›‰ÛX]\‰ÎÂˆYŠö*6b¶)¶*6a¶.6)öav*6*6b¶)¶a6-va6b6`¶)ö*‹ö,öa6,öa6*H6.¶,6)ö)¶b¶*H6*¶`öb¶`KË\İ

J\™]\›‰ÙXÛÛÙŞIÎÂˆYŠö*¶+6,v*6av*¶.¶b¶,v.vav)ö+¶*¶*6)öa6a¶b¶)ö*‹Ë\İ

J\™]\›‰Ù^\š[Y[	ÎÂˆYŠö+6,öaH6)öa6)va¶,ö)öa¶*¶a¶-6+öb6,v)öa¶aö-¶avaË\İ

J\™]\›‰Ø›ÙIÎÂˆ™]\›‰ØÛÛ˜Ù\	ÎÂˆBˆ™]\›‰ÙÙ[™\˜[	ÎÂŸB™[˜İ[ÛˆXİ[Û‘›ÜŠ
^ÂˆÛÛœİ[ÙO\™ÛZ[˜[ÂˆÛÛœİ[ÙSXY[[ÙOOOIÚ[™™\™[˜ÙIÏÉöa6(öaˆ6av.v.öaH6)öa6(ö+¶-ö)ö(H6)ö,ö*¶a6+öa6)öa6b¶b¶*K6b¶*6+ö(È6)öa6*¶-ö,vb¶+6*6*6)ö,v)ö,ˆ6)öa6+öa6b¶a6)öa6,6bˆ6b¶`¶b6+È6a6a6)v+6)ö*6*H6*öaH6*¶b¶,v,vb¶,H6)öa6)ö+¶*¶b¶)ö,Kˆ	Î›[ÙOOOIØ\XØ][Û‰ÏÉöa6(öaˆ6av.v.öaH6)öa6(ö+¶-ö)ö(H6*¶-ö*6b¶`¶b¶*v#6b¶*6+ö(öa6)öa6*¶+ö,vb¶*6*6av*ö)öa6av+va6b6a6*öaH6b¶a¶*¶`¶a6)öa6bH6*¶b¶*6)ö,v,H6av,ö*¶`¶-‹ˆ	Î‰à¶a6(öaˆ6av.v.6aH6)öa6)ö+¶-ö)ö*ˆ6av.v,v`vb¶*v*¶b¶*v#6b¶b¶*6+ö(È6)öa6*¶aö+öa6bˆ6*6*¶*6*6b¶*ˆ6)öa6av v+vb6aH6b6)öa6avav-v-öa6+v)ö*ˆ6*öaH6)öa6*¶+v`¶`ˆ6*6)ö,ö*¶,v+6)ö.H6,ö,vb¶.Kˆ	ÎÂˆÛÛœİX\^Âˆ™XY[™ÎÂˆ›ØØX[\N‰ö)ö,ö*¶+¶,v)ö+6`¶,v)ö)¶aˆ6)öa6,öb¶)ö`ˆ6+vb6a6)öa6`öa6av*v#6*¶+v+öb¶+È6)öa6av.va¶bH6)öa6av*¶b6`¶.H6`¶*6a6)öa6a¶`ö,H6)va6bH6)öa6*6+ö)ö)¶a6#6*öaH6*¶av,vb¶aˆ6.va6bH6av-v,v+ö)ö*ˆ6+6+öb¶+ö*H6+¶a6,öb¶)ö`¶)ö*ˆ6a6+¶*¶a6`v*K‰ËˆYX\Î‰ö*¶+v+öb¶+È6)öa6a6av*6a6*H6)öa6av+vb6,vb¶*H6`vbˆ6`öa6`v,ö,v*v#6*¶avb¶b¶b¶,ˆ6)öa6`v`ö,v*H6)öa6,v)¶b¶,ö*H6avaˆ6)öa6*¶`v)ö-vb¶a6)öa6+ö)ö.vav*K6*öaH6*¶a6+¶a¶b¶-H6)öa6`v`¶,v*H6`vbˆ6+6a6a6*H6b6)ö+v+ö*K‰Ëˆ™[][ÛœÎ‰ö*¶+v+öb¶+È6)öa6.v*6)ö,v*¶b¶aˆ6)öa6av,v*¶*6mö*¶b¶aˆ6`vbˆ6)öa6a¶-K6b6,v,öaH6,öaöaH6b¶b6-¶+H6a¶b6.H6)öa6.va6)ö`¶*H
6,ö*6*öa¶*¶b¶+6*Kö*¶`v,öb¶,Jv#6*öaH6+va6(öav*¶a6*H6+6+öb¶+ö*K‰Ëˆ[™™\™[˜ÙN‰ö*¶+v+öb¶+È6)öa6a6+öa6b¶a6)öa6-v,vb¶aH6(öb6a6)ö#6*öaH6`ö*¶)ö*6*H6av)È6b¶av`öaˆ6)ö,ö*¶a¶*¶a¶*¶)ö+6aÈ6ava¶aÈ6+öb6aˆ6)ö-6)ö`vbˆ6av.va6b6av)ö*ˆ6avaˆ6+¶)ö,v+6)öa6a¶-K‰Ëˆ\œÜÙN‰öav`¶)ö,va¶*H6+¶-v)ö)¶-H6(öa¶b6)ö.H6)öa6a¶-vb6-H6b6)öa6.¶,v-ˆ6ava¶aö)ö#6*öaH6*¶b¶,v,vb¶,H6)ö+¶*¶b¶)ö,H6a¶b6.H6)öa6a¶-vb6(öb6.¶,v-ˆ6)öa6`ö)ö*¶*6*6+öa6b¶a6a6`v.6b‹‰ËˆÛÛ\\™N‰ö)ö,ö*¶+¶+ö)öaH6+6+öb6a6*¶-6)ö*6aËö)ö+¶*¶a6)ö`H6avaˆ6.va6b6+öb¶a‹6*öaH6*¶+vb6b¶a6)öa6av`¶)ö,va¶*H6)öa6bH6)vb²)ö*6*H6`ö)öava6*K‰ËˆÙ\]Y[˜ÙN‰ö*¶avb¶,H6)öa6(ö+v+ö)ö*È6)öb6)öa6(ö`v`ö)ö,H6)ö.v*¶av)ö+öbö)È6.va6bH6(öa6`v)ö.6)öa6,¶avaˆ6)öb6)öa6,v*6-È6*öaH6(ö.v)ö+ö*H6*6a¶)ö(H6)öa6*¶,öa6,öa6+ö"6aˆ6)öa6,v+6b6.H6a6a6a¶-K‰ËˆÛÛ\™Z[œÚ[Û‰ö`¶,v)ö(v*H6avb6+6*vaö*H6a6a6a¶-K6*¶+v+öb¶+È6)öa6av-öa6b6*6`vbˆ6)öa6,ö)6)öa6b6-¶.H6+¶-È6*¶+v*ˆ6)öa6+öa6b¶a6)öa6av)ö,ö*6*öaH6)ö,ö*¶*6.v)ö+È6)öa6av-6*¶*¶*¶)ö*ˆ6b6)ö+va¶)È6b6)ö+v+ö)öbÈ6b6-v+È6a6*¶)ö+v+Ë‰ÂˆKˆX]Âˆ[X™\›[™N‰ö*¶av*öb¶a6)öa6(ö.v+ö)ö+È6`v.va6b¶)È6.va6bH6+¶-È6)öa6(ö.v+ö)ö+ö#6av ¶)ö,va¶*vb6)ö`¶.vaö)ö#6*öaH6)öa6)öa¶*¶`¶)öa6)va6bH6(ö,ö)¶a6*H6*¶,v*¶b¶*6b6*¶av*öb¶a6+6+öb¶+ö*H6+öb6aˆ6a¶avb6,6+6+6)öaö,‹‰Ëˆœ˜Xİ[ÛœÎ‰ö)ö,ö*¶+¶+ö)öaH6a¶avb6,6+6*6-v,vbˆ6a6a6`ö,ö,H6(öb6)öa6a¶,ö*6*v#6*¶b6+vb¶+È6)öa6av`¶)öav)ö*¶b6a6)ö*‹öb6)öa6+v+v+ö)ö*ˆ6.va¶+È6)öa6+v)ö+6*K6*öaH6*¶-ö*6b¶`ˆ6av*¶+ö,v+6.va6bH6av+6)ö)¶a6av-6)ö*6aö*K‰Ëˆ[ÙXœ˜N‰ö*¶'vb¶+ö+È6)öa6av+6aöb6a8ª´ÙÙŠØ° Ø§Ù„Ø¹Ù…Ù„ÙŠØ© Ø§Ù„Ø¹ÙƒØ³ÙŠØ© Ø®Ø·ÙˆØª ØªØ®Ø·ÙˆØ©ØŒ Ø«Ù… Ø§Ù„ØªØ­Ù‚Ù‚ Ø¨Ø§Ù„ØªØ¹ÙˆÙŠØ¶ ÙÙŠ Ø§Ù„Ù…Ø¹Ø§Ø¯Ù„Ø© Ø§Ù„Ø£ØµÙ„ÙŠØ©.',
   geometry:'Ø±Ø³Ù… Ø§Ù„Ø´ÙƒÙ„ ÙˆÙƒØªØ·Ø© Ø§Ù„Ù…Ø¹Ø·ÙŠØ§Øª Ø¹Ù„ÙŠÙ‡ØŒ Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ù‚Ø§Ù†ÙˆÙ† Ù…Ø¹Ø§ Ø§Ù„ÙˆØ­Ø¯Ø§Øª, Ø«Ù… Ø­Ù„ Ù…Ø¹Ø³Ø£Ù„Ø© Ù…Ù‡Ø§Ø¨Ù„Ø© ØªØºÙŠÙŠÙŠØ± Ø§Ù„Ù‚ÙŠÙ….',
   data:'Ù‚Ø±Ø§Ø¡Ø© Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø¬Ø¯ÙˆÙ„/Ø§Ù„Ø±Ø³Ù… ÙˆØ§Ù„Ù…Ø­Ø§ÙˆØ± Ø£ÙˆÙ„Ø§ØŒ Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø§Ù„Ù‚ÙŠÙ… Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©ØŒ Ø«Ù… ØªÙ†ÙÙŠÙ Ø§Ù„Ø­Ø³Ø§Ø¨ Ø§Ùˆ Ø§Ù„Ø§Ø³ØªÙ†ØªØ§Ø¬ Ù…Ø† Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.',
   factors:'ØªÙÙƒÙŠÙƒ Ø§Ù„Ø¹Ø¯Ø¯ Ø¥Ù„Ù‰ Ø¹Ø§Ù…Ù„Ù‡, âªÓff+bØƒbŸfffbÏfƒffƒbŸffbÛbŸbçfb0ƒb¯fƒb«bßb£f+fƒbçff$ƒbbçb¿bŸb¼ƒb³b¿f+b¿b¤ƒfbäƒb«b£bÇf+bÄƒbÏb£b ƒbŸfbŸb»b«f+bŸbÄ¸œ°(€€½Á•É…Ñ¥½¹ÌèŸb«fb·b»f+b¼ƒbŸfbçfbçff+b¤ƒbŸffbßff#b£b§fbƒbÏf+bŸfƒbŸffbÏbfb¤°ƒbŸf+fb«ff+bÃfbœƒfbäƒb«fb¿f+bÄƒb«fbÇf+b£f(ƒfb£fƒbŸfb·f°ƒŠ²¬ƒfb·bÔƒfbçff#ff+b¤ƒbŸffbŸb«b°¸œ°(€€ÁÉ½‰±•´èŸb«b×f#f+fƒfbÔƒbŸffbÏbfb¤ƒb—ff$èƒfbçbßf+bŸb¨ƒŠHƒfbßff#b ƒŠHƒbçfff+b¤¿b»bßb¤ƒbŸf8ƒb·fƒŠHƒb«b»bfb0ƒŠ²¬ƒb·fƒfbçbÏbfb¤ƒb³b¿f+b¿b¤ƒffƒbŸfb«ff+b¤ƒffbÏfbœ¸œ(€ô°(€Í¥•¹”éì(€€•±±ÌèŸb£fbŸb„ƒfb»bßbÜƒf+bÇb£bÜƒbŸffb·b,ƒb£f#bãf+fb«fb0ƒb¯fƒfbbŸbÇfb¤ƒfb¯bŸff+fƒf#b«fbÏf+bÄƒbb¯bÄƒb«bëf+bÄƒbŸfb³bËb„ƒbçff$ƒbŸff#bãf+fb¤¸œ(€€å±”èŸb«bÇb«f+b ƒfbÇb·fƒbŸfb¿f#bÇb´ƒb£b×bÇf+bŸf,ƒffƒbbÏff°ƒˆ´ØµØ­ Ù…Ø§ ÙŠØ­Ø¯Ø« ÙÙŠ ÙƒÙ„ Ù…Ø±Ø­Ù„Ø©ØŒ â¬« Ø¥Ù¹Ø§Ø¯Ø© ØªÙ…ÙŠØ±ÙŠÙˆ Ø¯ÙˆØ±Ø© Ø¬Ø¯ÙŠØ¯Ø© Ù…Ù† Ø¯ÙˆÙ† ØªÙ„Ù…ÙŠØ­Ø§Øª.',
   energy:'ØªØ­Ø¯ÙŠØ¯ Ø´ÙƒÙ„ Ø§Ù„Ø·Ø§Ù‚Ø© Ø£Ùˆ Ø§Ù„Ù‚ÙˆØ© Ù‚Ø¨Ù„ ÙˆØ¨Ø¹Ø¯ Ø§Ù„Ù…ØˆÙ‚ÙØŒ Ø±Ø³Ù… Ù…Ø¹Ø§Ø± Ø§Ù„ØªØ­Ø­ÙˆÙ„, Ø«Ù… ØªÙØ³ÙŠØ± Ø§Ù„Ù†ØªÙŠØ¬Ø© Ø¹Ù„Ù…ÙŠØ§Ù‹.',
   matter:'ØªØµÙ†ÙŠÙØ§Ù„Ù…Ø§Ø¯Ø©/Ø§Ù„ØªØºÙŠØ± ÙˆÙÙ‚ Ø§Ù„Ø®ØµØ§Ø¦Øµ Ø§Ù„Ø¸Ø§Ù‡Ø±Ø©, Ø«Ù… ØªÙŠØ±Ø±ÙŠØ± Ø§Ù„ØªØµÙ†ÙŠÙØ¨ÙŠ Ø¨Ø¯Ù„ÙŠÙ„ Ù…Ù† Ø§Ù„Ù…ÙˆÙ‚Ù Ø£Ùˆ Ø§Ù„ØªØ¬Ø±Ø¨Ø©.',
   ecology:'Ø¨Ù†Ø§Ø¡ Ø´Ø¨ÙƒØ© Ø¹Ù„Ø§Ù‚Ø© Ø¨ÙŠÙ† Ø§Ù„Ù…Ø®Ù„ÙˆÙ‚Ø§Øª ÙˆØ§Ù„Ø¹ÙˆØ§Ù…Ù„, Ø«Ù… ØªÙˆÙ‚Ø¹ Ø£Ø«Ø± ØªØºÙŠØ± Ø¹Ù†ÙµØ± ÙˆØ§Ø­Ø¯ ÙˆØªÙØ³ÙŠØ± Ø§Ù„Ù†ØªÙŠØ¬Ø©.'
   experiment:'ØªØ­Ø¯ÙŠØ¯ Ø§Ù„Ù…ØªØºÙŠØ±Ø¹Ù…Ø§Ø®ØªØ¨Ø§Ù„Ù†ÙŠØ§Øª Ø§Ù„Ù…Ù…Ø³ØªÙ‚Ù„ ÙˆØ§Ù„ØªÙ…Ù…Ù„ ÙˆØ§Ù„Ø«Ø§ØªÙŠØ¨ Ø§Ù„ÙØ¹ÙˆØ¨Ø©, Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù„Ø¨ÙŠØ§Ù†Ø§ØªØŒ Ø«Ù… ØµÙŠØ§ØºÙ† Ø§Ø³ØªÙ†ØªØ§Ø¬ ØªØ¯Ù†Ø±ÙˆØ±Ù‡ Ù†ØªÙŠÙˆØ© Ù…Ø† Ø§Ù„ØªØ¬Ø±Ø¨Ø©.',
   body:'rØ¨Ø· Ø§Ù„Ø¹Ø¶Ùˆ Ø¨Ø§Ù„Ø¬Ù‡Ø§Ø² ÙˆØ§Ù„ÙˆØ¸ÙŠÙØ©, Ø«Ù… ØªØªØ¹Ù… Ù…Ø³Ø§Ø± Ø§Ù„Ø¹Ù…Ø¹Ù„ÙŠØ© Ø¯Ø§Ø®Ù„ Ø§Ù„Ø¬Ø³Ù… ÙÙŠ Ù…Ø®Ø·Ø· Ù…Ø¨Ø³Ø·.',
   concept:'Ù…Ø±Ø¬Ø¹Ø© Ø§Ù„Ù…ÙÙ‡ÙˆÙ… Ù…Ù† Ù…Ø«Ø§Ù„ Ø­Ù‚ÙŠÙ‚ÙŠ Ø£Ùˆ Ø±Ø³Ù…, ØªÙ…ÙŠÙŠØ²Ù‡ Ù…Ø… Ù…ÙÙ‡ÙˆÙ… Ù‚Ø±ÙŠØ¨ØŒ â¬« ØªÙØ·ÙŠØ± Ø§Ø¬Ø§Ø¨Ø© Ø¬Ø¯ÙŠØ¯Ø© Ø¨Ø§Ø³ØªØ®Ø·Ø§Ù… Ø§Ù„Ù…ÙÙ‡ÙˆÙ… Ù†ÙØ³Ù‡.'
  }
 };
 return modeLead+(map[p.subject]?.[a.kind]||'Ø¥Ø¹Ø§Ø¯Ø© Ø¨Ù†Ø§Ø¡ Ø§Ù„Ù…ÙÙ‡ÙˆÙ… Ù…Ø… Ù…Ø«Ø§Ù„ Ù…Ø±ØªØ·Ø· Ø¨Ø§Ù„Ø³Ø§Ù„Ø§, Ø«Ù… ØªØ·Ø¨ÙŠÙ‚ Ù…ØˆØ¬Ù‡ ÙŠÙ„ÙŠÙ‡Ù‡ ØªÙØ¨ÙŠÙ‚ Ù…Ø³ØªÙ‚Ø¶ Ù…Ø¹ÙØ³ÙŠØ± Ø§Ù„Ø£Ø¬Ø§Ø¨Ø©.');
}
function followupFor(p){
 if(p.dominant==='inference')return 'Ø¥Ø¹Ø§Ø¯Ø© Ù‚ÙŠØ§Ø³ Ø¨Ø«Ù„Ø§Ø«Ø© Ø£Ø³Ø¦Ù„Ø© Ø§Ø³ØªÙ„Ø¯Ù„Ø§Ù„ÙŠØ© Ø¬Ø¯ÙŠØ¯Ø© Ù…Ù† Ø³ÙŠØ§Ù‚Ø§Øª Ù…Ø®ØªÙ„ÙØ©Ø› ÙŠØªØµÙ‚Ù‚ Ø§Ù„Ø¥ÙªÙ‚Ø§Ù† Ø¹Ù†Ø¯ 80% ÙˆÙØ£Ø¹Ù„Ù‰ Ù…Ø¹Ø¢ Ù€Ù Ø§Ù„Ø¯Ù„ÙŠÙ„.';
 if(p.dominant==='application')return 'Ù…Ø«Ø§Ù„ Ù…ØˆØ¬Ù‡ ÙˆØ§Ø­Ø¯ Ø«Ù… 3 ØªØ·Ø¨ÙŠÙ‚Ø§Øª Ù…Ø³ØªÙ‚Ù„Ø© Ø¬Ø¯ÙŠØ¯Ø©Ø› ÙŠØªØµÙ‚Ù‚ Ø§Ù„Ø¥ÙªÙ‚Ø§Ù† Ø¹Ù†Ø¯ 80% Ø¯ÙˆÙ† Ù…Ø³Ø§Ø¹Ø¯Ø©.';
 return 'Ù…Ø±Ø¬Ø¹Ø© Ø³Ø±ÙŠØ¹Ø© Ø«Ù… 4 Ø£Ø³Ø¦Ù„Ø© Ù‚ØµÙŠØ±Ø© Ø¬Ø¯ÙŠØ¯Ø© Ù„ØªÙ…ÙŠÙŠØ²Ø§Ù„Ù…ÙÙ‡ÙˆÙ… ÙˆØ§Ø³ØªÙˆØ§Ø¯ØªÙ‡ØŒ ÙŠÙŠØªØ­Ø­Ù‚Ù‚ Ø§Ù„Ø¥ÙªÙ‚Ø§Ù† Ø¹Ù†Ø¯ 80% ÙˆÙØ£Ø¹Ù„ÙŠ.';
}
function cleanSchoolLogo(root){
 if(!root||!root.querySelectorAll)return;
 root.querySelectorAll('.wr-school').forEach(slot=>{
   [...slot.childNodes].forEach(node=>{if(node.nodeType===1&&node.classList?.contains('wr-logo-card'))return;node.remove()});
   const card=slot.querySelector@('.wr-logo-card');if(!card)return;
   card.querySelectorAll('.wr-school-name,.school-name,figcaption,small,strong,p,[data-school-caption]').forEach(el=>el.remove());
 });
}
function analyzeSelectedTest(){
 const selected=String($('reportTest')?.value||'').trim();
 const raw=window[DATA_CACHE]?.data?.attempts||[];
 if(!selected||!Array.isArray(raw)||!raw.length)return[];
 const groups=new Map();
 for(const a of raw){
  if(!submitted(a)||testId(a)!==selected)continue;
  const sid=ident(a),sname=studentName(a);
  for(const q of (a.questions||[])){
   const subject=normSubject(q?.subject||q?.subject_key);if(!subject||!scorable(q))continue;
   const ik=indKey(q),indicator=clean(q?.indicator_text||q?.indicator||ik);if(!indicator)continue;
   const key=subject+'::'+(ik||indicator);
  if(!groups.has(key))groups.set(key,{subject,indicator,total:0,wrong:0,stems:[],cog:{knowledge:0,application:0,inference:0},students:new Map()});
   const g=groups.get(key),correct=q.correct===true;
   g.total++;if(!correct){g.wrong++;g.stems.push(clean(q.question||q.stem||q.text));g.cog[cognitive(q)]++;}
   if(!g.students.has(sid))g.students.set(sid,{name:sname,total:0,wrong:0});
   const st=g.students.get(sid);st.total++;if(!correct)st.wrong++;
  }
 }
 return [...groups.values()].map(g=>{
   const percent=g.total?(g.total-g.wrong)/g.total*100:null;
   const targets=[...g.students.values()].filter(s=>s.total&&((s.total-s.wrong)/s.total*100)<80);
   const dominant=Object.entries(g.cog).sort((a,b)=>b[1]-a[1])[0]?.[0]||'value';
   const kind=classify(g.subject,g.indicator,g.stems);
   const p={...g,percent,targets,dominant,kind};
   p.action=actionFor(p);p.followup=followupFor(p);
   return p;
 }).filter(p=>p.total&&p.wrong&&p.percent<80).sort((a,b)=>(a.percent??100)-(b.percent??100));
}
function fallbackPlans(page1,page2){
 const plans=[],seen=new Set();
 const add=(subject,item)=>{
  const subj=normSubject(subject)||Object.keys(SUBJECT_LABEL).find(k=>SUBJECT_LABEL[k]===clean(subject));if(!subj||!item)return;
  const parts=[...item.querySelectorAll('span')].map(x=>clean(x.textContent)).filter(Boolean);
  const indicator=short(parts.join(' ')||item.textContent);if(!indicator)return;
  const key=subj+'::'+indicator;if(seen.has(key))return;seen.add(key);
  const percentText=clean(item.querySelector('strong')?.textContent)||'â€”';
  const kind=classify(subj,indicator,[]),p={subject:subj,indicator,total:0,wrong:0,percent:null,targets:[],dominant:'knowledge',kind};
  p.action=actionFor(p);p.followup=followupFor(p);p.percentText=percentText;plans.push(p);
 };
 for(const card of page1?.querySelectorAll('.wr-indicator-card')||[]){const subject=card.querySelector('header b')?.textContent;for(const item of card.querySelectorAll('.wr-indicator-item'))add(subject,item)}
 for(const row of page2?.querySelectorAll('.wr-student-table tbody tr')||[]){for(const item of row.querySelectorAll('.wr-student-ind'))add(item.querySelector('.wr-ind-subject')?.textContent,item)}
 return plans;
}
function planHtml(plans){
 if(!plans.length)return '<section class="wr-remedial"><h3>Ø°Ù„Ø®Ø·Ø© Ø§Ù„Ø¹Ù„Ø§Ø¬ÙŠØ© Ø§Ù„Ù…Ø¨Ù†ÙŠØ© Ø¹Ù„Ù‰ Ø§Ù„Ø§Ø®ØªÙŠØ§Ø±</h3><p class="wr-remedial-empty">Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø¤Ø´Ø±Ø§Øª Ù…Ù†Ø®Ù‚Ø¶Ø© Ø§Ù„Ø£Ø¯Ø§Ø¡ (Ø£Ù‚Ù„ Ù…Ù† 80%@) ÙÙŠ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø§Ø®Ø¨ØªØ§Ø± Ø§Ù„Ø­Ø§Ù„ÙŠØ©ØŒ Ø£Ùˆ Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ø³Ø¦Ù„Ø© ÙƒØ§ÙÙŠØ© Ù„Ù„ØªØ´Ø®ÙŠØµ.</p></section>';
 return '<section class="wr-remedial wr-remedial-diagnostic"><h3>Ø°Ù„Ø®Ø·Ø© Ø§Ù„Ø¹Ù„Ø§Ø¬ÙŠØ© Ø§Ù„Ù…Ø¨Ù†ÙŠØ© Ø¹Ù„Ù‰ Ø§Ù„Ø§Ø®ØªÙŠØ§Ø±</h3><p class="wr-remedial-intro">Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡ Ø§Ù„ØªØ§Ù„ÙŠØ© Ù…ØˆÙ„Ø¯Ø© Ù…Ù† Ø§Ù„Ù…Ø£Ø´Ø±Ø§Øª ÙˆØ§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„ØªÙŠ Ø£Ø®ÙÙ‚ ÙÙŠÙ‡Ø§ Ø§Ù„Ø·Ø§Ù„Ø¨ ÙÙŠ Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø± Ø§Ù„Ù…Ø­Ø¯Ø¯Ø¯ØŒ Ù„Ø°Ù„Ùƒ ØªÙªØªÙŠÙŠØ± ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹ Ø¹Ù†Ø¯ ØªØºÙŠØ± Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø± Ø£Ùˆ Ù†Ù…Ø· Ø§Ù„Ø£Ø®Ø·Ø§Ø¡.</p><table><thead><tr><th>Ø§Ù„Ù…Ø§Ø¯Ø©</th><th>Ø§Ù„Ù…Ù‡Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªÙ‡Ø¯ÙØ©</th><th>Ø¯Ù„ÙŠÙ„ Ø§Ù„ØªØ´Ø®ÙŠØµ Ù…ØŒ Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±</th><th>Ø§Ù„Ø·Ù„Ø§Ø¨ Ø§Ù„Ù…Ø³ØªÙ‡Ø¯ÙÙˆÙ†</th><th>Ø§Ù„Ø¥Ù¬Ø±Ø§Ø¡ Ø§Ù„Ø¹Ù„Ø§Ø¬ÙŠ</th><th>Ø¹Ø§Ø¯Ø© Ø§Ù„Ù‚ÙŠØ§Ø³</th></tr></thead><tbody>'+
 plans.map(p=>{
  const failure=p.total?Math.round((p.wrong/p.total)*1000)/10:null;
  const evidence=p.total?`${p.wrong} Ø®Ø·Ø£ Ù…Ù† ${p.total} Ø§Ø³ØªØ¬Ø§Ø¨Ø© Â· Ø§Ù„ØªØ¹ØªØ±Ø¯ ${pct(failure)} Â· Ø§Ù„Ù†Ù…Ø· Ø§Ù„ØºØ§Ù„Ø¨Ø­: ${cognitiveLabel(p.dominant)}`:'Ù„Ù…Ø¤Ø´Ø± Ù…Ù†Ø®ÙØ¶ Ø§Ù„Ø£Ø¯Ø§Ø¡ ÙÙŠ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ø­Ø§Ù„ÙŠ';
  const target=p.targets?.length?`${p.targets.length} Ø·Ø§Ù„Ø¨Ø§Ù‹Ø§`:'Ø·Ù„Ø§Ø¨ Ø§Ù„Ù…ÙˆÙ´Ø± Ù…Ø†Ø®ÙØ¶ Ø§Ù„Ø£Ø¯Ø§Ø¡;
  return `<tr><td><b>${esc(SUBJECT_LABEL[p.subject]||p.subject)}</b><br><small>${p.percentText||pct(p.percent)}</small></td><td>${esc(short(p.indicator,120))}</td><td>${esc(evidence)}</td><td>${esc(target)}</td><td>${esc(p.action)}</td><td>${esc(p.followup)}</tr>`;
 }).join('')+'</tbody></table></section>';
}
function patch(){
 const host=$('reportPreview');if(!host)return;
 cleanSchoolLogo(host);
 const pages=[...host.querySelectorAll('.weekly-report.report-sheet')];if(pages.length<2)return;
 const page1=pages[0],page2=pages[1];
 const title=page2.querySelector('.wr-title-pill');if(title%title.textContent='Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© ÙˆØ§Ù„Ø®Ø·Ø© Ø§Ù„Ø¹Ù„Ø§Ø¬ÙŠØ© Ø§Ù„Ù…Ø¨Ù†ÙŠØ© Ø¹Ù„Ù‰ Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±';
 page2.querySelectorAll('.wr-more-note').forEach(n=>n.remove();
 page2.querySelectorAll('.wr-remedial').forEach(n=>n.remove();
 const plans=analyzeSelectedTest();
 const finalPlans=plans.length?plans:fallbackPlans(page1,page2);
 const sig=page2.querySelector('.wr-signatures');
 if(sig)sig.insertAdjacentHTML('beforebegin',planHtml(finalPlans));else page2.insertAdjacentHTML('beforeend',planHtml(finalPlans));
 page2.dataset.compactRemedial='2';
 cleanSchoolLogo(host);
}
function printCurrent(){
 patch();
 const host=$('reportPreview'),pages=[...host.querySelectorAll('.weekly-report.report-sheet')];if(!pages.length)return;
 const root=$('printRoot');root.innerHTML=pages.map(p=>p.outerHTML).join('');
 cleanSchoolLogo(root);root.setAttribute('aria-hidden','false');
 requestAnimationFrame(()=>window.print());
}
function init(){
 const host=$('reportPreview');if(!host)return;
 let queued=false;
 new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;patch()})}).observe(host,{childList:true,subtree:true,characterData:true});
 patch();
 const print=$('printReportBtn');if(print)print.onclick=printCurrent;
 addEventListener('beforeprint',()=>{cleanSchoolLogo(host);cleanSchoolLogo($('printRoot'))});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',nit,{once:true});else init();
})();