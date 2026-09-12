const FAIL = JSON.stringify({
  ok: false,
  error: "Could not send that message. Try again or email hello@uintahvalley.com."
});

function jsonError(status) {
  return new Response(FAIL, {
    status: status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

// Only /api/contact invokes Functions (_routes.json). Always return JSON if a handler throws.
export async function onRequest(context) {
  try {
    const response = await context.next();
    if (response) return response;
    return jsonError(500);
  } catch (err) {
    return jsonError(500);
  }
}
