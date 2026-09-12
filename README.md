# Uintah Valley

Static site for **Uintah Valley LLC** — homemade goods from a Utah kitchen. Vanilla is the current line. No build step. Meant for [Cloudflare Pages](https://developers.cloudflare.com/pages/) on **uintahvalley.com**.

## Branch status — read this first

| Branch | What it is |
| --- | --- |
| **`main`** | The **live** old storefront. Leave it alone. CAPT will cut over later. |
| **This branch** (`rebuild/v2` / `cursor/rebuild-v2-ground-up-080f`) | Ground-up rebuild. Preview and iterate here. **Do not merge to `main` until cutover.** |

Cloudflare Pages production should stay pointed at `main` until CAPT is ready to switch.

## Pages

Nav is **Home / Shop / About / Contact / Request list**.

| File | Purpose |
| --- | --- |
| `index.html` | Full-bleed mountain hero behind the header, plus Discover tabs |
| `shop.html` | Vanilla line: mainline sold out; Don's Reserve can be added to a request list |
| `about.html` | CAPT kitchen copy, Utah-residents callout, Team cards (Navarre + Don Thornton Jr.) |
| `contact.html` | On-site form posts to `/api/contact` (Resend). Request-list lines are included when present. |
| `cart.html` | Request list (localStorage). Email this request posts to `/api/contact`. No live payment. |
| `404.html` | Cloudflare Pages not-found page |

Shared styles: `css/styles.css`. Menu, year, home header scroll, Discover tabs, and shop filters: `js/site.js`. Request list: `js/cart.js`.

Old Experimental / product routes redirect to Shop so bookmarks do not 404 after preview deploys.

## Honest stock

**Uintah Valley Pure Vanilla Extract (mainline) is out of stock indefinitely.** There is no live checkout on this rebuild. Don's Reserve batches can be added to a request list and emailed. Currently we can only sell to Utah residents.

## Discover section (home)

Under the hero: **Discover Premium Vanilla Extract** with two selectors.

- **Uintah Valley** — “This is our mainline product, made with locally distilled spirits and judiciously sourced Madagascar Vanilla.”
- **Don's Reserve** — collaboration with Don Thornton Jr.; Madagascar / Tahitian / Tahiti bottles.

Each tab shows three product cards. Mainline is sold out; Don's Reserve cards have Add to request. Shop uses the same catalog with All / Uintah Valley / Don's Reserve filters.

## Brand

Header uses the official color mark: SVG preferred, CLR PNG fallback (`assets/logo-color.svg` / `assets/logo-color.png`).

Palette from the logo: lime `#72a813`, forest `#5e8924` / `#2e6423` / `#144916`, cream `#fff6d2`, taupe `#777a69`. Display type is Quattrocento; body is Source Sans 3.

## Hero photo

`assets/hero-home.jpg` **is** CAPT’s forested mountain still (evergreen valley, two snow-patched peaks, blue sky). That file is the only homepage hero background.

The homepage uses a full-bleed `<img class="hero-photo">` of `assets/hero-home.jpg` behind a transparent header. Copy and bottles sit mid-hero (not under the nav, not on the bottom edge) over a dark left / bottom-left scrim.

Layering to the right of the title: mountain photo, then one product image — `assets/hero-product-plate.png` (Lens orchid + beans + bottles, already composed). That plate flies in from the right as a unit (honors `prefers-reduced-motion`). Separate `vanilla-orchid-beans.png` and `bottles-hero.png` stay in the repo but are not used on the live hero.

Do not use `assets/hero.jpg` (vanilla bottle), `assets/landscape.jpg` (basin overlook), stock/shutterstock, or a CSS gradient standing in for the mountain photo.

## Local preview

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). Confirm the mountain photo sits behind the logo and nav, the Discover tabs swap copy and cards, and the footer credit is on every page.

## Deploy (later cutover)

1. Cloudflare: **Workers & Pages → Pages**. Project `uintahvalley`.
2. Framework preset none. Output directory `/`.
3. Keep **production branch = `main`** until cutover.
4. To preview this rebuild, attach the branch as a Pages preview, or temporarily switch production only when CAPT is ready.

`404.html` is the not-found page. `_redirects` and `_headers` stay in the project root.

Contact form secrets: see `CONTACT_FORM.md`. **`RESEND_API_KEY` must exist on Production** (and Preview). Optional: `EMAIL_FROM` / `EMAIL_TO`. Tests: `node --test tests/contact.test.mjs`.

## Footer

Every page keeps the SS Argus credit and a simple © Uintah Valley LLC line.

Homemade product, sold for home use, not for resale; prepared without state or local inspection; contains alcohol.
