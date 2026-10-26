-- Apply as a database administrator. This file only owns new bizbox_* objects.
-- The backend validates Telegram identity before calling this service-role API.
-- No browser role receives table or RPC access; no public RLS policies exist.
begin;

create table if not exists public.bizbox_payment_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id bigint not null check (user_id between 1 and 9007199254740991),
  name text not null check (pg_catalog.char_length(name) between 1 and 160),
  username text check (username is null or username ~ '^[A-Za-z0-9_]{1,64}$'),
  plan text not null check (plan in ('business', 'pro')),
  amount integer not null check ((plan = 'business' and amount = 4990) or (plan = 'pro' and amount = 14990)),
  days integer not null default 30 check (days = 30),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default pg_catalog.now(),
  decided_at timestamptz,
  decided_by bigint check (decided_by is null or decided_by = 6575928505),
  receipt_file_id text check (receipt_file_id is null or pg_catalog.char_length(receipt_file_id) between 1 and 2048),
  receipt_type text check (receipt_type is null or receipt_type in ('photo', 'document')),
  receipt_message_id bigint check (receipt_message_id is null or receipt_message_id between 1 and 2147483647),
  admin_message_id bigint check (admin_message_id is null or admin_message_id between 1 and 2147483647),
  notification_claimed_at timestamptz,
  customer_notified_at timestamptz,
  constraint bizbox_request_decision_consistent check (
    (status = 'pending' and decided_at is null and decided_by is null)
    or (status in ('approved', 'rejected') and decided_at is not null and decided_by is not null)
  ),
  constraint bizbox_request_receipt_consistent check (
    (receipt_file_id is null and receipt_type is null and receipt_message_id is null)
    or (receipt_file_id is not null and receipt_type is not null and receipt_message_id is not null)
  ),
  constraint bizbox_customer_notification_after_decision check (customer_notified_at is null or status in ('approved', 'rejected'))
);

create unique index if not exists bizbox_one_pending_per_user
  on public.bizbox_payment_requests (user_id) where status = 'pending';
create unique index if not exists bizbox_receipt_message_per_user
  on public.bizbox_payment_requests (user_id, receipt_message_id) where receipt_message_id is not null;
create index if not exists bizbox_requests_user_created
  on public.bizbox_payment_requests (user_id, created_at desc, id desc);
create index if not exists bizbox_requests_pending_created
  on public.bizbox_payment_requests (created_at, id) where status = 'pending';

create table if not exists public.bizbox_subscriptions (
  user_id bigint primary key check (user_id between 1 and 9007199254740991),
  plan text not null check (plan in ('business', 'pro')),
  expires_at timestamptz not null check (pg_catalog.isfinite(expires_at)),
  updated_at timestamptz not null default pg_catalog.now(),
  last_request_id uuid not null references public.bizbox_payment_requests (id)
);

alter table public.bizbox_payment_requests enable row level security;
alter table public.bizbox_subscriptions enable row level security;
revoke all on table public.bizbox_payment_requests, public.bizbox_subscriptions from public, anon, authenticated, service_role;
grant select, insert, update on table public.bizbox_payment_requests, public.bizbox_subscriptions to service_role;

create or replace function public.bizbox_billing_request_json(p_row public.bizbox_payment_requests)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select case when p_row.id is null then null::jsonb else pg_catalog.jsonb_build_object(
    'id', p_row.id, 'user_id', p_row.user_id::text, 'name', p_row.name,
    'username', p_row.username, 'plan', p_row.plan, 'amount', p_row.amount,
    'days', p_row.days, 'status', p_row.status, 'created_at', p_row.created_at,
    'decided_at', p_row.decided_at, 'decided_by', p_row.decided_by::text,
    'admin_message_id', p_row.admin_message_id,
    'notification_claimed_at', p_row.notification_claimed_at,
    'customer_notified_at', p_row.customer_notified_at,
    'receipt', case when p_row.receipt_file_id is null then null::jsonb else pg_catalog.jsonb_build_object(
      'file_id', p_row.receipt_file_id, 'type', p_row.receipt_type, 'message_id', p_row.receipt_message_id
    ) end
  ) end;
$$;

