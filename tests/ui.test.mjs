import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(name) {
  return readFileSync(join(root, name), "utf8");
}

function articles(page) {
  return page.split("<article").slice(1).map(function (chunk) {
    const end = chunk.indexOf("</article>");
    return end === -1 ? chunk : chunk.slice(0, end);
  });
}

const STEPS = [
  "Add Items to your request list.",
  "Email the request. No payment info on the site.",
  "We reply with availability, a confirmed total, and how to pay."
];

const QUESTIONS = [
  "Why only Utah?",
  "Do I pay on this site?",
  "Does it contain alcohol?",
  "What's in it?",
  "Can I order the mainline Pure Vanilla Extract?",
  "Are the prices final?"
];

test("home and shop show the three ordering steps and Utah residents only", function () {
  ["index.html", "shop.html"].forEach(function (name) {
    const page = read(name);
    assert.match(page, /id="order-how-title">How ordering works/);
    assert.match(page, /class="order-how-utah">Utah residents only/);
    assert.match(page, /<ol class="order-steps">/);
    STEPS.forEach(function (step) {
      assert.equal(page.includes(step), true, name + " " + step);
    });
  });
});

test("shop and contact share a native FAQ and skip the marquee", function () {
  const shop = read("shop.html");
  const contact = read("contact.html");
  [shop, contact].forEach(function (page) {
    assert.match(page, /<section class="section faq"/);
    assert.equal((page.match(/<details class="faq-item">/g) || []).length, QUESTIONS.length);
    QUESTIONS.forEach(function (question) {
      assert.match(page, new RegExp("<summary>" + question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "</summary>"));
    });
    assert.match(page, /a11ypros/);
    assert.equal(page.includes("<marquee"), false);
    assert.equal(page.includes("class=\"marquee"), false);
  });
  assert.equal(read("index.html").includes("<marquee"), false);
});

test("shop filter stays a pressed-button group with true counts", function () {
  const shop = read("shop.html");
  const mainline = (shop.match(/data-line="mainline"/g) || []).length;
  const reserve = (shop.match(/data-line="dons-reserve"/g) || []).length;
  assert.equal(mainline, 3);
  assert.equal(reserve, 3);
  assert.match(shop, /data-shop-filter/);
  assert.match(shop, /data-filter="all"[^>]*aria-pressed="true"[^>]*>All <span class="filter-count">6<\/span>/);
  assert.match(shop, /data-filter="mainline"[^>]*aria-pressed="false"[^>]*>Uintah Valley <span class="filter-count">3<\/span>/);
  assert.match(shop, /data-filter="dons-reserve"[^>]*aria-pressed="false"[^>]*>Don's Reserve <span class="filter-count">3<\/span>/);
  assert.equal(mainline + reserve, 6);
});

test("spotlight is only on Don's Reserve cards", function () {
  ["index.html", "shop.html"].forEach(function (name) {
    articles(read(name)).forEach(function (article) {
      const spot = article.includes("spotlight-card");
      const reserve = article.includes("product-dons-");
      const mainline = article.includes("product-mainline") || article.includes("gift-box.jpg");
      if (spot) assert.equal(reserve, true, name);
      if (mainline) assert.equal(spot, false, name);
    });
  });
  const home = read("index.html");
  assert.equal((home.match(/spotlight-card/g) || []).length, 3);
  assert.equal((read("about.html").match(/spotlight-card/g) || []).length, 0);
});

test("discover and founder cards can reveal, and the hero still animates", function () {
  const home = read("index.html");
  assert.equal((home.match(/class="product-card reveal/g) || []).length, 6);
  assert.equal((read("about.html").match(/class="founder-card reveal"/g) || []).length, 2);
  const css = read("css/styles.css");
  assert.match(css, /@keyframes hero-appear/);
  assert.match(css, /animation-name:\s*hero-appear/);
  assert.match(css, /animation-name:\s*hero-plate-in/);
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  assert.equal(reduced.includes("hero-appear"), false);
  assert.equal(reduced.includes("hero-plate"), false);
  assert.match(reduced, /\.reveal\.reveal-pending/);
  assert.match(reduced, /cart-count\.is-pulsing/);
  const site = read("js/site.js");
  assert.match(site, /IntersectionObserver/);
  assert.match(site, /prefers-reduced-motion: reduce/);
  assert.match(site, /pointer: coarse/);
});

test("add confirmation, empty picks, and sent summary stay in the cart script", function () {
  const cart = read("js/cart.js");
  assert.match(cart, /Added to your request list/);
  assert.match(cart, /is-pulsing/);
  assert.match(cart, /Your request list is empty\./);
  assert.match(cart, /empty-cart-picks/);
  assert.match(cart, /What happens next/);
  assert.match(cart, /We reply with availability, a confirmed total, and how to pay\./);
  assert.match(cart, /data-cart-root/);
  assert.match(cart, /data-request-status/);
  assert.match(cart, /Request sent\. We will reply by email\./);
  ["dons-madagascar-dented-brick", "dons-tahitian-barbarosi", "dons-tahiti-five-wives"].forEach(function (id) {
    assert.equal(cart.includes(id), true, id);
  });
  assert.equal(cart.includes("setAttribute(\"style\""), false);
  assert.equal(cart.includes("pages.dev"), false);
  assert.equal(read("js/site.js").includes("setAttribute(\"style\""), false);
});

test("attribution comments stay with the ported pieces", function () {
  const css = read("css/styles.css");
  assert.match(css, /Df12345677/);
  assert.match(css, /uiverse\.io\/Df12345677\/black-rat-82/);
  assert.match(css, /00Kubi/);
  assert.match(css, /uiverse\.io\/00Kubi\/smooth-termite-31/);
  assert.match(css, /MIT License/);
  assert.match(css, /reactbits\.dev\/components\/spotlight-card/);
  assert.match(css, /David Haz/);
  assert.match(css, /Commons Clause/);
  assert.match(css, /a11ypros/);
  assert.match(read("js/site.js"), /reactbits\.dev\/components\/spotlight-card/);
});
