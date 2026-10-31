import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { onRequest, onRequestPost, prepareContact, normalizeKey, fromCandidates, confirmationText, PRODUCTS, headerSafe } from "../functions/api/contact.js";
import { onRequest as onTurnstileRequest } from "../functions/api/turnstile.js";

test("rejects invalid email", function () {
  const result = prepareContact({ email: "not-an-email", notes: "Hello" });
  assert.equal(result.error, "Please enter a valid email.");
});

test("rejects empty notes without a request list", function () {
  const result = prepareContact({ email: "guest@uintahvalley.test", notes: "  " });
  assert.equal(result.error, "Please write a short message.");
});

test("accepts empty notes when request items are present and rebuilds the list from the catalog", function () {
  const result = prepareContact({
    email: "guest@uintahvalley.test",
    notes: "",
    requestList: [{ id: "dons-madagascar-dented-brick", qty: 2, name: "WIRE FRAUD http://evil.example" }]
  });
  assert.equal(result.error, undefined);
  assert.equal(result.subject, "Uintah Valley request list from guest@uintahvalley.test");
  assert.match(result.text, /Email: guest@uintahvalley.test/);
  assert.match(result.text, /Madagascar Beans · Dented Brick Craft Rum · 4 oz × 2/);
  assert.match(result.text, /Provisional subtotal: \$80/);
  assert.equal(result.text.includes("WIRE FRAUD"), false);
  assert.equal(result.text.includes("evil.example"), false);
});

test("keeps optional notes above the request list", function () {
  const result = prepareContact({
    email: "guest@uintahvalley.test",
    notes: "Please hold for Saturday pickup.",
    requestList: [{ id: "dons-tahiti-five-wives", qty: 1 }]
  });
  const notesAt = result.text.indexOf("Please hold for Saturday pickup.");
  const listAt = result.text.indexOf("Request list:");
  assert.ok(notesAt >= 0 && listAt > notesAt);
  assert.match(result.text, /Tahiti Beans · Five Wives Vodka/);
});

test("contact-only messages keep the contact subject", function () {
  const result = prepareContact({
    name: "Ada",
    email: "ada@uintahvalley.test",
    notes: "When is mainline back?"
  });
  assert.equal(result.subject, "Uintah Valley contact from Ada");
  assert.equal(result.text.includes("When is mainline back?"), true);
});

function postContext(body, env, headers) {
  return {
    request: new Request("https://uintahvalley.com/api/contact", {
      method: "POST",
      headers: Object.assign({
        "Content-Type": "application/json",
        Origin: "https://uintahvalley.com"
      }, headers || {}),
      body: JSON.stringify(body)
    }),
    env: Object.assign({
      EMAIL_FROM: "Uintah Valley <hello@uintahvalley.com>"
    }, env || {})
  };
}

async function readJson(res) {
  const type = res.headers.get("Content-Type") || "";
  assert.match(type, /application\/json/);
  return JSON.parse(await res.text());
}

test("POST without RESEND_API_KEY returns JSON 503", async function () {
  const res = await onRequestPost(postContext({
    email: "guest@uintahvalley.test",
    notes: "Hello"
  }));
  assert.equal(res.status, 503);
  const data = await readJson(res);
  assert.equal(data.ok, false);
  assert.equal(data.error, "Email is not configured yet.");
});

test("POST with invalid JSON still returns JSON", async function () {
  const res = await onRequestPost({
    request: new Request("https://uintahvalley.com/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://uintahvalley.com" },
      body: "{not-json"
    }),
    env: {}
  });
  assert.equal(res.status, 400);
  const data = await readJson(res);
  assert.equal(data.ok, false);
});

test("GET /api/contact returns JSON 405", async function () {
  const res = await onRequest({
    request: new Request("https://uintahvalley.com/api/contact", { method: "GET" }),
    env: {}
  });
  assert.equal(res.status, 405);
  const data = await readJson(res);
  assert.equal(data.ok, false);
  assert.equal(data.error, "Method not allowed.");
});

