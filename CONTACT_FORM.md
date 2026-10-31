# Contact form (Resend + Pages Function)

The Contact page and the Request list “Email this request” modal both post to `POST /api/contact` (`functions/api/contact.js`). They do **not** open the visitor’s email client.

A request-list submit must include `requestList` as an array of `{ id, qty }` from `UVCart.requestItems()` (at most 20 lines). Each `id` has to be a product in the server catalog, and each `qty` is an integer from 1 to 99. The Function rebuilds the lines the owner sees from that catalog. A free-text `requestList` is rejected. Notes may be empty when the array has items; the inbound subject is then `Uintah Valley request list from …`. The optional modal message is extra notes, not a substitute for the item lines. After `{ ok: true }`, the request list is cleared in this browser; the success status stays in the modal until Cancel or overlay dismiss.

The visitor confirmation is not a copy of the form. It is sent only after Turnstile Siteverify passes, and the body is only: “Thanks for contacting Uintah Valley. We received your message and will reply soon.” plus `https://uintahvalley.com`. Name, notes, and request lines stay in the owner email.

`POST /api/contact` requires an `Origin` header. Allowed values are `https://uintahvalley.com` and `https://www.uintahvalley.com`. Missing, `http://`, `*.pages.dev`, and any other host are rejected. The request host must not be `*.pages.dev` either: `uintahvalley.pages.dev` and preview hosts return 403 and send nothing. Field caps: name 100, email 254 (a simple `local@domain.tld`, with no comma, semicolon, angle brackets, quotes, parentheses, brackets, backslash, or whitespace), message 2000. A body over 16 KB is rejected.

If `TURNSTILE_SECRET_KEY` is unset, the handler returns 503 and the error “The contact form is temporarily unavailable. Please email hello@uintahvalley.com.” Nothing is sent. An empty `TURNSTILE_SITE_KEY` hides the widget and the page shows that same message. Preview with both values empty behaves the same way. Preview hosts cannot submit the form at all.

`POST /api/contact` always returns JSON (`{ ok: true }` or `{ ok: false, error: "…" }`). A bare Cloudflare `error code: 502` (non-JSON) means the Function did not run.

## CAPT still needs (dashboard)

Code cannot finish the send if Resend has not verified the domain:

1. **Resend → Domains → add and verify `uintahvalley.com`**, then send from `Uintah Valley <hello@uintahvalley.com>` to `hello@uintahvalley.com`.
2. Set **`EMAIL_FROM`** to that verified sender. The Function does not substitute another from-address. Until the domain is verified, set **`EMAIL_TO`** to the Resend account inbox (the address a dashboard test send works to).
3. **`RESEND_API_KEY`** on Pages **Production** (not only Preview). Re-paste if it was copied with quotes. Retry the Production deployment after any secret change.
4. Optional: **`CONTACT_DEBUG=1`** on Production until mail works, then unset it.
5. Zone **uintahvalley.com** → skip Bot Fight / WAF for `POST /api/contact` so the apex is not an HTML challenge.

## Production secret (required)

`RESEND_API_KEY` **must exist on Production**, not only Preview. Set it in **Cloudflare Pages → uintahvalley → Settings → Environment variables**, environment **Production**. Also set it on Preview if you test preview URLs.

| Name | Type | Production | Preview | Value |
| --- | --- | --- | --- | --- |
| `RESEND_API_KEY` | Secret | **Required** | Required to send from preview | From Resend |
| `EMAIL_TO` | Plain (optional) | Optional | Optional | `hello@uintahvalley.com` (bare address only — never `To: …`) |
| `EMAIL_FROM` | Plain | **Required** | **Required** | `Uintah Valley <hello@uintahvalley.com>` |
| `CONTACT_DEBUG` | Plain (optional) | Leave unset | Optional | `1` to include a non-sensitive Resend status/message in JSON errors |
| `TURNSTILE_SITE_KEY` | Plain | Set with the secret | Set with the secret | Public site key. `GET /api/turnstile` returns `{ siteKey }`. Empty hides the widget. |
| `TURNSTILE_SECRET_KEY` | Secret | Set with the site key | Set with the site key | Siteverify secret. If unset, nothing is sent and the form returns 503. |

`EMAIL_TO` must be a **bare address** (`hello@uintahvalley.com`). Never set it to `To: hello@uintahvalley.com` — Resend rejects a `To:` prefix.

## Turnstile

1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. Hostname: `uintahvalley.com` only. Do not add `uintahvalley.pages.dev`, preview hosts, or `localhost`.
3. Mode: **Managed**. Create the widget.
4. Put the site key in `TURNSTILE_SITE_KEY` and the secret in `TURNSTILE_SECRET_KEY` (Production and Preview). Retry the deployment.
5. The pages load Turnstile only from `https://challenges.cloudflare.com/turnstile/v0/api.js`. Both forms use widget action `contact`.
6. Siteverify checks `success`, action `contact`, and hostname `uintahvalley.com` or `www.uintahvalley.com`. The client IP sent to Siteverify is `CF-Connecting-IP`.

