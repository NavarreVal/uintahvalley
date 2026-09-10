(function () {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.querySelectorAll("img[data-fallback]").forEach(function (img) {
    img.addEventListener("error", function onErr() {
      img.src = img.getAttribute("data-fallback");
      img.removeAttribute("data-fallback");
      img.removeEventListener("error", onErr);
    });
  });

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  const params = new URLSearchParams(window.location.search);
  const skuAliases = {
    "1oz": "vanilla-1oz",
    "2oz": "vanilla-2oz",
    "6oz": "vanilla-6oz",
    "double-fold": "exp-double-fold",
    "mexican": "exp-mexican",
    "barrel": "exp-barrel",
    "paste": "exp-paste"
  };
  const sku = skuAliases[params.get("sku") || params.get("size")] || params.get("sku") || params.get("size");
  if (sku) {
    const choice = document.querySelector('input[name="sku"][value="' + sku + '"], input[name="size"][value="' + sku + '"]');
    if (choice) choice.checked = true;
  }

  const skuInputs = document.querySelectorAll('input[name="sku"], input[name="size"]');
  const addButton = document.querySelector("[data-add-dynamic]");
  const priceEl = document.querySelector("[data-price]");
  function syncProduct() {
    const selected = document.querySelector('input[name="sku"]:checked, input[name="size"]:checked');
    const id = selected ? selected.value : (addButton && addButton.getAttribute("data-add"));
    if (!id || !window.UVCart || !UVCart.PRODUCTS[id]) return;
    const product = UVCart.PRODUCTS[id];
    if (priceEl) priceEl.textContent = "$" + product.price;
    if (!addButton) return;
    if (!product.available) {
      addButton.disabled = true;
      addButton.setAttribute("aria-disabled", "true");
      addButton.removeAttribute("data-add");
      addButton.textContent = "Sold out";
      return;
    }
    addButton.disabled = false;
    addButton.removeAttribute("aria-disabled");
    addButton.setAttribute("data-add", id);
  }
  skuInputs.forEach(function (input) {
    input.addEventListener("change", syncProduct);
  });
  syncProduct();
})();

