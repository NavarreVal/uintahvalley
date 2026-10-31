const DEFAULT_TO = "hello@uintahvalley.com";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_NAME = 100;
const MAX_EMAIL = 254;
const MAX_NOTES = 2000;
const MAX_ITEMS = 20;
const MAX_QTY = 99;
const MAX_TOKEN = 2048;
const TURNSTILE_ACTION = "contact";
const VISITOR_SUBJECT = "Thanks for contacting Uintah Valley";
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Keep this aligned with PRODUCTS in js/cart.js. The owner email is rebuilt
// from this map so a visitor cannot put arbitrary text in the request list.
const PRODUCTS = {
  "vanilla-1oz": {
    name: "Pure Vanilla Extract",
    size: "1 fl oz",
    price: 12,
    line: "Uintah Valley"
  },
  "vanilla-3oz": {
    name: "Pure Vanilla Extract",
    size: "3 fl oz",
    price: 32,
    line: "Uintah Valley"
  },
  "gift-box": {
    name: "Uintah Valley Gift Box",
    size: "Gift set",
    price: 40,
    line: "Uintah Valley"
  },
  "dons-madagascar-dented-brick": {
    name: "Madagascar Beans · Dented Brick Craft Rum",
    size: "4 oz",
    price: 40,
    line: "Don's Reserve"
  },
  "dons-tahitian-barbarosi": {
    name: "Tahitian Barbarosi Spiced Rum",
    size: "4 oz",
    price: 40,
    line: "Don's Reserve"
  },
  "dons-tahiti-five-wives": {
    name: "Tahiti Beans · Five Wives Vodka",
    size: "4 oz",
    price: 40,
    line: "Don's Reserve"
  }
};

// One extra label only: https://<preview>.uintahvalley.pages.dev
const PREVIEW_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.uintahvalley\.pages\.dev$/;

function allowedOrigin(origin) {
  if (!origin || typeof origin !== "string" || origin.length > 200) return "";
  let url;
  try {
    url = new URL(origin);
  } catch (err) {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (url.username || url.password) return "";
  if (url.origin !== origin) return "";
  const host = url.hostname;
  if (
    host === "uintahvalley.com" ||
    host === "www.uintahvalley.com" ||
    host === "uintahvalley.pages.dev"
  ) {
    return url.origin;
  }
  if (PREVIEW_HOST.test(host)) return url.origin;
  return "";
}

export function turnstileHostnameOk(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
  if (
    host === "uintahvalley.com" ||
    host === "www.uintahvalley.com" ||
    host === "uintahvalley.pages.dev"
  ) {
    return true;
  }
  return PREVIEW_HOST.test(host);
}

function corsHeaders(origin) {
  const allow = allowedOrigin(origin);
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin"
  };
  if (allow) headers["Access-Control-Allow-Origin"] = allow;
  return headers;
}

