# Contact form (Resend + Pages Function)

The Contact page posts to `POST /api/contact` (`functions/api/contact.js`). It does **not** open the visitor’s email client.

Set these in **Cloudflare Pages → Settings → Environment variables** for **Production and Preview**:

| Name | Type | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | From Resend |
| `EMAIL_TO` | Plain (optional) | `hello@uintahvalley.com` |
| `EMAIL_FROM` | Plain (optional) | `Uintah Valley <hello@uintahvalley.com>` |

`EMAIL_FROM` must use a domain verified in Resend. Do not commit API keys.

If the secret is missing, the form returns a configuration error and tells the visitor to write `hello@uintahvalley.com` directly.
