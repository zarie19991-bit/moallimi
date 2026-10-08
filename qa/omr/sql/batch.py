import copy
import hashlib
import json
import subprocess
from pathlib import Path
from schema import ROOT, literal, original_ddl
from runtime import LocalPostgres
from repairs import build_repairs

OWNER="33333333-3333-4333-8333-333333333333"
SESSION="11111111-1111-4111-8111-111111111111"
REVIEW="00000000-0000-4000-8000-000000001000"
def j(x): return literal(json.dumps(x,ensure_ascii=False))+"::jsonb"
def student(i): return "22222222-2222-4222-8222-"+f"{i+1:012d}"

def seed(pg):
    ddl,bodies=original_ddl()
    pg.sql("postgres","CREATE DATABASE omr_repaired")
    pg.sql("omr_repaired",ddl)
    pg.sql("omr_repaired",build_repairs(bodies))
    path=pg.directory/"batch-images.json"
    result=subprocess.run(["bun","qa/omr/batch-images.ts",str(path)],cwd=ROOT,env=pg.env,text=True,
                          capture_output=True,timeout=240)
    if result.returncode: raise RuntimeError(result.stderr)
    rows=json.loads(path.read_text())
    assignments=[dict(sheet_no=i+1,student_id=student(i),student_name=f"طالب اختبار {i+1}",model="A") for i in range(141)]
    payload=dict(question_count=60,assignments=assignments,answer_keys=[dict(model="A",answers=[dict(correct_index=r%4) for r in range(60)])])
    pg.sql("omr_repaired",f"INSERT INTO public.nafes_teacher_access(id,key_hash,label) VALUES({literal(OWNER)},repeat('0',64),'معلم اختبار اصطناعي');"
        f"INSERT INTO public.nafes_paper_reviews(id,owner_id,review_id,subject,subjects,payload) VALUES({literal(REVIEW)},{literal(OWNER)},'batch-140','math',ARRAY['math'],{j(payload)});"
        f"INSERT INTO public.nafes_scan_sessions(id,review_pk,reviewer_id,file_hash,review_snapshot,expected_count) VALUES({literal(SESSION)},{literal(REVIEW)},{literal(OWNER)},'synthetic-140',{j(payload)},140);")
    stored=[]
    for i,row in enumerate(rows):
        answers=copy.deepcopy(row["answers"])
        if i==0:
            answers[0].update(status="ambiguous",reading_status="ambiguous",selected=None,marked=[0,1],state="uncertain",correct=False,
                uncertainty={"reading":["synthetic_review_injection"],"identity":[],"answer_key":[]})
        snapshot=dict(identity_valid=True,markers_ok=row["markers_ok"],model="A",student_name=assignments[i]["student_name"],
                      answers=answers,total=60,score=sum(a["state"]=="correct" for a in answers))
        body=dict(ordinal=i+1,student_id=student(i),sheet_no=i+1,image_data=row["image_data"],image_hash=row["image_hash"],snapshot=snapshot)
        r=pg.json("omr_repaired",f"SELECT public.nafes_scan_register({literal(SESSION)},{j(body)})")
        assert r["student_id"]==student(i) and not r["blocked_duplicate"]
        replay=pg.json("omr_repaired",f"SELECT public.nafes_scan_register({literal(SESSION)},{j(body)})")
        assert replay["id"]==r["id"]
        stored.append(r)
    return rows,stored,payload

def run():
    evidence={"synthetic_only":True,"production_connected":False,"ready_to_publish":False}
    with LocalPostgres() as pg:
        rows,stored,payload=seed(pg)
        db="omr_repaired"
        before=pg.json(db,f"SELECT to_jsonb(s)-'image_data' FROM public.nafes_scan_sheets s WHERE id={literal(stored[0]['id'])}")
        bad=pg.sql(db,f"SELECT public.nafes_scan_verify_current({literal(SESSION)},{literal(stored[0]['id'])},{literal(OWNER)},true,0)",allow_error=True)
        assert bad.returncode!=0
        assert before==pg.json(db,f"SELECT to_jsonb(s)-'image_data' FROM public.nafes_scan_sheets s WHERE id={literal(stored[0]['id'])}")
        # Manual resolution is based on generated ground truth, not guessing real images.
        for i,r in enumerate(stored):
            current=r["effective_snapshot"] or r["snapshot"]
            version=r["answer_version"]
            for n,a in enumerate(current["answers"]):
                if a["state"]=="uncertain" or a["status"]=="ambiguous" or a.get("review_pending"):
                    request=f"44444444-4444-4444-8444-{i*60+n+1:012d}"
                    args=f"{literal(SESSION)},{literal(r['id'])},{literal(OWNER)},{n+1},ARRAY[{rows[i]['expected'][n]}],{version},{literal(request)},'synthetic generated visual ground truth'"
                    edited=pg.json(db,f"SELECT public.nafes_scan_edit_answer({args})")
                    version=edited["answer_version"]
            pg.json(db,f"SELECT public.nafes_scan_verify_current({literal(SESSION)},{literal(r['id'])},{literal(OWNER)},true,{version})")
        done=pg.json(db,f"SELECT public.nafes_scan_finish({literal(SESSION)})")
        again=pg.json(db,f"SELECT public.nafes_scan_finish({literal(SESSION)})")
        assert done["completed_at"]==again["completed_at"]
        final=pg.json(db,"SELECT jsonb_agg(to_jsonb(s)-'image_data' ORDER BY ordinal) FROM public.nafes_scan_sheets s")
        assert len(final)==140 and len({r["student_id"] for r in final})==140
        assert all(r["disposition"]=="verified" and r["student_id"]==student(i) for i,r in enumerate(final))
        matches=sum((r["effective_snapshot"] or r["snapshot"])["answers"][n]["selected"]==rows[i]["expected"][n] for i,r in enumerate(final) for n in range(60))
        assert matches==8400
        evidence.update(sheets=140,source_image_matches=sum(r["matched"] for r in rows),source_image_differences=8400-sum(r["matched"] for r in rows),
            marker_success=sum(bool(r["markers_ok"]) for r in rows),answers_after_manual_review_matches=matches,
            repeated_uploads=140,persisted_rows=140,unique_students=140,verified=140,completed_at=done["completed_at"],
            manual_audit_rows=int(pg.sql(db,"SELECT count(*) FROM public.nafes_scan_answer_edits").stdout.strip()),
            workflow_injected_ambiguous=1,answers_per_sheet=60,definitions_missing=["nafes_scan_deletions","nafes_assessments","nafes_students",
                "lugati_sync_sections_attempt","lugati_sync_student_worksheets"],
            grading_attempt_publication="BLOCKED: original downstream schema incomplete, no attempts were created",
            native_snapshot_sha256=hashlib.sha256(json.dumps(final,sort_keys=True).encode()).hexdigest())
    out=ROOT/"qa/omr/results/integrated";out.mkdir(parents=True,exist_ok=True)
    (out/"batch-140.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2))
    print(json.dumps(evidence,ensure_ascii=False))
if __name__=="__main__": run()
