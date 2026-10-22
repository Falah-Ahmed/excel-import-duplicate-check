# Frappe Server Script
# Script Type: API
# API Method: get_vercel_attendance_sso_url
# Allow Guest: unchecked
#
# Logged-in HR users only. The Frappe sid never leaves v3.
# A one-time token is placed in the URL fragment (not sent to the dashboard server logs).

DASHBOARD_URL = "https://YOUR-ATTENDANCE-DASHBOARD.vercel.app"

if frappe.session.user == "Guest":
	frappe.throw("Login required")

allowed = ["HR Manager", "HR User", "System Manager", "Administrator"]
ok = 0
for role in frappe.get_roles():
	if role in allowed:
		ok = 1
if not ok:
	frappe.throw("Not permitted")

old = frappe.get_all(
	"Integration Request",
	filters={
		"integration_request_service": "Attendance SSO",
		"creation": ["<", frappe.utils.add_to_date(frappe.utils.now_datetime(), hours=-1)],
	},
	pluck="name",
	limit=20,
)
for name in old:
	frappe.delete_doc("Integration Request", name, ignore_permissions=True)

token = frappe.utils.random_string(40)
full_name = frappe.utils.get_fullname(frappe.session.user) or frappe.session.user
doc = frappe.get_doc({
	"doctype": "Integration Request",
	"integration_request_service": "Attendance SSO",
	"request_id": token,
	"status": "Queued",
	"data": frappe.as_json({"user": frappe.session.user, "full_name": full_name}),
})
doc.insert(ignore_permissions=True)

base = DASHBOARD_URL
if base.endswith("/"):
	base = base[0 : len(base) - 1]

if frappe.form_dict.get("redirect"):
	frappe.response["type"] = "redirect"
	frappe.response["location"] = base + "/sso#" + token
else:
	frappe.response["message"] = {"ok": True}
