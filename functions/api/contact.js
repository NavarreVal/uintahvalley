const DEFAULT_TO = "hello@uintahvalley.com";
const DEFAULT_FROM = "Uintah Valley <hello@uintahvalley.com>";
const FALLBACK_FROM = "Uintah Valley <beth.t@example.com>";
const FALLBACK_FROM_BARE = "beth.t@example.com";

function allowedOrigin(origin) {
  if (!origin) return "";
  try {
    const { hostname, protocol } = new URL(origin);
    const https = protocol === "https:" || protocol === "http:";
    if (!https) return "";
    if (hostname === "uintahvalley.com" || hostname === "www.uintahvalley.com") return origin;
    if (hostname.endsWith(".pages.dev")) return origin;
    if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
    return "";
  } catch (err) {
    return "";
  }
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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function debugOn(env) {
  return !!(env && env.CONTACT_DEBUG === "1");
}

async function readPayload(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const data = await request.json();
    return data && typeof data === "object" ? data : {};
  }
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await request.formData();
    const data = {};
    form.forEach(function (value, key) {
      data[key] = typeof value === "string" ? value : "";
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
  const seen = {};
  const list = [];
  [preferred, FALLBACK_FROM, FALLBACK_FROM_BARE].forEach(function (from) {
    if (from && !seen[from]) {
      seen[from] = true;
      list.push(from);
    }
  });
  return list;
}

function debugHint(attempts, to) {
  const blob = attempts.map(function (item) {
    return String(item.message || "") + " " + String(item.name || "");
  }).join(" ").toLowerCase();
  if (blob.indexOf("not verified") !== -1 || blob.indexOf("domain") !== -1) {
    return "Verify uintahvalley.com in Resend, or leave EMAIL_FROM unset so the Function retries beth.t@example.com.";
  }
  if (blob.indexOf("testing") !== -1 || blob.indexOf("own email") !== -1) {
    return "beth.t@example.com can only send to the Resend account inbox until uintahvalley.com is verified. Set EMAIL_TO to that inbox, or verify the domain and send from hello@.";
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

function confirmationText(name, notes, requestList) {
  const who = name || "there";
  const echo = notes.length > 280 ? notes.slice(0, 277) + "…" : notes;
  const lines = [
    "Hi " + who + ",",
    "",
    requestList
      ? "We got your request list. Thanks for writing Uintah Valley — we will reply by email."
      : "We got your message. Thanks for writing Uintah Valley — we will reply by email.",
    "Currently we can only sell to Utah residents.",
    ""
  ];
  if (echo) {
    lines.push("Your message:", echo, "");
  }
  if (requestList) {
    lines.push(requestList, "");
  }
  lines.push("Uintah Valley", "hello@uintahvalley.com");
  return lines.join("\n");
}

export function prepareContact(data) {
  const name = String((data && data.name) || "").trim();
  const email = String((data && data.email) || "").trim();
  const notes = String((data && (data.notes || data.message)) || "").trim();
  const requestList = String((data && (data.requestList || data.request_list)) || "").trim();

  if (!isEmail(email)) {
    return { error: "Please enter a valid email." };
  }
  if (!notes && !requestList) {
    return { error: "Please write a short message." };
  }

  const subject = requestList
    ? "Uintah Valley request list from " + (name || email || "the site")
    : "Uintah Valley contact from " + (name || "the site");

  const text = [
    name ? "Name: " + name : "Name: (not given)",
    "Email: " + email,
    "",
    notes,
    requestList ? "\n" + requestList : ""
  ].filter(Boolean).join("\n");

  return { name, email, notes, requestList, subject, text };
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
    return new Response(null, { status: 204 });
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
  if (origin && !allowedOrigin(origin)) {
    return json(403, { ok: false, error: "Forbidden." }, origin);
  }

  let data;
  try {
    data = await readPayload(request);
  } catch (err) {
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
  const { name, email, notes, requestList, subject, text } = prepared;

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

  const to = String(env.EMAIL_TO || DEFAULT_TO).trim();
  const from = String(env.EMAIL_FROM || DEFAULT_FROM).trim();
  const candidates = fromCandidates(from);

  let inbound = { status: 0, id: "", name: "", message: "" };
  let usedFrom = from;
  const attempts = [];
  try {
    for (let i = 0; i < candidates.length; i++) {
      inbound = await sendResend(key, {
        from: candidates[i],
        to: [to],
        reply_to: email,
        subject: subject,
        text: text
      });
      attempts.push({
        from: candidates[i],
        status: inbound.status,
        name: inbound.name,
        message: inbound.message
      });
      if (inbound.id) {
        usedFrom = candidates[i];
        break;
      }
      // Invalid API key will fail every from-address; stop. 403 can be an
      // unverified-domain / testing-recipient restriction — try the next from.
      if (inbound.status === 401) break;
    }
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
    try {
      await sendResend(key, {
        from: usedFrom,
        to: [email],
        subject: "We got your message — Uintah Valley",
        text: confirmationText(name, notes, requestList)
      });
    } catch (err) {
      // Primary mail already went out; do not fail the form.
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
