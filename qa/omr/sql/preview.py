"""Managed development preview: synthetic PostgreSQL only; retain existing platform files."""
import json,signal,subprocess
from runtime import LocalPostgres
from schema import ROOT
from batch import seed,OWNER,SESSION

with LocalPostgres() as pg:
    seed(pg)
    cfg=pg.directory/"preview.json"
    cfg.write_text(json.dumps(dict(socket=str(pg.socket),database="omr_repaired",owner_id=OWNER,session_id=SESSION)))
    process=subprocess.Popen(["bun","qa/omr/integrated-server.ts",str(cfg)],cwd=ROOT,env=pg.env)
    def stop(*_):
        process.terminate()
    signal.signal(signal.SIGTERM,stop)
    signal.signal(signal.SIGINT,stop)
    try: process.wait()
    finally:
        if process.poll() is None:
            process.terminate();process.wait(timeout=10)
