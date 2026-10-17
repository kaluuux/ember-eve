-- Ember & Eve: shared catalogue, orders and admin access.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to re-run.

-- ---------------------------------------------------------------- admins
create table if not exists admins (email text primary key);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- --------------------------------------------- catalogue (products, colours, ...)
-- One row per collection: products, colors, categories, seasons, settings, discounts.
create table if not exists catalog_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table catalog_kv enable row level security;
drop policy if exists "catalog readable by everyone" on catalog_kv;
drop policy if exists "catalog writable by admin" on catalog_kv;
-- Discount codes are not public: only expose the other keys.
create policy "catalog readable by everyone" on catalog_kv for select using (key <> 'discounts' or is_admin());
create policy "catalog writable by admin" on catalog_kv for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------- orders
create table if not exists orders (
  id text primary key,
  data jsonb not null,
  email text not null,
  status text not null default 'Processing',
  created_at timestamptz not null default now()
);
alter table orders enable row level security;
drop policy if exists "orders admin only" on orders;
create policy "orders admin only" on orders for all using (is_admin()) with check (is_admin());

-- Customers never read or write orders directly; they go through these functions.
create or replace function place_order(o jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  new_id text;
  n int;
  item jsonb;
  prods jsonb;
begin
  select coalesce(max((regexp_replace(id, '\D', '', 'g'))::int), 1000) + 1 into n from orders;
  new_id := 'EE-' || n;
  select value into prods from catalog_kv where key = 'products' for update;
  -- reduce stock for limited-stock products
  for item in select * from jsonb_array_elements(o -> 'items') loop
    if (item ->> 'pid')::int > 0 then
      prods := (
        select jsonb_agg(
          case when (p ->> 'id')::bigint = (item ->> 'pid')::bigint and p -> 'stock' <> 'null'::jsonb
            then jsonb_set(p, '{stock}', to_jsonb(greatest(0, (p ->> 'stock')::int - (item ->> 'qty')::int)))
            else p end)
        from jsonb_array_elements(prods) p);
    end if;
  end loop;
  update catalog_kv set value = prods, updated_at = now() where key = 'products';
  insert into orders (id, data, email, status)
  values (new_id, jsonb_set(o, '{id}', to_jsonb(new_id)), lower(o ->> 'email'), 'Processing');
  return new_id;
end $$;

-- Look up one order by id + the email it was placed with (used by Track Order and the confirmation page).
create or replace function get_order(oid text, mail text) returns jsonb
language sql stable security definer set search_path = public as $$
  select data || jsonb_build_object('status', status) from orders where id = oid and email = lower(mail);
$$;

-- Public sales counts for the Best Selling / Trending shelves (no customer data).
create or replace function sales_summary() returns table (pid int, qty int, last_30 int)
language sql stable security definer set search_path = public as $$
  select (i ->> 'pid')::int,
         sum((i ->> 'qty')::int)::int,
         sum(case when o.created_at > now() - interval '30 days' then (i ->> 'qty')::int else 0 end)::int
  from orders o, jsonb_array_elements(o.data -> 'items') i
  where o.status <> 'Cancelled' and (i ->> 'pid')::int > 0
  group by 1;
$$;

grant execute on function place_order(jsonb) to anon, authenticated;
grant execute on function get_order(text, text) to anon, authenticated;
grant execute on function sales_summary() to anon, authenticated;

-- --------------------------------------------------------- reviews and messages
create table if not exists reviews (
  id bigint generated always as identity primary key,
  data jsonb not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
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
alter table messages enable row level security;
drop policy if exists "anyone can send a message" on messages;
drop policy if exists "messages admin" on messages;
create policy "anyone can send a message" on messages for insert with check (is_read = false);
create policy "messages admin" on messages for all using (is_admin()) with check (is_admin());

-- ------------------------------------------------------ after running this file
-- 1. Authentication > Users > Add user: create the admin login (email + password).
-- 2. Run:  insert into admins (email) values ('your-admin@email.com');
