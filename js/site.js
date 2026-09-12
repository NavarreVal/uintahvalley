(function () {
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

  const header = document.querySelector(".page-home .site-header");
  if (header) {
    const onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const plate = document.querySelector(".hero-plate");
  if (plate) {
    const reveal = function () {
      requestAnimationFrame(function () {
        plate.classList.add("is-in");
      });
    };
    if (plate.complete) {
      reveal();
    } else {
      plate.addEventListener("load", reveal, { once: true });
      plate.addEventListener("error", reveal, { once: true });
    }
  }

  const tablist = document.querySelector("[data-discover-tabs]");
  if (tablist) {
    const tabs = tablist.querySelectorAll("[role='tab']");
    const panels = document.querySelectorAll("[data-discover-panel]");

    function showLine(line) {
      tabs.forEach(function (tab) {
        const selected = tab.getAttribute("data-line") === line;
        tab.setAttribute("aria-selected", selected ? "true" : "false");
      });
      panels.forEach(function (panel) {
        const match = panel.getAttribute("data-discover-panel") === line;
        panel.hidden = !match;
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        showLine(tab.getAttribute("data-line"));
      });
    });
  }

  const filterBar = document.querySelector("[data-shop-filter]");
  if (filterBar) {
    const buttons = filterBar.querySelectorAll("[data-filter]");
    const cards = document.querySelectorAll("[data-shop-card]");

    function showFilter(line) {
      buttons.forEach(function (btn) {
        const on = btn.getAttribute("data-filter") === line;
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
      cards.forEach(function (card) {
        const match = line === "all" || card.getAttribute("data-line") === line;
        card.hidden = !match;
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        showFilter(btn.getAttribute("data-filter"));
      });
    });

    const hash = (location.hash || "").replace("#", "");
    if (hash === "dons-reserve" || hash === "mainline") {
      showFilter(hash);
    }
  }
})();