If `TURNSTILE_SECRET_KEY` is missing, nothing is sent. The response is 503 with “The contact form is temporarily unavailable. Please email hello@uintahvalley.com.” If the secret is set, a missing or failed token returns “Please complete the security check and try again.” and nothing is sent.

## Rate limit

No in-app throttle: this project has no rate-limit binding, and a memory counter would not hold across isolates. On the **uintahvalley.com** zone, add **Security → WAF → Rate limiting rules** for `POST` `/api/contact` (for example 10 requests per minute per IP, action Block). `POST /api/contact` on `*.pages.dev` is rejected by the Function, so that host is not an unmetered backup.

Also skip Bot Fight / WAF challenges for `POST /api/contact` and `GET /api/turnstile`, or the apex answers with HTML instead of JSON.

`EMAIL_FROM` must use a domain verified in Resend. Do not commit API keys.

The Function trims `RESEND_API_KEY` (quotes, `Bearer ` prefix, BOM/newlines). The sender is `EMAIL_FROM` only. If `EMAIL_FROM` is missing, the Function returns HTTP 500 (`Email sender is not configured.`) and does not send.

`EMAIL_FROM` must be a verified Resend sender, such as `Uintah Valley <hello@uintahvalley.com>`. There is no placeholder from-address. Until `uintahvalley.com` is verified, a key that works in the Resend dashboard (to your own inbox) will still fail here if `EMAIL_TO` is `hello@uintahvalley.com`.

Set `CONTACT_DEBUG=1` on Production to put a non-secret `detail` on JSON errors (`reason`, `hint`, from-addresses tried, Resend status/name/message, key length/`re_` prefix only). The form appends that text so CAPT can read it in the browser. Leave it unset once mail works.

After changing Production secrets, **retry the latest Production deployment** so the Function picks up the new values.

If `RESEND_API_KEY` is missing while Turnstile is configured, the form returns JSON 503 (`Email is not configured yet.`) and tells the visitor to write `hello@uintahvalley.com` directly. A missing `TURNSTILE_SECRET_KEY` is a different 503: nothing is sent, and the error is “The contact form is temporarily unavailable. Please email hello@uintahvalley.com.”

## Custom domain vs pages.dev

`uintahvalley.com` is a Cloudflare zone with Bot Fight / managed challenge. `uintahvalley.pages.dev` is not. That is why apex can return a bare `error code: 502` or HTML “Just a moment…” while pages.dev still runs the Function.

**Required dashboard skip** so curl and the Function on the apex work:

1. Cloudflare Dashboard → the **uintahvalley.com** zone (not only the Pages project).
2. Security → Bots (and WAF / custom rules if present).
3. Skip or disable the challenge for `POST /api/contact` and `GET /api/turnstile` (or the whole `/api/*` path).
4. If the zone orange-clouds a record that points at Pages, either grey-cloud it or use the Pages custom-domain target so zone rules do not sit in front of Functions.

The browser posts only to same-origin `/api/contact`. It does not fall back to `uintahvalley.pages.dev`.

## Deploy shape

`functions/api/contact.js` is the contact route. `functions/_middleware.js` runs for every path (`_routes.json` include `/*`) so it can redirect duplicate hosts and hide non-site files. Tests live in `tests/` so Pages does not treat `*.mjs` under `functions/` as Functions.

- `www.uintahvalley.com` and the production host `uintahvalley.pages.dev` 301 to `https://uintahvalley.com` with the same path and query. Preview hosts (`*.uintahvalley.pages.dev`) are not redirected; their responses get `X-Robots-Tag: noindex`.
- `/api/contact` is not redirected on any host. The handler returns 403 JSON for a pages.dev POST. A 301 on that POST would turn it into a GET.
- `functions/_middleware.js` still catches contact-handler throws and returns JSON.
- Non-site files (`*.md`, `/tests/`, dotfiles, and repo-root config such as `_routes.json`) return 404. `IMAGE-LICENSES.md` stays in the repo.
- `_redirects` has no `/*` splat (that can intercept the API on the custom domain).

```bash
node --test tests/contact.test.mjs tests/middleware.test.mjs tests/seo.test.mjs
```

## If the form shows “unexpected response”

The browser shows that when `/api/contact` is not JSON.

| Response | Meaning |
| --- | --- |
| JSON `{ ok: true }` | Mail accepted |
| JSON 503 | `RESEND_API_KEY` missing on that environment |
| JSON 502 | Function ran; Resend rejected the send. Set `CONTACT_DEBUG=1` and retry — `detail.reason` / `detail.hint` name the Resend restriction |
| HTML “Just a moment…” / challenge | Bot Fight / WAF is challenging `POST /api/contact` — skip that path |
| `text/plain` `error code: 502` | Function did not run (zone rules in front of Pages, or a Function crash) |
