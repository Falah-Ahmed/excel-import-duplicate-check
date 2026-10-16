# Frappe Server Script — API Method: redeem_vercel_sso
# Allow Guest: unchecked

token = frappe.form_dict.get("token") or ""
token = str(token).strip()
if not token:
	frappe.throw("Missing token")

name = frappe.db.get_value("Error Log", {"method": "vercel_sso:" + token}, "name")
if not name:
	frappe.throw("Invalid or expired token")

error = frappe.db.get_value("Error Log", name, "error")
creation = frappe.db.get_value("Error Log", name, "creation")

if not error:
	frappe.throw("Invalid or expired token")

age = frappe.utils.time_diff_in_seconds(frappe.utils.now_datetime(), frappe.utils.get_datetime(creation))
if age < 0:
	age = -age
if age > 300:
	frappe.throw("Invalid or expired token")

start = error.find("{")
end = error.rfind("}")
if start < 0 or end <= start:
	frappe.throw("Invalid or expired token")

data = json.loads(error[start : end + 1])
if not data or not data.get("user"):
	frappe.throw("Invalid or expired token")

frappe.delete_doc("Error Log", name, ignore_permissions=True, delete_permanently=True)
frappe.response["message"] = data
