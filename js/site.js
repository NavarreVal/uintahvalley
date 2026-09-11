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

  const bottles = document.querySelector(".hero-bottles");
  if (bottles) {
    const reveal = function () {
      requestAnimationFrame(function () {
        bottles.classList.add("is-in");
      });
    };
    if (bottles.complete) {
      reveal();
    } else {
      bottles.addEventListener("load", reveal, { once: true });
      bottles.addEventListener("error", reveal, { once: true });
    }
  }

  const tablist = document.querySelector("[data-discover-tabs]");
  if (!tablist) return;

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
})();
