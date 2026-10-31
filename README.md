# Uintah Valley

Static site for **Uintah Valley LLC** — homemade vanilla from a Utah kitchen. Live on [uintahvalley.com](https://uintahvalley.com) via [Cloudflare Pages](https://developers.cloudflare.com/pages/). No build step. Production branch is **`main`**.

## Pages

Nav is **Home / Shop / About / Contact / Request list**.

| File | Purpose |
| --- | --- |
| `index.html` | Full-bleed mountain hero behind the header, plus Discover tabs |
| `shop.html` | Vanilla line: mainline sold out; Don's Reserve can be added to a request list |
| `about.html` | Kitchen copy, Utah-residents callout, Team cards (Navarre + Don Thornton Jr.) |
| `contact.html` | On-site form posts to `/api/contact` (Resend). Request-list lines are included when present. |
| `cart.html` | Request list (localStorage). Email this request posts to `/api/contact`. Clear empties the list; a successful send does the same. No live payment. |
| `404.html` | Cloudflare Pages not-found page |
| `privacy.html` | Privacy policy |
| `copyright.html` | Copyright notice |

Shared styles: `css/styles.css`. Menu, year, home header scroll, Discover tabs, and shop filters: `js/site.js`. Request list: `js/cart.js`.

`/experimental` and `/product` redirect to Shop so old bookmarks do not 404.

## Honest stock

**Uintah Valley Pure Vanilla Extract (mainline) is out of stock indefinitely.** There is no live checkout. Don's Reserve batches can be added to a request list and emailed via the contact Function. Currently we can only sell to Utah residents.

## Discover section (home)

Under the hero: **Discover Premium Vanilla Extract** with two selectors.

- **Uintah Valley** — “This is our mainline product, made with locally distilled spirits and judiciously sourced Madagascar Vanilla.”
- **Don's Reserve** — collaboration with Don Thornton Jr.; Madagascar / Tahitian / Tahiti bottles.

Each tab shows three product cards. Mainline is sold out; Don's Reserve cards have Add to request. Shop uses the same catalog with All / Uintah Valley / Don's Reserve filters.

## Brand

Header uses the official color mark: SVG preferred, CLR PNG fallback (`assets/logo-color.svg` / `assets/logo-color.png`).

Palette from the logo: lime `#72a813`, forest `#5e8924` / `#2e6423` / `#144916`, cream `#fff6d2`, taupe `#777a69`. Display type is Quattrocento; body is Source Sans 3. Both families are self-hosted from `/assets/fonts/` (OFL).

Icons: `/assets/favicon-32.png` (tab), `/assets/favicon.svg`, `/assets/favicon-180.png` (apple-touch), `/favicon.ico` (root), `/assets/logo-square.png` (192×192 / OG).

## Hero photo

`assets/hero-home.jpg` **is** CAPT’s forested mountain still (evergreen valley, two snow-patched peaks, blue sky). That file is the only homepage hero background.

The homepage uses a full-bleed `<img class="hero-photo">` of `assets/hero-home.jpg` behind a transparent header. A full-width dark scrim keeps the giant cream wordmark readable while the top of the frame stays light enough for the dark nav.

The hero is one lockup: stacked Quattrocento lines **PURE** and **PREMIUM**, sized with `clamp()` / `vw` so each word spans the hero width. `assets/hero-product-plate.png` (orchid, beans, and bottles) sits centered on top of the type. The shop button stays under that composition. On load, PURE snaps on at 0.4s, PREMIUM at 0.8s, then the plate flies in from the right at 1.1s (CSS only, for every visitor).

## Local preview

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). Confirm the mountain photo sits behind the logo and nav, the Discover tabs swap copy and cards, and the footer credit is on every page. The contact form does not send from localhost or from any `*.pages.dev` host. Use `node --test tests/contact.test.mjs` to exercise the handler.

## Deploy

1. Cloudflare: **Workers & Pages → Pages**. Project `uintahvalley`.
2. Framework preset none. Output directory `/`.
3. Production branch is **`main`**.

`404.html` is the not-found page. `_redirects` and `_headers` stay in the project root.

