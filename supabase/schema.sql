-- Ember & Eve: shared catalogue, orders, customers and admin access.
-- Run this whole file in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It is safe to re-run after every update.

-- ================================================================== admins
create table if not exists admins (email text primary key);
-- owner: everything. staff: can pack and dispatch orders but never sees prices, payments or customers' contact history.
alter table admins add column if not exists role text not null default 'owner';
alter table admins drop constraint if exists admins_role_check;
alter table admins add constraint admins_role_check check (role in ('owner', 'staff'));
alter table admins enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
$$;
create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role(), '') = 'owner';
$$;
grant execute on function is_admin() to anon, authenticated;
grant execute on function my_role() to anon, authenticated;
grant execute on function is_owner() to anon, authenticated;

drop policy if exists "admins manage admins" on admins;
create policy "admins manage admins" on admins for all using (is_owner()) with check (is_owner());

create or replace function admins_keep_one() returns trigger language plpgsql as $$
begin
  if old.role = 'owner' and (select count(*) from admins where role = 'owner') <= 1 and (tg_op = 'DELETE' or new.role <> 'owner') then
    raise exception 'cannot remove the last owner';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists admins_keep_one on admins;
create trigger admins_keep_one before delete or update of role on admins for each row execute function admins_keep_one();

-- ================================================================== helpers
create or replace function ee_ip() returns text language sql stable as $$
  select split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
$$;

-- ================================================================== catalogue
create table if not exists catalog_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table catalog_kv enable row level security;
drop policy if exists "catalog readable by everyone" on catalog_kv;
drop policy if exists "catalog writable by admin" on catalog_kv;
-- Discount codes are not public.
create policy "catalog readable by everyone" on catalog_kv for select using (key <> 'discounts' or is_owner());
create policy "catalog writable by admin" on catalog_kv for all using (is_owner()) with check (is_owner());

-- ================================================================== customers
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text,
  address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table profiles add column if not exists addresses jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists credit numeric not null default 0;
alter table profiles drop constraint if exists profiles_credit_check;
alter table profiles add constraint profiles_credit_check check (credit >= 0);
alter table profiles add column if not exists ref_code text;
create unique index if not exists profiles_ref_code_key on profiles (ref_code);
update profiles set ref_code = upper(substr(md5(id::text || random()::text), 1, 6)) where ref_code is null;
-- customers may edit their own details, but never their credit or referral code
revoke update on profiles from anon, authenticated;
grant update (name, phone, address, addresses) on profiles to authenticated;
alter table profiles enable row level security;
drop policy if exists "own profile read" on profiles;
drop policy if exists "own profile update" on profiles;
drop policy if exists "admin reads profiles" on profiles;
create policy "own profile read" on profiles for select using (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin reads profiles" on profiles for select using (is_owner());

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name, ref_code)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)), upper(substr(md5(new.id::text || clock_timestamp()::text), 1, 6)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
insert into profiles (id, email, name, ref_code) select id, email, split_part(email, '@', 1), upper(substr(md5(id::text || random()::text), 1, 6)) from auth.users on conflict (id) do nothing;

-- ================================================================== costs, gift cards, store credit, activity
-- Cost prices are private: they live here, never in the public catalogue.
create table if not exists product_costs (pid bigint primary key, cost numeric not null check (cost >= 0));
alter table product_costs enable row level security;
drop policy if exists "costs owner" on product_costs;
create policy "costs owner" on product_costs for all using (is_owner()) with check (is_owner());

create table if not exists gift_cards (
  code text primary key,
  amount numeric not null check (amount > 0),
  balance numeric not null check (balance >= 0),
  status text not null default 'active' check (status in ('active', 'disabled')),
  recipient text, from_name text, message text, order_id text, note text,
  created_at timestamptz not null default now()
);
alter table gift_cards enable row level security;
drop policy if exists "gift cards owner" on gift_cards;
create policy "gift cards owner" on gift_cards for all using (is_owner()) with check (is_owner());

create table if not exists credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  delta numeric not null, reason text, order_id text,
  at timestamptz not null default now()
);
alter table credit_ledger enable row level security;
drop policy if exists "own ledger" on credit_ledger;
drop policy if exists "ledger owner" on credit_ledger;
create policy "own ledger" on credit_ledger for select using (user_id = auth.uid());
create policy "ledger owner" on credit_ledger for select using (is_owner());

create or replace function ee_credit_add(uid uuid, delta numeric, reason text, order_id text default null, clamp boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set credit = case when clamp then greatest(0, credit + delta) else credit + delta end where id = uid;
  if not found then return; end if;
  insert into credit_ledger (user_id, delta, reason, order_id) values (uid, delta, reason, order_id);
end $$;

create or replace function ee_gc_code() returns text language sql volatile as $$
  select 'EVE-' || upper(substr(h, 1, 4)) || '-' || upper(substr(h, 5, 4)) || '-' || upper(substr(h, 9, 4)) from (select replace(gen_random_uuid()::text, '-', '') as h) x;
$$;

create table if not exists activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text, action text not null, target text, detail jsonb not null default '{}'::jsonb
);
alter table activity_log enable row level security;
drop policy if exists "activity owner read" on activity_log;
create policy "activity owner read" on activity_log for select using (is_owner());
create index if not exists activity_log_at on activity_log (at desc);

