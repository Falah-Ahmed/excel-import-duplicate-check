/**
 * Same for Duplicate Check — Page name: vercel-duplicate-check
 */
frappe.pages["vercel-duplicate-check"].on_page_load = function (wrapper) {
  $(wrapper).empty();

  if (!frappe.session || frappe.session.user === "Guest") {
    $(wrapper).html(
      '<div style="display:grid;place-items:center;height:70vh;color:#64748b;text-align:center;font-family:system-ui,sans-serif;"><div><strong style="font-size:48px;color:#0f172a;">403</strong><br/>Access Denied</div></div>'
    );
    return;
  }

  $(wrapper).html(
    '<div style="margin:-8px;height:calc(100vh - 100px);">' +
      '<iframe src="/api/method/get_vercel_dup_sso_url?redirect=1" title="Duplicate Check" allow="fullscreen" referrerpolicy="no-referrer" ' +
      'style="width:100%;height:100%;border:0;background:#f4f5f7;"></iframe>' +
      "</div>"
  );
};
