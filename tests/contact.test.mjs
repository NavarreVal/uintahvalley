import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequest, onRequestPost, prepareContact, normalizeKey, fromCandidates } from "../functions/api/contact.js";

test("rejects invalid email", function () {
  const result = prepareContact({ email: "not-an-email", notes: "Hello" });
  assert.equal(result.error, "Please enter a valid email.");
});

test("rejects empty notes without a request list", function () {
  const result = prepareContact({ email: "guest@uintahvalley.test", notes: "  " });
  assert.equal(result.error, "Please write a short message.");
});

test("accepts empty notes when requestList is present and appends the list", function () {
  const requestList = [
    "Request list:",
    "- [Don's Reserve] Madagascar Beans · Dented Brick Craft Rum · 4 oz × 2  ($40 each, provisional)",
    "Provisional subtotal: $80"
  ].join("\n");
  const result = prepareContact({
    email: "guest@uintahvalley.test",
    notes: "",
    requestList: requestList
  });
  assert.equal(result.error, undefined);
  assert.equal(result.subject, "Uintah Valley request list from guest@uintahvalley.test");
  assert.match(result.text, /Email: guest@uintahvalley.test/);
  assert.match(result.text, /Madagascar Beans · Dented Brick Craft Rum · 4 oz × 2/);
  assert.match(result.text, /Provisional subtotal: \$80/);
  assert.equal(result.text.includes(requestList), true);
});

test("keeps optional notes above the request list", function () {
  const requestList = "Request list:\n- [Don's Reserve] Tahiti Beans · Five Wives Vodka · 4 oz × 1  ($40 each, provisional)";
  const result = prepareContact({
    email: "guest@uintahvalley.test",
    notes: "Please hold for Saturday pickup.",
    requestList: requestList
  });
  const notesAt = result.text.indexOf("Please hold for Saturday pickup.");
  const listAt = result.text.indexOf(requestList);
  assert.ok(notesAt >= 0 && listAt > notesAt);
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

function postContext(body, env) {
  return {
    request: new Request("https://uintahvalley.com/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
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

test("Resend success returns JSON ok true", async function () {
  const original = globalThis.fetch;
  globalThis.fetch = async function () {
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  };
  try {
    const res = await onRequestPost(postContext({
      email: "guest@uintahvalley.test",
      notes: "Hello"
    }, { RESEND_API_KEY: "re_test" }));
    assert.equal(res.status, 200);
    const data = await readJson(res);
    assert.equal(data.ok, true);
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
