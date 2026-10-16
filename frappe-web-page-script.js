/**
 * Web Page Script for Duplicate Check (route: vercel-duplicate-check)
 * No sid in JavaScript.
 */
frappe.ready(function () {
  var frame = document.getElementById("vercel-dup-check");
  if (!frame) return;
  if (!frappe.session || frappe.session.user === "Guest") {
    document.body.innerHTML =
      '<div style="display:grid;place-items:center;height:100vh;color:#64748b;text-align:center;font-family:system-ui,sans-serif;">' +
      '<div><strong style="font-size:48px;color:#0f172a;">403</strong><br/>Access Denied</div></div>';
    return;
  }
  frame.referrerPolicy = "no-referrer";
  frame.src = "/api/method/get_vercel_dup_sso_url?redirect=1";
});