test("Resend success without Turnstile emails only the owner", async function () {
  const original = globalThis.fetch;
  const messages = [];
  globalThis.fetch = async function (url, opts) {
    assert.equal(String(url).includes("siteverify"), false);
    messages.push(JSON.parse(opts.body));
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  };
  try {
    const res = await onRequestPost(postContext({
      name: "Ada",
      email: "guest@uintahvalley.test",
      notes: "Hello from Ada"
    }, { RESEND_API_KEY: "re_test" }));
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.equal(data.ok, true);
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0].to, ["hello@uintahvalley.com"]);
    assert.equal(messages[0].reply_to, "guest@uintahvalley.test");
    assert.match(messages[0].text, /Hello from Ada/);
    assert.equal(messages[0].subject.includes("\n"), false);
    assert.equal(messages[0].subject.includes("\r"), false);
  } finally {
    globalThis.fetch = original;
  }
});

test("Resend 401 still returns JSON, never a bare 502", async function () {
  const original = globalThis.fetch;
  globalThis.fetch = async function () {
    return new Response(JSON.stringify({ message: "invalid" }), { status: 401 });
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello"
    }, { RESEND_API_KEY: "re_test" }));
    assert.equal(res.status, 502);
    const data = await readJson(res);
    assert.equal(data.ok, false);
    assert.equal(data.error, "Email is not configured correctly.");
  } finally {
    globalThis.fetch = original;
  }
});

test("Resend fetch throw still returns JSON", async function () {
  const original = globalThis.fetch;
  globalThis.fetch = async function () {
    throw new Error("network down");
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello"
    }, { RESEND_API_KEY: "re_test" }));
    assert.equal(res.status, 502);
    const data = await readJson(res);
    assert.equal(data.ok, false);
    assert.equal(typeof data.error, "string");
  } finally {
    globalThis.fetch = original;
  }
});

test("POST without EMAIL_FROM returns a server error and does not send", async function () {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async function () {
    called = true;
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello"
    }, { RESEND_API_KEY: "re_test", EMAIL_FROM: "" }));
    assert.equal(res.status, 500);
    const data = await readJson(res);
    assert.equal(data.ok, false);
    assert.equal(data.error, "Email sender is not configured.");
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("rejected sender is not retried with another address", async function () {
  const original = globalThis.fetch;
  const froms = [];
  globalThis.fetch = async function (url, opts) {
    const payload = JSON.parse(opts.body);
    froms.push(payload.from);
    return new Response(JSON.stringify({ message: "The uintahvalley.com domain is not verified." }), { status: 422 });
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello"
    }, { RESEND_API_KEY: "re_test", EMAIL_FROM: "Uintah Valley <hello@uintahvalley.com>" }));
    assert.equal(res.status, 502);
    const data = await readJson(res);
    assert.equal(data.ok, false);
    assert.deepEqual(froms, ["Uintah Valley <hello@uintahvalley.com>"]);
  } finally {
    globalThis.fetch = original;
  }
});

test("normalizeKey strips BOM, quotes, Bearer, and newlines", function () {
  assert.equal(normalizeKey("\uFEFF  Bearer re_test\n"), "re_test");
  assert.equal(normalizeKey("\"re_live\""), "re_live");
});

test("fromCandidates returns only the configured sender", function () {
  assert.deepEqual(
    fromCandidates("Uintah Valley <hello@uintahvalley.com>"),
    ["Uintah Valley <hello@uintahvalley.com>"]
  );
  assert.deepEqual(fromCandidates("  "), []);
  assert.deepEqual(fromCandidates(""), []);
});

test("403 on the configured sender is not retried", async function () {
  const original = globalThis.fetch;
  const froms = [];
  globalThis.fetch = async function (url, opts) {
    const payload = JSON.parse(opts.body);
    froms.push(payload.from);
    return new Response(JSON.stringify({
      name: "validation_error",
      message: "The uintahvalley.com domain is not verified."
    }), { status: 403 });
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello"
    }, { RESEND_API_KEY: "re_test" }));
    assert.equal(res.status, 502);
    const data = await readJson(res);
    assert.equal(data.ok, false);
    assert.equal(data.error, "Email is not configured correctly.");
    assert.deepEqual(froms, ["Uintah Valley <hello@uintahvalley.com>"]);
  } finally {
    globalThis.fetch = original;
  }
});

