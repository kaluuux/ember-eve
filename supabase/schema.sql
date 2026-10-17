-- Ember & Eve: shared catalogue, orders, customers and admin access.
-- Run this whole file in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It is safe to re-run after every update.

-- ================================================================== admins
create table if not exists admins (email text primary key);
alter table admins enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function is_admin() to anon, authenticated;

drop policy if exists "admins manage admins" on admins;
create policy "admins manage admins" on admins for all using (is_admin()) with check (is_admin());

create or replace function admins_keep_one() returns trigger language plpgsql as $$
begin
  if (select count(*) from admins) <= 1 then raise exception 'cannot remove the last admin'; end if;
  return old;
end $$;
drop trigger if exists admins_keep_one on admins;
create trigger admins_keep_one before delete on admins for each row execute function admins_keep_one();

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
create policy "catalog readable by everyone" on catalog_kv for select using (key <> 'discounts' or is_admin());
create policy "catalog writable by admin" on catalog_kv for all using (is_admin()) with check (is_admin());

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
alter table profiles enable row level security;
drop policy if exists "own profile read" on profiles;
drop policy if exists "own profile update" on profiles;
drop policy if exists "admin reads profiles" on profiles;
create policy "own profile read" on profiles for select using (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin reads profiles" on profiles for select using (is_admin());

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
insert into profiles (id, email, name) select id, email, split_part(email, '@', 1) from auth.users on conflict (id) do nothing;

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
create policy "orders admin only" on orders for all using (is_admin()) with check (is_admin());

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
  defaults jsonb := '{"standard":450,"express":900,"freeOver":8000,"giftWrap":300,"freeColors":3,"extraColorFee":100,"giftBoxFee":1000,"giftBoxes":[],"districts":[],"pay":{"card":false,"bank":true,"whatsapp":false,"store":false}}';
  st jsonb; prods jsonb; pal jsonb; discs jsonb;
  it jsonb; c jsonb; p jsonb; r jsonb; cfg jsonb;
  items jsonb := '[]'; need jsonb := '{}'; box jsonb;
  qty int; unit numeric; fee numeric; sub numeric := 0; parts text[]; slots int; n int;
  code text; dsc jsonb; disc numeric := 0; free_ship boolean := false;
  ship_m text; ship numeric; wrap numeric := 0; net numeric; district text; rate numeric;
  pay_m text; pay_label text; pay_bank text; nm text; ph text; em text; a1 text; city text; payset jsonb;
  pid_txt text; stock_txt text; first_hex text; now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
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
  if ship_m not in ('standard', 'express', 'pickup') then ship_m := 'standard'; end if;
  if em !~ '^\S+@\S+\.\S+$' then raise exception 'invalid:email'; end if;
  if nm = '' or ph = '' then raise exception 'invalid:contact'; end if;
  if ship_m <> 'pickup' and (a1 = '' or city = '') then raise exception 'invalid:address'; end if;
  if jsonb_typeof(o -> 'items') <> 'array' or jsonb_array_length(o -> 'items') = 0 or jsonb_array_length(o -> 'items') > 30 then
    raise exception 'invalid:items';
  end if;

  for it in select * from jsonb_array_elements(o -> 'items') loop
    qty := least(10, greatest(1, coalesce((it ->> 'qty')::int, 1)));
    if jsonb_typeof(it -> 'box') = 'array' then
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
      unit := fee; parts := '{}'; box := '[]'; first_hex := null;
      for c in select * from jsonb_array_elements(it -> 'box') loop
        select x into p from jsonb_array_elements(prods) x where (x ->> 'id') = (c ->> 'pid') limit 1;
        if p is null or not coalesce((p ->> 'active')::boolean, false) then raise exception 'unavailable:%', coalesce(c ->> 'pid', '?'); end if;
        r := ee_price(p, c -> 'sel', st, pal);
        unit := unit + (r ->> 'unit')::numeric;
        parts := parts || ((p ->> 'name') || ' [' || (r ->> 'desc') || ']');
        box := box || jsonb_build_object('pid', (p ->> 'id')::bigint, 'name', p ->> 'name', 'sel', ee_clean_sel(c -> 'sel'));
        first_hex := coalesce(first_hex, r ->> 'hex');
        need := jsonb_set(need, array[p ->> 'id'], to_jsonb(coalesce((need ->> (p ->> 'id'))::int, 0) + qty));
      end loop;
      items := items || jsonb_build_object('pid', 0, 'name', 'Gift Box (' || slots || ' candles)', 'sub', array_to_string(parts, '; '),
        'qty', qty, 'unit', unit, 'tint', coalesce(first_hex, '#EADFD3'), 'box', box, 'boxId', it ->> 'boxId',
        'note', left(btrim(coalesce(it ->> 'note', '')), 250));
    else
      select x into p from jsonb_array_elements(prods) x where (x ->> 'id') = (it ->> 'pid') limit 1;
      if p is null or not coalesce((p ->> 'active')::boolean, false) then raise exception 'unavailable:%', coalesce(it ->> 'pid', '?'); end if;
      r := ee_price(p, it -> 'sel', st, pal);
      unit := (r ->> 'unit')::numeric;
      need := jsonb_set(need, array[p ->> 'id'], to_jsonb(coalesce((need ->> (p ->> 'id'))::int, 0) + qty));
      items := items || jsonb_build_object('pid', (p ->> 'id')::bigint, 'name', p ->> 'name', 'sub', r ->> 'desc',
        'qty', qty, 'unit', unit, 'tint', r ->> 'hex', 'sel', ee_clean_sel(it -> 'sel'));
    end if;
    sub := sub + unit * qty;
  end loop;

  -- stock: every candle (including those inside gift boxes) must be available
  for pid_txt in select k from jsonb_object_keys(need) k loop
    select x into p from jsonb_array_elements(prods) x where (x ->> 'id') = pid_txt limit 1;
    stock_txt := p ->> 'stock';
    if stock_txt is not null and stock_txt::int < (need ->> pid_txt)::int then
      raise exception 'out_of_stock:%', p ->> 'name';
    end if;
  end loop;

  -- discount code
  code := upper(btrim(coalesce(o ->> 'code', '')));
  if code <> '' then
    select d into dsc from jsonb_array_elements(discs) d
      where coalesce((d ->> 'active')::boolean, false) and upper(d ->> 'code') = code limit 1;
    if dsc is not null and sub >= coalesce((dsc ->> 'min')::numeric, 0) then
      if dsc ->> 'type' = 'pct' then disc := round(sub * (dsc ->> 'value')::numeric / 100);
      elsif dsc ->> 'type' = 'fixed' then disc := least((dsc ->> 'value')::numeric, sub);
      else free_ship := true; end if;
    else
      code := '';
    end if;
  end if;
  net := sub - disc;

  -- delivery
  if ship_m = 'pickup' then ship := 0;
  elsif ship_m = 'express' then ship := (st ->> 'express')::numeric;
  elsif net >= (st ->> 'freeOver')::numeric or free_ship then ship := 0;
  else
    select (x ->> 'rate')::numeric into rate from jsonb_array_elements(st -> 'districts') x where lower(x ->> 'name') = lower(district) limit 1;
    ship := coalesce(rate, (st ->> 'standard')::numeric);
  end if;
  if coalesce((o ->> 'wrap')::boolean, false) then wrap := (st ->> 'giftWrap')::numeric; end if;

  -- payment method
  pay_m := coalesce(o ->> 'payMethod', 'bank');
  if pay_m = 'card' and coalesce((payset ->> 'card')::boolean, false) then pay_label := 'Card (PayHere)';
  elsif pay_m = 'bank' and coalesce((payset ->> 'bank')::boolean, false) then pay_label := 'Bank transfer';
  elsif pay_m = 'whatsapp' and coalesce((payset ->> 'whatsapp')::boolean, false) then pay_label := 'WhatsApp order';
  elsif pay_m = 'store' and coalesce((payset ->> 'store')::boolean, false) and ship_m = 'pickup' then pay_label := 'Pay at store pickup';
  else raise exception 'invalid:payment';
  end if;
  -- which of the shop's bank accounts the customer chose (must match a saved account)
  if pay_m = 'bank' and btrim(coalesce(o ->> 'payBank', '')) <> '' then
    select b ->> 'bank' into pay_bank from jsonb_array_elements(coalesce(st -> 'banks', '[]'::jsonb)) b
      where lower(b ->> 'bank') = lower(btrim(o ->> 'payBank')) limit 1;
  end if;

  return jsonb_build_object(
    'date', now_iso, 'email', em, 'name', nm, 'first', left(btrim(coalesce(o ->> 'first', '')), 80), 'phone', ph,
    'address', jsonb_build_object('a1', a1, 'a2', btrim(coalesce(o #>> '{address,a2}', '')), 'city', city, 'district', district, 'post', btrim(coalesce(o #>> '{address,post}', ''))),
    'items', items, 'sub', sub, 'disc', disc, 'code', code, 'ship', ship, 'shipM', ship_m, 'wrap', wrap, 'total', net + ship + wrap,
    'status', 'Processing', 'pay', pay_label, 'payMethod', pay_m, 'payBank', pay_bank, 'payStatus', 'Pending',
    'note', left(btrim(coalesce(o ->> 'note', '')), 500), 'sellerNote', left(btrim(coalesce(o ->> 'sellerNote', '')), 1000),
    'userId', auth.uid()::text, 'log', jsonb_build_array(jsonb_build_object('s', 'Placed', 'd', now_iso)),
    '_need', need);
end $$;

-- Preview the authoritative totals before the customer pays. Writes nothing.
create or replace function quote_order(o jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select ee_build_order(o) - '_need';
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
  return b;
end $$;

create or replace function get_order(oid text, mail text) returns jsonb
language sql stable security definer set search_path = public as $$
  select (data - 'adminNote') || jsonb_build_object('status', status, 'id', id) from orders where id = oid and email = lower(btrim(mail));
$$;

-- Orders belonging to the signed-in customer.
create or replace function my_orders() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg((o.data - 'adminNote') || jsonb_build_object('status', o.status, 'id', o.id) order by o.created_at desc), '[]'::jsonb)
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
create policy "receipt admin read" on storage.objects for select using (bucket_id = 'receipts' and is_admin());
create policy "receipt admin delete" on storage.objects for delete using (bucket_id = 'receipts' and is_admin());

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
  if not is_admin() then raise exception 'not allowed'; end if;
  update orders set data = data || patch, status = coalesce(patch ->> 'status', status) where id = oid;
end $$;
grant execute on function admin_patch_order(text, jsonb) to authenticated;

-- ================================================================== shop images (LankaQR codes)
-- Public so customers can see the QR; only admins can add or change files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-assets', 'shop-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = true;
drop policy if exists "shop assets admin write" on storage.objects;
drop policy if exists "shop assets admin update" on storage.objects;
drop policy if exists "shop assets admin delete" on storage.objects;
create policy "shop assets admin write" on storage.objects for insert with check (bucket_id = 'shop-assets' and is_admin());
create policy "shop assets admin update" on storage.objects for update using (bucket_id = 'shop-assets' and is_admin());
create policy "shop assets admin delete" on storage.objects for delete using (bucket_id = 'shop-assets' and is_admin());

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
      'Rs ' || to_char(coalesce((d ->> 'total')::numeric, 0), 'FM999,999,990') || ' · ' || coalesce(d ->> 'name', '') || ' · ' || coalesce(d ->> 'pay', '')
        || ' · ' || jsonb_array_length(coalesce(d -> 'items', '[]'::jsonb)) || ' item(s)',
      '/#/admin/orders?sel=' || new.id, 4);
  else
    before_n := jsonb_array_length(coalesce(old.data -> 'receipts', '[]'::jsonb));
    after_n := jsonb_array_length(coalesce(new.data -> 'receipts', '[]'::jsonb));
    if after_n > before_n then
      perform ee_notify('Receipt uploaded for ' || new.id,
        coalesce(d ->> 'name', '') || ' · Rs ' || to_char(coalesce((d ->> 'total')::numeric, 0), 'FM999,999,990') || ' · tap to check and approve',
        '/#/admin/orders?sel=' || new.id, 4);
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
  if not is_admin() then raise exception 'not allowed'; end if;
  return (select jsonb_build_object('topic', coalesce((select value from notify_config where key = 'topic'), ''),
                                    'site', coalesce((select value from notify_config where key = 'site'), '')));
end $$;

create or replace function admin_set_notify(topic text, site text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
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
  if not is_admin() then raise exception 'not allowed'; end if;
  perform ee_notify('Test alert', 'Phone alerts are working. You will get one for every new order and receipt.', '/#/admin/orders', 3);
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
create policy "approved reviews public" on reviews for select using (approved or is_admin());
create policy "anyone can submit a review" on reviews for insert with check (approved = false);
create policy "reviews admin" on reviews for all using (is_admin()) with check (is_admin());

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
create policy "messages admin" on messages for all using (is_admin()) with check (is_admin());

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

-- ================================================================== after running this file
-- 1. Authentication > Users > Add user: create your admin login (email + password).
-- 2. Run:  insert into admins (email) values ('your-admin@email.com');
--    More admins can be added later from the app: Admin > Settings > Admins.
