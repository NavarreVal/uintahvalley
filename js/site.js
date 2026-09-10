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
  const sizeAliases = { "2oz": "vanilla-2oz", "6oz": "vanilla-6oz" };
  const size = sizeAliases[params.get("size")] || params.get("size");
  if (size) {
    const choice = document.querySelector('input[name="size"][value="' + size + '"]');
    if (choice) choice.checked = true;
  }

  const sizeInputs = document.querySelectorAll('input[name="size"]');
  const addButton = document.querySelector("[data-add-dynamic]");
  const priceEl = document.querySelector("[data-price]");
  function syncProduct() {
    if (!addButton) return;
    const selected = document.querySelector('input[name="size"]:checked');
    const id = selected ? selected.value : "vanilla-6oz";
    addButton.setAttribute("data-add", id);
    if (priceEl && window.UVCart && UVCart.PRODUCTS[id]) {
      priceEl.textContent = "$" + UVCart.PRODUCTS[id].price;
    }
  }
  sizeInputs.forEach(function (input) {
    input.addEventListener("change", syncProduct);
  });
  syncProduct();
})();