function json(status, body, origin) {
  let payload = "{\"ok\":false,\"error\":\"Could not send that message. Try again or email hello@uintahvalley.com.\"}";
  try {
    payload = JSON.stringify(body);
  } catch (err) {
    status = status || 500;
  }
  return new Response(payload, {
    status: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

function fail(status, error, origin, env, detail) {
  const body = { ok: false, error: error };
  if (env && env.CONTACT_DEBUG === "1" && detail) {
    body.detail = detail;
  }
  return json(status, body, origin);
}

function isEmail(value) {
  const email = String(value || "").trim();
  if (!email || email.length > MAX_EMAIL) return false;
  if (/[\u0000-\u001F\u007F]/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function debugOn(env) {
  return !!(env && env.CONTACT_DEBUG === "1");
}

function codedError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function declaredBodyTooLarge(request) {
  const declared = request && request.headers ? request.headers.get("content-length") : "";
  if (declared == null || declared === "") return false;
  if (!/^\d+$/.test(declared)) return true;
  return Number(declared) > MAX_BODY_BYTES;
}

async function readBounded(request) {
  const body = request && request.body;
  if (!body || typeof body.getReader !== "function") {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) throw codedError("too-large");
    return raw;
  }
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      const value = step.value;
      const size = value ? value.byteLength : 0;
      total += size;
      if (total > MAX_BODY_BYTES) {
        try { await reader.cancel(); } catch (err) { /* already over the cap */ }
        throw codedError("too-large");
      }
      if (value) chunks.push(value);
    }
  } catch (err) {
    if (err && err.code === "too-large") throw err;
    throw codedError("bad-body");
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    merged.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function readPayload(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) {
    if (declaredBodyTooLarge(request) || !request.headers.get("content-length")) {
      throw codedError("too-large");
    }
    const form = await request.formData();
    const data = {};
    form.forEach(function (value, key) {
      data[key] = typeof value === "string" ? value : "";
    });
    return data;
  }
  const raw = await readBounded(request);
  if (type.includes("application/json")) {
    if (!raw) return {};
    try {
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (err) {
      throw codedError("bad-json");
    }
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    const data = {};
    new URLSearchParams(raw).forEach(function (value, key) {
      data[key] = value;
    });
    return data;
  }
  return {};
}

function resendMessage(payload, raw) {
  if (payload && typeof payload.message === "string") return payload.message;
  if (payload && payload.error && typeof payload.error.message === "string") return payload.error.message;
  if (payload && typeof payload.error === "string") return payload.error;
  if (typeof raw === "string" && raw) return raw.slice(0, 240);
  return "";
}

function resendName(payload) {
  if (payload && typeof payload.name === "string") return payload.name;
  if (payload && payload.error && typeof payload.error.name === "string") return payload.error.name;
  return "";
}

export function normalizeKey(value) {
  let key = String(value == null ? "" : value);
  key = key.replace(/^\uFEFF/, "");
  key = key.replace(/[\u200B-\u200D\uFEFF]/g, "");
  key = key.trim();
  if (
    (key.charAt(0) === '"' && key.charAt(key.length - 1) === '"') ||
    (key.charAt(0) === "'" && key.charAt(key.length - 1) === "'")
  ) {
    key = key.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(key)) {
    key = key.replace(/^bearer\s+/i, "").trim();
  }
  return key.replace(/[\r\n\t]+/g, "").trim();
}

function keyMeta(key) {
  return {
    present: !!key,
    length: key ? key.length : 0,
    prefix: key ? key.slice(0, 3) : ""
  };
}

function toHost(address) {
  const match = String(address || "").match(/@([^>\s]+)/);
  return match ? match[1] : "";
}

export function fromCandidates(preferred) {
  const from = String(preferred || "").trim();
  return from ? [from] : [];
}

function debugHint(attempts, to) {
  const blob = attempts.map(function (item) {
    return String(item.message || "") + " " + String(item.name || "");
  }).join(" ").toLowerCase();
  if (blob.indexOf("not verified") !== -1 || blob.indexOf("domain") !== -1) {
    return "Verify uintahvalley.com in Resend and set EMAIL_FROM to a sender on that domain.";
  }
  if (blob.indexOf("testing") !== -1 || blob.indexOf("own email") !== -1) {
    return "Resend rejected a testing-mode send. Verify uintahvalley.com, and set EMAIL_TO to an inbox that account can send to.";
  }
  if (blob.indexOf("api key") !== -1 || blob.indexOf("unauthorized") !== -1) {
    return "RESEND_API_KEY on this Pages environment is missing, quoted, or not the live key. Re-paste it on Production and retry the deployment.";
  }
  if (!attempts.length) {
    return "Function reached Resend with no usable response. Confirm Production RESEND_API_KEY and retry the deployment.";
  }
  if (toHost(to) === "uintahvalley.com") {
    return "Resend rejected the send. If the domain is unverified, set EMAIL_TO to the Resend account email or verify uintahvalley.com.";
  }
  return "";
}

function buildDebugDetail(key, to, from, attempts, extra) {
  const last = attempts && attempts.length ? attempts[attempts.length - 1] : null;
  const detail = {
    key: keyMeta(key),
    toHost: toHost(to),
    from: from || "",
    attempts: (attempts || []).map(function (item) {
      return {
        from: item.from,
        status: item.status,
        name: item.name || "",
        message: item.message || ""
      };
    }),
    reason: last && last.message ? last.message : (extra || "")
  };
  const hint = debugHint(attempts || [], to);
  if (hint) detail.hint = hint;
  if (extra && extra !== detail.reason) detail.extra = extra;
  return detail;
}

async function sendResend(key, payload) {
  const resend = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const raw = await resend.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch (err) {
    body = null;
  }
  return {
    status: resend.status,
    id: body && body.id ? body.id : "",
    name: resendName(body),
    message: resendMessage(body, raw)
  };
}

export function headerSafe(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function confirmationText() {
  return [
    "Thanks for contacting Uintah Valley. We received your message and will reply soon.",
    "",
    "https://uintahvalley.com"
  ].join("\n");
}

function money(n) {
  return "$" + Number(n).toFixed(2).replace(/\.00$/, "");
}

function parseQty(value) {
  let qty = value;
  if (typeof qty === "string" && /^[1-9][0-9]?$/.test(qty)) qty = Number(qty);
  if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return null;
  return qty;
}

function parseRequestList(value) {
  if (value == null || value === "") return { items: [] };
  if (typeof value === "string" || !Array.isArray(value)) {
    return { error: "Could not read that request list." };
  }
  if (value.length > MAX_ITEMS) return { error: "That request list is too long." };
  const items = [];
  const seen = new Set();
  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { error: "Could not read that request list." };
    }
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!Object.prototype.hasOwnProperty.call(PRODUCTS, id)) {
      return { error: "That request list has an item we don't sell." };
    }
    if (seen.has(id)) return { error: "That request list has a duplicate item." };
    const qty = parseQty(entry.qty);
    if (qty == null) return { error: "Quantity must be between 1 and 99." };
    seen.add(id);
    items.push({ id: id, qty: qty });
  }
  return { items: items };
}

function formatRequestList(items) {
  if (!items.length) return "";
  const lines = ["Request list:"];
  let subtotal = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const product = PRODUCTS[item.id];
    subtotal += product.price * item.qty;
    lines.push(
      "- [" + product.line + "] " + product.name + " · " + product.size +
      " × " + item.qty +
      "  (" + money(product.price) + " each, provisional)"
    );
  }
  lines.push("Provisional subtotal: " + money(subtotal));
  return lines.join("\n");
}

export function prepareContact(data) {
  const nameRaw = String((data && data.name) || "").trim();
  if (nameRaw.length > MAX_NAME) return { error: "Name is too long." };
  const name = headerSafe(nameRaw);

  const email = String((data && data.email) || "").trim();
  if (!isEmail(email)) return { error: "Please enter a valid email." };

  const notes = String((data && (data.notes || data.message)) || "").trim();
  if (notes.length > MAX_NOTES) return { error: "Message is too long." };

  const parsed = parseRequestList(data && (data.requestList != null ? data.requestList : data.request_list));
  if (parsed.error) return { error: parsed.error };
  const items = parsed.items;
  if (!notes && !items.length) return { error: "Please write a short message." };

  const requestList = formatRequestList(items);
  const safeEmail = headerSafe(email);
  const subject = items.length
    ? "Uintah Valley request list from " + (name || safeEmail || "the site")
    : "Uintah Valley contact from " + (name || "the site");

  const text = [
    name ? "Name: " + name : "Name: (not given)",
    "Email: " + safeEmail,
    "",
    notes,
    requestList ? "\n" + requestList : ""
  ].filter(Boolean).join("\n");

  return { name: name, email: safeEmail, notes: notes, items: items, requestList: requestList, subject: headerSafe(subject), text: text };
}

function turnstileSecret(env) {
  const raw = env && env.TURNSTILE_SECRET_KEY;
  if (typeof raw !== "string") return "";
  return raw.trim();
}

async function verifyTurnstile(request, env, token) {
  const secret = turnstileSecret(env);
  if (!secret) return { enforced: false, ok: false };

  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN) {
    return { enforced: true, ok: false };
  }

  const remoteip = request && request.headers ? (request.headers.get("CF-Connecting-IP") || "") : "";
  let result;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({
        secret: secret,
        response: token,
        remoteip: remoteip
      })
    });
    if (!response.ok) return { enforced: true, ok: false, unavailable: true };
    result = await response.json();
  } catch (err) {
    return { enforced: true, ok: false, unavailable: true };
  }

  if (!result || result.success !== true || result.action !== TURNSTILE_ACTION || !turnstileHostnameOk(result.hostname)) {
    return { enforced: true, ok: false };
  }
  return { enforced: true, ok: true };
}

