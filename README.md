# Uintah Valley

Static site for **Uintah Valley LLC** — homemade goods from a Utah kitchen. Vanilla is the current line. No build step. Meant for [Cloudflare Pages](https://developers.cloudflare.com/pages/) on **uintahvalley.com**.

## Branch status — read this first

| Branch | What it is |
| --- | --- |
| **`main`** | The **live** old storefront. Leave it alone. CAPT will cut over later. |
| **This branch** (`rebuild/v2` / `cursor/rebuild-v2-ground-up-080f`) | Ground-up rebuild. Preview and iterate here. **Do not merge to `main` until cutover.** |

Cloudflare Pages production should stay pointed at `main` until CAPT is ready to switch.

## Pages

Nav is only **Home / Shop / About / Contact**.

| File | Purpose |
| --- | --- |
| `index.html` | Full-bleed mountain hero behind the header, plus Discover tabs |
| `shop.html` | Vanilla line: mainline sold out; Experimental noted as request-only |
| `about.html` | Short LLC / Utah kitchen note (named for the valley; not “located in the Uintah Basin”) |
| `contact.html` | Mailto contact — no card checkout |
| `404.html` | Cloudflare Pages not-found page |

Shared styles: `css/styles.css`. Menu, year, home header scroll, and Discover tabs: `js/site.js`.

Old Experimental / product / cart routes redirect here so bookmarks do not 404 after preview deploys.

## Honest stock

**Uintah Valley Pure Vanilla Extract (mainline) is out of stock indefinitely.** There is no live checkout on this rebuild. Experimental batches can be requested by email.

## Discover section (home)

Under the hero: **Discover Premium Vanilla Extract** with two selectors.

- **Uintah Valley** — “This is our mainline product, made with locally distilled spirits and judiciously sourced Madagascar Vanilla.”
- **Experimental** — “These are extractives, methods, and beans we're trying out.”

Each tab shows three placeholder product cards. No fake buy buttons.

## Brand

Header uses the official color mark: SVG preferred, CLR PNG fallback (`assets/logo-color.svg` / `assets/logo-color.png`).

Palette from the logo: lime `#72a813`, forest `#5e8924` / `#2e6423` / `#144916`, cream `#fff6d2`, taupe `#777a69`. Display type is Quattrocento; body is Source Sans 3.

## Hero photo

`assets/hero-home.jpg` must be CAPT’s forested mountain still (evergreen valley, two snow-patched peaks, blue sky — **not** the Kamas Lake / Reids Peak alpine shot).

The homepage `<img class="hero-photo">` points only at `assets/hero-home.jpg`. No shutterstock bottle hero, no `landscape.jpg`, no CSS gradient standing in for the photo.

If this file is still the lake stand-in, the attachment did not land on the build VM — drop CAPT’s `hero-mountains.jpg` in as `assets/hero-home.jpg` and keep that filename.

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

## Footer

Every page keeps the SS Argus credit and a simple © Uintah Valley LLC line.

Homemade product, sold for home use, not for resale; prepared without state or local inspection; contains alcohol.
