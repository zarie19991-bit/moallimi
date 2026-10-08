-- OWNER-RUN DIAGNOSTIC ONLY. No application rows, keys or hashes are selected.
-- A pg_proc function lookup cannot detect a table or view.
SELECT n.nspname AS schema_name,
       c.relname AS relation_name,
       CASE c.relkind
         WHEN 'r' THEN 'table'
         WHEN 'p' THEN 'partitioned table'
         WHEN 'v' THEN 'view'
         WHEN 'm' THEN 'materialized view'
         WHEN 'f' THEN 'foreign table'
       END AS object_type
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE c.relname='nafes_teacher_access'
  AND c.relkind IN ('r','p','v','m','f')
ORDER BY n.nspname,c.relname;
