# Same redeem API as vercel-dashboard/frappe-server-script-redeem-sso.py
# Create ONCE on Frappe. API Method: redeem_vercel_sso. Allow Guest: unchecked.

token = frappe.form_dict.get("token") or ""
token = str(token).strip()
if not token:
	frappe.throw("Missing token")

name = frappe.db.get_value("Error Log", {"method": "vercel_sso:" + token}, "name")
if not name:
	frappe.throw("Invalid or expired token")

error = frappe.db.get_value("Error Log", name, "error")
creation = frappe.db.get_value("Error Log", name, "creation")
frappe.delete_doc("Error Log", name, ignore_permissions=True, delete_permanently=True)

if not error:
	frappe.throw("Invalid or expired token")

age = frappe.utils.time_diff_in_seconds(frappe.utils.now_datetime(), frappe.utils.get_datetime(creation))
if age > 60:
	frappe.throw("Invalid or expired token")

data = json.loads(error)
if not data or not data.get("user"):
	frappe.throw("Invalid or expired token")

frappe.response["message"] = data
