/**
 * Desk → Client Script → New
 * DocType: Registered People
 * Apply To: Form
 *
 * This loads the PDF details page in an iframe tab using the current record.
 * Create a Custom HTML field named `pdf_details` (or change the fieldname below).
 */
frappe.ui.form.on("Registered People", {
  refresh(frm) {
    const fieldname = "pdf_details";
    const field = frm.fields_dict[fieldname];
    if (!field || !frm.doc.name || frm.is_new()) return;

    const base = "https://excel-import-duplicate-check-lfae.vercel.app/pdf";
    const src = `${base}?name=${encodeURIComponent(frm.doc.name)}`;
    field.$wrapper.html(`
      <div style="margin:-8px;height:calc(100vh - 220px);">
        <iframe
          src="${src}"
          title="Registered People PDF"
          style="width:100%;height:100%;border:0;background:#eef1f6;"
          allow="fullscreen"
        ></iframe>
      </div>
    `);
  },
});
