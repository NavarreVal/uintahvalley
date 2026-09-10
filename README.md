# Uintah Valley

Static storefront for **Uintah Valley LLC** — homemade vanilla extract from a Utah / Uintah Basin maker. No build step. Meant for [Cloudflare Pages](https://developers.cloudflare.com/pages/) on **uintahvalley.com**.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home, logo, featured 6 oz, how ordering works |
| `shop.html` | 2 oz and 6 oz listing |
| `product.html` | Detail, sizes, ingredients / process, add to request list |
| `about.html` | Short LLC / homemade Utah note (no invented biography) |
| `contact.html` | Mailto contact / order help |
| `cart.html` | localStorage request list + email summary |
| `404.html` | Cloudflare Pages not-found page |

Shared styles live in `css/styles.css`. Cart logic is `js/cart.js`. Header menu and image fallbacks are `js/site.js`.

## Provisional prices

Confirm before taking money. Marked on the site as provisional:

- 2 oz — **$18**
- 6 oz — **$42**

Checkout is a browser list (`localStorage`) plus a `mailto:hello@uintahvalley.com` order summary. There is no Stripe, Shopify, or fake payment flow.

Change the mailbox in `js/cart.js` (`ORDER_EMAIL`) and the visible mailto links if needed.

## Brand assets

Official color mark (paths from the brand SVG) is `assets/logo-color.svg`. Pages use it in the header.

| File | Use |
| --- | --- |
| `assets/logo-color.svg` | Header / hero mark |
| `assets/logo-square.png` | Official square lockup — favicon fallback, Apple touch icon, Open Graph image |
| `assets/favicon.svg` | Simple tab icon derived from the badge |

Palette from the logo: lime `#72a813`, forest `#5e8924` / `#2e6423` / `#144916`, tree taupe `#777a69`, cream `#fff6d2`, plus style-sheet accents red `#de1e2a` and sage `#aaad95`. Display type is Quattrocento; body is Source Sans 3 (Helvetica Neue stand-in).

## Product photos (drop-in)

Tasteful SVG stand-ins ship today. Replace these **exact filenames** (same folder) when CAPT has photos — the pages already point at the `.jpg` paths and fall back to SVG if the JPEG is missing:

| Drop in | Used for |
| --- | --- |
| `assets/hero.jpg` | Home / about landscape |
| `assets/bottle.jpg` | Product and shop bottle |
| `assets/beans.jpg` | Product process / beans |

SVG placeholders to keep until then: `assets/hero.svg`, `assets/bottle.svg`, `assets/beans.svg`.

Suggested frames: landscape for `hero.jpg`, portrait bottle on cream or wood for `bottle.jpg`, beans close-up for `beans.jpg`. No need to change HTML if the names match.

## Local preview

From the repo root:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). Click through Home ? Shop ? Product ? Request list ? email draft.

## Deploy to Cloudflare Pages (uintahvalley.com)

1. In Cloudflare: **Workers & Pages ? Create ? Pages ? Connect to Git**.
2. Select `NavarreVal/uintahvalley`.
3. Build settings: **Framework preset** none. **Build command** empty. **Output directory** `/` (project root).
4. Production branch: `main`.
5. After the first deploy, **Custom domains ? uintahvalley.com** (and `www` if you want it). Point the domain’s DNS to Cloudflare if it is not already.

`404.html` is the real not-found page. `_redirects` sends unknown paths there. `_headers` adds basic security headers.

Optional CLI from a machine with Wrangler logged in:

```bash
npx wrangler pages deploy . --project-name uintahvalley
```

## Later

- Confirm prices and the public order email.
- Drop in real photos (table above).
- Add live payments (Stripe or Shopify) when you want card checkout.
- Nutrition / cottage-food label copy on the bottle is separate from this site.

Homemade product, sold for home use, not for resale; the footer states it is prepared without state or local inspection and contains alcohol.
