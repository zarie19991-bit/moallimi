// Paper assessments stay draft to avoid opening an electronic student test.
// Saved, submitted attempts are the evidence that their results were approved.
export async function analysisTestCatalog(db:any){
 const columns='id,owner_id,title,kind,status,config,short_code,created_at,published_at,legacy_target';
 const read=(r:any)=>{if(r.error)throw new Error(r.error.message);return r.data||[];};
 const [publishedResult,paperResult]=await Promise.all([
  db.from('nafes_assessments').select(columns).eq('status','published').neq('kind','simulation'),
  db.from('nafes_assessments').select(columns).eq('status','draft').eq('config->>paper_review','true').neq('kind','simulation')
 ]);
 const published=read(publishedResult),papers=read(paperResult);
 const approved=new Set<string>();
 if(papers.length){
  for(let start=0;;start+=1000){
   const rows=read(await db.from('nafes_assessment_attempts').select('id,assessment_id')
    .in('assessment_id',papers.map((p:any)=>p.id)).eq('is_demo',false)
    .not('submitted_at','is',null).order('id').range(start,start+999));
   for(const row of rows)approved.add(row.assessment_id);
   if(rows.length<1000)break;
  }
 }
 return [...new Map([...published,...papers.filter((p:any)=>approved.has(p.id))].map((p:any)=>[p.id,p])).values()];
}