export function onRequestOptions(context) {
  try {
    const request = context && context.request;
    const origin = request && request.headers ? request.headers.get("Origin") || "" : "";
    if (!allowedOrigin(origin)) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  } catch (err) {
    return new Response(null, { status: 403 });
  }
}

function requestOrigin(request) {
  try {
    return request && request.headers ? request.headers.get("Origin") || "" : "";
  } catch (err) {
    return "";
  }
}

export async function onRequestPost(context) {
  let origin = "";
  let env = {};
  try {
    const request = context && context.request;
    env = (context && context.env) || {};
    origin = requestOrigin(request);
    return await handleContactPost(request, env, origin);
  } catch (err) {
    return fail(
      500,
      "Could not send that message. Try again or email hello@uintahvalley.com.",
      origin,
      env,
      debugOn(env) ? String(err && err.message ? err.message : err) : ""
    );
  }
}

// Pages-compatible catch-all so GET/HEAD/etc. still return JSON, never a bare 502.
export async function onRequest(context) {
  let origin = "";
  let env = {};
  try {
    const request = context && context.request;
    env = (context && context.env) || {};
    origin = requestOrigin(request);
    const method = request && request.method ? String(request.method).toUpperCase() : "";
    if (method === "OPTIONS") return onRequestOptions(context);
    if (method === "POST") return await onRequestPost(context);
    return json(405, { ok: false, error: "Method not allowed." }, origin);
  } catch (err) {
    return fail(
      500,
      "Could not send that message. Try again or email hello@uintahvalley.com.",
      origin,
      env,
      debugOn(env) ? String(err && err.message ? err.message : err) : ""
    );
  }
}

