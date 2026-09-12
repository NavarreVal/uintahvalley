(function () {
  const PAGES_CONTACT = "https://uintahvalley.pages.dev/api/contact";

  function isCustomDomain() {
    const host = location.hostname;
    return host === "uintahvalley.com" || host === "www.uintahvalley.com";
  }

  function formatContactDetail(detail) {
    if (!detail) return "";
    if (typeof detail === "string") return detail;
    var reason = detail.reason || detail.message || "";
    if (!reason && detail.attempts && detail.attempts.length) {
      var last = detail.attempts[detail.attempts.length - 1];
      if (last && last.message) {
        reason = "Resend " + last.status + ": " + last.message;
      }
    }
    var hint = detail.hint || "";
    var parts = [];
    if (reason) parts.push(reason);
    if (hint) parts.push(hint);
    return parts.join(" ");
  }

  function parseContactResponse(res) {
    return res.text().then(function (text) {
      var data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (err) {
        return {
          ok: false,
          parsed: false,
          error: "The server returned an unexpected response. Write hello@uintahvalley.com."
        };
      }
      if (data && data.ok) return { ok: true, parsed: true };
      var extra = formatContactDetail(data && data.detail);
      return {
        ok: false,
        parsed: true,
        error: ((data && data.error) || "Could not send that message. Write hello@uintahvalley.com.") +
          (extra ? " " + extra : "")
      };
    });
  }

  function postContact(payload) {
    const body = JSON.stringify(payload);
    const headers = { "Content-Type": "application/json" };
    return fetch("/api/contact", { method: "POST", headers: headers, body: body })
      .then(parseContactResponse)
      .catch(function () {
        return {
          ok: false,
          parsed: false,
          error: "The server returned an unexpected response. Write hello@uintahvalley.com."
        };
      })
      .then(function (result) {
        if (result.ok || result.parsed || !isCustomDomain()) return result;
        return fetch(PAGES_CONTACT, { method: "POST", headers: headers, body: body })
          .then(parseContactResponse)
          .catch(function () {
            return result;
          });
      });
  }

  window.UVContact = { post: postContact };

  const STORAGE_KEY = "uintahvalley-cart-v1";
  const DEFAULT_REQUEST_NOTES = "Please review my request list.";
  const PRODUCTS = {
    "vanilla-1oz": {
      id: "vanilla-1oz",
      name: "Pure Vanilla Extract",
      size: "1 fl oz",
      price: 12,
      line: "mainline",
      available: false
    },
    "vanilla-3oz": {
      id: "vanilla-3oz",
      name: "Pure Vanilla Extract",
      size: "3 fl oz",
      price: 32,
      line: "mainline",
      available: false
    },
    "gift-box": {
      id: "gift-box",
      name: "Uintah Valley Gift Box",
      size: "Gift set",
      price: 40,
      line: "mainline",
      available: false
    },
    "dons-madagascar-dented-brick": {
      id: "dons-madagascar-dented-brick",
      name: "Madagascar Beans · Dented Brick Craft Rum",
      size: "4 oz",
      price: 40,
      line: "dons-reserve",
      available: true
    },
    "dons-tahitian-barbarosi": {
      id: "dons-tahitian-barbarosi",
      name: "Tahitian Barbarosi Spiced Rum",
      size: "4 oz",
      price: 40,
      line: "dons-reserve",
      available: true
    },
    "dons-tahiti-five-wives": {
      id: "dons-tahiti-five-wives",
      name: "Tahiti Beans · Five Wives Vodka",
      size: "4 oz",
      price: 40,
      line: "dons-reserve",
      available: true
    }
  };

  function isAvailable(product) {
    return !!(product && product.available);
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : { items: [] };
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      return {
        items: items.filter(function (item) {
          return isAvailable(PRODUCTS[item.id]);
        })
      };
    } catch (err) {
      return { items: [] };
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateCartCount();
  }

  function cartCount(cart) {
    return cart.items.reduce(function (sum, item) {
      return sum + Number(item.qty || 0);
    }, 0);
  }

  function cartTotal(cart) {
    return cart.items.reduce(function (sum, item) {
      const product = PRODUCTS[item.id];
      return sum + (product ? product.price * item.qty : 0);
    }, 0);
  }

  function money(n) {
    return "$" + Number(n).toFixed(2).replace(/\.00$/, "");
  }

  function lineLabel(product) {
    return product.line === "dons-reserve" ? "Don's Reserve" : "Uintah Valley";
  }

  function addItem(id, qty) {
    const product = PRODUCTS[id];
    if (!isAvailable(product)) {
      showToast("Uintah Valley Pure Vanilla Extract (mainline) is out of stock.");
      return;
    }
    const cart = loadCart();
    const nextQty = Math.max(1, parseInt(qty, 10) || 1);
    const existing = cart.items.find(function (item) { return item.id === id; });
    if (existing) {
      existing.qty += nextQty;
    } else {
      cart.items.push({ id: id, qty: nextQty });
    }
    saveCart(cart);
    showToast(product.name + " added to your request list.");
  }

  function setQty(id, qty) {
    if (!isAvailable(PRODUCTS[id])) return;
    const cart = loadCart();
    const nextQty = Math.max(0, parseInt(qty, 10) || 0);
    cart.items = cart.items
      .map(function (item) {
        return item.id === id ? { id: id, qty: nextQty } : item;
      })
      .filter(function (item) { return item.qty > 0; });
    saveCart(cart);
    renderCartPage();
  }

  function removeItem(id) {
    const cart = loadCart();
    cart.items = cart.items.filter(function (item) { return item.id !== id; });
    saveCart(cart);
    renderCartPage();
  }

  function updateCartCount() {
    const count = cartCount(loadCart());
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = String(count);
    });
  }

  function showToast(message) {
    var toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.tid);
    showToast.tid = window.setTimeout(function () {
      toast.classList.remove("show");
    }, 2600);
  }

  function cartHasItems() {
    return loadCart().items.length > 0;
  }

  function syncRequestMailButton() {
    const empty = !cartHasItems();
    document.querySelectorAll("[data-request-mail]").forEach(function (btn) {
      btn.disabled = empty;
      btn.setAttribute("aria-disabled", empty ? "true" : "false");
    });
    document.querySelectorAll("[data-request-empty-hint]").forEach(function (el) {
      el.hidden = !empty;
    });
  }

  function renderCartPage() {
    const root = document.querySelector("[data-cart-root]");
    if (!root) return;
    const cart = loadCart();
    saveCart(cart);
    if (!cart.items.length) {
      root.innerHTML =
        '<div class="empty-cart">' +
        "<p>Your request list is empty.</p>" +
        '<p><a class="btn btn-primary" href="shop.html#dons-reserve">Browse Don\'s Reserve</a></p>' +
        "</div>";
      syncRequestMailButton();
      return;
    }

    const rows = cart.items.map(function (item) {
      const product = PRODUCTS[item.id];
      if (!product) return "";
      return (
        "<tr>" +
        "<td>" + product.name +
        "<div class='fine'><span class='pill'>Don's Reserve</span> " + product.size + "</div></td>" +
        "<td>" + money(product.price) + "</td>" +
        "<td><input data-qty='" + product.id + "' type='number' min='1' max='24' value='" + item.qty + "' aria-label='Quantity for " + product.name + "'></td>" +
        "<td>" + money(product.price * item.qty) + "</td>" +
        "<td><button class='btn' type='button' data-remove='" + product.id + "'>Remove</button></td>" +
        "</tr>"
      );
    }).join("");

    root.innerHTML =
      '<table class="cart-table">' +
      "<thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Line</th><th></th></tr></thead>" +
      "<tbody>" + rows + "</tbody>" +
      "<tfoot><tr><td colspan='3'>Provisional subtotal</td><td colspan='2'>" + money(cartTotal(cart)) + "</td></tr></tfoot>" +
      "</table>";

    root.querySelectorAll("[data-qty]").forEach(function (input) {
      input.addEventListener("change", function () {
        setQty(input.getAttribute("data-qty"), input.value);
      });
    });
    root.querySelectorAll("[data-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        removeItem(button.getAttribute("data-remove"));
      });
    });

    syncRequestMailButton();
  }

  document.addEventListener("click", function (event) {
    const addBtn = event.target.closest("[data-add]");
    if (!addBtn) return;
    event.preventDefault();
    if (addBtn.disabled || addBtn.getAttribute("aria-disabled") === "true") return;
    const id = addBtn.getAttribute("data-add");
    const scope = addBtn.closest(".product-buy, .product-card, .card, form") || document;
    const qtyField = scope.querySelector("[data-add-qty]");
    addItem(id, qtyField ? qtyField.value : 1);
  });

  function requestSummary() {
    const cart = loadCart();
    if (!cart.items.length) return "";
    const lines = ["Request list:"];
    cart.items.forEach(function (item) {
      const product = PRODUCTS[item.id];
      if (!product) return;
      lines.push(
        "- [" + lineLabel(product) + "] " + product.name + " · " + product.size +
        " × " + item.qty +
        "  (" + money(product.price) + " each, provisional)"
      );
    });
    lines.push("Provisional subtotal: " + money(cartTotal(cart)));
    return lines.join("\n");
  }

  const requestOverlay = document.querySelector("[data-request-modal]");
  const requestForm = document.querySelector("[data-request-form]");
  const requestStatus = requestForm ? requestForm.querySelector("[data-request-status]") : null;
  const requestSubmit = requestForm ? requestForm.querySelector("[type='submit']") : null;
  let requestLastFocus = null;

  function requestFocusables() {
    if (!requestOverlay) return [];
    return Array.prototype.slice.call(requestOverlay.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
    )).filter(function (el) {
      return !el.closest(".hp") && el.getAttribute("tabindex") !== "-1";
    });
  }

  function setRequestStatus(kind, message) {
    if (!requestStatus) return;
    requestStatus.hidden = !message;
    requestStatus.textContent = message || "";
    requestStatus.classList.toggle("is-error", kind === "error");
    requestStatus.classList.toggle("is-ok", kind === "ok");
  }

  function closeRequestModal() {
    if (!requestOverlay || requestOverlay.hidden) return;
    requestOverlay.hidden = true;
    document.body.classList.remove("modal-open");
    if (requestLastFocus && typeof requestLastFocus.focus === "function") {
      requestLastFocus.focus();
    }
    requestLastFocus = null;
  }

  function openRequestModal() {
    if (!requestOverlay) return;
    if (!cartHasItems()) {
      showToast("Add Don's Reserve items to your list first.");
      syncRequestMailButton();
      return;
    }
    requestLastFocus = document.activeElement;
    if (requestForm) requestForm.reset();
    setRequestStatus("", "");
    if (requestSubmit) requestSubmit.disabled = false;
    requestOverlay.hidden = false;
    document.body.classList.add("modal-open");
    const emailField = requestForm && requestForm.querySelector("[name='email']");
    if (emailField) emailField.focus();
  }

  function trapRequestFocus(event) {
    if (event.key !== "Tab" || !requestOverlay || requestOverlay.hidden) return;
    const nodes = requestFocusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.querySelectorAll("[data-request-mail]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openRequestModal();
    });
  });

  document.querySelectorAll("[data-request-cancel]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      closeRequestModal();
    });
  });

  function requestSendSucceeded() {
    return !!(requestStatus && !requestStatus.hidden && requestStatus.classList.contains("is-ok"));
  }

  if (requestOverlay) {
    requestOverlay.addEventListener("keydown", trapRequestFocus);
    requestOverlay.addEventListener("click", function (event) {
      if (event.target !== requestOverlay) return;
      if (!requestSendSucceeded()) return;
      closeRequestModal();
    });
  }

  if (requestForm) {
    requestForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const requestList = requestSummary();
      if (!requestList) {
        setRequestStatus("error", "Add Don's Reserve items to your list first.");
        syncRequestMailButton();
        return;
      }

      const email = (requestForm.querySelector("[name='email']") || {}).value || "";
      const notes = ((requestForm.querySelector("[name='notes']") || {}).value || "").trim() || DEFAULT_REQUEST_NOTES;
      const company = (requestForm.querySelector("[name='company']") || {}).value || "";

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setRequestStatus("error", "Please enter a valid email.");
        const emailField = requestForm.querySelector("[name='email']");
        if (emailField) emailField.focus();
        return;
      }

      if (requestSubmit) requestSubmit.disabled = true;
      setRequestStatus("", "Sending…");

      postContact({
        email: email.trim(),
        notes: notes,
        company: company,
        requestList: requestList
      }).then(function (result) {
        if (result.ok) {
          requestForm.reset();
          setRequestStatus("ok", "Request sent. We will reply by email.");
        } else {
          setRequestStatus("error", result.error || "Could not send that request. Write hello@uintahvalley.com.");
        }
      }).catch(function () {
        setRequestStatus("error", "Could not send that request. Write hello@uintahvalley.com.");
      }).finally(function () {
        if (requestSubmit) requestSubmit.disabled = false;
      });
    });
  }

  window.UVCart = {
    PRODUCTS: PRODUCTS,
    loadCart: loadCart,
    addItem: addItem,
    isAvailable: isAvailable,
    requestSummary: requestSummary,
    updateCartCount: updateCartCount,
    renderCartPage: renderCartPage
  };

  updateCartCount();
  renderCartPage();
})();