test("CONTACT_DEBUG=1 includes attempts, reason, and a config hint", async function () {
  const original = globalThis.fetch;
  globalThis.fetch = async function () {
    return new Response(JSON.stringify({
      name: "validation_error",
      message: "You can only send testing emails to your own email address."
    }), { status: 403 });
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello"
    }, { RESEND_API_KEY: "re_test", CONTACT_DEBUG: "1" }));
    assert.equal(res.status, 502);
    const data = await readJson(res);
    assert.equal(data.ok, false);
    assert.equal(typeof data.detail, "object");
    assert.equal(data.detail.key.present, true);
    assert.equal(data.detail.key.prefix, "re_");
    assert.equal(data.detail.toHost, "uintahvalley.com");
    assert.ok(data.detail.attempts.length >= 1);
    assert.match(data.detail.reason, /testing emails/);
    assert.match(data.detail.hint, /account inbox|verify/i);
  } finally {
    globalThis.fetch = original;
  }
});

test("trims Bearer prefix and whitespace on RESEND_API_KEY", async function () {
  const original = globalThis.fetch;
  let auth = "";
  globalThis.fetch = async function (url, opts) {
    auth = opts.headers.Authorization;
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello"
    }, { RESEND_API_KEY: "  Bearer re_test  " }));
    assert.equal(res.status, 200);
    assert.equal(auth, "Bearer re_test");
  } finally {
    globalThis.fetch = original;
  }
});

test("catalog ids in the handler match js/cart.js", function () {
  const cart = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../js/cart.js"), "utf8");
  const ids = [];
  const re = /"([a-z0-9-]+)": \{\s+id: "([a-z0-9-]+)"/g;
  let match;
  while ((match = re.exec(cart))) {
    assert.equal(match[1], match[2]);
    ids.push(match[1]);
  }
  assert.deepEqual(ids.sort(), Object.keys(PRODUCTS).sort());
});

test("strips CR and LF from the subject", function () {
  const result = prepareContact({
    name: "Ada\r\nBcc: evil@example.com",
    email: "ada@uintahvalley.test",
    notes: "When is mainline back?"
  });
  assert.equal(result.subject.includes("\n"), false);
  assert.equal(result.subject.includes("\r"), false);
  assert.equal(result.subject, "Uintah Valley contact from Ada Bcc: evil@example.com");
  assert.equal(headerSafe("a\nb"), "a b");
});

test("rejects oversized fields and a free-text request list", function () {
  assert.equal(prepareContact({
    name: "A".repeat(101),
    email: "ada@uintahvalley.test",
    notes: "Hello"
  }).error, "Name is too long.");
  assert.equal(prepareContact({
    email: "a".repeat(243) + "@example.com",
    notes: "Hello"
  }).error, "Please enter a valid email.");
  assert.equal(prepareContact({
    email: "a".repeat(242) + "@example.com",
    notes: "Hello"
  }).error, undefined);
  assert.equal(prepareContact({
    email: "ada@uintahvalley.test",
    notes: "A".repeat(2001)
  }).error, "Message is too long.");
  assert.equal(prepareContact({
    email: "ada@uintahvalley.test",
    notes: "Hello",
    requestList: "Please buy gift cards from this list"
  }).error, "Could not read that request list.");
  assert.equal(prepareContact({
    email: "ada@uintahvalley.test",
    notes: "Hello",
    requestList: [{ id: "not-a-product", qty: 1 }]
  }).error, "That request list has an item we don't sell.");
  assert.equal(prepareContact({
    email: "ada@uintahvalley.test",
    notes: "Hello",
    requestList: [{ id: "gift-box", qty: 0 }]
  }).error, "Quantity must be between 1 and 99.");
  assert.equal(prepareContact({
    email: "ada@uintahvalley.test",
    notes: "Hello",
    requestList: [{ id: "gift-box", qty: 100 }]
  }).error, "Quantity must be between 1 and 99.");
  assert.equal(prepareContact({
    email: "ada@uintahvalley.test",
    requestList: [{ id: "gift-box", qty: 99 }]
  }).error, undefined);
  const many = [];
  for (let i = 0; i < 21; i++) many.push({ id: "gift-box", qty: 1 });
  assert.equal(prepareContact({
    email: "ada@uintahvalley.test",
    notes: "Hello",
    requestList: many
  }).error, "That request list is too long.");
});

function originStatus(origin) {
  const headers = { "Content-Type": "application/json" };
  if (origin !== undefined) headers.Origin = origin;
  return onRequestPost({
    request: new Request("https://uintahvalley.pages.dev/api/contact", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ email: "guest@uintahvalley.test", notes: "Hello" })
    }),
    env: { EMAIL_FROM: "Uintah Valley <hello@uintahvalley.com>" }
  }).then(function (res) { return res.status; });
}

