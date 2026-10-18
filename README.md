# Ember & Eve

Storefront and admin for hand-poured soy wax candles (Sri Lanka). Vite + React + TypeScript SPA with a Supabase backend, deployed on Vercel.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

## Two modes

- **Online (Supabase configured):** catalogue, orders, receipts, customers and admin sign-in live in Supabase and are shared by everyone.
- **Offline demo (no env vars):** everything runs on `localStorage` with sample data. Handy for trying things; edits are not shared. Gift cards, store credit, referrals and team roles need the online store.

Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key; never put the `service_role` key anywhere in this project). On Vercel add the same two variables for Production and Preview, then redeploy.

## Setting up Supabase

1. Run `supabase/schema.sql` in the SQL Editor (safe to re-run after every update; it also upgrades older versions). **Re-run it whenever you pull a new version**: it creates the tables and rules for roles, costs, gift cards, credit, reviews and alerts.
2. Authentication > Users > Add user: create the first admin login, then run `insert into admins (email) values ('you@example.com');` (that person is an **owner**). More people can be added later in Admin > Settings > Team.
3. Authentication > Providers > Email: for simple sign-up turn **Confirm email** off, or set up your own SMTP so confirmation and password-reset emails are reliable (Supabase's built-in sender is heavily rate limited).
4. Authentication > URL Configuration: set the Site URL to your live address, and add your live address, Vercel preview addresses and `http://localhost:5173/**` under Redirect URLs (needed for password-reset links and Google sign-in).
5. **Google sign-in (optional but recommended).** See "Publishing Google sign-in" below.
6. Open `/admin`, sign in, and on **Catalogue** click **Publish starter catalogue**.
7. In **Settings** add your bank accounts (each can have its own LankaQR image), WhatsApp number, pickup address, social links and delivery rates. Customers pick their bank, then see its QR and details.
8. In **Settings > Phone alerts** click **Turn on phone alerts**, install the free ntfy app, and subscribe to the topic shown. You then get a push for every new order, uploaded receipt and cancellation request (sent by the database through ntfy.sh; needs the `pg_net` extension, which Supabase enables by default).

## Publishing Google sign-in

While the Google OAuth app is in **Testing**, only the "test users" you list can sign in with Google. To let everyone in:

1. Google Cloud Console > **APIs & Services > OAuth consent screen** (now called *Google Auth Platform > Audience*).
2. Fill in everything Google asks for: app name (Ember & Eve), support email, your logo, your **home page** (your live address), **privacy policy** link (`https://your-site/privacy`) and **terms** link (`https://your-site/terms`), and add your site's domain under *Authorised domains*. The site already has both pages.
3. Under **Data access / Scopes** keep only the basic ones: `openid`, `email`, `profile`. These do not need Google's lengthy security review.
4. Under **Audience** click **Publish app** and confirm ("In production"). Basic sign-in with those three scopes is approved straight away; there is no wait. The "unverified app" warning only appears if you add sensitive scopes.
5. Make sure the OAuth client's **Authorised redirect URI** is `https://<your-project-ref>.supabase.co/auth/v1/callback` and the Client ID and Secret are saved in Supabase > Authentication > Providers > Google.
6. Test with a Google account that is not on the old test-user list.

Google shows your logo and the home page link on the consent screen, so use the real ones.

## Web addresses and link previews

The site uses real addresses (`/shop`, `/product/4`, `/shop?cat=mold`). Old `#/shop` links still work and are upgraded automatically.

- `api/page.js` runs on Vercel for every page. It reads the catalogue and puts the right title, description, share image and structured data into the page, so a link pasted into WhatsApp, Facebook or Google shows the actual candle (those services do not run scripts).
- `/sitemap.xml` and `/robots.txt` are generated from the catalogue. Private pages (cart, checkout, account, admin, orders) are marked `noindex`.
- `public/og.png` is the default share image (1200 x 630). Product pages use their first photo.
- `vercel.json` wires the above up; nothing to configure. The shared head/meta logic lives in `src/seo-core.js`, used by both the browser and the server.
- Set your real domain in Supabase (step 4) and add it to Vercel > Domains.

## Photos and social links

- **Admin > Products > Edit** has a Photos section: upload several photos (they are shrunk and stored in Supabase Storage), drag the order with the arrows, and the first is the cover. Categories have one photo each, and **Settings > Home page gallery** feeds the "Little moments, lit" section.
- **Settings > Store details > Social links** takes your Instagram, Facebook, TikTok and YouTube addresses; icons appear in the footer and on the Contact page. Empty ones are hidden.

## Customers and accounts

- Checkout asks signed-out visitors to **sign in, create an account, or continue as a guest**. Google or email + password both work.
- Signed-in customers have an **address book**: pick a saved address at checkout, or add one and tick "Save this address". Their **account page** shows total orders, orders in progress, total spent, current and past orders (with Track, Invoice and Buy again), saved addresses, saved candles, **rewards** and their profile.
- A guest who later creates an account with the same **verified** email sees their earlier orders there.
- **Track Order** (`/track`) needs no account: a mobile number plus an order number or courier tracking number. It shows status only, never the email, street address or prices, and guessing is rate limited.
- In Admin, **Customers** opens a panel with contact details, totals, saved addresses and every order, and each order has a private **internal note** customers never see.

## Look and feel

The storefront has a calm, warm design layer in `src/theme.css` (colours, type, buttons, motion) on top of the base styles in `src/index.css`, plus a soft candle glow in `src/glow.css`. Headings use Cormorant Garamond; body text uses Inter. Motion is gentle and respects "reduce motion". Newsletter sign-ups are stored in Supabase and listed in Admin > Customers (Newsletter list).

## Sinhala and Tamil

The storefront is available in English, Sinhala and Tamil. The language buttons are at the top right of the page and in the footer; the choice is remembered on that device. The admin stays in English.

- The English text is the key. `src/lang/si.ts` and `src/lang/ta.ts` map English sentences to their translation; anything without an entry simply shows in English. Product names, descriptions, categories and the policy pages (shipping, privacy, terms, candle care) are your own content and stay as you wrote them.
- The translations were written carefully but are worth a read by a native speaker before launch. To fix a word, change it in those two files; to add a new sentence, wrap it in `t('...')` (hook `useT` from `src/i18n.ts`) and add its translation.

## How an order works

1. The browser sends only the customer's choices (candle, options, colours, notes, gift code, credit, referral link). The server (`place_order`) prices everything from the live catalogue, checks stock, applies the discount and delivery rate, and returns the final order. Checkout shows the server's totals before the customer pays.
2. Payment is by bank transfer: the order page shows your account details and the order number as reference. The customer uploads a receipt photo (private storage) or sends it on WhatsApp. An order fully covered by a gift card or credit needs no payment.
3. In **Orders** you see the receipt and which bank the customer chose, **Approve payment**, add courier and tracking, and move the order through Processing > Dispatched > Delivered.
4. Every order has a printable invoice (`/invoice/EE-1007`): customers open it from their order page, you open it from the order in Admin. Fill in the invoice details (business address, phone, registration number, due days) in Settings > Store details. To use your own artwork on the invoice, put `invoice-logo.png` (the candle mark, top right) and `invoice-wordmark.png` (name and tagline, bottom right) in `public/`.

## Running the shop day to day

- **Bulk actions and labels.** On **Orders** tick several orders: mark them packed, dispatched or delivered in one go (unpaid orders are skipped), or **Print labels**. Labels open as a print-ready page, 8 per A4 sheet (shop address as sender, customer name, address, phone, order number, express flag), with a pick list on top that adds up the candles you need to take off the shelf. A single order has **Print courier label** too. The **To pack** chip lists paid orders not yet packed.
- **Cost price and profit.** Enter what each candle costs you to make in **Products** (the Cost column, or inside Edit). Costs are stored privately: customers can never read them. The dashboard then shows **Profit** (candle sales after discounts, minus cost, before delivery) with the margin and profit per candle. Each order snapshots the cost at the time, and every order's detail shows its own profit.
- **Team roles and the activity log.** In **Settings > Team** each person is an **Owner** (everything) or **Staff**. Staff see only an **Orders to pack** screen: names, phone numbers, addresses and items, never prices, payments, customers, settings or the dashboard. They can mark orders packed, add tracking and mark paid orders dispatched or delivered; the database enforces this, not just the screen. **Activity** (owners only) lists who changed what: orders, catalogue, team, reviews, costs, gift cards and credit.
- **Cancellation requests.** On their order page a customer can ask to cancel while the order is still Processing. You get a phone alert; the order shows **Wants to cancel** and you **Approve and cancel** (stock goes back, any gift card or credit used is refunded) or **Decline**.
- **Verified reviews with photos.** Once an order is Delivered, the order page asks for a review of each candle, with up to three photos. Only real buyers can review, once per candle. Reviews arrive in **Reviews** marked "Verified buyer"; you approve them before they show on the candle page.
- **Back in stock.** A sold-out candle shows "Notify me" (email or mobile number). **Back in stock** lists who is waiting for each candle, tells you which are available again, and gives one-tap WhatsApp or email links, then mark them as told.
- **Gift cards, cashback and referrals.** Switch these on in **Settings > Rewards**. Gift cards are sold at `/gift-cards`; once the order's payment is approved the code appears on the buyer's order page (copy, or send on WhatsApp) and in **Gift cards**, where you can also create a card yourself, disable one or adjust a customer's store credit. Cashback (a percentage of each paid order) and the referral offer (a discount for a friend's first order plus credit for whoever shared) are paid out as store credit only once the order is marked paid, and are taken back if it is cancelled. Every signed-in customer gets a personal link on their account's **Rewards** tab.