create or replace function public.bizbox_billing_subscription_json(p_row public.bizbox_subscriptions)
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select case when p_row.user_id is null then null::jsonb else pg_catalog.jsonb_build_object(
    'user_id', p_row.user_id::text, 'plan', p_row.plan, 'expires_at', p_row.expires_at,
    'updated_at', p_row.updated_at, 'last_request_id', p_row.last_request_id
  ) end;
$$;

create or replace function public.bizbox_billing_action(p_action text, p_args jsonb)
returns jsonb language plpgsql volatile security invoker
set search_path = '' set lock_timeout = '3s' set statement_timeout = '8s'
as $$
declare
  v_user_id bigint;
  v_admin_id constant bigint := 6575928505;
  v_request_id uuid;
  v_request public.bizbox_payment_requests%rowtype;
  v_subscription public.bizbox_subscriptions%rowtype;
  v_plan text;
  v_name text;
  v_username text;
  v_message_id bigint;
  v_message_date bigint;
  v_receipt jsonb;
  v_count integer;
  v_created boolean := false;
  v_changed boolean := false;
  v_claimed boolean := false;
  v_now timestamptz;
  v_expiry timestamptz;
begin
  if p_args is null or pg_catalog.jsonb_typeof(p_args) <> 'object'
    or pg_catalog.octet_length(p_args::text) > 16384 then
    raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
  end if;
  if p_action is null or p_action not in (
    'create_request', 'get_state', 'attach_receipt', 'list_pending', 'decide',
    'claim_notification', 'mark_notification', 'release_notification', 'get_request', 'mark_customer_notified'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_ACTION';
  end if;

  -- This is a second allowlist check after the Telegram broker's authentication.
  if p_action in ('decide', 'list_pending', 'mark_notification', 'get_request', 'mark_customer_notified')
    and (p_args ->> 'admin_id') is distinct from v_admin_id::text then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if p_action = 'list_pending' then
    return pg_catalog.jsonb_build_object('requests', coalesce((
      select pg_catalog.jsonb_agg(public.bizbox_billing_request_json(q.request_row) order by q.created_at, q.id)
      from (select r as request_row, r.created_at, r.id from public.bizbox_payment_requests as r
            where r.status = 'pending' order by r.created_at, r.id limit 20) as q
    ), '[]'::jsonb));
  end if;

  if p_action in ('create_request', 'get_state', 'attach_receipt') then
    if coalesce(p_args ->> 'user_id', '') !~ '^[1-9][0-9]{0,15}$' then
      raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
    end if;
    v_user_id := (p_args ->> 'user_id')::bigint;
    if v_user_id > 9007199254740991 then
      raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
    end if;
  else
    if coalesce(p_args ->> 'request_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
    end if;
    v_request_id := (p_args ->> 'request_id')::uuid;
    select r.user_id into v_user_id from public.bizbox_payment_requests as r where r.id = v_request_id;
    if not found then
      if p_action = 'get_request' then return pg_catalog.jsonb_build_object('request', null); end if;
      raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND';
    end if;
  end if;

  -- The same transaction-scoped lock serializes ALL mutations for one user,
  -- including decisions on different requests. Always take it before row locks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bizbox-billing:' || v_user_id::text, 0));
  v_now := pg_catalog.clock_timestamp();

  if p_action = 'get_state' then
    select s.* into v_subscription from public.bizbox_subscriptions as s where s.user_id = v_user_id;
    select r.* into v_request from public.bizbox_payment_requests as r
      where r.user_id = v_user_id order by r.created_at desc, r.id desc limit 1;
    return pg_catalog.jsonb_build_object(
      'subscription', public.bizbox_billing_subscription_json(v_subscription),
      'request', public.bizbox_billing_request_json(v_request)
    );
  end if;

  if p_action = 'create_request' then
    if pg_catalog.jsonb_typeof(p_args -> 'name') is distinct from 'string'
      or pg_catalog.jsonb_typeof(p_args -> 'plan') is distinct from 'string' then
      raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
    end if;
    v_name := pg_catalog.btrim(p_args ->> 'name');
    v_plan := p_args ->> 'plan';
    v_username := nullif(p_args ->> 'username', '');
    if pg_catalog.char_length(v_name) not between 1 and 160 or v_plan not in ('business', 'pro')
      or (v_username is not null and (pg_catalog.jsonb_typeof(p_args -> 'username') <> 'string'
        or v_username !~ '^[A-Za-z0-9_]{1,64}$')) then
      raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
    end if;
    select r.* into v_request from public.bizbox_payment_requests as r
      where r.user_id = v_user_id and r.status = 'pending' for update;
    if not found then
      -- Rolling 24-hour cap. Repeated calls returning an existing request are free.
      select pg_catalog.count(*) into v_count from public.bizbox_payment_requests as r
        where r.user_id = v_user_id and r.created_at >= v_now - interval '24 hours';
      if v_count >= 5 then raise exception using errcode = 'P0001', message = 'RATE_LIMIT'; end if;
      insert into public.bizbox_payment_requests (user_id, name, username, plan, amount, days, created_at)
        values (v_user_id, v_name, v_username, v_plan, case when v_plan = 'business' then 4990 else 14990 end, 30, v_now)
        returning * into v_request;
      v_created := true;
    end if;
    -- One pending request per user: returning another selected plan is intentional.
    -- The UI must display this returned request's actual plan and amount.
    return pg_catalog.jsonb_build_object('request', public.bizbox_billing_request_json(v_request), 'created', v_created);
  end if;

  if p_action = 'attach_receipt' then
    v_receipt := p_args -> 'receipt';
    if coalesce(p_args ->> 'request_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or coalesce(p_args ->> 'message_date', '') !~ '^[1-9][0-9]{0,15}$'
      or pg_catalog.jsonb_typeof(v_receipt) is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_receipt -> 'file_id') is distinct from 'string'
      or pg_catalog.char_length(coalesce(v_receipt ->> 'file_id', '')) not between 1 and 2048
      or coalesce(v_receipt ->> 'type', '') not in ('photo', 'document')
      or coalesce(v_receipt ->> 'message_id', '') !~ '^[1-9][0-9]{0,9}$' then
      raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
    end if;
    v_request_id := (p_args ->> 'request_id')::uuid;
    v_message_date := (p_args ->> 'message_date')::bigint;
    v_message_id := (v_receipt ->> 'message_id')::bigint;
    if v_message_id > 2147483647 or v_message_date > 9007199254740991
      or v_message_date > pg_catalog.floor(extract(epoch from v_now)) + 60 then
      raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
    end if;
    select r.* into v_request from public.bizbox_payment_requests as r
      where r.id = v_request_id and r.user_id = v_user_id and r.status = 'pending' for update;
    if not found then raise exception using errcode = 'P0002', message = 'NO_PENDING_REQUEST'; end if;
    -- The broker binds the receipt to the request it read. A delayed webhook may
    -- never attach an earlier request's Telegram message to a new payment.
    if v_message_date < pg_catalog.floor(extract(epoch from v_request.created_at))
      or exists (select 1 from public.bizbox_payment_requests as r
        where r.user_id = v_user_id and r.receipt_message_id = v_message_id and r.id <> v_request_id) then
      raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
    end if;
    -- Duplicate or out-of-order webhook deliveries cannot replace a newer receipt.
    if v_request.receipt_message_id is null or v_message_id > v_request.receipt_message_id then
      update public.bizbox_payment_requests as r set
        receipt_file_id = v_receipt ->> 'file_id', receipt_type = v_receipt ->> 'type', receipt_message_id = v_message_id
        where r.id = v_request.id returning * into v_request;
    end if;
    return pg_catalog.jsonb_build_object('request', public.bizbox_billing_request_json(v_request));
  end if;

  select r.* into v_request from public.bizbox_payment_requests as r where r.id = v_request_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND'; end if;

  if p_action = 'get_request' then
    return pg_catalog.jsonb_build_object('request', public.bizbox_billing_request_json(v_request));
  end if;

  if p_action = 'mark_customer_notified' then
    if v_request.status = 'pending' then raise exception using errcode = '22023', message = 'INVALID_STATE'; end if;
    update public.bizbox_payment_requests as r set customer_notified_at = coalesce(r.customer_notified_at, v_now)
      where r.id = v_request_id returning * into v_request;
    return pg_catalog.jsonb_build_object('request', public.bizbox_billing_request_json(v_request));
  end if;

  if p_action = 'claim_notification' then
    if v_request.status = 'pending' and v_request.admin_message_id is null
      and (v_request.notification_claimed_at is null or v_request.notification_claimed_at <= v_now - interval '60 seconds') then
      update public.bizbox_payment_requests as r set notification_claimed_at = v_now
        where r.id = v_request_id returning * into v_request;
      v_claimed := true;
    end if;
    return pg_catalog.jsonb_build_object('request', public.bizbox_billing_request_json(v_request), 'claimed', v_claimed);
  end if;

  if p_action = 'release_notification' then
    update public.bizbox_payment_requests as r set notification_claimed_at = null
      where r.id = v_request_id and r.admin_message_id is null returning * into v_request;
    if not found then select r.* into v_request from public.bizbox_payment_requests as r where r.id = v_request_id; end if;
    return pg_catalog.jsonb_build_object('request', public.bizbox_billing_request_json(v_request));
  end if;

  if p_action = 'mark_notification' then
    if coalesce(p_args ->> 'message_id', '') !~ '^[1-9][0-9]{0,9}$' then
      raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
    end if;
    v_message_id := (p_args ->> 'message_id')::bigint;
    if v_message_id > 2147483647 then raise exception using errcode = '22023', message = 'INVALID_ARGUMENT'; end if;
    update public.bizbox_payment_requests as r set
      admin_message_id = coalesce(r.admin_message_id, v_message_id), notification_claimed_at = null
      where r.id = v_request_id returning * into v_request;
    return pg_catalog.jsonb_build_object('request', public.bizbox_billing_request_json(v_request));
  end if;

  if p_action = 'decide' then
    if coalesce(p_args ->> 'decision', '') not in ('approve', 'reject') then
      raise exception using errcode = '22023', message = 'INVALID_ARGUMENT';
    end if;
    select s.* into v_subscription from public.bizbox_subscriptions as s where s.user_id = v_user_id for update;
    if v_request.status = 'pending' then
      if p_args ->> 'decision' = 'approve' then
        v_expiry := (case when v_subscription.plan = v_request.plan
          then greatest(v_now, v_subscription.expires_at) else v_now end) + interval '30 days';
        insert into public.bizbox_subscriptions (user_id, plan, expires_at, updated_at, last_request_id)
          values (v_user_id, v_request.plan, v_expiry, v_now, v_request.id)
          on conflict (user_id) do update set plan = excluded.plan, expires_at = excluded.expires_at,
            updated_at = excluded.updated_at, last_request_id = excluded.last_request_id
          returning * into v_subscription;
      end if;
      update public.bizbox_payment_requests as r set
        status = case when p_args ->> 'decision' = 'approve' then 'approved' else 'rejected' end,
        decided_at = v_now, decided_by = v_admin_id, notification_claimed_at = null
        where r.id = v_request_id returning * into v_request;
      v_changed := true;
    end if;
    return pg_catalog.jsonb_build_object('request', public.bizbox_billing_request_json(v_request),
      'subscription', public.bizbox_billing_subscription_json(v_subscription), 'changed', v_changed);
  end if;

  raise exception using errcode = '22023', message = 'INVALID_ACTION';
end;
$$;

revoke all on function public.bizbox_billing_request_json(public.bizbox_payment_requests) from public, anon, authenticated;
revoke all on function public.bizbox_billing_subscription_json(public.bizbox_subscriptions) from public, anon, authenticated;
revoke all on function public.bizbox_billing_action(text, jsonb) from public, anon, authenticated;
grant execute on function public.bizbox_billing_request_json(public.bizbox_payment_requests) to service_role;
grant execute on function public.bizbox_billing_subscription_json(public.bizbox_subscriptions) to service_role;
grant execute on function public.bizbox_billing_action(text, jsonb) to service_role;

comment on function public.bizbox_billing_action(text, jsonb) is
  'BizBox internal billing API. service_role only; broker must authenticate Telegram. Admin ID is checked again for decisions/listing.';

notify pgrst, 'reload schema';
commit;
