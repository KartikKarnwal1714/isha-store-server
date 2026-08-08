# What was fixed

## The bug
Your backend correctly mounts routes under `/api` (e.g. `/api/products`), and your
frontend/admin code correctly reads `VITE_API_URL` and appends `/products`, `/brands`, etc.
The problem was that **11 different files** (8 in the storefront, 3 in the admin panel)
each had their own copy-pasted local `API_URL` constant:

```js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
```

If the `VITE_API_URL` environment variable on Vercel (or wherever you deploy) was ever set
without the trailing `/api` — or with a trailing slash, or slightly differently on one
deploy vs. another — some pages would work and others would silently 404, because every
page was reading the raw env var independently instead of from one shared, validated place.
That matches the "products load once, then disappear" symptom: different code paths on the
same page (initial product list vs. recommendations vs. brand filter) were hitting different,
inconsistently-built URLs.

## The fix
Both the storefront and the admin panel now have a single file,
`src/utils/apiUrl.js`, that is the **only** place `VITE_API_URL` is read. It normalizes
the value:
- strips any trailing slash(es)
- guarantees the URL ends in `/api` (adds it if missing)

Every page and the shared `src/api/client.js` axios instances now import `API_URL` from
that one file instead of redefining it. So even if the Vercel env var is set to
`https://isha-store-api.onrender.com` (no `/api`) or
`https://isha-store-api.onrender.com/` (trailing slash) or
`https://isha-store-api.onrender.com/api/` — it will now resolve correctly everywhere,
consistently, on every page.

Files changed:
- `frontend` (storefront): `src/utils/apiUrl.js` (new), `src/api/client.js`,
  `src/pages/Home.jsx`, `BrandProducts.jsx`, `Cart.jsx`, `ProductDetails.jsx`,
  `Brands.jsx`, `MyOrders.jsx`, `Addresses.jsx`, `PreviousOrders.jsx`
- `admin`: `src/utils/apiUrl.js` (new), `src/api/client.js`, `src/components/Navbar.jsx`,
  `src/pages/Orders.jsx`, `CompleteProfile.jsx`, `Reviews.jsx`, `AddBrand.jsx`
- `server`: no code changes needed — `server.js` already mounts `/api/products` etc.
  correctly. Your Razorpay test keys were already present in `server/.env` and were left
  untouched.

## What you still need to check
Even with this fix, **set `VITE_API_URL` on Vercel** to your Render backend URL
(e.g. `https://isha-store-api.onrender.com` — with or without `/api`, both now work) for
both the storefront project and the admin project, then redeploy. Local dev already works
via the `.env` files included in each folder (`http://localhost:5000/api`).

All three projects were syntax-checked with esbuild after editing — every changed file
compiles cleanly.
