import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/_middleware.js";

function contextFor(url, options) {
  const opts = options || {};
  let nextCalls = 0;
  const context = {
    request: new Request(url, opts.init),
    env: opts.env || {},
    async next() {
      nextCalls += 1;
      if (opts.next) return opts.next(context);
      return new Response("ok", {
        status: 200,
        headers: { "Content-Type": "text/plain", "X-Test": "pass" }
      });
    }
  };
  context.nextCalls = function () {
    return nextCalls;
  };
  return context;
}

test("www host 301s to the apex with the same path and query", async function () {
  const context = contextFor("http://www.uintahvalley.com/shop?x=1&y=2");
  const res = await onRequest(context);
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("Location"), "https://uintahvalley.com/shop?x=1&y=2");
  assert.equal(context.nextCalls(), 0);
});

test("production pages.dev host 301s to the apex and forces https", async function () {
  const context = contextFor("http://uintahvalley.pages.dev/about.html");
  const res = await onRequest(context);
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("Location"), "https://uintahvalley.com/about.html");
  assert.equal(context.nextCalls(), 0);
});

test("a protocol-relative pathname stays on the apex host", async function () {
  const context = contextFor("https://www.uintahvalley.com//evil.example/phish");
  const res = await onRequest(context);
  assert.equal(res.status, 301);
  const location = res.headers.get("Location");
  assert.equal(new URL(location).hostname, "uintahvalley.com");
  assert.notEqual(new URL(location).hostname, "evil.example");
});

test("branch and hash preview hosts are not redirected and are noindex", async function () {
  const hosts = [
    "https://cursor-seo.uintahvalley.pages.dev/shop",
    "https://abc123def.uintahvalley.pages.dev/shop?q=1"
  ];
  for (let i = 0; i < hosts.length; i++) {
    const context = contextFor(hosts[i]);
    const res = await onRequest(context);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Location"), null);
    assert.equal(res.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(res.headers.get("X-Test"), "pass");
    assert.equal(context.nextCalls(), 1);
  }
});

test("apex, localhost, and unrelated hosts pass through with no noindex header", async function () {
  const hosts = [
    "https://uintahvalley.com/shop",
    "http://localhost:8788/shop",
    "https://notuintahvalley.pages.dev/shop"
  ];
  for (let i = 0; i < hosts.length; i++) {
    const context = contextFor(hosts[i]);
    const res = await onRequest(context);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("X-Robots-Tag"), null);
    assert.equal(context.nextCalls(), 1);
  }
});

test("POST /api/contact on production pages.dev is not redirected", async function () {
  let seen = "";
  const context = contextFor("https://uintahvalley.pages.dev/api/contact", {
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://uintahvalley.com" },
      body: JSON.stringify({ notes: "hello" })
    },
    async next(ctx) {
      seen = await ctx.request.text();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "https://uintahvalley.com"
        }
      });
    }
  });
  const res = await onRequest(context);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Location"), null);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://uintahvalley.com");
  assert.equal(seen, JSON.stringify({ notes: "hello" }));
});

test("POST /api/contact on www is not redirected", async function () {
  const context = contextFor("https://www.uintahvalley.com/api/contact/", {
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }
  });
  const res = await onRequest(context);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Location"), null);
  assert.equal(context.nextCalls(), 1);
});

test("a thrown contact handler still returns JSON", async function () {
  const context = contextFor("https://uintahvalley.com/api/contact", {
    init: { method: "POST", body: "{}" },
    next: async function () {
      throw new Error("boom");
    }
  });
  const res = await onRequest(context);
  assert.equal(res.status, 500);
  assert.match(res.headers.get("Content-Type"), /application\/json/);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.match(data.error, /hello@uintahvalley.com/);
});

test("an empty contact handler response still returns JSON", async function () {
  const context = contextFor("https://uintahvalley.com/api/contact", {
    next: async function () {
      return null;
    }
  });
  const res = await onRequest(context);
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.ok, false);
});

test("preview OPTIONS /api/contact keeps 204 and adds noindex", async function () {
  const context = contextFor("https://feature.uintahvalley.pages.dev/api/contact", {
    init: { method: "OPTIONS" },
    next: async function () {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" } });
    }
  });
  const res = await onRequest(context);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("X-Robots-Tag"), "noindex");
  assert.equal(res.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
});

