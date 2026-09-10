(function () {
  const STORAGE_KEY = "uintahvalley-cart-v1";
  const ORDER_EMAIL = "hello@uintahvalley.com";
  const PRODUCTS = {
    "vanilla-2oz": {
      id: "vanilla-2oz",
      name: "Homemade Vanilla Extract",
      size: "2 oz",
      price: 18
    },
    "vanilla-6oz": {
      id: "vanilla-6oz",
      name: "Homemade Vanilla Extract",
      size: "6 oz",
      price: 42
    }
  };

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : { items: [] };
      return Array.isArray(parsed.items) ? parsed : { items: [] };
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

  function addItem(id, qty) {
    const product = PRODUCTS[id];
    if (!product) return;
    const cart = loadCart();
    const nextQty = Math.max(1, parseInt(qty, 10) || 1);
    const existing = cart.items.find(function (item) { return item.id === id; });
    if (existing) {
      existing.qty += nextQty;
    } else {
      cart.items.push({ id: id, qty: nextQty });
    }
    saveCart(cart);
    showToast(product.size + " vanilla extract added to your request list.");
  }

  function setQty(id, qty) {
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

  function orderMailto(extra) {
    const cart = loadCart();
    const lines = [
      "Hello Uintah Valley,",
      "",
      "I would like to request the following homemade vanilla extract:",
      ""
    ];

    if (!cart.items.length) {
      lines.push("(No bottles selected yet.)");
    } else {
      cart.items.forEach(function (item) {
        const product = PRODUCTS[item.id];
        if (!product) return;
        lines.push(
          "- " + product.name + " · " + product.size +
          " × " + item.qty +
          "  (" + money(product.price) + " each, provisional)"
        );
      });
      lines.push("");
      lines.push("Provisional subtotal: " + money(cartTotal(cart)));
    }

    lines.push("");
    if (extra && extra.name) lines.push("Name: " + extra.name);
    if (extra && extra.email) lines.push("Email: " + extra.email);
    if (extra && extra.notes) {
      lines.push("Notes: " + extra.notes);
    }
    lines.push("");
    lines.push("I understand prices are provisional and there is no online payment yet.");
    lines.push("Please reply with availability and how to complete this order.");

    const subject = encodeURIComponent("Vanilla extract order request");
    const body = encodeURIComponent(lines.join("\n"));
    return "mailto:" + ORDER_EMAIL + "?subject=" + subject + "&body=" + body;
  }

  function renderCartPage() {
    const root = document.querySelector("[data-cart-root]");
    if (!root) return;
    const cart = loadCart();
    if (!cart.items.length) {
      root.innerHTML =
        '<div class="empty-cart">' +
        "<p>Your request list is empty.</p>" +
        '<p><a class="btn btn-primary" href="shop.html">Browse bottles</a></p>' +
        "</div>";
      return;
    }

    const rows = cart.items.map(function (item) {
      const product = PRODUCTS[item.id];
      if (!product) return "";
      return (
        "<tr>" +
        "<td>" + product.name + "<div class='fine'>" + product.size + "</div></td>" +
        "<td>" + money(product.price) + "</td>" +
        "<td><input data-qty='" + product.id + "' type='number' min='1' max='24' value='" + item.qty + "' aria-label='Quantity for " + product.size + "'></td>" +
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

    document.querySelectorAll("[data-order-mail]").forEach(function (link) {
      link.setAttribute("href", orderMailto());
    });
  }

  document.addEventListener("click", function (event) {
    const addBtn = event.target.closest("[data-add]");
    if (!addBtn) return;
    event.preventDefault();
    const id = addBtn.getAttribute("data-add");
    const qtyField = document.querySelector("[data-add-qty]");
    addItem(id, qtyField ? qtyField.value : 1);
  });

  document.addEventListener("submit", function (event) {
    const form = event.target.closest("[data-order-form]");
    if (!form) return;
    event.preventDefault();
    const extra = {
      name: (form.querySelector("[name='name']") || {}).value || "",
      email: (form.querySelector("[name='email']") || {}).value || "",
      notes: (form.querySelector("[name='notes']") || {}).value || ""
    };
    window.location.href = orderMailto(extra);
  });

  window.UVCart = {
    PRODUCTS: PRODUCTS,
    ORDER_EMAIL: ORDER_EMAIL,
    loadCart: loadCart,
    addItem: addItem,
    orderMailto: orderMailto,
    updateCartCount: updateCartCount,
    renderCartPage: renderCartPage
  };

  updateCartCount();
  renderCartPage();
})();
