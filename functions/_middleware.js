const FAIL = JSON.stringify({
  ok: false,
  error: "Could not send that message. Try again or email hello@uintahvalley.com."
});

const APEX_ORIGIN = "https://uintahvalley.com";
const WWW_HOST = "www.uintahvalley.com";
const PRODUCTION_PAGES_HOST = "uintahvalley.pages.dev";

// HTML responses get a fresh script nonce so Cloudflare can stamp it onto the
// JavaScript Detections inline script. 'self' still allows /cdn-cgi/challenge-platform/.
export function contentSecurityPolicy(nonce) {
  const scriptSrc = nonce
    ? "script-src 'self' 'nonce-" + nonce + "' https://challenges.cloudflare.com"
    : "script-src 'self' https://challenges.cloudflare.com";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join("; ");
}

export function cspNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Repo-root names that are not site pages. The _* files are Pages config
// (usually not served). package.json and Wrangler files are not in this repo;
// blocking the names keeps them unpublished if they are added later.
const ROOT_BLOCKED = {
  "/_headers": true,
  "/_redirects": true,
  "/_routes.json": true,
  "/package.json": true,
  "/package-lock.json": true,
  "/yarn.lock": true,
  "/pnpm-lock.yaml": true,
  "/wrangler.toml": true,
  "/wrangler.json": true,
  "/wrangler.jsonc": true
};

function jsonError(status) {
  return new Response(FAIL, {
    status: status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function normalizeHost(hostname) {
  let host = String(hostname || "").toLowerCase();
  if (host.charAt(host.length - 1) === ".") host = host.slice(0, -1);
  return host;
}

function isRedirectHost(host) {
  return host === WWW_HOST || host === PRODUCTION_PAGES_HOST;
}

function isPreviewHost(host) {
  return host.endsWith("." + PRODUCTION_PAGES_HOST);
}

function isContactApi(pathname) {
  let path = String(pathname || "").toLowerCase();
  if (path.length > 1 && path.charAt(path.length - 1) === "/") path = path.slice(0, -1);
  return path === "/api/contact";
}

function normalizedPath(pathname) {
  let path = String(pathname || "/");
  for (let i = 0; i < 3; i++) {
    if (path.indexOf("%") === -1) break;
    try {
      const next = decodeURIComponent(path);
      if (next === path) break;
      path = next;
    } catch (err) {
      break;
    }
  }
  const parts = path.split(/[\\/]+/);
  const segments = [];
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i];
    if (!segment || segment === "." || segment === "..") {
      if (segment === "..") segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return "/" + segments.join("/");
}

function isHiddenPath(pathname) {
  const lower = normalizedPath(pathname).toLowerCase();
  const segments = lower.split("/");
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;
    if (segment.charAt(0) === ".") return true;
    if (segment.length >= 3 && segment.lastIndexOf(".md") === segment.length - 3) return true;
  }
  if (lower === "/tests" || lower.indexOf("/tests/") === 0) return true;
  if (lower === "/functions" || lower.indexOf("/functions/") === 0) return true;
  if (ROOT_BLOCKED[lower]) return true;
  return false;
}

function redirectToApex(url) {
  // Concatenate the already-parsed path. new URL(path, origin) would treat
  // a pathname of "//…" as a protocol-relative redirect off this host.
  const location = (APEX_ORIGIN + url.pathname + url.search).replace(/[\r\n]/g, "");
  return new Response(null, {
    status: 301,
    headers: { Location: location }
  });
}

function applyCsp(response) {
  if (!response) return response;
  let type = "";
  try {
    type = response.headers.get("Content-Type") || "";
  } catch (err) {
    type = "";
  }
  const nonce = /text\/html/i.test(type) ? cspNonce() : "";
  const policy = contentSecurityPolicy(nonce);
  try {
    response.headers.set("Content-Security-Policy", policy);
    return response;
  } catch (err) {
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", policy);
    const status = response.status;
    if (status === 101 || status === 204 || status === 205 || status === 304) {
      return new Response(null, { status: status, statusText: response.statusText, headers: headers });
    }
    return new Response(response.body, { status: status, statusText: response.statusText, headers: headers });
  }
}

function withPreviewRobots(response, host) {
  if (!response) return response;
  if (!isPreviewHost(host)) return applyCsp(response);
  try {
    response.headers.set("X-Robots-Tag", "noindex");
    return applyCsp(response);
  } catch (err) {
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex");
    const type = response.headers.get("Content-Type") || "";
    const nonce = /text\/html/i.test(type) ? cspNonce() : "";
    headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
    const status = response.status;
    if (status === 101 || status === 204 || status === 205 || status === 304) {
      return new Response(null, {
        status: status,
        statusText: response.statusText,
        headers: headers
      });
    }
    return new Response(response.body, {
      status: status,
      statusText: response.statusText,
      headers: headers
    });
  }
}

async function fetchNotFoundHtml(context) {
  const assets = context.env && context.env.ASSETS;
  if (!assets || typeof assets.fetch !== "function") return null;
  const paths = ["/404.html", "/404"];
  for (let i = 0; i < paths.length; i++) {
    const assetUrl = new URL(paths[i], context.request.url);
    let asset = await assets.fetch(new Request(assetUrl.toString(), { method: "GET" }));
    if (asset && (asset.status === 301 || asset.status === 302 || asset.status === 307 || asset.status === 308)) {
      const location = asset.headers.get("Location");
      if (!location) continue;
      const nextUrl = new URL(location, assetUrl);
      if (nextUrl.origin !== assetUrl.origin) continue;
      asset = await assets.fetch(new Request(nextUrl.toString(), { method: "GET" }));
    }
    if (asset && asset.status === 200) return asset;
  }
  return null;
}

async function notFoundResponse(context) {
  const security = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Frame-Options": "DENY"
  };
  try {
    const asset = await fetchNotFoundHtml(context);
    if (asset) {
      const headers = new Headers(asset.headers);
      if (!headers.get("Content-Type")) headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      Object.keys(security).forEach(function (name) {
        headers.set(name, security[name]);
      });
      return new Response(asset.body, { status: 404, headers: headers });
    }
  } catch (err) {
    // The site 404 page is optional; a plain 404 still hides the file.
  }
  return new Response("Not Found", {
    status: 404,
    headers: Object.assign({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }, security)
  });
}

async function continueRequest(context, host) {
  const path = new URL(context.request.url).pathname;
  if (isContactApi(path)) {
    try {
      const response = await context.next();
      if (response) return withPreviewRobots(response, host);
      return jsonError(500);
    } catch (err) {
      return jsonError(500);
    }
  }
  const response = await context.next();
  return withPreviewRobots(response, host);
}

// Host redirects, preview noindex, and dev-file 404s. _routes.json includes
// every path so this runs in front of static files. /api/contact is unchanged.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = normalizeHost(url.hostname);

  // Do not redirect /api/contact. The handler rejects pages.dev POSTs with
  // JSON. A 301 would turn that POST into a GET before the rejection.
  if (isRedirectHost(host) && !isContactApi(url.pathname)) {
    return redirectToApex(url);
  }

  if (isHiddenPath(url.pathname)) {
    return withPreviewRobots(await notFoundResponse(context), host);
  }

  return continueRequest(context, host);
}
