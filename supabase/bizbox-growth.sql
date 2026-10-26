-- Additive release 2.4. All data and RPCs are broker/service_role only.
begin;
alter table public.bizbox_payment_requests add column if not exists funding_source text not null default 'kaspi'
  check (funding_source in ('kaspi', 'referral_balance'));

create table public.bizbox_referral_accounts (
  user_id bigint primary key check (user_id between 1 and 9007199254740991),
  code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
create table public.bizbox_referrals (
  invitee_id bigint primary key references public.bizbox_referral_accounts(user_id),
  referrer_id bigint not null references public.bizbox_referral_accounts(user_id),
  created_at timestamptz not null default now(),
  check (invitee_id <> referrer_id)
);
create index bizbox_referrals_referrer on public.bizbox_referrals(referrer_id, created_at desc);
create table public.bizbox_wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references public.bizbox_referral_accounts(user_id),
  amount integer not null check (amount <> 0),
  kind text not null check (kind in ('referral_bonus', 'subscription')),
  payment_id uuid not null unique references public.bizbox_payment_requests(id),
  invitee_id bigint unique references public.bizbox_referral_accounts(user_id),
  created_at timestamptz not null default now(),
  check ((kind = 'referral_bonus' and amount > 0 and invitee_id is not null)
    or (kind = 'subscription' and amount < 0 and invitee_id is null))
);
create index bizbox_wallet_user on public.bizbox_wallet_entries(user_id, created_at desc);
create table public.bizbox_ai_usage (
  user_id bigint not null,
  day date not null,
  requests integer not null default 0,
  last_request_at timestamptz,
  primary key(user_id, day)
);
alter table public.bizbox_referral_accounts enable row level security;
alter table public.bizbox_referrals enable row level security;
alter table public.bizbox_wallet_entries enable row level security;
alter table public.bizbox_ai_usage enable row level security;
revoke all on public.bizbox_referral_accounts, public.bizbox_referrals, public.bizbox_wallet_entries, public.bizbox_ai_usage from public, anon, authenticated;
grant select, insert, update on public.bizbox_referral_accounts, public.bizbox_referrals, public.bizbox_wallet_entries, public.bizbox_ai_usage to service_role;

-- Runs in the same transaction and under the same per-payer lock as approval.
create function public.bizbox_credit_referral() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_referrer bigint;
begin
  if new.status = 'approved' and old.status = 'pending' and new.funding_source = 'kaspi' then
    select referrer_id into v_referrer from public.bizbox_referrals where invitee_id = new.user_id;
    if v_referrer is not null and not exists (
      select 1 from public.bizbox_payment_requests where user_id = new.user_id and status = 'approved' and id <> new.id
    ) then
      insert into public.bizbox_wallet_entries(user_id, amount, kind, payment_id, invitee_id)
        values (v_referrer, new.amount / 10, 'referral_bonus', new.id, new.user_id)
        on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;
create trigger bizbox_referral_credit after update of status on public.bizbox_payment_requests
  for each row execute function public.bizbox_credit_referral();
revoke all on function public.bizbox_credit_referral() from public, anon, authenticated;

create function public.bizbox_growth_action(p_action text, p_args jsonb) returns jsonb
language plpgsql security invoker set search_path = '' set lock_timeout = '3s' set statement_timeout = '8s' as $$
declare
  v_user bigint; v_referrer bigint; v_code text; v_new boolean := false;
  v_balance bigint; v_amount integer; v_plan text; v_id uuid; v_existing public.bizbox_payment_requests%rowtype;
  v_sub public.bizbox_subscriptions%rowtype; v_expiry timestamptz; v_count integer;
  v_day date := (clock_timestamp() at time zone 'UTC')::date;
  v_now timestamptz := clock_timestamp(); v_usage public.bizbox_ai_usage%rowtype;
