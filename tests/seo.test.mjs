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
  "terms.html": "https://uintahvalley.com/terms",
  "copyright.html": "https://uintahvalley.com/copyright",
  "cart.html": "https://uintahvalley.com/cart"
};

const PAGES = Object.keys(CANONICAL).concat(["404.html"]);

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

test("internal page links use the final extensionless URLs", function () {
  const files = PAGES.concat(["js/cart.js"]);
  files.forEach(function (name) {
    const page = name.endsWith(".js")
      ? readFileSync(join(root, name), "utf8")
      : html(name);
    const hrefs = page.match(/href="[^"]+"/g) || [];
    hrefs.forEach(function (href) {
      assert.equal(/\.html"/.test(href), false, name + " " + href);
    });
  });
  const home = html("index.html");
  ['href="/"', 'href="/shop"', 'href="/about"', 'href="/contact"', 'href="/cart"'].forEach(function (href) {
    assert.equal(home.includes(href), true, href);
  });
  assert.equal(home.includes('href="index.html"'), false);
  assert.equal(home.includes('href="/index"'), false);
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
    "https://uintahvalley.com/terms",
    "https://uintahvalley.com/copyright"
  ]);
  assert.equal(xml.includes(".html"), false);
  assert.equal(xml.includes("cart"), false);
  assert.equal(xml.includes("404"), false);
  const dates = {};
  xml.replace(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g, function (_, loc, date) {
    dates[loc] = date;
    return _;
  });
  locs.forEach(function (loc) {
    assert.equal(dates[loc], loc.endsWith("/terms") ? "2026-11-01" : "2026-10-31", loc);
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

test("html routes are private and uncached while assets stay public", function () {
  const text = readFileSync(join(root, "_headers"), "utf8");
  const blocks = [];
  let current = null;
  text.split(/\r?\n/).forEach(function (line) {
    if (!line || /^\s*#/.test(line)) return;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: {} };
      blocks.push(current);
      return;
    }
    const header = line.match(/^\s+([^:]+):\s*(.*)$/);
    if (current && header) current.headers[header[1]] = header[2];
  });

  function cacheControl(pathname) {
    const values = [];
    blocks.forEach(function (block) {
      const expression = new RegExp("^" + block.pattern.split("*").map(function (part) {
        return part.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      }).join(".*") + "$");
      if (expression.test(pathname) && block.headers["Cache-Control"]) {
        values.push(block.headers["Cache-Control"]);
      }
    });
    return values.join(", ");
  }

  ["/", "/index.html", "/shop", "/shop.html", "/about", "/about.html", "/contact", "/contact.html", "/cart", "/cart.html", "/privacy", "/privacy.html", "/terms", "/terms.html", "/copyright", "/copyright.html", "/404", "/404.html"].forEach(function (pathname) {
    assert.equal(cacheControl(pathname), "private, no-cache", pathname);
  });
  assert.equal(cacheControl("/assets/hero-home.jpg"), "public, max-age=604800");
  assert.equal(cacheControl("/assets/fonts/quattrocento-400.woff2"), "public, max-age=604800");
  assert.equal(cacheControl("/css/styles.css"), "");
  assert.equal(cacheControl("/js/site.js"), "");
  assert.equal(cacheControl("/js/cart.js"), "");
});

test("pages keep scripts and styles in files", function () {
  PAGES.concat(["404.html"]).forEach(function (name) {
    const page = html(name);
    assert.equal(/<script(?![^>]*\bsrc=)(?![^>]*\btype="application\/ld\+json")/i.test(page), false, name);
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

test("_redirects sends old product URLs to /shop in one 301 and the license record stays", function () {
  const redirects = readFileSync(join(root, "_redirects"), "utf8");
  assert.match(redirects, /\/experimental\.html\s+\/shop\s+301/);
  assert.match(redirects, /\/experimental\s+\/shop\s+301/);
  assert.match(redirects, /\/product\.html\s+\/shop\s+301/);
  assert.match(redirects, /\/product\s+\/shop\s+301/);
  const rules = redirects.split(/\r?\n/).filter(function (line) {
    return line && !/^\s*#/.test(line);
  });
  const ruleText = rules.join("\n");
  assert.equal(ruleText.includes("/shop.html"), false);
  assert.equal(ruleText.includes("302"), false);
  assert.equal(rules.some(function (line) { return line.includes("/*"); }), false);
  const licenses = readFileSync(join(root, "IMAGE-LICENSES.md"), "utf8");
  assert.match(licenses, /Shutterstock/);
});

test("the hero photo reserves its intrinsic size", function () {
  const home = html("index.html");
  assert.match(home, /<img class="hero-photo" src="assets\/hero-home\.jpg" width="2048" height="1365" alt="Forested mountain valley with snow-patched peaks under a blue sky">/);
  const css = readFileSync(join(root, "css/styles.css"), "utf8");
  assert.match(css, /\.hero-photo\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*cover/s);
});

function jsonLd(name) {
  const blocks = html(name).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  return blocks.map(function (block) {
    return JSON.parse(block.replace(/^<script type="application\/ld\+json">/, "").replace(/<\/script>$/, ""));
  });
}

test("organization JSON-LD uses the public logo and city only", function () {
  ["index.html", "about.html"].forEach(function (name) {
    const blocks = jsonLd(name);
    assert.equal(blocks.length, 1, name);
    const org = blocks[0];
    assert.equal(org["@context"], "https://schema.org");
    assert.equal(org["@type"], "Organization");
    assert.equal(org.name, "Uintah Valley LLC");
    assert.equal(org.url, "https://uintahvalley.com/");
    assert.equal(org.logo, "https://uintahvalley.com/assets/logo-square.png");
    assert.equal(org.email, "hello@uintahvalley.com");
    assert.deepEqual(Object.keys(org.address).sort(), ["@type", "addressLocality", "addressRegion"]);
    assert.equal(org.address["@type"], "PostalAddress");
    assert.equal(org.address.addressLocality, "Parowan");
    assert.equal(org.address.addressRegion, "Utah");
    assert.equal(JSON.stringify(org).includes("streetAddress"), false);
    assert.equal(/%|\bABV\b|\bproof\b/i.test(JSON.stringify(org)), false);
  });
  assert.match(html("about.html"), /based out of Parowan Utah/);
  assert.match(html("index.html"), /hello@uintahvalley.com/);
  assert.equal(jsonLd("shop.html")[0]["@type"], undefined);
});

test("shop JSON-LD matches the prices and sold-out state on the page", function () {
  const page = html("shop.html");
  const data = jsonLd("shop.html");
  assert.equal(data.length, 1);
  const graph = data[0]["@graph"];
  assert.equal(data[0]["@context"], "https://schema.org");
  const list = graph.find(function (node) { return node["@type"] === "ItemList"; });
  const products = graph.filter(function (node) { return node["@type"] === "Product"; });
  assert.equal(products.length, 6);
  assert.equal(list.numberOfItems, 6);
  assert.equal(list.itemListElement.length, 6);
  const cards = page.split("<article").slice(1).map(function (chunk) {
    const end = chunk.indexOf("</article>");
    return end === -1 ? chunk : chunk.slice(0, end);
  });
  assert.equal(cards.length, 6);
  cards.forEach(function (card, index) {
    const name = card.match(/<h3>([^<]+)<\/h3>/)[1];
    const description = card.match(/<p>([^<]+)<\/p>/)[1];
    const image = card.match(/src="(assets\/[^"]+)"/)[1];
    const product = products[index];
    assert.equal(product.name, name);
    assert.equal(product.description, description);
    assert.equal(product.image, "https://uintahvalley.com/" + image);
    assert.equal(product.url, "https://uintahvalley.com/shop");
    assert.equal(product.brand.name, "Uintah Valley");
    assert.equal(product.offers["@type"], "Offer");
    assert.equal(product.offers.url, "https://uintahvalley.com/shop");
    assert.equal(list.itemListElement[index].position, index + 1);
    assert.equal(list.itemListElement[index].item["@id"], product["@id"]);
    const soldOut = card.includes("Sold out indefinitely");
    const price = card.match(/class="price">\$([0-9]+)/);
    if (soldOut) {
      assert.equal(price, null, name);
      assert.equal(product.offers.availability, "https://schema.org/OutOfStock");
      assert.equal(Object.prototype.hasOwnProperty.call(product.offers, "price"), false, name);
      assert.equal(Object.prototype.hasOwnProperty.call(product.offers, "priceCurrency"), false, name);
    } else {
      assert.equal(price[1], "40", name);
      assert.equal(product.offers.availability, "https://schema.org/InStock");
      assert.equal(product.offers.price, 40);
      assert.equal(product.offers.priceCurrency, "USD");
    }
    assert.equal(/%|\bABV\b|\bproof\b/i.test(JSON.stringify(product)), false, name);
  });
  assert.equal(page.includes("streetAddress"), false);
});

test("terms gathers the existing request wording and stays generic", function () {
  const page = html("terms.html");
  [
    "Utah residents only",
    "Add items to your request list.",
    "Email the request. No payment info on the site.",
    "We reply with availability, a confirmed total, and how to pay.",
    "Currently we can only sell to Utah residents. This is a homemade food product for home use, not for resale, processed and prepared without state or local inspection, under Utah's cottage food program.",
    "There is no live checkout, and we won't ask for your payment info here.",
    "Sending a request is not a paid order.",
    "A request is not a purchase.",
    "Prices are provisional.",
    "Prices shown are provisional until confirmed in reply.",
    "Stored only in this browser.",
    "Some items are sold out for now and cannot be ordered here. Other items can still be requested.",
    "Homemade food product for home use. Not for resale. Processed and prepared without state or local inspection. Contains alcohol.",
    "Effective October 31, 2026",
    "reach out anyway",
    'Terms questions: <a href="mailto:hello@uintahvalley.com">hello@uintahvalley.com</a>.'
  ].forEach(function (line) {
    assert.equal(page.includes(line), true, line);
  });
  const visible = page.replace(/<!--[\s\S]*?-->/g, "");
  ["Don's Reserve", "mainline", "Pure Vanilla", "Madagascar", "Tahitian", "Dented Brick", "Five Wives", "Barbarosi", "Gift Box"].forEach(function (name) {
    assert.equal(visible.includes(name), false, name);
  });
  assert.equal(visible.includes("anyways"), false);
  assert.equal(visible.includes("sold out indefinitely"), false);
  assert.equal(/%|\bABV\b|\bproof\b/i.test(visible), false);
  assert.equal(page.includes('href="/terms" aria-current="page"'), true);
  PAGES.concat(["404.html"]).forEach(function (name) {
    assert.equal(html(name).includes('href="/terms"'), true, name);
  });
  ["shop.html", "contact.html", "cart.html"].forEach(function (name) {
    assert.equal(html(name).includes("reach out anyway"), true, name);
    assert.equal(html(name).includes("anyways"), false, name);
  });
  assert.equal(html("shop.html").includes("Sold out indefinitely"), true);
  const owners = page.match(/<!-- OWNER: [\s\S]*? -->/g) || [];
  assert.deepEqual(owners, ["<!-- OWNER: Returns, shipping, and cancellation will be added later. -->"]);
});