test("dev files return 404 and do not call next", async function () {
  const paths = [
    "/README.md",
    "/readme.MD",
    "/IMAGE-LICENSES.md",
    "/CONTACT_FORM.md",
    "/docs/notes.md",
    "/tests/contact.test.mjs",
    "/tests",
    "/.gitignore",
    "/%2egitignore",
    "/README%2Emd",
    "/%252egitignore",
    "/.git/config",
    "/_headers",
    "/_redirects",
    "/_routes.json",
    "/package.json",
    "/wrangler.toml",
    "/functions/api/contact.js"
  ];
  for (let i = 0; i < paths.length; i++) {
    const context = contextFor("https://uintahvalley.com" + paths[i]);
    const res = await onRequest(context);
    assert.equal(res.status, 404, paths[i]);
    assert.equal(context.nextCalls(), 0, paths[i]);
    assert.match(res.headers.get("Content-Type"), /text\/plain/);
    assert.equal(await res.text(), "Not Found");
  }
});

test("www requests for hidden files redirect before the 404", async function () {
  const context = contextFor("https://www.uintahvalley.com/README.md?x=1");
  const res = await onRequest(context);
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("Location"), "https://uintahvalley.com/README.md?x=1");
});

test("hidden files on a preview host are 404 and noindex", async function () {
  const context = contextFor("https://abc123.uintahvalley.pages.dev/tests/contact.test.mjs");
  const res = await onRequest(context);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("X-Robots-Tag"), "noindex");
  assert.equal(context.nextCalls(), 0);
});

test("hidden files serve 404.html with status 404 when ASSETS has it", async function () {
  const html = "<!DOCTYPE html><title>Page not found | Uintah Valley</title>";
  const context = contextFor("https://uintahvalley.com/IMAGE-LICENSES.md", {
    env: {
      ASSETS: {
        async fetch(request) {
          const pathname = new URL(request.url).pathname;
          if (pathname === "/404.html") {
            return new Response(null, {
              status: 308,
              headers: { Location: "/404" }
            });
          }
          if (pathname === "/404") {
            return new Response(html, {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" }
            });
          }
          return new Response("missing", { status: 404 });
        }
      }
    }
  });
  const res = await onRequest(context);
  assert.equal(res.status, 404);
  assert.match(res.headers.get("Content-Type"), /text\/html/);
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("X-Frame-Options"), "DENY");
  assert.match(res.headers.get("Strict-Transport-Security"), /max-age=31536000; includeSubDomains/);
  const csp = res.headers.get("Content-Security-Policy");
  assert.match(csp, /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(csp.includes("pages.dev"), false);
  assert.equal(csp.includes("unsafe-inline"), false);
  assert.equal(await res.text(), html);
  assert.equal(context.nextCalls(), 0);
});

test("site assets and seo files are served", async function () {
  const paths = [
    "/",
    "/shop",
    "/shop.html",
    "/about",
    "/contact",
    "/cart",
    "/privacy",
    "/copyright",
    "/404.html",
    "/css/styles.css",
    "/js/site.js",
    "/js/cart.js",
    "/assets/fonts/Quattrocento-OFL.txt",
    "/assets/fonts/SourceSans3-OFL.txt",
    "/favicon.ico",
    "/sitemap.xml",
    "/robots.txt",
    "/experimental"
  ];
  for (let i = 0; i < paths.length; i++) {
    const context = contextFor("https://uintahvalley.com" + paths[i]);
    const res = await onRequest(context);
    assert.equal(res.status, 200, paths[i]);
    assert.equal(context.nextCalls(), 1, paths[i]);
  }
});

test("a normalized path out of /tests is not hidden", async function () {
  const context = contextFor("https://uintahvalley.com/tests/../shop");
  const res = await onRequest(context);
  assert.equal(res.status, 200);
  assert.equal(new URL(context.request.url).pathname, "/shop");
});

test("an encoded parent segment does not hide the shop page", async function () {
  const context = contextFor("https://uintahvalley.com/tests/%2e%2e/shop");
  const res = await onRequest(context);
  assert.equal(res.status, 200);
  assert.equal(context.nextCalls(), 1);
});
