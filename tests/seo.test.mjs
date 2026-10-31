import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

test("robots.txt allows crawling and blocks the AI training crawlers", function () {
  const text = readFileSync(join(root, "robots.txt"), "utf8");
  assert.match(text, /^User-agent: \*\r?\nAllow: \/\r?\n/);
  assert.match(text, /Sitemap: https:\/\/uintahvalley\.com\/sitemap\.xml/);
  [
    "GPTBot",
    "CCBot",
    "Google-Extended",
    "ClaudeBot",
    "anthropic-ai",
    "Bytespider",
    "Applebot-Extended",
    "meta-externalagent"
  ].forEach(function (agent) {
    assert.match(text, new RegExp("User-agent: " + agent + "\\r?\\nDisallow: /"));
  });
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
