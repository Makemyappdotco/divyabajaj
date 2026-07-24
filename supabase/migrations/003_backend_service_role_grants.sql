-- Explicit backend access while automatic table exposure remains disabled.
-- Browser roles keep no direct CRUD permissions. The Vercel backend uses service_role.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

alter default privileges for role postgres in schema public
grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema public
grant usage, select, update on sequences to service_role;

revoke select, insert, update, delete on all tables in schema public from anon, authenticated;
revoke usage, select, update on all sequences in schema public from anon, authenticated;
