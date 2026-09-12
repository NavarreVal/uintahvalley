# Contact form (Resend + Pages Function)

The Contact page and the Request list “Email this request” modal both post to `POST /api/contact` (`functions/api/contact.js`). They do **not** open the visitor’s email client.

A request-list submit must include `requestList` (the full cart summary from `UVCart.requestSummary()`). Notes may be empty when `requestList` is present; the inbound subject is then `Uintah Valley request list from …`. The optional modal message is extra notes, not a substitute for the item lines.

`POST /api/contact` always returns JSON (`{ ok: true }` or `{ ok: false, error: "…" }`). A bare Cloudflare `error code: 502` (non-JSON) means the Function did not run.

## CAPT still needs (dashboard)

Code cannot finish the send if Resend has not verified the domain:

1. **Resend → Domains → add and verify `uintahvalley.com`**, then send from `Uintah Valley <hello@uintahvalley.com>` to `hello@uintahvalley.com`.
2. Until that verify lands, either set **`EMAIL_TO`** to the Resend *account* inbox (the address a dashboard test send works to) or expect onboarding-from to reject `hello@`.
3. **`RESEND_API_KEY`** on Pages **Production** (not only Preview). Re-paste if it was copied with quotes. Retry the Production deployment after any secret change.
4. Optional: **`CONTACT_DEBUG=1`** on Production until mail works, then unset it.
5. Zone **uintahvalley.com** → skip Bot Fight / WAF for `POST /api/contact` so the apex is not an HTML challenge.

## Production secret (required)

`RESEND_API_KEY` **must exist on Production**, not only Preview. Set it in **Cloudflare Pages → uintahvalley → Settings → Environment variables**, environment **Production**. Also set it on Preview if you test preview URLs.

| Name | Type | Production | Preview | Value |
| --- | --- | --- | --- | --- |
| `RESEND_API_KEY` | Secret | **Required** | Required to send from preview | From Resend |
| `EMAIL_TO` | Plain (optional) | Optional | Optional | `hello@uintahvalley.com` (bare address only — never `To: …`) |
| `EMAIL_FROM` | Plain (optional) | Optional | Optional | `Uintah Valley <hello@uintahvalley.com>` |
| `CONTACT_DEBUG` | Plain (optional) | Leave unset | Optional | `1` to include a non-sensitive Resend status/message in JSON errors |

`EMAIL_TO` must be a **bare address** (`hello@uintahvalley.com`). Never set it to `To: hello@uintahvalley.com` — Resend rejects a `To:` prefix.

`EMAIL_FROM` must use a domain verified in Resend. Do not commit API keys.

The Function trims `RESEND_API_KEY` (quotes, `Bearer ` prefix, BOM/newlines). If Resend rejects `hello@uintahvalley.com` (unverified domain), it retries `Uintah Valley <beth.t@example.com>` and then bare `beth.t@example.com`.

**Resend testing limit:** `beth.t@example.com` can only send **to the email of the Resend account** until `uintahvalley.com` is verified. A key that works in the Resend dashboard (to your own inbox) will still fail here if `EMAIL_TO` is `hello@uintahvalley.com` and the domain is not verified.

Set `CONTACT_DEBUG=1` on Production to put a non-secret `detail` on JSON errors (`reason`, `hint`, from-addresses tried, Resend status/name/message, key length/`re_` prefix only). The form appends that text so CAPT can read it in the browser. Leave it unset once mail works.

After changing Production secrets, **retry the latest Production deployment** so the Function picks up the new values.

If the secret is missing, the form returns JSON 503 (`Email is not configured yet.`) and tells the visitor to write `hello@uintahvalley.com` directly.

## Custom domain vs pages.dev

`uintahvalley.com` is a Cloudflare zone with Bot Fight / managed challenge. `uintahvalley.pages.dev` is not. That is why apex can return a bare `error code: 502` or HTML “Just a moment…” while pages.dev still runs the Function.

**Required dashboard skip** so curl and the Function on the apex work:

1. Cloudflare Dashboard → the **uintahvalley.com** zone (not only the Pages project).
2. Security → Bots (and WAF / custom rules if present).
3. Skip or disable the challenge for `POST /api/contact` (or the whole `/api/*` path).
4. If the zone orange-clouds a record that points at Pages, either grey-cloud it or use the Pages custom-domain target so zone rules do not sit in front of Functions.

Until that skip exists, the site posts to `/api/contact` first, then retries `https://uintahvalley.pages.dev/api/contact` when the apex response is not JSON.

## Deploy shape

Only `functions/api/contact.js` is a Function route. Tests live in `tests/` so Pages does not treat `*.mjs` under `functions/` as Functions.

- `_routes.json` invokes Functions only for `/api/contact` (static pages stay static).
- `functions/_middleware.js` catches handler throws and still returns JSON.
- `_redirects` has no `/*` splat (that can intercept the API on the custom domain).

```bash
node --test tests/contact.test.mjs
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
