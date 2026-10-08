-- OWNER-RUN OPTIONAL METADATA EXPORT. NOT EXECUTED BY REPLIT AGENT.
-- SELECT only: no student rows, results, images, grades, secrets, or settings.
-- Review returned function bodies for embedded secrets before sharing them.
-- Names of tables below were supplied by the owner.
-- RPC functions are discovered from the catalog; no signatures are assumed.
WITH requested(name) AS (
 VALUES ('nafes_scan_sheets'),('nafes_scan_sessions'),
        ('nafes_scan_answer_edits'),('nafes_scan_identity_edits'),('nafes_scan_alerts')
), relations AS (
 SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,n.nspname
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN requested r ON r.name=c.relname
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
)
SELECT jsonb_build_object(
 'tables',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'schema',r.nspname,'name',r.relname,'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,
     'columns',(SELECT jsonb_agg(jsonb_build_object(
       'name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
       'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
       'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid)
     ) ORDER BY a.attnum)
       FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d
       ON d.adrelid=a.attrelid AND d.adnum=a.attnum
       WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
     'constraints',(SELECT jsonb_agg(jsonb_build_object(
       'name',con.conname,'definition',pg_catalog.pg_get_constraintdef(con.oid,true)
     )) FROM pg_catalog.pg_constraint con WHERE con.conrelid=r.oid),
     'indexes',(SELECT jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid))
       FROM pg_catalog.pg_index i WHERE i.indrelid=r.oid),
     'policies',(SELECT jsonb_agg(to_jsonb(pol)) FROM pg_catalog.pg_policies pol
       WHERE pol.schemaname=r.nspname AND pol.tablename=r.relname),
     'triggers',(SELECT jsonb_agg(jsonb_build_object(
       'name',t.tgname,'definition',pg_catalog.pg_get_triggerdef(t.oid,true),
       'function_definition',pg_catalog.pg_get_functiondef(t.tgfoid)
     )) FROM pg_catalog.pg_trigger t WHERE t.tgrelid=r.oid AND NOT t.tgisinternal)
   )) FROM relations r
 ),'[]'::jsonb),
 'scan_functions',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'name',p.proname,
     'identity_arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
     'definition',pg_catalog.pg_get_functiondef(p.oid)
   )) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname ~ '^nafes_scan_' AND p.prokind='f'
 ),'[]'::jsonb),
 'missing_requested_tables',COALESCE((
   SELECT jsonb_agg(q.name) FROM requested q
   WHERE NOT EXISTS (SELECT 1 FROM relations r WHERE r.relname=q.name)
 ),'[]'::jsonb)
) AS manual_review_source_metadata;
