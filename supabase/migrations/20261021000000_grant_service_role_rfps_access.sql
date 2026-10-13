-- Grant service role full access to rfps and profiles tables
-- so that match_document_chunks (security invoker) and pipeline operations succeed without permission errors.

grant select, insert, update, delete on table public.rfps to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
