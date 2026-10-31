function json(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function siteKeyFromEnv(env) {
  const raw = env && env.TURNSTILE_SITE_KEY;
  if (typeof raw !== "string") return "";
  return raw.trim();
}

export async function onRequestGet(context) {
  const env = (context && context.env) || {};
  return json(200, { siteKey: siteKeyFromEnv(env) });
}

export async function onRequest(context) {
  const request = context && context.request;
  const method = request && request.method ? String(request.method).toUpperCase() : "";
  if (method === "GET" || method === "HEAD") {
    const response = await onRequestGet(context);
    if (method === "HEAD") {
      return new Response(null, { status: response.status, headers: response.headers });
    }
    return response;
  }
  return json(405, { ok: false, error: "Method not allowed." });
}