## Routes

`/` home · `/shop` (`?cat=` `?shelf=` `?season=` `?seasonal=1` `?q=`) · `/product/:id` · `/cart` · `/checkout` · `/order/:id` · `/login` · `/register` · `/forgot` · `/reset` · `/account` (`?tab=orders|addr|wish|rewards|details`) · `/track` · `/gifts` · `/gift-cards` · `/finder` · `/about` · `/contact` · `/faq` · `/shipping` · `/care` · `/privacy` · `/terms` · `/invoice/:id` · `/labels?ids=EE-1001,EE-1002` · `/admin[/dash|orders|products|catalog|discounts|giftcards|alerts|customers|reviews|messages|activity|settings]`

Offline demo logins: customer `demo@emberandeve.example` / `candle123`, admin `admin@emberandeve.example` / `admin123`.

## Layout

- `src/store.ts` data layer (localStorage cache, starter catalogue) · `src/sync.ts` Supabase sync, accounts, orders, receipts, team, rewards, backup
- `src/commerce.ts` pricing, options, shelves, seasons · `src/profit.ts` profit maths · `src/AppContext.tsx` cart, session, discounts
- `src/i18n.ts` + `src/lang/` Sinhala and Tamil · `src/seo-core.js` + `api/` link previews, sitemap, robots
- `src/pages/` storefront · `src/components/` shared pieces (`Perks.tsx` reviews, cancel and notify, `Rewards.tsx`) · `src/admin/` admin (`dashboard`, `orders`, `catalog`, `owner`, `settings`, `views`)
- `supabase/schema.sql` tables, security rules and server functions

## Backups

Admin > Settings > Backup downloads everything (catalogue, orders, customers, reviews, messages) as one file. Keep it private. Receipt photos stay in Supabase Storage. Supabase's own automatic backups need a paid plan.
