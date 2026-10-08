"""Positive auth/save integration with original core definitions and no fabricated parents."""
import importlib.util,json,subprocess
from pathlib import Path
from runtime import LocalPostgres
from schema import ROOT,original_ddl
from repairs import build_repairs

spec=importlib.util.spec_from_file_location("native_scan_cases",Path(__file__).with_name("run-tests.py"))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def run():
    ddl,bodies=original_ddl()
    outputs={}
    with LocalPostgres() as pg:
        for original in [True,False]:
            database="omr_original" if original else "omr_repaired"
            pg.sql("postgres",f"CREATE DATABASE {database}")
            pg.sql(database,ddl)
            if not original: pg.sql(database,build_repairs(bodies))
            cases=module.Cases(pg,database,repaired=not original)
            row=cases.reset("ambiguous")
            cfg=pg.directory/("auth-original.json" if original else "auth-repaired.json")
            cfg.write_text(json.dumps(dict(socket=str(pg.socket),database=database,owner=module.OWNER,
                session=module.SESSION,sheet=row["id"],original=original)))
            p=subprocess.run(["bun","qa/omr/sql/auth-path.ts",str(cfg)],cwd=ROOT,env=pg.env,text=True,capture_output=True,timeout=90)
            if p.returncode: raise RuntimeError(p.stderr)
            result=json.loads(p.stdout)
            outputs["original" if original else "repaired"]=result
    path=ROOT/"qa/omr/results/integration-review";path.mkdir(parents=True,exist_ok=True)
    (path/"auth-save-evidence.json").write_text(json.dumps(outputs,ensure_ascii=False,indent=2))
    for name,data in outputs.items():
        print(name,sum(c["passed"] for c in data["cases"]),"passed",sum(not c["passed"] for c in data["cases"]),"failed")
        for c in data["cases"]:
            if not c["passed"]: print(c["name"],c["error"])
    if any(not c["passed"] for c in outputs["repaired"]["cases"]): raise SystemExit(1)
if __name__=="__main__": run()
