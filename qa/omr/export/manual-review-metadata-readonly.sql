-- OWNER-RUN OPTIONAL METADATA EXPORT. NOT EXECUTED BY REPLIT AGENT.
-- SELECT only: catalog metadata, not student/result/image rows or secret stores.
-- Conservatively withhold definitions mentioning credential markers.
-- This is not a complete secret detector. Owner must inspect output before sharing.
-- Five tables below were supplied by the owner; two support tables are
-- referenced by the existing Edge source. Missing names are reported, not created.
-- RPC functions are discovered from the catalog; no signatures are assumed.
WITH RECURSIVE requested(name) AS (
 VALUES ('nafes_scan_sheets'),('nafes_scan_sessions'),
        ('nafes_scan_answer_edits'),('nafes_scan_identity_edits'),('nafes_scan_alerts'),
        ('nafes_paper_reviews'),('nafes_assessment_attempts')
), root_relations AS (
 SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relowner,c.relacl,n.nspname
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN requested r ON r.name=c.relname
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
), relation_oids(oid) AS (
 SELECT oid FROM root_relations
 UNION
 SELECT con.confrelid
 FROM pg_catalog.pg_constraint con JOIN relation_oids r ON r.oid=con.conrelid
 WHERE con.contype='f' AND con.confrelid<>0
), relations AS (
 SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relowner,c.relacl,n.nspname
 FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN relation_oids r ON r.oid=c.oid
)
SELECT jsonb_build_object(
 'postgres_version',pg_catalog.current_setting('server_version'),
 'tables',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'schema',r.nspname,'name',r.relname,'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,
     'owner',pg_catalog.pg_get_userbyid(r.relowner),'acl',r.relacl::text,
     'columns',(SELECT jsonb_agg(jsonb_build_object(
       'name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
       'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
       'owned_sequence',pg_catalog.pg_get_serial_sequence(
         pg_catalog.format('%I.%I',r.nspname,r.relname),a.attname),
       'default',CASE WHEN pg_catalog.pg_get_expr(d.adbin,d.adrelid)
         ~* '(sb_secret_|eyJ[A-Za-z0-9_-]{10,}[.]|bearer[[:space:]]|api[_-]?key|password|jwt[_-]?secret|vault[.])'
         THEN NULL ELSE pg_catalog.pg_get_expr(d.adbin,d.adrelid) END,
       'default_withheld_for_review',COALESCE(pg_catalog.pg_get_expr(d.adbin,d.adrelid)
         ~* '(sb_secret_|eyJ[A-Za-z0-9_-]{10,}[.]|bearer[[:space:]]|api[_-]?key|password|jwt[_-]?secret|vault[.])',false)
     ) ORDER BY a.attnum)
       FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d
       ON d.adrelid=a.attrelid AND d.adnum=a.attnum
       WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
     'constraints',(SELECT jsonb_agg(jsonb_build_object(
       'name',con.conname,'definition',pg_catalog.pg_get_constraintdef(con.oid,true),
       'validated',con.convalidated,'deferrable',con.condeferrable,'initially_deferred',con.condeferred,
       'referenced_relation',CASE WHEN con.confrelid<>0 THEN con.confrelid::regclass::text END
     )) FROM pg_catalog.pg_constraint con WHERE con.conrelid=r.oid),
     'indexes',(SELECT jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid))
       FROM pg_catalog.pg_index i WHERE i.indrelid=r.oid),
     'policies',(SELECT jsonb_agg(to_jsonb(pol)) FROM pg_catalog.pg_policies pol
       WHERE pol.schemaname=r.nspname AND pol.tablename=r.relname),
     'triggers',(SELECT jsonb_agg(jsonb_build_object(
       'name',t.tgname,'definition',pg_catalog.pg_get_triggerdef(t.oid,true),
       'enabled',t.tgenabled,
       'function_definition',CASE WHEN pg_catalog.pg_get_functiondef(t.tgfoid)
         ~* '(sb_secret_|eyJ[A-Za-z0-9_-]{10,}[.]|bearer[[:space:]]|api[_-]?key|password|jwt[_-]?secret|vault[.])'
         THEN NULL ELSE pg_catalog.pg_get_functiondef(t.tgfoid) END,
       'definition_withheld_for_review',pg_catalog.pg_get_functiondef(t.tgfoid)
         ~* '(sb_secret_|eyJ[A-Za-z0-9_-]{10,}[.]|bearer[[:space:]]|api[_-]?key|password|jwt[_-]?secret|vault[.])'
     )) FROM pg_catalog.pg_trigger t WHERE t.tgrelid=r.oid AND NOT t.tgisinternal)
   )) FROM relations r
 ),'[]'::jsonb),
 'scan_functions',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'name',p.proname,
     'identity_arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
     'owner',pg_catalog.pg_get_userbyid(p.proowner),'acl',p.proacl::text,
     'security_definer',p.prosecdef,'volatility',p.provolatile,
     'definition',CASE WHEN pg_catalog.pg_get_functiondef(p.oid)
       ~* '(sb_secret_|eyJ[A-Za-z0-9_-]{10,}[.]|bearer[[:space:]]|api[_-]?key|password|jwt[_-]?secret|vault[.])'
       THEN NULL ELSE pg_catalog.pg_get_functiondef(p.oid) END,
     'definition_withheld_for_review',pg_catalog.pg_get_functiondef(p.oid)
       ~* '(sb_secret_|eyJ[A-Za-z0-9_-]{10,}[.]|bearer[[:space:]]|api[_-]?key|password|jwt[_-]?secret|vault[.])'
   )) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prokind='f'
     AND (p.proname ~ '^nafes_scan_'
       -- These exact callees were found in the uploaded attempt trigger bodies.
       OR p.proname IN ('lugati_sync_sections_attempt','lugati_sync_student_worksheets'))
 ),'[]'::jsonb),
 'column_enums',COALESCE((
   SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,
     'labels',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
               FROM pg_catalog.pg_enum e WHERE e.enumtypid=t.oid)))
   FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
   WHERE t.typtype='e' AND t.oid IN (
     SELECT a.atttypid FROM pg_catalog.pg_attribute a JOIN relations r ON r.oid=a.attrelid
       WHERE a.attnum>0 AND NOT a.attisdropped
     UNION
     SELECT at.typelem FROM pg_catalog.pg_attribute a JOIN relations r ON r.oid=a.attrelid
       JOIN pg_catalog.pg_type at ON at.oid=a.atttypid
       WHERE a.attnum>0 AND NOT a.attisdropped AND at.typelem<>0
   )
 ),'[]'::jsonb),
 'owned_sequences',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'schema',n.nspname,'name',c.relname,'type',pg_catalog.format_type(s.seqtypid,NULL),
     'start',s.seqstart,'increment',s.seqincrement,'min',s.seqmin,'max',s.seqmax,
     'cache',s.seqcache,'cycle',s.seqcycle))
   FROM pg_catalog.pg_sequence s JOIN pg_catalog.pg_class c ON c.oid=s.seqrelid
     JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE EXISTS (SELECT 1 FROM pg_catalog.pg_depend d JOIN relations r ON r.oid=d.refobjid
     WHERE d.classid='pg_catalog.pg_class'::regclass
       AND d.refclassid='pg_catalog.pg_class'::regclass AND d.objid=s.seqrelid AND d.deptype IN ('a','i'))
 ),'[]'::jsonb),
 'missing_requested_tables',COALESCE((
   SELECT jsonb_agg(q.name) FROM requested q
   WHERE NOT EXISTS (SELECT 1 FROM root_relations r WHERE r.relname=q.name)
 ),'[]'::jsonb)
) AS manual_review_source_metadata;