test("missing Origin is rejected and foreign origins are rejected", async function () {
  assert.equal(await originStatus(undefined), 403);
  assert.equal(await originStatus("https://evil.example"), 403);
  assert.equal(await originStatus("http://uintahvalley.com"), 403);
  assert.equal(await originStatus("https://notuintahvalley.pages.dev"), 403);
  assert.equal(await originStatus("https://uintahvalley.pages.dev.evil.example"), 403);
  assert.equal(await originStatus("https://a.b.uintahvalley.pages.dev"), 403);
  assert.equal(await originStatus("https://uintahvalley.com"), 503);
  assert.equal(await originStatus("https://www.uintahvalley.com"), 503);
  assert.equal(await originStatus("https://uintahvalley.pages.dev"), 503);
  assert.equal(await originStatus("https://cursor-seo.uintahvalley.pages.dev"), 503);
});

test("a declared oversized body is rejected before it is read", async function () {
  let read = false;
  const res = await onRequestPost({
    request: {
      headers: new Headers({
        "Content-Type": "application/json",
        "Content-Length": "20000",
        Origin: "https://uintahvalley.com"
      }),
      text: async function () { read = true; return ""; },
      body: { getReader: function () { read = true; throw new Error("read"); } }
    },
    env: { RESEND_API_KEY: "re_test", EMAIL_FROM: "Uintah Valley <hello@uintahvalley.com>" }
  });
  assert.equal(res.status, 413);
  const data = await readJson(res);
  assert.equal(data.error, "That message is too large.");
  assert.equal(read, false);
});

test("an oversized JSON body is rejected and nothing is sent", async function () {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async function () {
    called = true;
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "A".repeat(17000)
    }, { RESEND_API_KEY: "re_test" }));
    assert.equal(res.status, 413);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

function turnstileEnv(extra) {
  return Object.assign({
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "Uintah Valley <hello@uintahvalley.com>",
    TURNSTILE_SECRET_KEY: "turnstile-secret"
  }, extra || {});
}

function siteverifyResult(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

test("a valid Turnstile token sends the owner email and a fixed visitor template", async function () {
  const original = globalThis.fetch;
  const messages = [];
  let siteverify;
  globalThis.fetch = async function (url, opts) {
    const href = String(url);
    if (href === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
      const params = opts.body instanceof URLSearchParams ? opts.body : new URLSearchParams(String(opts.body));
      siteverify = {
        secret: params.get("secret"),
        response: params.get("response"),
        remoteip: params.get("remoteip")
      };
      return siteverifyResult({
        success: true,
        action: "contact",
        hostname: "uintahvalley.com"
      });
    }
    messages.push(JSON.parse(opts.body));
    return new Response(JSON.stringify({ id: "email_" + messages.length }), { status: 200 });
  };
  try {
    const res = await onRequestPost(postContext({
      name: "Ada",
      email: "guest@uintahvalley.test",
      notes: "Please call me about the Tahitian bottle",
      requestList: [{ id: "dons-tahitian-barbarosi", qty: 1 }],
      "cf-turnstile-response": "token-ok"
    }, turnstileEnv(), { "CF-Connecting-IP": "203.0.113.5" }));
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.equal(data.ok, true);
    assert.deepEqual(siteverify, {
      secret: "turnstile-secret",
      response: "token-ok",
      remoteip: "203.0.113.5"
    });
    assert.equal(messages.length, 2);
    assert.deepEqual(messages[0].to, ["hello@uintahvalley.com"]);
    assert.match(messages[0].text, /Please call me about the Tahitian bottle/);
    assert.match(messages[0].text, /Tahitian Barbarosi Spiced Rum/);
    assert.equal(messages[0].subject.includes("\n"), false);
    assert.deepEqual(messages[1].to, ["guest@uintahvalley.test"]);
    assert.equal(messages[1].subject, "Thanks for contacting Uintah Valley");
    assert.equal(messages[1].text, confirmationText());
    assert.equal(messages[1].text.includes("Ada"), false);
    assert.equal(messages[1].text.includes("Tahitian"), false);
    assert.equal(messages[1].text.includes("Please call"), false);
    assert.match(messages[1].text, /https:\/\/uintahvalley\.com/);
  } finally {
    globalThis.fetch = original;
  }
});

test("preview and pages.dev hostnames pass Siteverify and a foreign hostname does not", async function () {
  const original = globalThis.fetch;
  async function post(hostname) {
    const sent = [];
    globalThis.fetch = async function (url, opts) {
      if (String(url).includes("siteverify")) {
        return siteverifyResult({ success: true, action: "contact", hostname: hostname });
      }
      sent.push(JSON.parse(opts.body));
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    };
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello",
      "cf-turnstile-response": "token-ok"
    }, turnstileEnv()));
    return { status: res.status, sent: sent.length };
  }
  try {
    assert.deepEqual(await post("uintahvalley.pages.dev"), { status: 200, sent: 2 });
    assert.deepEqual(await post("branch.uintahvalley.pages.dev"), { status: 200, sent: 2 });
    assert.deepEqual(await post("www.uintahvalley.com"), { status: 200, sent: 2 });
    assert.deepEqual(await post("evil.example"), { status: 400, sent: 0 });
    assert.deepEqual(await post("notuintahvalley.pages.dev"), { status: 400, sent: 0 });
    assert.deepEqual(await post("localhost"), { status: 400, sent: 0 });
    globalThis.fetch = async function (url, opts) {
      if (String(url).includes("siteverify")) {
        return siteverifyResult({ success: true, action: "subscribe", hostname: "uintahvalley.com" });
      }
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    };
    const wrongAction = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello",
      "cf-turnstile-response": "token-ok"
    }, turnstileEnv()));
    assert.equal(wrongAction.status, 400);
  } finally {
    globalThis.fetch = original;
  }
});

