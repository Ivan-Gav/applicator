-- Applicator: salary columns accept exactly what createApplicationSchema accepts
--
-- The range checks (min <= max) and the int4 bounds already match the schema.
-- These add the rest: no negative amount, and a currency that is three upper
-- case letters (the schema upper-cases what the user types).

alter table public.application
  add constraint salary_amounts_non_negative
    check (
          coalesce(salary_posted_min, 0) >= 0
      and coalesce(salary_posted_max, 0) >= 0
      and coalesce(salary_asked_min, 0) >= 0
      and coalesce(salary_asked_max, 0) >= 0
      and coalesce(salary_target_min, 0) >= 0
      and coalesce(salary_target_max, 0) >= 0
    ),
  add constraint salary_currency_code
    check (salary_currency ~ '^[A-Z]{3}$');
