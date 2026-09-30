-- Applicator: salary amounts named as the domain names them
--
--   advertised  what the employer stated in the vacancy
--   estimated   an estimate for the role, from AI tools or experts
--   asked       what was stated in the application
--
-- Renaming keeps the data; constraints follow their columns and are renamed
-- to match.

alter table public.application rename column salary_posted_min to salary_advertised_min;
alter table public.application rename column salary_posted_max to salary_advertised_max;
alter table public.application rename column salary_target_min to salary_estimated_min;
alter table public.application rename column salary_target_max to salary_estimated_max;

alter table public.application
  rename constraint salary_posted_range_valid to salary_advertised_range_valid;
alter table public.application
  rename constraint salary_target_range_valid to salary_estimated_range_valid;
