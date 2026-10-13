-- The processing/search routes use the service-role client after verifying
-- the signed-in user's ownership. Client roles remain denied by RLS and
-- revoked table privileges.
grant select, insert, update, delete on table public.document_chunks to service_role;
