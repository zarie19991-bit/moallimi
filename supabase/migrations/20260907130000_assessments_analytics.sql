-- Additive assessment/reporting storage. Existing exam URLs and attempt rows remain.
create table if not exists public.nafes_teacher_access (
 id uuid primary key default gen_random_uuid(), key_hash text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
 label text not null default 'معلم المنصة', active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.nafes_assessments (
 id uuid primary key default gen_random_uuid(), owner_id uuid references public.nafes_teacher_access(id),
 short_code text unique check (short_code ~ '^[A-Za-z0-9]{8}$'),
 status text not null default 'draft' check (status in ('draft','published')),
 kind text not null check (kind in ('indicator','multi_indicator','simulation','legacy')),
 title text not null, config jsonb not null, rendered_sections jsonb not null default '[]'::jsonb,
 legacy_target jsonb, created_at timestamptz not null default now(), published_at timestamptz
);
create table if not exists public.nafes_assessment_attempts (
 id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.nafes_assessments(id),
 student_name text not null, student_no text not null, student_key text not null, class_name text not null default '',
 attempt_no integer not null check (attempt_no between 1 and 10), config jsonb not null, rendered_sections jsonb not null,
 answers jsonb not null default '{}'::jsonb, events jsonb not null default '[]'::jsonb,
 cursor integer not null default 0, section_index integer not null default 0, section_started_at timestamptz not null default now(),
 version integer not null default 1, session_id text not null, access_hash text not null,
 lease_until timestamptz not null, started_at timestamptz not null default now(), expires_at timestamptz not null,
 submitted_at timestamptz, score integer, total integer, percent numeric, section_scores jsonb,
 unique(assessment_id,student_key,attempt_no)
);
create unique index if not exists nafes_assessment_active_student_idx on public.nafes_assessment_attempts(assessment_id,student_key) where submitted_at is null;
create index if not exists nafes_assessment_history_idx on public.nafes_assessment_attempts(student_key,started_at desc);
create index if not exists nafes_assessment_expiry_idx on public.nafes_assessment_attempts(expires_at) where submitted_at is null;
create table if not exists public.nafes_simulation_forms (
 subject text not null check(subject in ('reading','math','science')), model_no integer not null check(model_no between 1 and 60),
 questions jsonb not null check(jsonb_array_length(questions)=30), bank_hash text not null, signature text not null,
 created_at timestamptz not null default now(), primary key(subject,model_no), unique(subject,signature)
);
alter table public.nafes_teacher_access enable row level security;
alter table public.nafes_assessments enable row level security;
alter table public.nafes_assessment_attempts enable row level security;
alter table public.nafes_simulation_forms enable row level security;
revoke all on public.nafes_teacher_access,public.nafes_assessments,public.nafes_assessment_attempts,public.nafes_simulation_forms from public,anon,authenticated;
grant all on public.nafes_teacher_access,public.nafes_assessments,public.nafes_assessment_attempts,public.nafes_simulation_forms to service_role;

create or replace function public.nafes_preserve_attempt_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME='nafes_assessment_attempts' then
  if (to_jsonb(new) - array['answers','events','cursor','section_index','section_started_at','version','session_id','access_hash','lease_until','submitted_at','score','total','percent','section_scores']) is distinct from
     (to_jsonb(old) - array['answers','events','cursor','section_index','section_started_at','version','session_id','access_hash','lease_until','submitted_at','score','total','percent','section_scores']) then
   raise exception 'Attempt snapshot is immutable';
  end if;
 end if;
 if old.submitted_at is not null and to_jsonb(new) is distinct from to_jsonb(old) then
  raise exception 'Submitted attempts are immutable';
 end if;
 return new;
end $$;
drop trigger if exists nafes_snapshot_guard on public.nafes_assessment_attempts;
create trigger nafes_snapshot_guard before update on public.nafes_assessment_attempts for each row execute function public.nafes_preserve_attempt_snapshot();
drop trigger if exists nafes_exam_submitted_guard on public.nafes_exam_attempts;
create trigger nafes_exam_submitted_guard before update on public.nafes_exam_attempts for each row execute function public.nafes_preserve_attempt_snapshot();
drop trigger if exists nafes_simulation_submitted_guard on public.nafes_simulation_attempts;
create trigger nafes_simulation_submitted_guard before update on public.nafes_simulation_attempts for each row execute function public.nafes_preserve_attempt_snapshot();

create or replace function public.nafes_preserve_published_test() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='published' and to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'Published tests are immutable'; end if;
 return new;
end $$;
drop trigger if exists nafes_published_guard on public.nafes_assessments;
create trigger nafes_published_guard before update on public.nafes_assessments for each row execute function public.nafes_preserve_published_test();
revoke all on function public.nafes_preserve_attempt_snapshot(),public.nafes_preserve_published_test() from public,anon,authenticated;

create or replace function public.replace_nafes_simulation_forms(payload jsonb) returns jsonb language plpgsql set search_path='' security invoker as $$
declare v_subject text;
begin
 if jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)<>60 then raise exception 'Exactly 60 forms required'; end if;
 v_subject=payload->0->>'subject';
 if exists(select 1 from jsonb_array_elements(payload) p where p->>'subject'<>v_subject or jsonb_array_length(p->'questions')<>30) then raise exception 'Invalid forms'; end if;
 if (select count(distinct (p->>'model_no')::int) from jsonb_array_elements(payload) p)<>60 then raise exception 'Duplicate form numbers'; end if;
 delete from public.nafes_simulation_forms where subject=v_subject;
 insert into public.nafes_simulation_forms(subject,model_no,questions,bank_hash,signature)
 select p->>'subject',(p->>'model_no')::int,p->'questions',p->>'bank_hash',p->>'signature' from jsonb_array_elements(payload) p;
 return jsonb_build_object('subject',v_subject,'forms',60);
end $$;
revoke all on function public.replace_nafes_simulation_forms(jsonb) from public,anon,authenticated;
grant execute on function public.replace_nafes_simulation_forms(jsonb) to service_role;
