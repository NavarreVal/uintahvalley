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

  const contactForm = document.querySelector("[data-contact-form]");
  if (contactForm) {
    const status = contactForm.querySelector("[data-contact-status]");
    const button = contactForm.querySelector("[type='submit']");

    const FORM_UNAVAILABLE = "The contact form is temporarily unavailable. Please email hello@uintahvalley.com.";

    function visitorEmailOk(value) {
      const email = String(value || "").trim();
      if (!email || email.length > 254) return false;
      if (/[\s,;<>"()[\]\\]/.test(email)) return false;
      return /^[^@]+@[^@]+\.[^@]+$/.test(email);
    }

    function setStatus(kind, message) {
      if (!status) return;
      status.hidden = !message;
      status.textContent = message || "";
      status.classList.toggle("is-error", kind === "error");
      status.classList.toggle("is-ok", kind === "ok");
    }

    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const name = (contactForm.querySelector("[name='name']") || {}).value || "";
      const email = (contactForm.querySelector("[name='email']") || {}).value || "";
      const notes = (contactForm.querySelector("[name='notes']") || {}).value || "";
      const company = (contactForm.querySelector("[name='company']") || {}).value || "";
      const requestList = window.UVCart && typeof window.UVCart.requestItems === "function"
        ? window.UVCart.requestItems()
        : [];

      if (name.trim().length > 100) {
        setStatus("error", "Name is too long.");
        return;
      }
      if (contactForm.getAttribute("data-form-unavailable") === "true") {
        setStatus("error", FORM_UNAVAILABLE);
        if (button) button.disabled = true;
        return;
      }
      if (!visitorEmailOk(email)) {
        setStatus("error", "Please enter a valid email.");
        return;
      }
      if (!notes.trim()) {
        setStatus("error", "Please write a short message.");
        return;
      }
      if (notes.trim().length > 2000) {
        setStatus("error", "Message is too long.");
        return;
      }

      if (button) button.disabled = true;
      setStatus("", "Sending…");

      const turnstileSlot = contactForm.querySelector("[data-turnstile]");
      const ready = window.UVTurnstile && typeof window.UVTurnstile.prepare === "function"
        ? window.UVTurnstile.prepare(turnstileSlot)
        : Promise.resolve({ required: false, siteKey: "", token: "", widgetId: null });

      ready.then(function (check) {
        if (!check.siteKey) {
          contactForm.setAttribute("data-form-unavailable", "true");
          setStatus("error", FORM_UNAVAILABLE);
          if (button) button.disabled = true;
          return null;
        }
        if (check.required && !check.token) {
          setStatus("error", "Please complete the security check and try again.");
          if (button) button.disabled = false;
          return null;
        }
        const payload = {
          name: name,
          email: email,
          notes: notes,
          company: company,
          requestList: requestList,
          "cf-turnstile-response": check.token || ""
        };
        const send = window.UVContact && typeof window.UVContact.post === "function"
          ? window.UVContact.post(payload)
          : fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }).then(function (res) {
            return res.text().then(function (text) {
              var data = null;
              try {
                data = text ? JSON.parse(text) : null;
              } catch (err) {
                return {
                  ok: false,
                  error: "The server returned an unexpected response. Write hello@uintahvalley.com."
                };
              }
              if (data && data.ok) return { ok: true };
              return {
                ok: false,
                error: (data && data.error) || "Could not send that message. Write hello@uintahvalley.com."
              };
            });
          });

        return send.then(function (result) {
          if (result.ok) {
            contactForm.reset();
            setStatus("ok", "Message sent. We will reply by email.");
          } else {
            setStatus("error", result.error || "Could not send that message. Write hello@uintahvalley.com.");
          }
        }).finally(function () {
          if (window.UVTurnstile && typeof window.UVTurnstile.reset === "function") {
            window.UVTurnstile.reset(check.widgetId);
          }
          if (button && contactForm.getAttribute("data-form-unavailable") !== "true") {
            button.disabled = false;
          }
        });
      }).catch(function () {
        setStatus("error", "Could not send that message. Write hello@uintahvalley.com.");
        if (button && contactForm.getAttribute("data-form-unavailable") !== "true") {
          button.disabled = false;
        }
      });
    });
  }
})();
