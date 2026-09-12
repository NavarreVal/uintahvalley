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
  return new Response(JSON.stringify(body), {
    status: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
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

export function onRequestOptions({ request }) {
  const origin = request.headers.get("Origin") || "";
  if (!allowedOrigin(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin") || "";
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

  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim();
  const notes = String(data.notes || data.message || "").trim();
  const requestList = String(data.requestList || data.request_list || "").trim();

  if (!isEmail(email)) {
    return json(400, { ok: false, error: "Please enter a valid email." }, origin);
  }
  if (!notes) {
    return json(400, { ok: false, error: "Please write a short message." }, origin);
  }

  const key = env && env.RESEND_API_KEY;
  if (!key) {
    return json(503, { ok: false, error: "Email is not configured yet." }, origin);
  }

  const to = (env.EMAIL_TO || DEFAULT_TO).trim();
  const from = (env.EMAIL_FROM || DEFAULT_FROM).trim();
  const subject = "Uintah Valley contact from " + (name || "the site");
  const text = [
    name ? "Name: " + name : "Name: (not given)",
    "Email: " + email,
    "",
    notes,
    requestList ? "\n" + requestList : ""
  ].filter(Boolean).join("\n");

  const resend = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: from,
      to: [to],
      reply_to: email,
      subject: subject,
      text: text
    })
  });

  if (!resend.ok) {
    return json(502, { ok: false, error: "Could not send that message. Try again or email hello@uintahvalley.com." }, origin);
  }

  return json(200, { ok: true }, origin);
}
