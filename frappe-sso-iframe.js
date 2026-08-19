/**
 * HTML Block for Duplicate Check workspace.
 * Replace APP_URL with your Vercel URL.
 */
(function () {
  const APP_URL = "https://excel-import-duplicate-check-lfae.vercel.app";
  const sid =
    (window.frappe && frappe.get_cookie && frappe.get_cookie("sid")) ||
    (window.frappe && frappe.session && frappe.session.sid) ||
    "";

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

  if (sid) {
    iframe.src =
      APP_URL.replace(/\/$/, "") +
      "/api/auth/sso?sid=" +
      encodeURIComponent(sid) +
      "&next=/";
  } else {
    iframe.src = APP_URL.replace(/\/$/, "") + "/login";
  }

  wrap.appendChild(iframe);
  root.appendChild(wrap);
})();
