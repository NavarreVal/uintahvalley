import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequest, onRequestPost, prepareContact } from "../functions/api/contact.js";

test("rejects invalid email", function () {
  const result = prepareContact({ email: "not-an-email", notes: "Hello" });
  assert.equal(result.error, "Please enter a valid email.");
});

test("rejects empty notes without a request list", function () {
  const result = prepareContact({ email: "guest@example.com", notes: "  " });
  assert.equal(result.error, "Please write a short message.");
});

test("accepts empty notes when requestList is present and appends the list", function () {
  const requestList = [
    "Request list:",
    "- [Don's Reserve] Madagascar Beans · Dented Brick Craft Rum · 4 oz × 2  ($40 each, provisional)",
    "Provisional subtotal: $80"
  ].join("\n");
  const result = prepareContact({
    email: "guest@example.com",
    notes: "",
    requestList: requestList
  });
  assert.equal(result.error, undefined);
  assert.equal(result.subject, "Uintah Valley request list from guest@example.com");
  assert.match(result.text, /Email: guest@example.com/);
  assert.match(result.text, /Madagascar Beans · Dented Brick Craft Rum · 4 oz × 2/);
  assert.match(result.text, /Provisional subtotal: \$80/);
  assert.equal(result.text.includes(requestList), true);
});

test("keeps optional notes above the request list", function () {
  const requestList = "Request list:\n- [Don's Reserve] Tahiti Beans · Five Wives Vodka · 4 oz × 1  ($40 each, provisional)";
  const result = prepareContact({
    email: "guest@example.com",
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
    email: "ada@example.com",
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
    env: env || {}
  };
}

async function readJson(res) {
  const type = res.headers.get("Content-Type") || "";
  assert.match(type, /application\/json/);
  return JSON.parse(await res.text());
}

test("POST without RESEND_API_KEY returns JSON 503", async function () {
  const res = await onRequestPost(postContext({
    email: "guest@example.com",
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
      email: "guest@example.com",
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
      email: "guest@example.com",
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
      email: "guest@example.com",
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
