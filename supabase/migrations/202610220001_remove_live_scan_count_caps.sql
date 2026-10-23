-- Remove daily and lifetime live-scan count caps while retaining the pause
-- switch, approved targets, account access, idempotency, and one active scan
-- per account. Existing cap columns remain for compatibility but are unused.
begin;

-- Leave the queue paused until exactly one worker is confirmed running.
update public.live_scan_limits set enabled = false where singleton = true;

create or replace function public.enqueue_live_scan(
  p_target_url text,
  p_task text,
  p_idempotency_key uuid
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_existing uuid;
  v_existing_source text;
  v_id uuid;
  v_enabled boolean;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_idempotency_key is null then raise exception 'Idempotency key required' using errcode = '22023'; end if;
  if p_target_url is null or p_target_url not in (
    'https://access-path-mu.vercel.app/demo-site',
    'https://github.com/Apoorvishere/AccessPath',
    'https://en.wikipedia.org/wiki/Web_accessibility'
  ) then
    raise exception 'Only approved public demo sites are supported' using errcode = '22023';
  end if;
  if p_task is null or length(btrim(p_task)) not between 12 and 180 or p_task ~ '[[:cntrl:]]' then
    raise exception 'Invalid visitor goal' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(20261018, 2);
  select id, source into v_existing, v_existing_source from public.scans
    where user_id = v_user and idempotency_key = p_idempotency_key;
  if v_existing is not null then
    if v_existing_source <> 'live' then raise exception 'Idempotency key belongs to another operation' using errcode = '22023'; end if;
    return v_existing;
  end if;

  select enabled into v_enabled from public.live_scan_limits where singleton = true;
  if not found or not v_enabled then
    raise exception 'Live scans are paused' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.live_scan_access where user_id = v_user) then
    raise exception 'Account is not invited to the live preview' using errcode = 'P0006';
  end if;
  if exists (select 1 from public.scans where user_id = v_user and status in ('queued', 'running')) then
    raise exception 'Account already has an active scan' using errcode = 'P0003';
  end if;

  insert into public.scans(user_id, source, target_url, task, status, idempotency_key)
    values (v_user, 'live', p_target_url, btrim(p_task), 'queued', p_idempotency_key)
    returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enqueue_live_scan(text,text,uuid) from public, anon;
grant execute on function public.enqueue_live_scan(text,text,uuid) to authenticated;

commit;

select enabled from public.live_scan_limits where singleton = true;
