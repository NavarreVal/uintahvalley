(function () {
  const BANNER_KEY = "uintahvalley-oos-banner";

  function bannerDismissed() {
    try {
      return localStorage.getItem(BANNER_KEY) === "dismissed";
    } catch (err) {
      return false;
    }
  }

  if (bannerDismissed()) {
    document.documentElement.classList.add("oos-banner-off");
  }

  document.querySelectorAll("[data-dismiss-banner]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      try {
        localStorage.setItem(BANNER_KEY, "dismissed");
      } catch (err) {}
      document.documentElement.classList.add("oos-banner-off");
    });
  });

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();