create or replace function ee_log(action text, target text, detail jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into activity_log (actor, action, target, detail) values (coalesce(auth.jwt() ->> 'email', 'customer'), action, target, coalesce(detail, '{}'::jsonb));
$$;

-- What changed between two versions of a catalogue list (by id or code) or settings object.
create or replace function ee_diff(o jsonb, n jsonb) returns jsonb
language plpgsql immutable as $$
declare res jsonb; oo jsonb := coalesce(o, case when jsonb_typeof(n) = 'array' then '[]'::jsonb else '{}'::jsonb end);
begin
  if jsonb_typeof(n) = 'array' and jsonb_typeof(oo) = 'array' then
    return jsonb_build_object(
      'added', coalesce((select jsonb_agg(coalesce(x ->> 'id', x ->> 'code')) from jsonb_array_elements(n) x where not exists (select 1 from jsonb_array_elements(oo) y where coalesce(y ->> 'id', y ->> 'code') = coalesce(x ->> 'id', x ->> 'code'))), '[]'::jsonb),
      'removed', coalesce((select jsonb_agg(coalesce(y ->> 'id', y ->> 'code')) from jsonb_array_elements(oo) y where not exists (select 1 from jsonb_array_elements(n) x where coalesce(x ->> 'id', x ->> 'code') = coalesce(y ->> 'id', y ->> 'code'))), '[]'::jsonb),
      'changed', coalesce((select jsonb_agg(coalesce(x ->> 'id', x ->> 'code')) from jsonb_array_elements(n) x join jsonb_array_elements(oo) y on coalesce(y ->> 'id', y ->> 'code') = coalesce(x ->> 'id', x ->> 'code') where x is distinct from y), '[]'::jsonb));
  end if;
  if jsonb_typeof(n) = 'object' and jsonb_typeof(oo) = 'object' then
    return jsonb_build_object('keys', coalesce((select jsonb_agg(k) from jsonb_object_keys(n) k where oo -> k is distinct from n -> k), '[]'::jsonb));
  end if;
  return '{}'::jsonb;
end $$;

-- The version of an order a customer may see: no cost prices, no private notes, no referral links.
create or replace function ee_public_order(d jsonb) returns jsonb language sql immutable as $$
  select (d - 'adminNote' - 'refBy') || jsonb_build_object('items', coalesce((select jsonb_agg(i - 'cost') from jsonb_array_elements(coalesce(d -> 'items', '[]'::jsonb)) i), '[]'::jsonb));
$$;

-- ================================================================== orders
create table if not exists orders (
  id text primary key,
  data jsonb not null,
  email text not null,
  status text not null default 'Processing',
  created_at timestamptz not null default now()
);
alter table orders add column if not exists user_id uuid;
alter table orders add column if not exists ip text;
alter table orders enable row level security;
drop policy if exists "orders admin only" on orders;
create policy "orders admin only" on orders for all using (is_owner()) with check (is_owner());

-- Keep only the fields of a selection that matter (used to rebuild an item for "Buy again").
create or replace function ee_clean_sel(s jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('opts', coalesce(s -> 'opts', '{}'::jsonb), 'color', coalesce(s ->> 'color', ''),
                            'blend', coalesce(s -> 'blend', '[]'::jsonb), 'sticker', nullif(left(btrim(coalesce(s ->> 'sticker', '')), 60), ''));
$$;

-- Price one candle from the live catalogue. Raises on any invalid option or colour.
create or replace function ee_price(p jsonb, sel jsonb, st jsonb, pal jsonb) returns jsonb
language plpgsql stable as $$
declare
  g jsonb; o jsonb; want text; adds numeric := 0; parts text[] := '{}';
  allowed text[] := null; palids text[]; col text; blend text[]; fee numeric := 0;
  hex text := '#EADFD3'; names text[]; list numeric; unit numeric; stick text;
begin
  select coalesce(array_agg(c ->> 'id'), '{}') into palids from jsonb_array_elements(pal) c;
  for g in select * from jsonb_array_elements(coalesce(p -> 'groups', '[]'::jsonb)) loop
    want := sel -> 'opts' ->> (g ->> 'id');
    o := null;
    if want is not null then
      select x into o from jsonb_array_elements(g -> 'options') x where x ->> 'id' = want limit 1;
      if o is null then raise exception 'bad_option:%', p ->> 'name'; end if;
    else
      o := g -> 'options' -> 0;
    end if;
    if o is null then raise exception 'bad_option:%', p ->> 'name'; end if;
    adds := adds + coalesce((o ->> 'add')::numeric, 0);
    parts := parts || ((g ->> 'label') || ': ' || (o ->> 'label'));
    if jsonb_typeof(o -> 'colors') = 'array' and jsonb_array_length(o -> 'colors') > 0 then
      if allowed is null then
        allowed := array(select jsonb_array_elements_text(o -> 'colors'));
      else
        allowed := array(select a from unnest(allowed) a where a in (select jsonb_array_elements_text(o -> 'colors')));
      end if;
    end if;
  end loop;

  if coalesce((p ->> 'colors')::boolean, false) then
    allowed := array(select a from unnest(coalesce(allowed, palids)) a where a = any(palids));
    if cardinality(allowed) = 0 then allowed := palids; end if;
    col := coalesce(sel ->> 'color', '');
    if col = '' then col := allowed[1]; end if;
    if col = 'custom' then
      if not coalesce((p ->> 'custom')::boolean, false) or cardinality(allowed) < 2 then
        raise exception 'bad_color:%', p ->> 'name';
      end if;
      select array_agg(x order by ord) into blend from (
        select distinct on (x) x, ord from jsonb_array_elements_text(coalesce(sel -> 'blend', '[]'::jsonb)) with ordinality t(x, ord) order by x, ord
      ) s;
      blend := coalesce(blend, '{}');
      if cardinality(blend) < 2 or exists (select 1 from unnest(blend) b where b <> all(allowed)) then
        raise exception 'bad_blend:%', p ->> 'name';
      end if;
      fee := greatest(0, cardinality(blend) - (st ->> 'freeColors')::int) * (st ->> 'extraColorFee')::numeric;
      select array_agg(pc ->> 'name' order by array_position(blend, pc ->> 'id')) into names
        from jsonb_array_elements(pal) pc where pc ->> 'id' = any(blend);
      parts := parts || ('Colour: Custom blend (' || array_to_string(names, ' + ') || ')');
      select pc ->> 'hex' into hex from jsonb_array_elements(pal) pc where pc ->> 'id' = blend[1];
    else
      if col <> all(allowed) then raise exception 'bad_color:%', p ->> 'name'; end if;
      select pc ->> 'hex', pc ->> 'name' into hex, stick from jsonb_array_elements(pal) pc where pc ->> 'id' = col;
      parts := parts || ('Colour: ' || stick);
    end if;
  end if;

  stick := left(btrim(coalesce(sel ->> 'sticker', '')), 60);
  if coalesce((p ->> 'sticker')::boolean, false) and stick <> '' then
    parts := parts || ('Sticker: "' || replace(stick, '"', '''') || '"');
  end if;

  list := (p ->> 'base')::numeric + adds;
  unit := round(list * (1 - coalesce((p ->> 'salePct')::numeric, 0) / 100.0)) + fee;
  if unit < 0 then raise exception 'bad_price:%', p ->> 'name'; end if;
  return jsonb_build_object('unit', unit, 'desc', array_to_string(parts, ' · '), 'hex', hex);
end $$;

-- Rebuild a whole order from the live catalogue: prices, stock check, discount, delivery and totals.
-- Nothing the browser says about money is trusted; only choices (product, options, colours).
create or replace function ee_build_order(o jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  defaults jsonb := '{"standard":450,"express":900,"freeOver":8000,"giftWrap":300,"freeColors":3,"extraColorFee":100,"giftBoxFee":1000,"giftBoxes":[],"districts":[],"pay":{"card":false,"bank":true,"whatsapp":false,"store":false},"giftCardsOn":false,"giftCardMin":500,"giftCardMax":50000,"referralFriend":0}';
  st jsonb; prods jsonb; pal jsonb; discs jsonb;
  it jsonb; c jsonb; p jsonb; r jsonb; cfg jsonb;
  items jsonb := '[]'; need jsonb := '{}'; box jsonb;
  qty int; unit numeric; fee numeric; sub numeric := 0; parts text[]; slots int; n int;
  goods numeric := 0; gcs numeric := 0; is_gc boolean; has_goods boolean := false; ccost numeric;
  code text; dsc jsonb; disc numeric := 0; free_ship boolean := false;
  ship_m text; ship numeric; wrap numeric := 0; net numeric; district text; rate numeric; total numeric;
  pay_m text; pay_label text; pay_bank text; nm text; ph text; em text; a1 text; city text; payset jsonb;
  pid_txt text; stock_txt text; first_hex text; now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  uid uuid := auth.uid(); refcode text; ref_by uuid; ref_disc numeric := 0;
  gcode text; gcrow gift_cards%rowtype; gc_applied numeric := 0; cred_applied numeric := 0; credit_bal numeric; remaining numeric; due numeric;
begin
  st := defaults || coalesce((select value from catalog_kv where key = 'settings'), '{}'::jsonb);
  prods := coalesce((select value from catalog_kv where key = 'products'), '[]'::jsonb);
  pal := coalesce((select value from catalog_kv where key = 'colors'), '[]'::jsonb);
  discs := coalesce((select value from catalog_kv where key = 'discounts'), '[]'::jsonb);
  payset := coalesce(st -> 'pay', defaults -> 'pay');

  em := lower(btrim(coalesce(o ->> 'email', '')));
  nm := btrim(coalesce(o ->> 'name', ''));
  ph := btrim(coalesce(o ->> 'phone', ''));
  a1 := btrim(coalesce(o #>> '{address,a1}', ''));
  city := btrim(coalesce(o #>> '{address,city}', ''));
  district := btrim(coalesce(o #>> '{address,district}', ''));
  ship_m := coalesce(o ->> 'shipM', 'standard');
  if ship_m not in ('standard', 'express', 'pickup', 'digital') then ship_m := 'standard'; end if;
  if em !~ '^\S+@\S+\.\S+$' then raise exception 'invalid:email'; end if;
  if nm = '' or ph = '' then raise exception 'invalid:contact'; end if;
  if jsonb_typeof(o -> 'items') <> 'array' or jsonb_array_length(o -> 'items') = 0 or jsonb_array_length(o -> 'items') > 30 then
    raise exception 'invalid:items';
  end if;

  for it in select * from jsonb_array_elements(o -> 'items') loop
    qty := least(10, greatest(1, coalesce((it ->> 'qty')::int, 1)));
    is_gc := false;
    if it ->> 'kind' = 'giftcard' then
      -- a gift card: a value the recipient spends later; no stock, no delivery
      if not coalesce((st ->> 'giftCardsOn')::boolean, false) then raise exception 'invalid:giftcard'; end if;
      unit := round((it ->> 'amount')::numeric);
      if unit < (st ->> 'giftCardMin')::numeric or unit > (st ->> 'giftCardMax')::numeric then raise exception 'invalid:giftcard'; end if;
      qty := 1; is_gc := true;
      items := items || jsonb_build_object('pid', 0, 'kind', 'giftcard', 'name', 'Gift card', 'sub', 'For ' || left(coalesce(nullif(btrim(it ->> 'to'), ''), 'a friend'), 60),
        'qty', 1, 'unit', unit, 'tint', '#E9D5B5', 'cost', 0,
        'gc', jsonb_build_object('to', left(btrim(coalesce(it ->> 'to', '')), 60), 'from', left(btrim(coalesce(it ->> 'from', '')), 60), 'msg', left(btrim(coalesce(it ->> 'msg', '')), 300)));
    elsif jsonb_typeof(it -> 'box') = 'array' then
      -- gift box: a set of candles plus the box fee
      slots := jsonb_array_length(it -> 'box');
      cfg := null;
      if it ->> 'boxId' is not null then
        select x into cfg from jsonb_array_elements(st -> 'giftBoxes') x where x ->> 'id' = it ->> 'boxId' limit 1;
      end if;
      if cfg is not null then
        if slots <> (cfg ->> 'slots')::int then raise exception 'invalid:box'; end if;
        fee := (cfg ->> 'fee')::numeric;
      else
        if slots < 2 or slots > 8 then raise exception 'invalid:box'; end if;
        fee := (st ->> 'giftBoxFee')::numeric;
      end if;
      unit := fee; parts := '{}'; box := '[]'; first_hex := null; ccost := 0;
      for c in select * from jsonb_array_elements(it -> 'box') loop
        select x into p from jsonb_array_elements(prods) x where (x ->> 'id') = (c ->> 'pid') limit 1;
        if p is null or not coalesce((p ->> 'active')::boolean, false) then raise exception 'unavailable:%', coalesce(c ->> 'pid', '?'); end if;
        r := ee_price(p, c -> 'sel', st, pal);
        unit := unit + (r ->> 'unit')::numeric;
        ccost := ccost + coalesce((select pc.cost from product_costs pc where pc.pid = (p ->> 'id')::bigint), 0);
        parts := parts || ((p ->> 'name') || ' [' || (r ->> 'desc') || ']');
        box := box || jsonb_build_object('pid', (p ->> 'id')::bigint, 'name', p ->> 'name', 'sel', ee_clean_sel(c -> 'sel'));
        first_hex := coalesce(first_hex, r ->> 'hex');
        need := jsonb_set(need, array[p ->> 'id'], to_jsonb(coalesce((need ->> (p ->> 'id'))::int, 0) + qty));
      end loop;
      items := items || jsonb_build_object('pid', 0, 'name', 'Gift Box (' || slots || ' candles)', 'sub', array_to_string(parts, '; '),
        'qty', qty, 'unit', unit, 'tint', coalesce(first_hex, '#EADFD3'), 'box', box, 'boxId', it ->> 'boxId', 'cost', ccost,
        'note', left(btrim(coalesce(it ->> 'note', '')), 250));
    else
      select x into p from jsonb_array_elements(prods) x where (x ->> 'id') = (it ->> 'pid') limit 1;
      if p is null or not coalesce((p ->> 'active')::boolean, false) then raise exception 'unavailable:%', coalesce(it ->> 'pid', '?'); end if;
      r := ee_price(p, it -> 'sel', st, pal);
      unit := (r ->> 'unit')::numeric;
      need := jsonb_set(need, array[p ->> 'id'], to_jsonb(coalesce((need ->> (p ->> 'id'))::int, 0) + qty));
      items := items || jsonb_build_object('pid', (p ->> 'id')::bigint, 'name', p ->> 'name', 'sub', r ->> 'desc',
        'qty', qty, 'unit', unit, 'tint', r ->> 'hex', 'sel', ee_clean_sel(it -> 'sel'),
        'cost', coalesce((select pc.cost from product_costs pc where pc.pid = (p ->> 'id')::bigint), 0));
    end if;
    if is_gc then gcs := gcs + unit * qty; else goods := goods + unit * qty; has_goods := true; end if;
  end loop;
  sub := goods + gcs;

  if not has_goods then ship_m := 'digital'; elsif ship_m = 'digital' then ship_m := 'standard'; end if;
  if ship_m not in ('pickup', 'digital') and (a1 = '' or city = '') then raise exception 'invalid:address'; end if;

  -- stock: every candle (including those inside gift boxes) must be available
  for pid_txt in select k from jsonb_object_keys(need) k loop
    select x into p from jsonb_array_elements(prods) x where (x ->> 'id') = pid_txt limit 1;
    stock_txt := p ->> 'stock';
    if stock_txt is not null and stock_txt::int < (need ->> pid_txt)::int then
      raise exception 'out_of_stock:%', p ->> 'name';
    end if;
  end loop;

  -- discount code (applies to candles, not gift cards)
  code := upper(btrim(coalesce(o ->> 'code', '')));
  if code <> '' then
    select d into dsc from jsonb_array_elements(discs) d
      where coalesce((d ->> 'active')::boolean, false) and upper(d ->> 'code') = code limit 1;
    if dsc is not null and goods > 0 and goods >= coalesce((dsc ->> 'min')::numeric, 0) then
      if dsc ->> 'type' = 'pct' then disc := round(goods * (dsc ->> 'value')::numeric / 100);
      elsif dsc ->> 'type' = 'fixed' then disc := least((dsc ->> 'value')::numeric, goods);
      else free_ship := true; end if;
    else
      code := '';
    end if;
  end if;

  -- referral: a friend's first order gets a discount; the referrer is rewarded once it is paid
  refcode := upper(btrim(coalesce(o ->> 'refCode', '')));
  if refcode <> '' and has_goods and coalesce((st ->> 'referralFriend')::numeric, 0) > 0 then
    select pr.id into ref_by from profiles pr where pr.ref_code = refcode;
    if ref_by is not null and ref_by is distinct from uid
       and not exists (select 1 from orders x where x.email = em and x.status <> 'Cancelled')
       and not exists (select 1 from profiles pr where pr.id = ref_by and lower(pr.email) = em) then
      ref_disc := least((st ->> 'referralFriend')::numeric, greatest(0, goods - disc));
    else
      ref_by := null;
    end if;
  end if;

  -- delivery
  if ship_m in ('pickup', 'digital') then ship := 0;
  elsif ship_m = 'express' then ship := (st ->> 'express')::numeric;
  elsif goods - disc >= (st ->> 'freeOver')::numeric or free_ship then ship := 0;
  else
    select (x ->> 'rate')::numeric into rate from jsonb_array_elements(st -> 'districts') x where lower(x ->> 'name') = lower(district) limit 1;
    ship := coalesce(rate, (st ->> 'standard')::numeric);
  end if;
  if has_goods and coalesce((o ->> 'wrap')::boolean, false) then wrap := (st ->> 'giftWrap')::numeric; end if;
  total := sub - disc - ref_disc + ship + wrap;

  -- gift card and store credit (never used to buy a gift card)
  remaining := total;
  gcode := upper(btrim(coalesce(o ->> 'giftCode', '')));
  if gcode <> '' then
    if gcs > 0 then raise exception 'invalid:giftcard_use'; end if;
    select * into gcrow from gift_cards g where g.code = gcode and g.status = 'active' and g.balance > 0;
    if not found then raise exception 'invalid:giftcode'; end if;
    gc_applied := least(gcrow.balance, remaining);
    remaining := remaining - gc_applied;
  end if;
  if coalesce((o ->> 'useCredit')::boolean, false) and uid is not null and gcs = 0 then
    select pr.credit into credit_bal from profiles pr where pr.id = uid;
    cred_applied := least(coalesce(credit_bal, 0), remaining);
    remaining := remaining - cred_applied;
  end if;
  due := remaining;

  -- payment method
  pay_m := coalesce(o ->> 'payMethod', 'bank');
  if due = 0 then pay_m := 'credit'; pay_label := 'Gift card / store credit';
  elsif pay_m = 'card' and coalesce((payset ->> 'card')::boolean, false) then pay_label := 'Card (PayHere)';
  elsif pay_m = 'bank' and coalesce((payset ->> 'bank')::boolean, false) then pay_label := 'Bank transfer';
  elsif pay_m = 'whatsapp' and coalesce((payset ->> 'whatsapp')::boolean, false) then pay_label := 'WhatsApp order';
  elsif pay_m = 'store' and coalesce((payset ->> 'store')::boolean, false) and ship_m = 'pickup' then pay_label := 'Pay at store pickup';
  else raise exception 'invalid:payment';
  end if;
  if pay_m = 'bank' and btrim(coalesce(o ->> 'payBank', '')) <> '' then
    select b ->> 'bank' into pay_bank from jsonb_array_elements(coalesce(st -> 'banks', '[]'::jsonb)) b
      where lower(b ->> 'bank') = lower(btrim(o ->> 'payBank')) limit 1;
  end if;

  return jsonb_build_object(
    'date', now_iso, 'email', em, 'name', nm, 'first', left(btrim(coalesce(o ->> 'first', '')), 80), 'phone', ph,
    'address', jsonb_build_object('a1', a1, 'a2', btrim(coalesce(o #>> '{address,a2}', '')), 'city', city, 'district', district, 'post', btrim(coalesce(o #>> '{address,post}', ''))),
    'items', items, 'sub', sub, 'disc', disc, 'code', code, 'ship', ship, 'shipM', ship_m, 'wrap', wrap, 'total', total,
    'refDisc', ref_disc, 'refBy', ref_by, 'gcCode', case when gc_applied > 0 then gcode end, 'gcApplied', gc_applied, 'creditApplied', cred_applied, 'due', due,
    'status', 'Processing', 'pay', pay_label, 'payMethod', pay_m, 'payBank', pay_bank, 'payStatus', case when due = 0 then 'Paid' else 'Pending' end,
    'note', left(btrim(coalesce(o ->> 'note', '')), 500), 'sellerNote', left(btrim(coalesce(o ->> 'sellerNote', '')), 1000),
    'userId', auth.uid()::text, 'log', jsonb_build_array(jsonb_build_object('s', 'Placed', 'd', now_iso)),
    '_need', need);
end $$;

-- Preview the authoritative totals before the customer pays. Writes nothing.
create or replace function quote_order(o jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select ee_public_order(ee_build_order(o) - '_need');
$$;

-- place_order used to return text; Postgres cannot change a return type in place.
drop function if exists place_order(jsonb);
create or replace function place_order(o jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b jsonb; need jsonb; new_id text; n int; v_ip text := ee_ip();
begin
  if v_ip <> '' and (select count(*) from orders where orders.ip = v_ip and created_at > now() - interval '1 hour') >= 15 then
    raise exception 'rate_limited';
  end if;
  perform 1 from catalog_kv where key = 'products' for update;  -- serialise stock changes
  b := ee_build_order(o);
  need := b -> '_need';
  select coalesce(max((regexp_replace(id, '\D', '', 'g'))::int), 1000) + 1 into n from orders;
  new_id := 'EE-' || n;
  update catalog_kv set updated_at = now(), value = (
    select coalesce(jsonb_agg(
      case when e ? 'stock' and jsonb_typeof(e -> 'stock') = 'number' and need ? (e ->> 'id')
        then jsonb_set(e, '{stock}', to_jsonb(greatest(0, (e ->> 'stock')::int - (need ->> (e ->> 'id'))::int)))
        else e end order by ord), '[]'::jsonb)
    from jsonb_array_elements(value) with ordinality t(e, ord))
  where key = 'products';
  b := (b - '_need') || jsonb_build_object('id', new_id);
  insert into orders (id, data, email, status, user_id, ip) values (new_id, b, b ->> 'email', 'Processing', auth.uid(), nullif(v_ip, ''));
  -- spend the gift card and store credit (serialised with everything else by the lock above)
  if coalesce((b ->> 'gcApplied')::numeric, 0) > 0 then
    update gift_cards set balance = balance - (b ->> 'gcApplied')::numeric where code = b ->> 'gcCode' and balance >= (b ->> 'gcApplied')::numeric;
    if not found then raise exception 'giftcard_changed'; end if;
  end if;
  if coalesce((b ->> 'creditApplied')::numeric, 0) > 0 then
    perform ee_credit_add(auth.uid(), -(b ->> 'creditApplied')::numeric, 'Used on order ' || new_id, new_id);
  end if;
  return ee_public_order(b);
end $$;

create or replace function get_order(oid text, mail text) returns jsonb
language sql stable security definer set search_path = public as $$
  select ee_public_order(data) || jsonb_build_object('status', status, 'id', id) from orders where id = oid and email = lower(btrim(mail));
$$;

-- Orders belonging to the signed-in customer.
create or replace function my_orders() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(ee_public_order(o.data) || jsonb_build_object('status', o.status, 'id', o.id) order by o.created_at desc), '[]'::jsonb)
  from orders o
  where auth.uid() is not null and (
    o.user_id = auth.uid()
    or (o.email = (select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null)));
$$;

-- Public tracking: a mobile number plus an order number or courier tracking number.
-- Returns only status information (no email, street address or prices) and limits guessing.
create table if not exists track_attempts (ip text not null, at timestamptz not null default now());
alter table track_attempts enable row level security;   -- no policies on purpose

create or replace function track_order(q text, phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ip text := ee_ip(); key text := btrim(coalesce(q, '')); digits text := right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9);
  o orders%rowtype; d jsonb;
begin
  if v_ip <> '' then
    delete from track_attempts where at < now() - interval '1 day';
    if (select count(*) from track_attempts where ip = v_ip and at > now() - interval '10 minutes') >= 20 then raise exception 'rate_limited'; end if;
    insert into track_attempts (ip) values (v_ip);
  end if;
  if length(digits) < 9 or key = '' then return null; end if;
  select * into o from orders
   where right(regexp_replace(coalesce(data ->> 'phone', ''), '\D', '', 'g'), 9) = digits
     and (upper(id) = upper(key) or id = 'EE-' || regexp_replace(key, '\D', '', 'g') and key ~ '^\d+$'
          or lower(coalesce(data -> 'tracking' ->> 'number', '')) = lower(key))
   order by created_at desc limit 1;
  if not found then return null; end if;
  d := o.data;
  return jsonb_build_object('id', o.id, 'date', d ->> 'date', 'status', o.status, 'payStatus', coalesce(d ->> 'payStatus', 'Paid'),
    'payMethod', d ->> 'payMethod', 'shipM', d ->> 'shipM', 'tracking', d -> 'tracking', 'log', coalesce(d -> 'log', '[]'::jsonb),
    'city', d #>> '{address,city}', 'district', d #>> '{address,district}',
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i ->> 'name', 'qty', (i ->> 'qty')::int, 'tint', i ->> 'tint')), '[]'::jsonb) from jsonb_array_elements(coalesce(d -> 'items', '[]'::jsonb)) i),
    'first', d ->> 'first');
end $$;
grant execute on function track_order(text, text) to anon, authenticated;

-- Units sold per product (including candles inside gift boxes) for Best Selling / Trending. No customer data.
create or replace function sales_summary() returns table (pid int, qty int, last_30 int)
language sql stable security definer set search_path = public as $$
  select s.pid, sum(s.qty)::int, sum(s.recent)::int from (
    select (i ->> 'pid')::int as pid, (i ->> 'qty')::int as qty,
           case when o.created_at > now() - interval '30 days' then (i ->> 'qty')::int else 0 end as recent
    from orders o, jsonb_array_elements(o.data -> 'items') i
    where o.status <> 'Cancelled' and (i ->> 'pid')::int > 0
    union all
    select (c ->> 'pid')::int, (i ->> 'qty')::int,
           case when o.created_at > now() - interval '30 days' then (i ->> 'qty')::int else 0 end
    from orders o, jsonb_array_elements(o.data -> 'items') i, jsonb_array_elements(i -> 'box') c
    where o.status <> 'Cancelled' and jsonb_typeof(i -> 'box') = 'array'
  ) s group by s.pid;
$$;

create or replace function check_discount(c text) returns jsonb
language sql stable security definer set search_path = public as $$
  select d from catalog_kv k, jsonb_array_elements(k.value) d
  where k.key = 'discounts' and (d ->> 'active')::boolean and upper(d ->> 'code') = upper(btrim(c))
  limit 1;
$$;

grant execute on function quote_order(jsonb) to anon, authenticated;
grant execute on function place_order(jsonb) to anon, authenticated;
grant execute on function get_order(text, text) to anon, authenticated;
grant execute on function my_orders() to authenticated;
grant execute on function sales_summary() to anon, authenticated;
grant execute on function check_discount(text) to anon, authenticated;

-- ================================================================== bank transfer receipts
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

-- A receipt can be uploaded only for a recent bank-transfer order that has fewer than 3 receipts.
create or replace function ee_order_open(oid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders
    where id = oid and created_at > now() - interval '3 days'
      and coalesce(data ->> 'payMethod', '') = 'bank'
      and coalesce(data ->> 'payStatus', 'Pending') <> 'Paid'
      and jsonb_array_length(coalesce(data -> 'receipts', '[]'::jsonb)) < 3);
$$;
grant execute on function ee_order_open(text) to anon, authenticated;

drop policy if exists "receipt upload" on storage.objects;
drop policy if exists "receipt admin read" on storage.objects;
drop policy if exists "receipt admin delete" on storage.objects;
create policy "receipt upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'receipts' and ee_order_open((storage.foldername(name))[1]));
create policy "receipt admin read" on storage.objects for select using (bucket_id = 'receipts' and is_owner());
create policy "receipt admin delete" on storage.objects for delete using (bucket_id = 'receipts' and is_owner());

-- After uploading, the customer records the file against their order (order id + email must match).
create or replace function attach_receipt(oid text, mail text, path text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update orders set data = jsonb_set(jsonb_set(data, '{receipts}', coalesce(data -> 'receipts', '[]'::jsonb) || to_jsonb(path)), '{payStatus}', '"Receipt sent"')
  where id = oid and email = lower(btrim(mail)) and path like oid || '/%'
    and coalesce(data ->> 'payStatus', 'Pending') <> 'Paid'
    and jsonb_array_length(coalesce(data -> 'receipts', '[]'::jsonb)) < 3;
  return found;
end $$;
grant execute on function attach_receipt(text, text, text) to anon, authenticated;

-- Admin changes only the fields they touched, so a receipt uploaded at the same moment is never overwritten.
create or replace function admin_patch_order(oid text, patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'not allowed'; end if;
  update orders set data = data || patch, status = coalesce(patch ->> 'status', status) where id = oid;
end $$;
grant execute on function admin_patch_order(text, jsonb) to authenticated;

-- ================================================================== newsletter
create table if not exists subscribers (
  email text primary key,
  ip text,
  created_at timestamptz not null default now()
);
alter table subscribers enable row level security;
drop policy if exists "anyone can subscribe" on subscribers;
drop policy if exists "subscribers admin" on subscribers;
create policy "anyone can subscribe" on subscribers for insert with check (email ~ '^\S+@\S+\.\S+$' and length(email) < 200);
create policy "subscribers admin" on subscribers for all using (is_owner()) with check (is_owner());

create or replace function ee_limit_subscribers() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then return new; end if;
  new.email := lower(btrim(new.email));
  new.ip := nullif(ee_ip(), '');
  if new.ip is not null and (select count(*) from subscribers where ip = new.ip and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;
  return new;
end $$;
drop trigger if exists subscribers_limit on subscribers;
create trigger subscribers_limit before insert on subscribers for each row execute function ee_limit_subscribers();

-- ================================================================== shop images (LankaQR codes)
-- Public so customers can see the QR; only admins can add or change files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-assets', 'shop-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = true;
drop policy if exists "shop assets admin write" on storage.objects;
drop policy if exists "shop assets admin update" on storage.objects;
drop policy if exists "shop assets admin delete" on storage.objects;
create policy "shop assets admin write" on storage.objects for insert with check (bucket_id = 'shop-assets' and is_owner());
create policy "shop assets admin update" on storage.objects for update using (bucket_id = 'shop-assets' and is_owner());
create policy "shop assets admin delete" on storage.objects for delete using (bucket_id = 'shop-assets' and is_owner());

-- ================================================================== phone alerts (ntfy.sh)
-- The admin picks a private topic name; every new order and uploaded receipt is pushed to it.
-- The topic is kept in a table nobody can read directly (it works like a password).
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net is not available; phone alerts are disabled';
end $$;

create table if not exists notify_config (key text primary key, value text not null);
alter table notify_config enable row level security;   -- no policies on purpose

create or replace function ee_notify(title text, message text, click text, prio int) returns void
language plpgsql security definer set search_path = public as $$
declare topic text; site text;
begin
  select value into topic from notify_config where key = 'topic';
  if topic is null or topic = '' then return; end if;
  select value into site from notify_config where key = 'site';
  begin
    perform net.http_post(
      url := 'https://ntfy.sh/',
      body := jsonb_strip_nulls(jsonb_build_object('topic', topic, 'title', title, 'message', message, 'priority', prio,
        'tags', jsonb_build_array('candle'), 'click', case when coalesce(site, '') <> '' then site || click end)),
      headers := jsonb_build_object('Content-Type', 'application/json'));
  exception when others then
    null;   -- an alert problem must never block an order
  end;
end $$;

create or replace function ee_order_alert() returns trigger language plpgsql security definer set search_path = public as $$
declare before_n int; after_n int; d jsonb := new.data;
begin
  if tg_op = 'INSERT' then
    perform ee_notify('New order ' || new.id,
      'Rs ' || to_char(coalesce((d ->> 'due')::numeric, (d ->> 'total')::numeric, 0), 'FM999,999,990') || ' · ' || coalesce(d ->> 'name', '') || ' · ' || coalesce(d ->> 'pay', '')
        || ' · ' || jsonb_array_length(coalesce(d -> 'items', '[]'::jsonb)) || ' item(s)',
      '/admin/orders?sel=' || new.id, 4);
  else
    before_n := jsonb_array_length(coalesce(old.data -> 'receipts', '[]'::jsonb));
    after_n := jsonb_array_length(coalesce(new.data -> 'receipts', '[]'::jsonb));
    if after_n > before_n then
      perform ee_notify('Receipt uploaded for ' || new.id,
        coalesce(d ->> 'name', '') || ' · Rs ' || to_char(coalesce((d ->> 'due')::numeric, (d ->> 'total')::numeric, 0), 'FM999,999,990') || ' · tap to check and approve',
        '/admin/orders?sel=' || new.id, 4);
    end if;
    if coalesce(new.data #>> '{cancelRequest,state}', '') = 'pending' and coalesce(old.data #>> '{cancelRequest,state}', '') <> 'pending' then
      perform ee_notify('Cancellation requested for ' || new.id, coalesce(d ->> 'name', '') || ' · ' || coalesce(d #>> '{cancelRequest,reason}', 'no reason given'), '/admin/orders?sel=' || new.id, 4);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists orders_alert_insert on orders;
create trigger orders_alert_insert after insert on orders for each row execute function ee_order_alert();
drop trigger if exists orders_alert_update on orders;
create trigger orders_alert_update after update of data on orders for each row execute function ee_order_alert();

create or replace function admin_get_notify() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'not allowed'; end if;
  return (select jsonb_build_object('topic', coalesce((select value from notify_config where key = 'topic'), ''),
                                    'site', coalesce((select value from notify_config where key = 'site'), '')));
end $$;

create or replace function admin_set_notify(topic text, site text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'not allowed'; end if;
  if topic = '' then
    delete from notify_config where key in ('topic', 'site');
    return;
  end if;
  if topic !~ '^[A-Za-z0-9_-]{12,64}$' then raise exception 'invalid topic'; end if;
  insert into notify_config (key, value) values ('topic', topic) on conflict (key) do update set value = excluded.value;
  insert into notify_config (key, value) values ('site', regexp_replace(coalesce(site, ''), '/+$', ''))
    on conflict (key) do update set value = excluded.value;
end $$;

create or replace function admin_send_test() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'not allowed'; end if;
  perform ee_notify('Test alert', 'Phone alerts are working. You will get one for every new order and receipt.', '/admin/orders', 3);
end $$;
grant execute on function admin_get_notify() to authenticated;
grant execute on function admin_set_notify(text, text) to authenticated;
grant execute on function admin_send_test() to authenticated;

-- ================================================================== reviews and messages
create table if not exists reviews (
  id bigint generated always as identity primary key,
  data jsonb not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table reviews add column if not exists ip text;
alter table reviews enable row level security;
drop policy if exists "approved reviews public" on reviews;
drop policy if exists "anyone can submit a review" on reviews;
drop policy if exists "reviews admin" on reviews;
create policy "approved reviews public" on reviews for select using (approved or is_owner());
create policy "reviews admin" on reviews for all using (is_owner()) with check (is_owner());

create table if not exists messages (
  id bigint generated always as identity primary key,
  data jsonb not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table messages add column if not exists ip text;
alter table messages enable row level security;
drop policy if exists "anyone can send a message" on messages;
drop policy if exists "messages admin" on messages;
create policy "anyone can send a message" on messages for insert with check (is_read = false);
create policy "messages admin" on messages for all using (is_owner()) with check (is_owner());

-- Spam protection: at most 5 reviews and 5 messages per visitor per hour, and small payloads only.
create or replace function ee_limit_inserts() returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  if is_admin() then return new; end if;
  if length(new.data::text) > 3000 then raise exception 'too_large'; end if;
  new.ip := nullif(ee_ip(), '');
  if new.ip is not null then
    execute format('select count(*) from %I where ip = $1 and created_at > now() - interval ''1 hour''', tg_table_name) into cnt using new.ip;
    if cnt >= 5 then raise exception 'rate_limited'; end if;
  end if;
  return new;
end $$;
drop trigger if exists reviews_limit on reviews;
create trigger reviews_limit before insert on reviews for each row execute function ee_limit_inserts();
drop trigger if exists messages_limit on messages;
create trigger messages_limit before insert on messages for each row execute function ee_limit_inserts();

-- ================================================================== staff: pack and dispatch without seeing money
create or replace function ee_staff_view(o orders) returns jsonb language sql stable as $$
  select jsonb_build_object('id', o.id, 'date', o.data ->> 'date', 'status', o.status, 'name', o.data ->> 'name', 'first', o.data ->> 'first',
    'phone', o.data ->> 'phone', 'address', o.data -> 'address', 'shipM', o.data ->> 'shipM',
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i ->> 'name', 'sub', i ->> 'sub', 'qty', (i ->> 'qty')::int, 'tint', i ->> 'tint', 'pid', i -> 'pid', 'note', i ->> 'note', 'box', i -> 'box'))
                       from jsonb_array_elements(coalesce(o.data -> 'items', '[]'::jsonb)) i where coalesce(i ->> 'kind', '') <> 'giftcard'), '[]'::jsonb),
    'note', o.data ->> 'note', 'sellerNote', o.data ->> 'sellerNote', 'tracking', o.data -> 'tracking',
    'packed', coalesce((o.data ->> 'packed')::boolean, false), 'paid', coalesce(o.data ->> 'payStatus', 'Paid') = 'Paid',
    'cancelRequested', coalesce(o.data #>> '{cancelRequest,state}', '') = 'pending');
$$;

create or replace function staff_orders() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(ee_staff_view(o) order by o.created_at desc) from orders o
    where coalesce(o.data ->> 'shipM', '') <> 'digital' and (o.status <> 'Cancelled' or o.created_at > now() - interval '14 days')), '[]'::jsonb);
