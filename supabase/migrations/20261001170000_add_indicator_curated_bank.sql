create table if not exists public.nafes_indicator_curated_bank (
  id uuid primary key default gen_random_uuid(),
  subject_key text not null,
  outcome_code text not null,
  indicator_index integer not null,
  indicator_key text not null,
  indicator_text text not null,
  model_no integer not null,
  question_no integer not null,
  source_type text not null,
  source_id text not null,
  context_text text,
  question_text text not null,
  options jsonb not null,
  correct_index integer not null,
  explanation text,
  difficulty text not null,
  cognitive_level text not null,
  quality_version text not null,
  image jsonb,
  created_at timestamptz not null default now(),
  unique(subject_key,outcome_code,indicator_index,model_no,question_no)
);

create index if not exists nafes_indicator_curated_bank_lookup_idx
  on public.nafes_indicator_curated_bank(subject_key,quality_version,indicator_key,model_no,question_no);