async function handleContactPost(request, env, origin) {
  if (!allowedOrigin(origin)) {
    return json(403, { ok: false, error: "Forbidden." }, origin);
  }

  if (declaredBodyTooLarge(request)) {
    return json(413, { ok: false, error: "That message is too large." }, origin);
  }

  let data;
  try {
    data = await readPayload(request);
  } catch (err) {
    if (err && err.code === "too-large") {
      return json(413, { ok: false, error: "That message is too large." }, origin);
    }
    return json(400, { ok: false, error: "Could not read that form." }, origin);
  }

  const honeypot = String(data.company || data.website || data.hp || "").trim();
  if (honeypot) {
    return json(200, { ok: true }, origin);
  }

  const prepared = prepareContact(data);
  if (prepared.error) {
    return json(400, { ok: false, error: prepared.error }, origin);
  }
  const { email, subject, text } = prepared;

  const turnstile = await verifyTurnstile(request, env, data["cf-turnstile-response"]);
  if (turnstile.enforced && !turnstile.ok) {
    return json(
      turnstile.unavailable ? 503 : 400,
      {
        ok: false,
        error: turnstile.unavailable
          ? "The security check could not be completed. Try again in a moment."
          : "Please complete the security check and try again."
      },
      origin
    );
  }

  const key = normalizeKey(env.RESEND_API_KEY);
  if (!key) {
    if (debugOn(env)) {
      return fail(503, "Email is not configured yet.", origin, env, {
        key: keyMeta(""),
        hint: "RESEND_API_KEY is missing on this Pages environment (Production vs Preview). Add the secret and retry the deployment."
      });
    }
    return json(503, { ok: false, error: "Email is not configured yet." }, origin);
  }

  const to = headerSafe(env.EMAIL_TO || DEFAULT_TO);
  const from = headerSafe(env.EMAIL_FROM || "");
  const candidates = fromCandidates(from);
  if (!candidates.length) {
    return fail(
      500,
      "Email sender is not configured.",
      origin,
      env,
      debugOn(env)
        ? "EMAIL_FROM is missing on this Pages environment. Set it to a verified sender such as Uintah Valley <hello@uintahvalley.com>."
        : ""
    );
  }
  const sender = candidates[0];

  let inbound = { status: 0, id: "", name: "", message: "" };
  const attempts = [];
  try {
    inbound = await sendResend(key, {
      from: sender,
      to: [to],
      reply_to: email,
      subject: subject,
      text: text
    });
    attempts.push({
      from: sender,
      status: inbound.status,
      name: inbound.name,
      message: inbound.message
    });
  } catch (err) {
    const detail = debugOn(env)
      ? buildDebugDetail(key, to, from, attempts, "fetch to api.resend.com failed")
      : "";
    return fail(
      502,
      "Could not send that message. Try again or email hello@uintahvalley.com.",
      origin,
      env,
      detail
    );
  }

  if (inbound.id) {
    // Visitor mail only after Siteverify. The body is a fixed template.
    if (turnstile.ok) {
      try {
        await sendResend(key, {
          from: sender,
          to: [email],
          subject: VISITOR_SUBJECT,
          text: confirmationText()
        });
      } catch (err) {
        // Primary mail already went out; do not fail the form.
      }
    }
    return json(200, { ok: true }, origin);
  }

  const error = inbound.status === 401 || inbound.status === 403
    ? "Email is not configured correctly."
    : "Could not send that message. Try again or email hello@uintahvalley.com.";

  const detail = debugOn(env) ? buildDebugDetail(key, to, from, attempts) : "";
  if (debugOn(env)) {
    try {
      console.log("contact send failed", JSON.stringify(detail));
    } catch (err) {
      // ignore log failures
    }
  }
  return fail(502, error, origin, env, detail);
}

export { PRODUCTS };
