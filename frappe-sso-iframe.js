/**
 * HTML Block for Duplicate Check workspace.
 * Iframe loads Frappe (same site). sid never appears in the Vercel URL.
 */
(function () {
  const root = document.currentScript
    ? document.currentScript.parentNode
    : document.body;
  const wrap = document.createElement("div");
  wrap.style.margin = "-8px";
  wrap.style.height = "calc(100vh - 120px)";

  const iframe = document.createElement("iframe");
  iframe.title = "Excel Import Duplicate Check";
  iframe.allow = "fullscreen";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.background = "#f4f5f7";
  iframe.referrerPolicy = "no-referrer";
  iframe.src = "/api/method/get_vercel_dup_sso_url?redirect=1";

  wrap.appendChild(iframe);
  root.appendChild(wrap);
})();
