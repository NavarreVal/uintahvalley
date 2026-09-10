# Uintah Valley

Static storefront for **Uintah Valley LLC** — homemade goods from a Utah / Uintah Basin kitchen. Vanilla is the current line. No build step. Meant for [Cloudflare Pages](https://developers.cloudflare.com/pages/) on **uintahvalley.com**.

## Stock status

**Uintah Valley Pure Vanilla Extract (mainline) is currently out of stock and will remain unavailable indefinitely.**

The red banner on every page repeats that. It can be dismissed with the X; dismissal is stored in `localStorage` (`uintahvalley-oos-banner`). Mainline 1 fl oz (and the optional 6 oz label-draft size) stay visible for the brand story. They cannot be added to the request list. Any leftover mainline SKUs in `localStorage` are dropped.

What *can* be requested: the **Experimental** line.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home, sold-out notice, CTA into Experimental |
| `shop.html` | Mainline (sold out) + Experimental listing |
| `product.html` | Mainline Pure Vanilla Extract detail — no purchase |
| `experimental.html` | Four Experimental trial cards (request-list add) |
| `about.html` | Short LLC / homemade Utah note (no invented biography) |
| `contact.html` | Mailto contact / order help |
| `cart.html` | localStorage request list + email summary (Experimental only) |
| `404.html` | Cloudflare Pages not-found page |

Shared styles live in `css/styles.css`. Cart logic is `js/cart.js`. Header menu and the dismissible stock banner are `js/site.js`.

## Provisional prices

Confirm before taking money. Marked on the site as provisional.

### Mainline — not for sale

- Pure Vanilla Extract, 1 fl oz — listed as sold out (placeholder **$12** if a future restock needs a number)
- Pure Vanilla Extract, 6 oz — optional label-draft size, also sold out (**$42** was the earlier draft)

### Experimental — orderable

CAPT can rename these later:

| SKU id | Name | Size | Price |
| --- | --- | --- | --- |
| `exp-double-fold` | Double-Fold Madagascar | 1 fl oz | **$16** |
| `exp-mexican` | Mexican Vanilla Trial | 1 fl oz | **$14** |
| `exp-barrel` | Bourbon-Barrel Rested | 1 fl oz | **$18** |
| `exp-paste` | Vanilla Bean Paste (trial) | 4 oz jar | **$22** |

Checkout is a browser list (`localStorage`) plus a `mailto:hello@uintahvalley.com` order summary. There is no Stripe, Shopify, or fake payment flow. Change the mailbox in `js/cart.js` (`ORDER_EMAIL`) and the visible mailto links if needed.

## Brand assets

Header uses a single mark: SVG preferred, official CLR PNG as the `<picture>` fallback (never both visible). Large homepage badge stays SVG.

| File | Use |
| --- | --- |
| `assets/logo-color.svg` | Header (preferred) + large hero mark |
| `assets/logo-color.png` | Official CLR PNG fallback if SVG is not supported |
| `assets/logo-square.png` | Square lockup — favicon fallback, Apple touch icon |
| `assets/favicon.svg` | Simple tab icon derived from the badge |

Palette from the logo: lime `#72a813`, forest `#5e8924` / `#2e6423` / `#144916`, tree taupe `#777a69`, cream `#fff6d2`, plus style-sheet accents red `#de1e2a` and sage `#aaad95`. Display type is Quattrocento; body is Source Sans 3 (Helvetica Neue stand-in).

## Product photos (committed)

These JPEGs are in the repo now. Replace in place if CAPT sends a tighter crop — **keep the filenames**.

| Site path | Source file | Used for |
| --- | --- | --- |
| `assets/bottle-hero.jpg` | `IMG_5405_EDIT.jpg` | Primary 1 fl oz product hero (three amber bottles) |
| `assets/bottle-angle-1.jpg` | `IMG_5406_EDIT.jpg` | Alternate bottle angle |
| `assets/bottle-angle-2.jpg` | `IMG_5407_EDIT.jpg` | Alternate bottle angle |
| `assets/bottle-angle-3.jpg` | `IMG_5410_EDIT.jpg` | Alternate bottle angle |
| `assets/beans-jar.jpg` | `IMG_5971RAWedit.jpg` | Mason jar of whole vanilla beans |
| `assets/landscape.jpg` | `IMG_4852RAWedit.jpg` | Uintah Basin / about |
| `assets/hero.jpg` | `shutterstock_369993419.jpg` | Homepage hero (vanilla bottle + beans) |
| `assets/stock-beans.jpg` | `shutterstock_56869582.jpg` | Small Experimental accent (beans, not a bottle) |
| `assets/stock-spices.jpg` | `spice-1631562_1920.jpg` | About kitchen accent |
| `assets/logo-color.png` | `UintaValleyLogoA_CLR.png` | Header raster fallback |

Experimental SKUs use blank labeled frames (`placeholder 01`–`04`), not mainline bottle photos and not decorative SVG art.

Label copy used on the site: **Pure Vanilla Extract**, **Made with Madagascar Vanilla Beans**, **NET 1 FL OZ (29 mL)**.

## Local preview

From the repo root:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). Walk Home → Experimental → add a trial → Request list → email draft. Confirm mainline pages have no working add-to-cart. Confirm the header shows one logo and the red banner can be dismissed.

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

- Confirm Experimental names, prices, the public order email, and the 1 fl oz restock price (placeholder $12).
- Add live payments (Stripe or Shopify) when you want card checkout.
- Nutrition / cottage-food label copy on the bottle is separate from this site.

Homemade product, sold for home use, not for resale; the footer states it is prepared without state or local inspection and contains alcohol.
