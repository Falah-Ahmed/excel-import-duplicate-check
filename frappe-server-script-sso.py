# Frappe Server Script — API Method: get_vercel_dup_sso_url
# Allow Guest: unchecked
# Same as before: logged-in Frappe users only. Guest cannot get a sid.

DASHBOARD_URL = "https://excel-import-duplicate-check-lfae.vercel.app"

if frappe.session.user == "Guest":
	frappe.throw("Login required")

sid = frappe.request.cookies.get("sid")
if not sid:
	frappe.throw("Missing session cookie")

base = DASHBOARD_URL
if base.endswith("/"):
	base = base[0 : len(base) - 1]

url = base + "/api/auth/sso?sid=" + str(sid) + "&next=/"

redirect = frappe.form_dict.get("redirect")
if redirect:
	frappe.response["type"] = "redirect"
	frappe.response["location"] = url
else:
	frappe.response["message"] = {"url": url, "user": frappe.session.user}
