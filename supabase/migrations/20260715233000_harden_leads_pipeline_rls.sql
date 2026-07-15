begin;

alter table public.leads_pipeline enable row level security;

do $$
declare policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'leads_pipeline'
  loop
    execute format('drop policy %I on public.leads_pipeline', policy_name);
  end loop;
end $$;

create policy leads_assigned_access
on public.leads_pipeline
for all
to authenticated
using (
  public.crm_is_admin()
  or assigned_user_id is null
  or assigned_user_id = auth.uid()
)
with check (
  public.crm_is_admin()
  or assigned_user_id is null
  or assigned_user_id = auth.uid()
);

revoke all on table public.leads_pipeline from anon;
grant select, insert, update, delete on table public.leads_pipeline to authenticated, service_role;

commit;
