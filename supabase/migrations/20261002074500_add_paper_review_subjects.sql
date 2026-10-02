alter table public.nafes_paper_reviews
  add column if not exists subjects text[] not null default '{}'::text[];

update public.nafes_paper_reviews
set subjects=array[subject]::text[]
where coalesce(cardinality(subjects),0)=0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.nafes_paper_reviews'::regclass
      and conname='nafes_paper_reviews_subjects_check'
  ) then
    alter table public.nafes_paper_reviews
      add constraint nafes_paper_reviews_subjects_check
      check (
        cardinality(subjects) between 1 and 3
        and subjects <@ array['reading','math','science']::text[]
      );
  end if;
end $$;
