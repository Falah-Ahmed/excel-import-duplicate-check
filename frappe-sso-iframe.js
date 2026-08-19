/**
 * HTML Block for Duplicate Check workspace.
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

  if (!sid) {
    wrap.style.display = "grid";
    wrap.style.placeItems = "center";
    wrap.style.padding = "24px";
    wrap.style.color = "#64748b";
    wrap.style.fontFamily = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
    wrap.innerHTML = "<div><strong>403</strong><br/>Access Denied</div>";
    root.appendChild(wrap);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.title = "Excel Import Duplicate Check";
  iframe.allow = "fullscreen";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.background = "#f4f5f7";
  iframe.src =
    APP_URL.replace(/\/$/, "") +
    "/api/auth/sso?sid=" +
    encodeURIComponent(sid) +
    "&next=/";

  wrap.appendChild(iframe);
  root.appendChild(wrap);
})();
