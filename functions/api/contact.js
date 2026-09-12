const DEFAULT_TO = "hello@uintahvalley.com";
const DEFAULT_FROM = "Uintah Valley <hello@uintahvalley.com>";

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
  if (typeof raw === "string" && raw) return raw.slice(0, 200);
  return "";
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

  const key = env.RESEND_API_KEY;
  if (!key) {
    return json(503, { ok: false, error: "Email is not configured yet." }, origin);
  }

  const to = String(env.EMAIL_TO || DEFAULT_TO).trim();
  const from = String(env.EMAIL_FROM || DEFAULT_FROM).trim();

  let inbound;
  try {
    inbound = await sendResend(key, {
      from: from,
      to: [to],
      reply_to: [email],
      subject: subject,
      text: text
    });
  } catch (err) {
    return fail(
      502,
      "Could not send that message. Try again or email hello@uintahvalley.com.",
      origin,
      env,
      debugOn(env) ? "fetch failed" : ""
    );
  }

  if (inbound.id) {
    try {
      await sendResend(key, {
        from: from,
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

  return fail(502, error, origin, env, debugOn(env) ? {
    status: inbound.status,
    message: inbound.message
  } : "");
}
