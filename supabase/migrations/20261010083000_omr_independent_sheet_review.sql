-- Allow reviewing clean scanned sheets in any order.
-- DO NOT alter existing scores, attempts, identities, answer keys or review timestamps.
-- All other validation in each original function is retained.
BEGIN;
DO $migration$
DECLARE
  func regprocedure;
  source_sql text;
  guard text;
  target_sql text;
BEGIN
  FOREACH func IN ARRAY ARRAY[
    'public.nafes_scan_verify(uuid,uuid,uuid,boolean)'::regprocedure,
    'public.nafes_scan_edit_answer(uuid,uuid,uuid,integer,integer[],integer,uuid,text)'::regprocedure
  ] LOOP
    SELECT pg_get_functiondef(func) INTO source_sql;
    -- The production verify RPC uses "; end if;" while edit_answer uses ";end if;".
    guard := ' if exists(select 1 from public.nafes_scan_sheets where session_id=s.id and ordinal<r.ordinal and reviewed_at is null) then raise exception ''راجع الورقة السابقة أولًا'';' ||
      CASE WHEN func='public.nafes_scan_verify(uuid,uuid,uuid,boolean)'::regprocedure
        THEN ' end if;' ELSE 'end if;' END;
    IF source_sql IS NULL OR length(source_sql)-length(replace(source_sql,guard,'')) <> length(guard) THEN
      RAISE EXCEPTION 'Sequential guard does not match %; no database changes committed',func;
    END IF;
    -- Version is checked in the active verify_current wrapper; edit_answer
    -- checks answer_version itself. Neither check may be weakened.
    IF (func='public.nafes_scan_edit_answer(uuid,uuid,uuid,integer,integer[],integer,uuid,text)'::regprocedure
        AND position('answer_version' in source_sql)=0)
       OR position('reviewed_at' in source_sql)=0
       OR position('session_id=s.id' in source_sql)=0 THEN
      RAISE EXCEPTION 'Core OMR safety checks not found in %',func;
    END IF;
    target_sql := replace(source_sql,guard,'
    -- Independent sheet review: other sheets may remain pending.');
    EXECUTE target_sql;
  END LOOP;
END $migration$;
COMMIT;
