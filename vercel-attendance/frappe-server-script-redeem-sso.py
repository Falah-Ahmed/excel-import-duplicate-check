# Frappe Server Script
# Script Type: API
# API Method: redeem_attendance_sso
# Allow Guest: unchecked
#
# Called by the dashboard server with its API key. One use, then the token is deleted.

token = str(frappe.form_dict.get("token") or "").strip()
if not token or len(token) > 80:
	frappe.throw("Invalid or expired token")

name = frappe.db.get_value(
	"Integration Request",
	{"request_id": token, "integration_request_service": "Attendance SSO", "status": "Queued"},
	"name",
)
if not name:
	frappe.throw("Invalid or expired token")

creation = frappe.db.get_value("Integration Request", name, "creation")
age = frappe.utils.time_diff_in_seconds(frappe.utils.now_datetime(), frappe.utils.get_datetime(creation))
if age < 0:
	age = -age
if age > 120:
	frappe.delete_doc("Integration Request", name, ignore_permissions=True)
	frappe.throw("Invalid or expired token")

raw = frappe.db.get_value("Integration Request", name, "data")
data = json.loads(raw) if raw else None
frappe.delete_doc("Integration Request", name, ignore_permissions=True)
if not data or not data.get("user") or data.get("user") == "Guest":
	frappe.throw("Invalid or expired token")

frappe.response["message"] = {"user": data.get("user"), "full_name": data.get("full_name") or data.get("user")}