end $$;
grant execute on function staff_orders() to authenticated;

create or replace function staff_update_order(oid text, patch jsonb) returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; k text; st text; ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  select * into o from orders where id = oid for update;
  if not found then raise exception 'not found'; end if;
  if o.status = 'Cancelled' then raise exception 'cancelled'; end if;
  for k in select jsonb_object_keys(patch) loop
    if k not in ('status', 'tracking', 'packed') then raise exception 'not allowed:%', k; end if;
  end loop;
  if patch ? 'status' then
    st := patch ->> 'status';
    if st not in ('Dispatched', 'Delivered') or o.status = 'Delivered' then raise exception 'not allowed:status'; end if;
    if st = 'Dispatched' and coalesce(o.data ->> 'payStatus', 'Paid') <> 'Paid' then raise exception 'not_paid'; end if;
    update orders set status = st, data = data || jsonb_build_object('log', coalesce(data -> 'log', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('s', st, 'd', ts))) where id = oid;
  end if;
  if patch ? 'tracking' then
    update orders set data = jsonb_set(data, '{tracking}', jsonb_build_object('courier', left(coalesce(patch #>> '{tracking,courier}', ''), 60), 'number', left(coalesce(patch #>> '{tracking,number}', ''), 60), 'url', left(coalesce(patch #>> '{tracking,url}', ''), 300))) where id = oid;
  end if;
  if patch ? 'packed' then
    update orders set data = jsonb_set(data, '{packed}', to_jsonb(coalesce((patch ->> 'packed')::boolean, false))) where id = oid;
  end if;
end $$;
grant execute on function staff_update_order(text, jsonb) to authenticated;

-- ================================================================== activity log triggers
create or replace function ee_log_catalog() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return coalesce(new, old); end if;   -- customer orders adjust stock; that is not a shop edit
  perform ee_log('catalog.' || coalesce(new.key, old.key), coalesce(new.key, old.key), case when tg_op = 'DELETE' then '{}'::jsonb else ee_diff(case when tg_op = 'INSERT' then null else old.value end, new.value) end);
  return coalesce(new, old);
end $$;
drop trigger if exists catalog_log on catalog_kv;
create trigger catalog_log after insert or update or delete on catalog_kv for each row execute function ee_log_catalog();

create or replace function ee_log_order() returns trigger language plpgsql security definer set search_path = public as $$
declare od jsonb; nd jsonb;
begin
  if tg_op = 'INSERT' then
    perform ee_log('order.placed', new.id, jsonb_build_object('pay', new.data ->> 'payMethod'));
    return new;
  end if;
  od := old.data; nd := new.data;
  if new.status is distinct from old.status then perform ee_log('order.status', new.id, jsonb_build_object('from', old.status, 'to', new.status)); end if;
  if nd ->> 'payStatus' is distinct from od ->> 'payStatus' then perform ee_log('order.payment', new.id, jsonb_build_object('from', od ->> 'payStatus', 'to', nd ->> 'payStatus')); end if;
  if nd -> 'tracking' is distinct from od -> 'tracking' then perform ee_log('order.tracking', new.id, jsonb_build_object('courier', nd #>> '{tracking,courier}')); end if;
  if nd -> 'cancelRequest' is distinct from od -> 'cancelRequest' then perform ee_log('order.cancel', new.id, jsonb_build_object('state', nd #>> '{cancelRequest,state}')); end if;
  if nd ->> 'adminNote' is distinct from od ->> 'adminNote' then perform ee_log('order.note', new.id, '{}'::jsonb); end if;
  if nd ->> 'packed' is distinct from od ->> 'packed' then perform ee_log('order.packed', new.id, jsonb_build_object('packed', nd ->> 'packed')); end if;
  return new;
end $$;
drop trigger if exists orders_log_insert on orders;
create trigger orders_log_insert after insert on orders for each row execute function ee_log_order();
drop trigger if exists orders_log_update on orders;
create trigger orders_log_update after update on orders for each row execute function ee_log_order();

create or replace function ee_log_team() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform ee_log(case tg_op when 'INSERT' then 'team.add' when 'DELETE' then 'team.remove' else 'team.role' end, coalesce(new.email, old.email), jsonb_build_object('role', coalesce(new.role, old.role)));
  return coalesce(new, old);
end $$;
drop trigger if exists admins_log on admins;
create trigger admins_log after insert or update or delete on admins for each row execute function ee_log_team();

create or replace function ee_log_review() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then perform ee_log('review.delete', old.id::text, '{}'::jsonb);
  elsif new.approved is distinct from old.approved then perform ee_log(case when new.approved then 'review.approve' else 'review.unpublish' end, new.id::text, '{}'::jsonb); end if;
  return coalesce(new, old);
end $$;
drop trigger if exists reviews_log on reviews;
create trigger reviews_log after update or delete on reviews for each row execute function ee_log_review();

create or replace function ee_log_cost() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform ee_log('costs.update', coalesce(new.pid, old.pid)::text, '{}'::jsonb);
  return coalesce(new, old);
end $$;
drop trigger if exists costs_log on product_costs;
create trigger costs_log after insert or update or delete on product_costs for each row execute function ee_log_cost();

-- ================================================================== gift cards, credit and referral rewards
-- When an order is paid: issue any gift cards bought, pay cashback and the referral reward. When it is cancelled: undo them.
create or replace function ee_order_perks() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := new.data; st jsonb; it jsonb; gcc text; codes jsonb := '[]'::jsonb; gc_total numeric := 0; cashbase numeric; cb numeric; pct numeric; reward numeric; i int;
begin
  st := coalesce((select value from catalog_kv where key = 'settings'), '{}'::jsonb);
  if coalesce(d ->> 'payStatus', '') = 'Paid' and (tg_op = 'INSERT' or coalesce(old.data ->> 'payStatus', '') <> 'Paid') and not coalesce((d ->> 'perks')::boolean, false) then
    for it in select * from jsonb_array_elements(coalesce(d -> 'items', '[]'::jsonb)) loop
      if it ->> 'kind' = 'giftcard' then
        for i in 1..greatest(1, coalesce((it ->> 'qty')::int, 1)) loop
          gcc := ee_gc_code();
          insert into gift_cards (code, amount, balance, recipient, from_name, message, order_id)
            values (gcc, (it ->> 'unit')::numeric, (it ->> 'unit')::numeric, it #>> '{gc,to}', it #>> '{gc,from}', it #>> '{gc,msg}', new.id);
          codes := codes || jsonb_build_object('code', gcc, 'amount', (it ->> 'unit')::numeric, 'to', it #>> '{gc,to}');
          gc_total := gc_total + (it ->> 'unit')::numeric;
        end loop;
      end if;
    end loop;
    pct := coalesce((st ->> 'loyaltyPct')::numeric, 0);
    cashbase := greatest(0, coalesce((d ->> 'due')::numeric, (d ->> 'total')::numeric, 0) - gc_total);
    if pct > 0 and nullif(d ->> 'userId', '') is not null and cashbase > 0 then
      cb := floor(cashbase * pct / 100);
      if cb > 0 then
        perform ee_credit_add((d ->> 'userId')::uuid, cb, 'Cashback on order ' || new.id, new.id);
        d := d || jsonb_build_object('cashback', cb);
      end if;
    end if;
    reward := coalesce((st ->> 'referralReward')::numeric, 0);
    if reward > 0 and nullif(d ->> 'refBy', '') is not null and not coalesce((d ->> 'refRewarded')::boolean, false) then
      perform ee_credit_add((d ->> 'refBy')::uuid, reward, 'A friend ordered (' || new.id || ')', new.id);
      d := d || jsonb_build_object('refRewarded', true);
    end if;
    d := d || jsonb_build_object('perks', true);
    if jsonb_array_length(codes) > 0 then d := d || jsonb_build_object('giftCards', codes); end if;
  end if;
  if new.status = 'Cancelled' and (tg_op = 'INSERT' or old.status <> 'Cancelled') and not coalesce((d ->> 'restored')::boolean, false) then
    if coalesce((d ->> 'gcApplied')::numeric, 0) > 0 and d ->> 'gcCode' is not null then
      update gift_cards set balance = least(amount, balance + (d ->> 'gcApplied')::numeric) where code = d ->> 'gcCode';
    end if;
    if nullif(d ->> 'userId', '') is not null then
      if coalesce((d ->> 'creditApplied')::numeric, 0) > 0 then perform ee_credit_add((d ->> 'userId')::uuid, (d ->> 'creditApplied')::numeric, 'Refund: order ' || new.id || ' cancelled', new.id); end if;
      if coalesce((d ->> 'cashback')::numeric, 0) > 0 then perform ee_credit_add((d ->> 'userId')::uuid, -(d ->> 'cashback')::numeric, 'Cashback removed: order ' || new.id || ' cancelled', new.id, true); end if;
    end if;
    update gift_cards set status = 'disabled' where order_id = new.id;
    d := d || jsonb_build_object('restored', true);
  end if;
  new.data := d;
  return new;
end $$;
drop trigger if exists orders_perks on orders;
create trigger orders_perks before insert or update of data, status on orders for each row execute function ee_order_perks();

-- Is this gift card code valid, and what is left on it? Guessing is rate limited.
create or replace function check_gift_card(c text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ip text := ee_ip(); g gift_cards%rowtype;
begin
  if v_ip <> '' then
    delete from track_attempts where at < now() - interval '1 day';
    if (select count(*) from track_attempts where ip = v_ip and at > now() - interval '10 minutes') >= 20 then raise exception 'rate_limited'; end if;
    insert into track_attempts (ip) values (v_ip);
  end if;
  select * into g from gift_cards where code = upper(btrim(c)) and status = 'active' and balance > 0;
  if not found then return null; end if;
  return jsonb_build_object('balance', g.balance);
end $$;
grant execute on function check_gift_card(text) to anon, authenticated;

create or replace function admin_create_gift_card(amount_in numeric, recipient_in text default null, note_in text default null) returns text
language plpgsql security definer set search_path = public as $$
declare code text := ee_gc_code();
begin
  if not is_owner() then raise exception 'not allowed'; end if;
  if amount_in is null or amount_in <= 0 or amount_in > 1000000 then raise exception 'invalid amount'; end if;
  insert into gift_cards (code, amount, balance, recipient, note) values (code, round(amount_in), round(amount_in), left(recipient_in, 60), left(note_in, 200));
  perform ee_log('giftcard.create', code, jsonb_build_object('amount', round(amount_in)));
  return code;
end $$;
grant execute on function admin_create_gift_card(numeric, text, text) to authenticated;

create or replace function admin_adjust_credit(uid uuid, delta numeric, reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'not allowed'; end if;
  perform ee_credit_add(uid, delta, coalesce(nullif(btrim(reason), ''), 'Adjustment by the shop'), null, true);
  perform ee_log('credit.adjust', uid::text, jsonb_build_object('delta', delta));
end $$;
grant execute on function admin_adjust_credit(uuid, numeric, text) to authenticated;

-- ================================================================== cancellation requests
create or replace function request_cancel(oid text, mail text, reason text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update orders set data = jsonb_set(data, '{cancelRequest}', jsonb_build_object('state', 'pending', 'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'reason', left(btrim(coalesce(reason, '')), 300)))
   where id = oid and (email = lower(btrim(mail)) or (auth.uid() is not null and user_id = auth.uid()))
     and status = 'Processing' and coalesce(data #>> '{cancelRequest,state}', '') <> 'pending';
  return found;
end $$;
grant execute on function request_cancel(text, text, text) to anon, authenticated;

-- ================================================================== verified-buyer reviews with photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = true;

-- Photos can be uploaded into the folder of a delivered order, a dozen at most.
create or replace function ee_review_folder_ok(oid text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from orders where id = oid and status = 'Delivered' and created_at > now() - interval '120 days')
     and (select count(*) from storage.objects where bucket_id = 'review-photos' and name like oid || '/%') < 12;
$$;
grant execute on function ee_review_folder_ok(text) to anon, authenticated;
drop policy if exists "review photo upload" on storage.objects;
drop policy if exists "review photo owner delete" on storage.objects;
create policy "review photo upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'review-photos' and ee_review_folder_ok((storage.foldername(name))[1]));
create policy "review photo owner delete" on storage.objects for delete using (bucket_id = 'review-photos' and is_owner());

create or replace function submit_review(oid text, mail text, pid_in bigint, stars int, q text, photos jsonb default '[]'::jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; d jsonb; hit boolean; ph jsonb := '[]'::jsonb; u text; who text;
begin
  select * into o from orders where id = oid and email = lower(btrim(mail)) and status = 'Delivered';
  if not found then raise exception 'not_eligible'; end if;
  d := o.data;
  select exists (select 1 from jsonb_array_elements(coalesce(d -> 'items', '[]'::jsonb)) i
    where (i ->> 'pid')::bigint = pid_in or exists (select 1 from jsonb_array_elements(coalesce(i -> 'box', '[]'::jsonb)) c where (c ->> 'pid')::bigint = pid_in)) into hit;
  if not hit then raise exception 'not_eligible'; end if;
  if stars is null or stars < 1 or stars > 5 or length(btrim(coalesce(q, ''))) < 3 or length(q) > 1000 then raise exception 'invalid_review'; end if;
  if exists (select 1 from reviews r where r.data ->> 'orderId' = oid and (r.data ->> 'pid')::bigint = pid_in) then raise exception 'already_reviewed'; end if;
  for u in select jsonb_array_elements_text(coalesce(photos, '[]'::jsonb)) loop
    if jsonb_array_length(ph) < 3 and u ~ ('^' || oid || '/[A-Za-z0-9_.-]{4,90}$') then ph := ph || to_jsonb(u); end if;
  end loop;
  who := coalesce(nullif(d ->> 'first', ''), split_part(coalesce(d ->> 'name', ''), ' ', 1)) || coalesce(', ' || nullif(d #>> '{address,city}', ''), '');
  insert into reviews (data, approved) values (jsonb_build_object('pid', pid_in, 'who', who, 'stars', stars, 'q', btrim(q), 'date', to_char(now(), 'YYYY-MM-DD'), 'verified', true, 'orderId', oid, 'photos', ph), false);
  return true;
end $$;
grant execute on function submit_review(text, text, bigint, int, text, jsonb) to anon, authenticated;

-- ================================================================== back-in-stock alerts
create table if not exists stock_alerts (
  id bigint generated always as identity primary key,
  pid bigint not null, contact text not null, kind text not null,
  notified boolean not null default false, ip text,
  created_at timestamptz not null default now()
);
create unique index if not exists stock_alerts_unique on stock_alerts (pid, lower(contact));
alter table stock_alerts enable row level security;
drop policy if exists "stock alerts owner" on stock_alerts;
create policy "stock alerts owner" on stock_alerts for all using (is_owner()) with check (is_owner());

create or replace function request_stock_alert(pid_in bigint, contact_in text) returns boolean
language plpgsql security definer set search_path = public as $$
declare c text := btrim(coalesce(contact_in, '')); k text; v_ip text := ee_ip();
begin
  if c ~ '^\S+@\S+\.\S+$' and length(c) < 200 then k := 'email'; c := lower(c);
  elsif length(regexp_replace(c, '\D', '', 'g')) between 9 and 15 then k := 'phone'; c := regexp_replace(c, '[^0-9+]', '', 'g');
  else raise exception 'invalid:contact'; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce((select value from catalog_kv where key = 'products'), '[]'::jsonb)) p where (p ->> 'id')::bigint = pid_in) then raise exception 'unavailable'; end if;
  if v_ip <> '' and (select count(*) from stock_alerts where ip = v_ip and created_at > now() - interval '1 hour') >= 10 then raise exception 'rate_limited'; end if;
  insert into stock_alerts (pid, contact, kind, ip) values (pid_in, c, k, nullif(v_ip, '')) on conflict do nothing;
  return true;
end $$;
grant execute on function request_stock_alert(bigint, text) to anon, authenticated;

-- ================================================================== after running this file
-- 1. Authentication > Users > Add user: create your admin login (email + password).
-- 2. Run:  insert into admins (email) values ('your-admin@email.com');
--    More admins can be added later from the app: Admin > Settings > Admins.
