-- Browser observations contain no answer content. Only the authenticated edge
-- handler can write/read them after checking the existing attempt/teacher scope.
create table if not exists public.nafes_attempt_activity (
 id uuid primary key,
 source text not null check (source in ('exam','assessment')),
 attempt_id uuid not null,
 event_type text not null check (event_type in ('previous_result','entry','pulse','hidden','visible','page_leave','offline','online','server_error','request_failed','client_error','submit_intent','result','section')),
 section integer not null check (section between 0 and 20),
 subject text not null check (subject in ('reading','math','science')),
 occurred_at timestamptz not null,
 received_at timestamptz not null default now(),
 visible_ms integer not null default 0 check (visible_ms between 0 and 45000),
 status_code integer check (status_code between 400 and 599)
);
create index if not exists nafes_attempt_activity_lookup on public.nafes_attempt_activity(source,attempt_id,received_at,id);
alter table public.nafes_attempt_activity enable row level security;
revoke all on public.nafes_attempt_activity from public, anon, authenticated;
grant select, insert on public.nafes_attempt_activity to service_role;
