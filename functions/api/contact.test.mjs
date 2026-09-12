import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareContact } from "./contact.js";

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
