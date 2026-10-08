"""Managed development preview: synthetic PostgreSQL only; retain existing platform files."""
import json,signal,subprocess,hashlib
from runtime import LocalPostgres
from schema import ROOT
from batch import seed,OWNER,SESSION

with LocalPostgres() as pg:
    seed(pg)
    key="0000000001" # Public synthetic fixture, never a real teacher credential.
    pg.sql("omr_repaired",f"UPDATE public.nafes_teacher_access SET key_hash='{hashlib.sha256(key.encode()).hexdigest()}' WHERE id='{OWNER}'")
    cfg=pg.directory/"preview.json"
    cfg.write_text(json.dumps(dict(socket=str(pg.socket),database="omr_repaired",owner_id=OWNER,session_id=SESSION,
        auth_role="service_role",read_role="service_role",rpc_role="service_role")))
    process=subprocess.Popen(["bun","qa/omr/integrated-server.ts",str(cfg)],cwd=ROOT,env=pg.env)
    def stop(*_):
        process.terminate()
    signal.signal(signal.SIGTERM,stop)
    signal.signal(signal.SIGINT,stop)
    try: process.wait()
    finally:
        if process.poll() is None:
            process.terminate();process.wait(timeout=10)
