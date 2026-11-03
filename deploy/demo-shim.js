// demo-shim.js: the static demo of the cockpit on GitHub Pages.
//
// The Node proxy (server.js) on Railway is paused since November 2026. On GitHub Pages
// (or with ?demo=1 locally) this script answers the page's /api/* calls in the browser:
//   /api/data          window.SCM_DATA from data.js, the snapshot exported through the proxy
//   other reads        demo/api.json when present (orders, decision log, single decisions,
//                      cost gaps, TCO serials and devices, the KPI CSV); without it they
//                      answer "not in the static demo" and the tab says so
//   refresh, purchasing run, AI commentary
//                      need the live backend (the purchasing run writes to its decision
//                      log, the commentary calls a model), so they answer with a demo note
// Served by server.js the script does nothing, and the cockpit reads the live API.
(function () {
  var params = new URLSearchParams(location.search);
  if (!/\.github\.io$/.test(location.hostname) && params.get("demo") !== "1") return;

  var NOTE = "Static demo: this needs the live backend, paused since November 2026.";
  var realFetch = window.fetch.bind(window);
  var store = null;
  function load() {
    if (!store) {
      store = realFetch("demo/api.json")
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    }
    return store;
  }
  function reply(body, status, type) {
    return new Response(type === "csv" ? body : JSON.stringify(body), {
      status: status || 200,
      headers: { "Content-Type": type === "csv" ? "text/csv; charset=utf-8" : "application/json" },
    });
  }

  async function answer(url, method) {
    var path = url.pathname.slice(url.pathname.indexOf("/api/"));
    if (method === "POST") {
      if (path === "/api/refresh") return reply({ ok: false, error: "the data is a frozen export (" + stamp() + ")" });
      if (path === "/api/purchasing-run") return reply({ error: NOTE, dry_run: true });
      return reply({ error: NOTE }, 503);
    }
    if (path === "/api/data" && window.SCM_DATA) return reply(window.SCM_DATA);

    var s = await load();
    if (path === "/api/kpis/export.csv") return s[path] ? reply(s[path], 200, "csv") : reply({ error: NOTE }, 404);
    if (path === "/api/decisions") {
      var rows = s["/api/decisions"] || [];
      var tier = url.searchParams.get("tier");
      return reply(tier ? rows.filter(function (r) { return r.tier === tier; }) : rows);
    }
    var key = path + url.search;
    if (key in s) return reply(s[key]);
    if (path in s) return reply(s[path]);
    return reply({ error: "not in the static demo" });
  }

  function stamp() {
    return (window.SCM_DATA && window.SCM_DATA.generated_at) || "export date unknown";
  }

  window.fetch = function (input, init) {
    var url = new URL(typeof input === "string" ? input : input.url, location.href);
    var method = ((init && init.method) || "GET").toUpperCase();
    if (url.origin === location.origin && url.pathname.indexOf("/api/") !== -1) return answer(url, method);
    return realFetch(input, init);
  };

  function banner() {
    var bar = document.createElement("div");
    bar.textContent = "Static demo: data exported on " + stamp() + ". Refresh, purchasing run and AI commentary need the live backend.";
    Object.assign(bar.style, {
      position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "9999", padding: "6px 12px",
      font: "12px/1.4 system-ui, sans-serif", textAlign: "center", color: "#fff", background: "#0f172a",
    });
    document.body.appendChild(bar);
  }
  window.addEventListener("load", banner);
})();