Contact form secrets: see `CONTACT_FORM.md`. **`RESEND_API_KEY` must exist on Production** (and Preview). **`EMAIL_FROM` is required** (a verified sender such as `Uintah Valley <hello@uintahvalley.com>`). Optional: `EMAIL_TO` (a bare address such as `hello@uintahvalley.com`, never `To: …`).

Turnstile (set both on Production and Preview before relying on the form):

| Name | Type | Purpose |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` | Plain | Public site key. Pages read it from `GET /api/turnstile`. If it is empty, the widget stays hidden and the form shows that it is unavailable. |
| `TURNSTILE_SECRET_KEY` | Secret | Server-side Siteverify only. Never put this in the page. |

If `TURNSTILE_SECRET_KEY` is missing or blank, `POST /api/contact` sends **no** email and returns 503: “The contact form is temporarily unavailable. Please email hello@uintahvalley.com.” Preview behaves the same way when its site key and secret are empty. After the secret is set, a missing or invalid token is rejected and nothing is sent. A passing token emails the owner the real message and emails the visitor only this fixed note: “Thanks for contacting Uintah Valley. We received your message and will reply soon.” plus `https://uintahvalley.com`.

`POST /api/contact` is refused on every `*.pages.dev` host, including `uintahvalley.pages.dev` and branch or hash previews. The browser no longer retries that host. Preview URLs can still show the pages, but they cannot send the form. Test the handler with `node --test`.

### Turnstile widget

1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. Name it `Uintah Valley contact`. Add hostname **`uintahvalley.com`**. `www` redirects to the apex, so the widget runs there. Do not add `uintahvalley.pages.dev`, preview hosts, or `localhost`.
3. Widget mode: **Managed**.
4. Copy the site key into `TURNSTILE_SITE_KEY` and the secret into `TURNSTILE_SECRET_KEY` on the Pages project (**Settings → Environment variables**, Production and Preview).
5. Retry the deployment after saving them. Do not merge or treat the form as live until both values are set.
6. On the **uintahvalley.com** zone, skip Bot Fight / WAF challenges for `POST /api/contact` and `GET /api/turnstile` so those paths return JSON.

The widget action is `contact`. Siteverify must return `success` and a hostname of `uintahvalley.com` or `www.uintahvalley.com`.

### WAF rate limit

This project has no rate-limit binding. An in-memory counter would not be shared across isolates, so the Function does not throttle. Add a rule on the **uintahvalley.com** zone: **Security → WAF → Rate limiting rules**. Match URI Path equals `/api/contact` and method POST, for example 10 requests per minute per IP, action Block. `*.pages.dev` is not on that zone; the Function rejects those POSTs instead of accepting them outside the rule.

### Content Security Policy and bot scripts

HTML responses get their CSP from `functions/_middleware.js`, including a new `script-src` nonce on each HTML response. `_headers` does not set CSP, so it cannot publish a second policy without that nonce. `script-src` stays `'self'`, the nonce, and `https://challenges.cloudflare.com`. There is no `unsafe-inline`.

Cloudflare Bot Fight Mode injects an inline script and loads `/cdn-cgi/challenge-platform/…`. That path is same-origin, so `script-src 'self'` allows it. For the inline script, [JavaScript Detections](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/) says Cloudflare copies a CSP nonce from the response header onto the script it injects. A nonce in a `<meta>` tag is not supported. Bot Fight Mode cannot turn JavaScript Detections off. Do not add `'unsafe-inline'` to `script-src`.

If the zone uses Super Bot Fight Mode instead, JavaScript Detections is optional: **Security → Settings**, filter **Bot traffic**, edit **JS detections**, and turn it off only if you do not want the injection. That is not required for this CSP.

Tests: `node --test tests/contact.test.mjs tests/middleware.test.mjs tests/seo.test.mjs`.

## Footer

Every page keeps the SS Argus credit, a simple © Uintah Valley LLC line, and Privacy and Copyright links.

Homemade product, sold for home use, not for resale; prepared without state or local inspection; contains alcohol.
