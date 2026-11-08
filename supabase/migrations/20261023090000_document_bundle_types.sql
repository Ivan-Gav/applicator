-- Applicator: two document types for merged files
--
--   attachment_set    supporting documents merged into one file (degree,
--                     recognition, certificates): the Anlagen; reusable
--   application_pack  everything for one application in one file, cover
--                     letter included; specific to that application
--
-- The CHECK lists the values only; their order lives in the domain.

alter table public.document drop constraint document_type_check;
alter table public.document add constraint document_type_check
  check (type in ('cv', 'cover_letter', 'certificate', 'diploma', 'reference',
                  'portfolio', 'attachment_set', 'application_pack', 'other'));