test("a missing or invalid Turnstile token sends nothing", async function () {
  const original = globalThis.fetch;
  let resendCalls = 0;
  globalThis.fetch = async function (url) {
    if (String(url).includes("siteverify")) {
      return siteverifyResult({ success: false, "error-codes": ["invalid-input-response"] });
    }
    resendCalls += 1;
    return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
  };
  try {
    const missing = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello"
    }, turnstileEnv()));
    assert.equal(missing.status, 400);
    const missingBody = await readJson(missing);
    assert.equal(missingBody.error, "Please complete the security check and try again.");

    const invalid = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello",
      "cf-turnstile-response": "not-a-token"
    }, turnstileEnv()));
    assert.equal(invalid.status, 400);
    const invalidBody = await readJson(invalid);
    assert.equal(invalidBody.error, "Please complete the security check and try again.");
    assert.equal(resendCalls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("a Siteverify outage sends nothing", async function () {
  const original = globalThis.fetch;
  let resendCalls = 0;
  globalThis.fetch = async function (url) {
    if (String(url).includes("api.resend.com")) resendCalls += 1;
    throw new Error("siteverify down");
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello",
      "cf-turnstile-response": "token-ok"
    }, turnstileEnv()));
    assert.equal(res.status, 503);
    const data = await readJson(res);
    assert.match(data.error, /security check/i);
    assert.equal(resendCalls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("a filled honeypot does not send mail even when Turnstile is configured", async function () {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async function () {
    called = true;
    return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello",
      company: "Acme Spam",
      "cf-turnstile-response": "token-ok"
    }, turnstileEnv()));
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.equal(data.ok, true);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("GET /api/turnstile returns only the public site key", async function () {
  const res = await onTurnstileRequest({
    request: new Request("https://uintahvalley.com/api/turnstile"),
    env: { TURNSTILE_SITE_KEY: " site-key ", TURNSTILE_SECRET_KEY: "super-secret" }
  });
  assert.equal(res.status, 200);
  const data = await readJson(res);
  assert.deepEqual(data, { siteKey: "site-key" });
  assert.equal(JSON.stringify(data).includes("super-secret"), false);

  const empty = await onTurnstileRequest({
    request: new Request("https://uintahvalley.com/api/turnstile"),
    env: {}
  });
  assert.deepEqual(await readJson(empty), { siteKey: "" });

  const denied = await onTurnstileRequest({
    request: new Request("https://uintahvalley.com/api/turnstile", { method: "POST" }),
    env: { TURNSTILE_SITE_KEY: "site-key" }
  });
  assert.equal(denied.status, 405);
});
