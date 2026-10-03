-- Keep attempt storage aligned with the competition builder.
-- The builder supports up to 12 indicators:
-- 12 * 3 indicator questions + up to 3 boss questions = 39 questions.
-- current_position can become 40 after submitting question 39.

alter table public.lugati_competition_attempt_answers
  drop constraint if exists lugati_competition_attempt_answers_position_check;

alter table public.lugati_competition_attempt_answers
  add constraint lugati_competition_attempt_answers_position_check
  check ("position" >= 1 and "position" <= 39);

alter table public.lugati_competition_attempts
  drop constraint if exists lugati_competition_attempts_correct_questions_check;

alter table public.lugati_competition_attempts
  add constraint lugati_competition_attempts_correct_questions_check
  check (correct_questions >= 0 and correct_questions <= 39);

alter table public.lugati_competition_attempts
  drop constraint if exists lugati_competition_attempts_current_position_check;

alter table public.lugati_competition_attempts
  add constraint lugati_competition_attempts_current_position_check
  check (current_position >= 1 and current_position <= 40);
