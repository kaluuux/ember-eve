# Ember & Eve

Storefront and admin for hand-poured soy wax candles (Sri Lanka). Vite + React + TypeScript SPA with a Supabase backend.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

## Two modes

- **Online (Supabase configured):** catalogue, orders, receipts, customers and admin sign-in live in Supabase and are shared by everyone.
- **Offline demo (no env vars):** everything runs on `localStorage` with sample data. Handy for trying things; edits are not shared.

Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key; never put the `service_role` key anywhere in this project). On Vercel add the same two variables for Production and Preview, then redeploy.

## Setting up Supabase

1. Run `supabase/schema.sql` in the SQL Editor (safe to re-run after every update; it also upgrades older versions).
2. Authentication > Users > Add user: create the first admin login, then run `insert into admins (email) values ('you@example.com');`. More admins can be added later in Admin > Settings > Admin team.
3. Authentication > Providers > Email: for simple sign-up turn **Confirm email** off, or set up your own SMTP so confirmation and password-reset emails are reliable (Supabase's built-in sender is heavily rate limited).
4. Authentication > URL Configuration: set the Site URL to your live address (for password-reset links).
5. Open `/#/admin`, sign in, and on **Catalogue** click **Publish starter catalogue**.
6. In **Settings** add your bank accounts (each can have its own LankaQR image), WhatsApp number, pickup address and delivery rates. Customers pick their bank, then see its QR and details.
7. In **Settings > Phone alerts** click **Turn on phone alerts**, install the free ntfy app, and subscribe to the topic shown. You then get a push for every new order and uploaded receipt (sent by the database through ntfy.sh; needs the `pg_net` extension, which Supabase enables by default).

## How an order works

1. The browser sends only the customer's choices (candle, options, colours, notes). The server (`place_order`) prices everything from the live catalogue, checks stock, applies the discount and delivery rate, and returns the final order. Checkout shows the server's totals before the customer pays.
2. Payment is by bank transfer: the order page shows your account details and the order number as reference. The customer uploads a receipt photo (private storage) or sends it on WhatsApp.
3. In **Orders** you see the receipt and which bank the customer chose, **Approve payment**, add courier and tracking, and move the order through Processing > Dispatched > Delivered.
4. Every order has a printable invoice (`#/invoice/EE-1007`): customers open it from their order page, you open it from the order in Admin. Fill in the invoice details (business address, phone, registration number) in Settings > Store details.

## Routes (hash-based)

`#/` home · `#/shop` (`?cat=` `?shelf=` `?season=` `?seasonal=1` `?q=`) · `#/product/:id` · `#/cart` · `#/checkout` · `#/order/:id` · `#/login` · `#/register` · `#/forgot` · `#/reset` · `#/account` · `#/track` · `#/gifts` · `#/finder` · `#/about` · `#/contact` · `#/faq` · `#/shipping` · `#/care` · `#/privacy` · `#/terms` · `#/admin[/dash|orders|products|catalog|discounts|customers|reviews|messages|settings]`

Offline demo logins: customer `demo@emberandeve.example` / `candle123`, admin `admin@emberandeve.example` / `admin123`.

## Layout

- `src/store.ts` data layer (localStorage cache, starter catalogue) · `src/sync.ts` Supabase sync, accounts, orders, receipts, admin team, backup
- `src/commerce.ts` pricing, options, shelves, seasons · `src/AppContext.tsx` cart, session, discounts
- `src/pages/` storefront · `src/admin/` admin (`dashboard`, `orders`, `catalog`, `settings`, `views`)
- `supabase/schema.sql` tables, security rules and server functions

## Backups

Admin > Settings > Backup downloads everything (catalogue, orders, customers, reviews, messages) as one file. Keep it private. Receipt photos stay in Supabase Storage. Supabase's own automatic backups need a paid plan.
