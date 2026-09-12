# Contact form (Resend + Pages Function)

The Contact page and the Request list “Email this request” modal both post to `POST /api/contact` (`functions/api/contact.js`). They do **not** open the visitor’s email client.

A request-list submit must include `requestList` (the full cart summary from `UVCart.requestSummary()`). Notes may be empty when `requestList` is present; the inbound subject is then `Uintah Valley request list from …`. The optional modal message is extra notes, not a substitute for the item lines.

Set these in **Cloudflare Pages → Settings → Environment variables** for **Production and Preview**:

| Name | Type | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | From Resend |
| `EMAIL_TO` | Plain (optional) | `hello@uintahvalley.com` |
| `EMAIL_FROM` | Plain (optional) | `Uintah Valley <hello@uintahvalley.com>` |
| `CONTACT_DEBUG` | Plain (optional) | `1` to include a non-sensitive Resend status/message in JSON errors |

`EMAIL_FROM` must use a domain verified in Resend. Do not commit API keys. Leave `CONTACT_DEBUG` unset in production unless diagnosing a send failure.

If the secret is missing, the form returns a configuration error and tells the visitor to write `hello@uintahvalley.com` directly.