begin
  if p_args is null or jsonb_typeof(p_args) <> 'object' or octet_length(p_args::text) > 16384
    or coalesce(p_args->>'user_id','') !~ '^[1-9][0-9]{0,15}$' then
    raise exception using message = 'INVALID_ARGUMENT';
  end if;
  v_user := (p_args->>'user_id')::bigint;
  if v_user > 9007199254740991 then raise exception using message = 'INVALID_ARGUMENT'; end if;
  if p_action = 'assistant_reserve' then
    -- Cross-instance request limits, no private prompts stored in the database.
    perform pg_advisory_xact_lock(hashtextextended('bizbox-ai-budget', 0));
    select * into v_usage from public.bizbox_ai_usage where user_id = v_user and day = v_day;
    if coalesce(v_usage.requests,0) >= 30 or v_usage.last_request_at > v_now - interval '8 seconds' then
      raise exception using message = 'AI_RATE_LIMIT';
    end if;
    select coalesce(sum(requests),0) into v_count from public.bizbox_ai_usage where day = v_day;
    if v_count >= 500 then raise exception using message = 'AI_DAILY_LIMIT'; end if;
    insert into public.bizbox_ai_usage(user_id,day,requests,last_request_at) values(v_user,v_day,1,v_now)
      on conflict(user_id,day) do update set requests = public.bizbox_ai_usage.requests + 1, last_request_at = v_now;
    return jsonb_build_object('remaining',29-coalesce(v_usage.requests,0));
  end if;
  if p_action not in ('referral_register','referral_state','wallet_redeem') then
    raise exception using message = 'INVALID_ACTION';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bizbox-billing:' || v_user::text, 0));
  insert into public.bizbox_referral_accounts(user_id) values(v_user) on conflict do nothing;
  v_new := found;
  if p_action = 'referral_register' then
    v_code := p_args->>'code';
    if v_new and coalesce(v_code,'') ~ '^[a-f0-9]{32}$'
      and not exists(select 1 from public.bizbox_payment_requests where user_id=v_user) then
      select user_id into v_referrer from public.bizbox_referral_accounts where code=v_code;
      if v_referrer is not null and v_referrer <> v_user then
        insert into public.bizbox_referrals(invitee_id,referrer_id) values(v_user,v_referrer) on conflict do nothing;
      end if;
    end if;
    return jsonb_build_object('ok',true);
  end if;
  select coalesce(sum(amount),0) into v_balance from public.bizbox_wallet_entries where user_id=v_user;
  if p_action = 'wallet_redeem' then
    v_plan := p_args->>'plan';
    if coalesce(v_plan,'') not in ('business','pro') or coalesce(p_args->>'request_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then
      raise exception using message = 'INVALID_ARGUMENT';
    end if;
    v_id := (p_args->>'request_id')::uuid;
    select * into v_existing from public.bizbox_payment_requests where id=v_id;
    if found then
      if v_existing.user_id <> v_user or v_existing.funding_source <> 'referral_balance' or v_existing.plan <> v_plan then
        raise exception using message = 'INVALID_ARGUMENT';
      end if;
      return jsonb_build_object('ok',true,'alreadyApplied',true);
    end if;
    if exists(select 1 from public.bizbox_payment_requests where user_id=v_user and status='pending') then
      raise exception using message = 'PAYMENT_PENDING';
    end if;
    v_amount := case when v_plan='business' then 4990 else 14990 end;
    if v_balance < v_amount then raise exception using message = 'INSUFFICIENT_BALANCE'; end if;
    select * into v_sub from public.bizbox_subscriptions where user_id=v_user;
    if v_sub.plan = 'pro' and v_sub.expires_at > v_now and v_plan = 'business' then
      raise exception using message = 'ACTIVE_PRO';
    end if;
    v_expiry := (case when v_sub.plan=v_plan then greatest(v_now,v_sub.expires_at) else v_now end) + interval '30 days';
    insert into public.bizbox_payment_requests(id,user_id,name,plan,amount,days,status,decided_at,decided_by,funding_source)
      values(v_id,v_user,'Оплата бонусами',v_plan,v_amount,30,'approved',v_now,6575928505,'referral_balance');
    insert into public.bizbox_wallet_entries(user_id,amount,kind,payment_id) values(v_user,-v_amount,'subscription',v_id);
    insert into public.bizbox_subscriptions(user_id,plan,expires_at,updated_at,last_request_id) values(v_user,v_plan,v_expiry,v_now,v_id)
      on conflict(user_id) do update set plan=excluded.plan,expires_at=excluded.expires_at,updated_at=excluded.updated_at,last_request_id=excluded.last_request_id;
    return jsonb_build_object('ok',true,'alreadyApplied',false);
  end if;
  select code into v_code from public.bizbox_referral_accounts where user_id=v_user;
  return jsonb_build_object('code',v_code,'balance',v_balance,
    'earned', (select coalesce(sum(amount),0) from public.bizbox_wallet_entries where user_id=v_user and kind='referral_bonus'),
    'invited', (select count(*) from public.bizbox_referrals where referrer_id=v_user),
    'paid', (select count(*) from public.bizbox_wallet_entries where user_id=v_user and kind='referral_bonus'),
    'history', coalesce((select jsonb_agg(q) from (select id, amount, kind, created_at as date from public.bizbox_wallet_entries where user_id=v_user order by created_at desc,id desc limit 50) q),'[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(q) from (select r.created_at as date,case when w.id is null then 'registered' else 'rewarded' end as status,coalesce(w.amount,0) as bonus from public.bizbox_referrals r left join public.bizbox_wallet_entries w on w.invitee_id=r.invitee_id where r.referrer_id=v_user order by r.created_at desc limit 50) q),'[]'::jsonb));
end;
$$;
revoke all on function public.bizbox_growth_action(text,jsonb) from public, anon, authenticated;
grant execute on function public.bizbox_growth_action(text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
