import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contentSecurityPolicy } from "../functions/_middleware.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function html(name) {
  return readFileSync(join(root, name), "utf8");
}

const CANONICAL = {
  "index.html": "https://uintahvalley.com/",
  "shop.html": "https://uintahvalley.com/shop",
  "about.html": "https://uintahvalley.com/about",
  "contact.html": "https://uintahvalley.com/contact",
  "privacy.html": "https://uintahvalley.com/privacy",
  "copyright.html": "https://uintahvalley.com/copyright",
  "cart.html": "https://uintahvalley.com/cart"
};

test("indexable pages use one extensionless canonical and the same og:url", function () {
  Object.keys(CANONICAL).forEach(function (name) {
    const page = html(name);
    const href = CANONICAL[name];
    const canonical = page.match(/<link rel="canonical" href="([^"]+)">/g);
    assert.deepEqual(canonical, ['<link rel="canonical" href="' + href + '">'], name);
    assert.match(page, new RegExp('<meta property="og:url" content="' + href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '">'));
    assert.equal(page.includes(href + ".html"), false, name);
  });
});

test("cart is noindex and 404 is noindex without a canonical", function () {
  const cart = html("cart.html");
  assert.match(cart, /<meta name="robots" content="noindex">/);
  const missing = html("404.html");
  assert.match(missing, /<meta name="robots" content="noindex">/);
  assert.equal(missing.includes('rel="canonical"'), false);
});

test("internal page links stay on the .html files", function () {
  const home = html("index.html");
  ["shop.html", "about.html", "contact.html", "cart.html", "index.html"].forEach(function (href) {
    assert.equal(home.includes('href="' + href + '"'), true, href);
  });
});

test("sitemap lists the indexable extensionless URLs and not cart or 404", function () {
  const xml = readFileSync(join(root, "sitemap.xml"), "utf8");
  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(function (match) {
    return match[1];
  });
  assert.deepEqual(locs, [
    "https://uintahvalley.com/",
    "https://uintahvalley.com/shop",
    "https://uintahvalley.com/about",
    "https://uintahvalley.com/contact",
    "https://uintahvalley.com/privacy",
    "https://uintahvalley.com/copyright"
  ]);
  assert.equal(xml.includes("cart"), false);
  assert.equal(xml.includes("404"), false);
  const dates = xml.match(/<lastmod>[^<]+<\/lastmod>/g);
  assert.equal(dates.length, locs.length);
  dates.forEach(function (date) {
    assert.equal(date, "<lastmod>2026-10-31</lastmod>");
  });
});

test("robots.txt points crawlers at the sitemap", function () {
  const text = readFileSync(join(root, "robots.txt"), "utf8");
  assert.match(text, /Sitemap: https:\/\/uintahvalley\.com\/sitemap\.xml/);
});

test("security headers allow this site and Turnstile only", function () {
  const headers = readFileSync(join(root, "_headers"), "utf8");
  assert.match(headers, /Strict-Transport-Security: max-age=31536000; includeSubDomains/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(headers, /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)/);
  assert.equal(headers.includes("Content-Security-Policy:"), false);
  assert.equal(headers.includes("pages.dev"), false);
  const csp = contentSecurityPolicy("abc+/=xyz");
  assert.match(csp, /script-src 'self' 'nonce-abc\+\/=xyz' https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /font-src 'self'/);
  assert.match(csp, /style-src 'self'/);
  assert.equal(csp.includes("unsafe-inline"), false);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.equal(csp.includes("pages.dev"), false);
  assert.match(csp, /img-src 'self' data:/);
  assert.equal(csp.includes("youtube"), false);
  assert.equal(csp.includes("fonts.google"), false);
  const cart = readFileSync(join(root, "js/cart.js"), "utf8");
  const site = readFileSync(join(root, "js/site.js"), "utf8");
  assert.equal(cart.includes("pages.dev"), false);
  assert.equal(site.includes("pages.dev"), false);
});

test("pages keep scripts and styles in files", function () {
  [
    "index.html",
    "shop.html",
    "about.html",
    "contact.html",
    "cart.html",
    "privacy.html",
    "copyright.html",
    "404.html"
  ].forEach(function (name) {
    const page = html(name);
    assert.equal(/<script(?![^>]*\bsrc=)/i.test(page), false, name);
    assert.equal(/\son[a-z]+\s*=/i.test(page), false, name);
    assert.equal(/\sstyle\s*=/i.test(page), false, name);
  });
  ["contact.html", "cart.html"].forEach(function (name) {
    const page = html(name);
    assert.match(page, /data-turnstile/);
    assert.match(page, /js\/turnstile\.js/);
    assert.match(page, /maxlength="254"/);
    assert.match(page, /maxlength="2000"/);
  });
  assert.match(html("contact.html"), /name="name"[^>]*maxlength="100"/);
  const turnstile = readFileSync(join(root, "js/turnstile.js"), "utf8");
  const urls = turnstile.match(/https?:\/\/[^"'\\\s]+/g) || [];
  assert.deepEqual(urls, ["https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]);
});

test("_redirects still points old product URLs at shop and the license record stays", function () {
  const redirects = readFileSync(join(root, "_redirects"), "utf8");
  assert.match(redirects, /\/experimental\.html\s+\/shop\.html\s+302/);
  assert.match(redirects, /\/experimental\s+\/shop\.html\s+302/);
  assert.match(redirects, /\/product\.html\s+\/shop\.html\s+302/);
  assert.match(redirects, /\/product\s+\/shop\.html\s+302/);
  const licenses = readFileSync(join(root, "IMAGE-LICENSES.md"), "utf8");
  assert.match(licenses, /Shutterstock/);
});
