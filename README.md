# Ember & Eve

Storefront and admin for Ember & Eve hand-poured candles. Implements the Claude Design handoff
(`Ember and Eve.dc.html`, `Admin.dc.html`) as a Vite + React + TypeScript SPA.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

> The scripts call `node ./node_modules/...` directly because this folder's name contains `&`,
> which breaks `npx` / bare binary names under `cmd.exe`. Renaming the folder to `ember-eve` is the simpler long-term fix.

## Routes (hash-based)

`#/` home · `#/shop` · `#/product/:id` · `#/cart` · `#/checkout` · `#/order/:id` · `#/login` · `#/register` ·
`#/forgot` · `#/account` · `#/track` · `#/gifts` · `#/finder` · `#/about` · `#/contact` · `#/faq` ·
`#/shipping` · `#/care` · `#/privacy` · `#/terms` · `#/admin[/dash|orders|products|customers|discounts|reviews|messages|settings]`

## Demo data and logins

All data lives in `localStorage` (keys prefixed `ee_`), seeded on first load by `src/store.ts`.

- Customer: `demo@emberandeve.example` / `candle123`
- Admin (`#/admin`): `admin@emberandeve.example` / `admin123`
- Discount codes: `WELCOME10`, `EVE5` (min £20), `FREESHIP`

To reset, clear site data for the origin.

## Layout

- `src/store.ts` – localStorage data layer, seed data, `useStored` reactive hook (swap for an API client later)
- `src/AppContext.tsx` – cart, wishlist, session, toast, quick view
- `src/commerce.ts` – totals, ratings, order view helpers
- `src/components/` – layout shell, scroll-driven `Hero`, product card, basket drawer, quick view
- `src/pages/` – storefront pages · `src/admin/` – admin shell and views

## Before going live

This is a prototype backend: passwords, the admin login and "payments" are all client-side and unverified.
A real deployment needs a server for auth (hashed passwords), orders, stock and a payment provider.
Photography is still placeholder blocks, as in the design.
