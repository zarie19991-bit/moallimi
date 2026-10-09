-- OWNER-RUN OPTIONAL METADATA EXPORT. NOT EXECUTED BY REPLIT AGENT.
-- SELECT only: catalog metadata, not student/result/image rows or secret stores.
-- Conservatively withhold definitions mentioning credential markers.
-- This is not a complete secret detector. Owner must inspect output before sharing.
-- Copy this entire SINGLE SELECT into SQL Editor; export its ONE result cell.
-- No business functions are invoked; only pg_catalog metadata helpers are used.
-- Procedural/dynamic SQL is not fully tracked by PostgreSQL's dependency catalog.
-- Reported completeness is about requested objects, not a promise about dynamic SQL.
WITH RECURSIVE requested(schema_name,name) AS (
 VALUES ('public','nafes_scan_sheets'),('public','nafes_scan_sessions'),
        ('public','nafes_scan_answer_edits'),('public','nafes_scan_identity_edits'),
        ('public','nafes_scan_alerts'),('public','nafes_paper_reviews'),
        ('public','nafes_assessment_attempts'),('public','nafes_scan_deletions'),
        ('public','nafes_assessments'),('public','nafes_students'),
        ('public','nafes_teacher_access'),('auth','users'),
        ('public','moallimi_classes'),('public','nafes_analysis_exclusion_audit'),
        ('public','nafes_exam_attempts'),('public','nafes_simulation_attempts'),
        ('public','nafes_question_bank'),('public','lugati_adaptive_assignments')
), requested_functions(name) AS (
 VALUES ('lugati_sync_sections_attempt'),('lugati_sync_student_worksheets'),
        ('lugati_upsert_adaptive_assignment'),('nafes_enforce_teacher_subject_scope'),
        ('nafes_log_student_analysis_exclusion'),('nafes_log_student_demo_exclusion'),
        ('nafes_preserve_published_test'),('nafes_set_updated_at'),
        ('nafes_sync_student_name_normalized'),
        ('nafes_normalize_arabic'),('lugati_require_source_for_auto_assignment'),
        ('lugati_exam_adaptive_trigger'),('lugati_simulation_adaptive_trigger'),
        ('nafes_standard_question_quality_guard'),
        ('nafes_teacher_attempt_page'),('nafes_teacher_catalog_counts')
), safety AS (
 SELECT '(sb_secret_|eyJ[A-Za-z0-9_-]{10,}[.]|bearer[[:space:]]|api[_-]?key|password|jwt[_-]?secret|vault[.]|-----BEGIN .*PRIVATE KEY-----|postgres(ql)?://)'::text AS pattern
), all_relations AS MATERIALIZED (
 SELECT c.*,n.nspname FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema')
   AND n.nspname !~ '^pg_(toast|temp)'
   AND c.relkind IN ('r','p','v','m','S')
), all_functions AS MATERIALIZED (
 SELECT p.*,n.nspname,pg_catalog.pg_get_functiondef(p.oid) AS body
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema')
   AND n.nspname !~ '^pg_(toast|temp)' AND p.prokind='f'
), root_relations AS (
 SELECT c.* FROM all_relations c
 JOIN requested r ON r.name=c.relname AND r.schema_name=c.nspname
), edges(source_kind,source_oid,target_kind,target_oid) AS MATERIALIZED (
 -- FK parents, including auth.users without selecting any auth.users rows.
 SELECT 'r',con.conrelid,'r',con.confrelid FROM pg_catalog.pg_constraint con
 WHERE con.contype='f' AND con.confrelid<>0
 UNION
 SELECT 'r',t.tgrelid,'f',t.tgfoid FROM pg_catalog.pg_trigger t WHERE NOT t.tgisinternal
 UNION
 -- Column defaults, CHECK constraints and RLS expressions may call functions/sequences.
 SELECT 'r',obj.relid,CASE d.refclassid WHEN 'pg_catalog.pg_proc'::regclass THEN 'f' ELSE 'r' END,d.refobjid
 FROM (
   SELECT 'pg_catalog.pg_attrdef'::regclass AS classid,oid,adrelid AS relid FROM pg_catalog.pg_attrdef
   UNION ALL SELECT 'pg_catalog.pg_constraint'::regclass,oid,conrelid FROM pg_catalog.pg_constraint
   UNION ALL SELECT 'pg_catalog.pg_policy'::regclass,oid,polrelid FROM pg_catalog.pg_policy
   UNION ALL SELECT 'pg_catalog.pg_rewrite'::regclass,oid,ev_class FROM pg_catalog.pg_rewrite
 ) obj JOIN pg_catalog.pg_depend d ON d.classid=obj.classid AND d.objid=obj.oid
 WHERE d.refclassid IN ('pg_catalog.pg_proc'::regclass,'pg_catalog.pg_class'::regclass)
 UNION
 SELECT 'r',d.refobjid,'r',d.objid FROM pg_catalog.pg_depend d
 JOIN all_relations seq ON seq.oid=d.objid AND seq.relkind='S'
 WHERE d.classid='pg_catalog.pg_class'::regclass AND d.refclassid='pg_catalog.pg_class'::regclass
   AND d.deptype IN ('a','i')
 UNION
 SELECT 'f',d.objid,CASE d.refclassid WHEN 'pg_catalog.pg_proc'::regclass THEN 'f' ELSE 'r' END,d.refobjid
 FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_proc'::regclass
 AND d.refclassid IN ('pg_catalog.pg_proc'::regclass,'pg_catalog.pg_class'::regclass)
 UNION
 -- Best-effort PL/pgSQL body discovery supplements (never replaces) pg_depend.
 -- Include every matching overload; do not guess parameter signatures.
 SELECT 'f',caller.oid,'f',callee.oid FROM all_functions caller
 CROSS JOIN LATERAL pg_catalog.regexp_matches(caller.body,
   '(?:([a-z_][a-z0-9_]*)[.])?([a-z_][a-z0-9_]*)[[:space:]]*[(]','gi') m(parts)
 JOIN all_functions callee ON callee.proname=lower(m.parts[2])
 AND ((m.parts[1] IS NOT NULL AND callee.nspname=lower(m.parts[1]))
      OR (m.parts[1] IS NULL AND callee.nspname IN ('public','auth',caller.nspname)))
 UNION
 SELECT 'f',caller.oid,'r',rel.oid FROM all_functions caller
 CROSS JOIN LATERAL pg_catalog.regexp_matches(caller.body,
   '(?:from|join|into|update)[[:space:]]+(?:([a-z_][a-z0-9_]*)[.])?([a-z_][a-z0-9_]*)','gi') m(parts)
 JOIN all_relations rel ON rel.relname=lower(m.parts[2])
 AND ((m.parts[1] IS NOT NULL AND rel.nspname=lower(m.parts[1]))
      OR (m.parts[1] IS NULL AND rel.nspname IN ('public','auth',caller.nspname)))
), closure(kind,oid) AS (
 SELECT 'r',oid FROM root_relations
 UNION
 SELECT 'f',oid FROM all_functions
 WHERE nspname='public' AND (proname ~ '^nafes_scan_' OR proname IN (SELECT name FROM requested_functions))
 UNION
 SELECT e.target_kind,e.target_oid FROM closure c
 JOIN edges e ON e.source_kind=c.kind AND e.source_oid=c.oid
 WHERE (e.target_kind='r' AND EXISTS(SELECT 1 FROM all_relations r WHERE r.oid=e.target_oid))
    OR (e.target_kind='f' AND EXISTS(SELECT 1 FROM all_functions f WHERE f.oid=e.target_oid))
), relations AS (
 SELECT r.* FROM all_relations r JOIN closure c ON c.kind='r' AND c.oid=r.oid
 WHERE r.relkind<>'S'
), functions AS (
 SELECT f.* FROM all_functions f JOIN closure c ON c.kind='f' AND c.oid=f.oid
), sequences AS (
 SELECT r.* FROM all_relations r JOIN closure c ON c.kind='r' AND c.oid=r.oid
 WHERE r.relkind='S'
), type_oids(oid) AS (
 SELECT a.atttypid FROM pg_catalog.pg_attribute a JOIN relations r ON r.oid=a.attrelid
 WHERE a.attnum>0 AND NOT a.attisdropped
 UNION
 SELECT f.prorettype FROM functions f
 UNION
 SELECT unnest(f.proargtypes::oid[]) FROM functions f
 UNION
 SELECT dep.oid FROM type_oids old JOIN pg_catalog.pg_type t ON t.oid=old.oid
 CROSS JOIN LATERAL (VALUES(t.typelem),(t.typbasetype)) dep(oid) WHERE dep.oid<>0
), object_acl(owner_id,acl) AS (
 SELECT relowner,COALESCE(relacl,pg_catalog.acldefault('r',relowner)) FROM relations
 UNION ALL SELECT relowner,COALESCE(relacl,pg_catalog.acldefault('s',relowner)) FROM sequences
 UNION ALL SELECT proowner,COALESCE(proacl,pg_catalog.acldefault('f',proowner)) FROM functions
 UNION ALL SELECT nspowner,COALESCE(nspacl,pg_catalog.acldefault('n',nspowner))
 FROM pg_catalog.pg_namespace WHERE nspname IN (
   SELECT nspname FROM relations UNION SELECT nspname FROM functions UNION SELECT nspname FROM sequences)
), role_oids(oid) AS (
 SELECT owner_id FROM object_acl
 UNION SELECT a.grantee FROM object_acl o CROSS JOIN LATERAL pg_catalog.aclexplode(o.acl) a WHERE a.grantee<>0
 UNION SELECT a.grantor FROM object_acl o CROSS JOIN LATERAL pg_catalog.aclexplode(o.acl) a
 UNION SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','service_role','postgres')
 UNION SELECT m.roleid FROM role_oids r JOIN pg_catalog.pg_auth_members m ON m.member=r.oid
)
SELECT jsonb_build_object(
 'export_format','omr-original-catalog-closure-v2',
 'metadata_only',true,'student_rows_included',false,
 'postgres_version',pg_catalog.current_setting('server_version'),
 'tables',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'schema',r.nspname,'name',r.relname,'relation_kind',r.relkind,
     'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,
     'owner',pg_catalog.pg_get_userbyid(r.relowner),'acl',r.relacl::text,
     'effective_acl',(SELECT jsonb_agg(jsonb_build_object(
       'grantor',pg_catalog.pg_get_userbyid(a.grantor),
       'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
       'privilege',a.privilege_type,'grantable',a.is_grantable))
       FROM pg_catalog.aclexplode(COALESCE(r.relacl,pg_catalog.acldefault('r',r.relowner))) a),
     'view_definition',CASE WHEN r.relkind IN ('v','m')
       AND pg_catalog.pg_get_viewdef(r.oid,true) !~* (SELECT pattern FROM safety)
       THEN pg_catalog.pg_get_viewdef(r.oid,true) END,
     'columns',(SELECT jsonb_agg(jsonb_build_object(
       'name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
        'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
        'acl',a.attacl::text,
       'owned_sequence',pg_catalog.pg_get_serial_sequence(
         pg_catalog.format('%I.%I',r.nspname,r.relname),a.attname),
       'default',CASE WHEN pg_catalog.pg_get_expr(d.adbin,d.adrelid)
          ~* (SELECT pattern FROM safety)
         THEN NULL ELSE pg_catalog.pg_get_expr(d.adbin,d.adrelid) END,
       'default_withheld_for_review',COALESCE(pg_catalog.pg_get_expr(d.adbin,d.adrelid)
          ~* (SELECT pattern FROM safety),false)
     ) ORDER BY a.attnum)
       FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d
       ON d.adrelid=a.attrelid AND d.adnum=a.attnum
       WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
     'constraints',(SELECT jsonb_agg(jsonb_build_object(
        'name',con.conname,
        'definition',CASE WHEN pg_catalog.pg_get_constraintdef(con.oid,true) !~* (SELECT pattern FROM safety)
          THEN pg_catalog.pg_get_constraintdef(con.oid,true) END,
        'definition_withheld_for_review',pg_catalog.pg_get_constraintdef(con.oid,true) ~* (SELECT pattern FROM safety),
       'validated',con.convalidated,'deferrable',con.condeferrable,'initially_deferred',con.condeferred,
       'referenced_relation',CASE WHEN con.confrelid<>0 THEN con.confrelid::regclass::text END
     )) FROM pg_catalog.pg_constraint con WHERE con.conrelid=r.oid),
     'indexes',(SELECT jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid)) FILTER (
       WHERE pg_catalog.pg_get_indexdef(i.indexrelid) !~* (SELECT pattern FROM safety))
       FROM pg_catalog.pg_index i WHERE i.indrelid=r.oid),
     'indexes_withheld_for_review',(SELECT count(*) FROM pg_catalog.pg_index i WHERE i.indrelid=r.oid
       AND pg_catalog.pg_get_indexdef(i.indexrelid) ~* (SELECT pattern FROM safety)),
     'policies',(SELECT jsonb_agg(to_jsonb(pol)) FILTER (WHERE
       COALESCE(pol.qual,'') !~* (SELECT pattern FROM safety)
       AND COALESCE(pol.with_check,'') !~* (SELECT pattern FROM safety)) FROM pg_catalog.pg_policies pol
       WHERE pol.schemaname=r.nspname AND pol.tablename=r.relname),
     'policies_withheld_for_review',(SELECT count(*) FROM pg_catalog.pg_policies pol
       WHERE pol.schemaname=r.nspname AND pol.tablename=r.relname
       AND (COALESCE(pol.qual,'') ~* (SELECT pattern FROM safety)
         OR COALESCE(pol.with_check,'') ~* (SELECT pattern FROM safety))),
     'triggers',(SELECT jsonb_agg(jsonb_build_object(
        'name',t.tgname,'definition',CASE
          WHEN pg_catalog.pg_get_triggerdef(t.oid,true) !~* (SELECT pattern FROM safety)
          THEN pg_catalog.pg_get_triggerdef(t.oid,true) END,
        'trigger_definition_withheld_for_review',pg_catalog.pg_get_triggerdef(t.oid,true) ~* (SELECT pattern FROM safety),
       'enabled',t.tgenabled,
       'function_definition',CASE WHEN pg_catalog.pg_get_functiondef(t.tgfoid)
          ~* (SELECT pattern FROM safety)
         THEN NULL ELSE pg_catalog.pg_get_functiondef(t.tgfoid) END,
       'definition_withheld_for_review',pg_catalog.pg_get_functiondef(t.tgfoid)
          ~* (SELECT pattern FROM safety),
       'function_schema',(SELECT nspname FROM all_functions f WHERE f.oid=t.tgfoid),
       'function_identity_arguments',pg_catalog.pg_get_function_identity_arguments(t.tgfoid),
       'function_acl',(SELECT proacl::text FROM all_functions f WHERE f.oid=t.tgfoid)
     )) FROM pg_catalog.pg_trigger t WHERE t.tgrelid=r.oid AND NOT t.tgisinternal)
   )) FROM relations r
 ),'[]'::jsonb),
 'scan_functions',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'schema',p.nspname,'name',p.proname,
     'identity_arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
     'owner',pg_catalog.pg_get_userbyid(p.proowner),'acl',p.proacl::text,
     'effective_acl',(SELECT jsonb_agg(jsonb_build_object(
       'grantor',pg_catalog.pg_get_userbyid(a.grantor),
       'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
       'privilege',a.privilege_type,'grantable',a.is_grantable))
       FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a),
     'config',p.proconfig,'language',(SELECT lanname FROM pg_catalog.pg_language WHERE oid=p.prolang),
     'dynamic_sql_review_required',p.body ~* '\mEXECUTE\M',
     'security_definer',p.prosecdef,'volatility',p.provolatile,
     'definition',CASE WHEN pg_catalog.pg_get_functiondef(p.oid)
        ~* (SELECT pattern FROM safety)
       THEN NULL ELSE pg_catalog.pg_get_functiondef(p.oid) END,
     'definition_withheld_for_review',pg_catalog.pg_get_functiondef(p.oid)
        ~* (SELECT pattern FROM safety)
   )) FROM functions p
 ),'[]'::jsonb),
 'column_enums',COALESCE((
    SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,
      'owner',pg_catalog.pg_get_userbyid(t.typowner),'acl',t.typacl::text,
     'labels',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
               FROM pg_catalog.pg_enum e WHERE e.enumtypid=t.oid)))
   FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
    WHERE t.typtype='e' AND t.oid IN (SELECT oid FROM type_oids)
 ),'[]'::jsonb),
 'owned_sequences',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'schema',n.nspname,'name',c.relname,'type',pg_catalog.format_type(s.seqtypid,NULL),
     'start',s.seqstart,'increment',s.seqincrement,'min',s.seqmin,'max',s.seqmax,
     'cache',s.seqcache,'cycle',s.seqcycle,
     'owner',pg_catalog.pg_get_userbyid(c.relowner),'acl',c.relacl::text,
     'effective_acl',(SELECT jsonb_agg(jsonb_build_object(
       'grantor',pg_catalog.pg_get_userbyid(a.grantor),
       'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
       'privilege',a.privilege_type,'grantable',a.is_grantable))
       FROM pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('s',c.relowner))) a),
     'owned_by',(SELECT jsonb_agg(jsonb_build_object(
       'schema',r.nspname,'table',r.relname,'column',at.attname,'dependency_type',d.deptype))
       FROM pg_catalog.pg_depend d JOIN relations r ON r.oid=d.refobjid
       JOIN pg_catalog.pg_attribute at ON at.attrelid=r.oid AND at.attnum=d.refobjsubid
       WHERE d.classid='pg_catalog.pg_class'::regclass AND d.objid=c.oid
       AND d.refclassid='pg_catalog.pg_class'::regclass AND d.deptype IN ('a','i'))))
   FROM pg_catalog.pg_sequence s JOIN pg_catalog.pg_class c ON c.oid=s.seqrelid
     JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE c.oid IN (SELECT oid FROM sequences)
 ),'[]'::jsonb),
 'missing_requested_tables',COALESCE((
   SELECT jsonb_agg(q.schema_name||'.'||q.name) FROM requested q
   WHERE NOT EXISTS (SELECT 1 FROM root_relations r WHERE r.relname=q.name AND r.nspname=q.schema_name)
 ),'[]'::jsonb),
 'missing_requested_functions',COALESCE((
   SELECT jsonb_agg(q.name) FROM requested_functions q
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prokind='f' AND p.proname=q.name)
 ),'[]'::jsonb),
 'schemas',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'name',n.nspname,'owner',pg_catalog.pg_get_userbyid(n.nspowner),'acl',n.nspacl::text,
     'effective_acl',(SELECT jsonb_agg(jsonb_build_object(
       'grantor',pg_catalog.pg_get_userbyid(a.grantor),
       'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
       'privilege',a.privilege_type,'grantable',a.is_grantable))
       FROM pg_catalog.aclexplode(COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a)))
   FROM pg_catalog.pg_namespace n WHERE n.nspname IN (
     SELECT nspname FROM relations UNION SELECT nspname FROM functions UNION SELECT nspname FROM sequences)
 ),'[]'::jsonb),
 'domain_types',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'schema',n.nspname,'name',t.typname,'base_type',pg_catalog.format_type(t.typbasetype,t.typtypmod),
     'not_null',t.typnotnull,'owner',pg_catalog.pg_get_userbyid(t.typowner),'acl',t.typacl::text,
     'default',CASE WHEN COALESCE(t.typdefault,'') !~* (SELECT pattern FROM safety) THEN t.typdefault END,
     'constraints',(SELECT jsonb_agg(jsonb_build_object(
       'name',c.conname,'definition',CASE WHEN pg_catalog.pg_get_constraintdef(c.oid,true) !~* (SELECT pattern FROM safety)
         THEN pg_catalog.pg_get_constraintdef(c.oid,true) END,
       'definition_withheld_for_review',pg_catalog.pg_get_constraintdef(c.oid,true) ~* (SELECT pattern FROM safety)))
       FROM pg_catalog.pg_constraint c WHERE c.contypid=t.oid)))
   FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
   WHERE t.typtype='d' AND t.oid IN (SELECT oid FROM type_oids)
 ),'[]'::jsonb),
 'default_privileges',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'owner',pg_catalog.pg_get_userbyid(d.defaclrole),'schema',n.nspname,
     'object_type',d.defaclobjtype,'acl',d.defaclacl::text))
   FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
   WHERE d.defaclnamespace=0 OR n.nspname IN (
     SELECT nspname FROM relations UNION SELECT nspname FROM functions UNION SELECT nspname FROM sequences)
 ),'[]'::jsonb),
 'role_attributes',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'name',r.rolname,'inherit',r.rolinherit,'bypass_rls',r.rolbypassrls,
     'superuser',r.rolsuper,'can_login',r.rolcanlogin))
   FROM pg_catalog.pg_roles r WHERE r.oid IN (SELECT oid FROM role_oids)
 ),'[]'::jsonb),
 'role_memberships',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'role',pg_catalog.pg_get_userbyid(m.roleid),'member',pg_catalog.pg_get_userbyid(m.member),
     'grantor',pg_catalog.pg_get_userbyid(m.grantor),'admin_option',m.admin_option,
     'inherit_option',m.inherit_option,'set_option',m.set_option))
   FROM pg_catalog.pg_auth_members m WHERE m.member IN (SELECT oid FROM role_oids)
 ),'[]'::jsonb),
 'extensions',COALESCE((
   SELECT jsonb_agg(jsonb_build_object(
     'name',e.extname,'version',e.extversion,'schema',n.nspname))
   FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
   WHERE EXISTS (
     SELECT 1 FROM pg_catalog.pg_depend d WHERE d.refclassid='pg_catalog.pg_extension'::regclass
       AND d.refobjid=e.oid AND d.deptype='e'
       AND ((d.classid='pg_catalog.pg_proc'::regclass AND d.objid IN(SELECT oid FROM functions))
         OR (d.classid='pg_catalog.pg_class'::regclass AND d.objid IN(SELECT oid FROM relations))
         OR (d.classid='pg_catalog.pg_type'::regclass AND d.objid IN(SELECT oid FROM type_oids))))
 ),'[]'::jsonb),
 'withheld_objects',COALESCE((
   SELECT jsonb_agg(jsonb_build_object('schema',f.nspname,'function',f.proname,
     'identity_arguments',pg_catalog.pg_get_function_identity_arguments(f.oid)))
   FROM functions f WHERE f.body ~* (SELECT pattern FROM safety)
 ),'[]'::jsonb),
 'procedural_dependency_review_required',true,
 'owner_secret_review_required',true,
 'sequence_current_values_included',false
) AS manual_review_source_metadata;
