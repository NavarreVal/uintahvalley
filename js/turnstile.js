(function () {
  var ACTION = "contact";
  var SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  var scriptPromise = null;
  var siteKeyPromise = null;
  var widgets = new WeakMap();
  var pending = new WeakMap();

  function loadSiteKey() {
    if (!siteKeyPromise) {
      siteKeyPromise = fetch("/api/turnstile", { headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) return "";
          return res.json();
        })
        .then(function (data) {
          var key = data && typeof data.siteKey === "string" ? data.siteKey.trim() : "";
          return key;
        })
        .catch(function () {
          return "";
        });
    }
    return siteKeyPromise;
  }

  function loadScript() {
    if (window.turnstile) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        scriptPromise = null;
        reject(new Error("turnstile"));
      };
      document.head.appendChild(script);
    });
    return scriptPromise;
  }

  function mount(container) {
    if (!container) return Promise.resolve(null);
    if (widgets.has(container)) return Promise.resolve(widgets.get(container));
    if (pending.has(container)) return pending.get(container);
    var promise = loadSiteKey().then(function (siteKey) {
      if (!siteKey) {
        container.hidden = true;
        return null;
      }
      return loadScript().then(function () {
        if (!window.turnstile || typeof window.turnstile.render !== "function") {
          throw new Error("turnstile");
        }
        var widgetId = window.turnstile.render(container, {
          sitekey: siteKey,
          action: ACTION
        });
        widgets.set(container, widgetId);
        container.hidden = false;
        return widgetId;
      });
    }).catch(function () {
      container.hidden = true;
      pending.delete(container);
      return null;
    });
    pending.set(container, promise);
    return promise;
  }

  function tokenFor(widgetId) {
    if (widgetId == null || !window.turnstile || typeof window.turnstile.getResponse !== "function") return "";
    try {
      return window.turnstile.getResponse(widgetId) || "";
    } catch (err) {
      return "";
    }
  }

  function prepare(container) {
    return mount(container).then(function (widgetId) {
      if (widgetId == null) return { required: false, token: "", widgetId: null };
      return { required: true, token: tokenFor(widgetId), widgetId: widgetId };
    });
  }

  function reset(widgetId) {
    if (widgetId == null || !window.turnstile || typeof window.turnstile.reset !== "function") return;
    try {
      window.turnstile.reset(widgetId);
    } catch (err) {
      // The page stays up. The next submit asks for a fresh check.
    }
  }

  window.UVTurnstile = {
    mount: mount,
    prepare: prepare,
    reset: reset
  };

  document.querySelectorAll("[data-turnstile]").forEach(function (container) {
    var parent = container.parentElement;
    if (parent && parent.closest("[hidden]")) return;
    mount(container);
  });
})();
