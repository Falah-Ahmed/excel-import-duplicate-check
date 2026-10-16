# Frappe Server Script (API) — Frappe 15.43 RestrictedPython
# API Method: get_vercel_dup_sso_url
# Allow Guest: unchecked

DASHBOARD_URL = "https://excel-import-duplicate-check-lfae.vercel.app"

if frappe.session.user == "Guest":
	frappe.throw("Login required")

token = frappe.utils.generate_hash(length=40)
payload = json.dumps(
	{
		"user": frappe.session.user,
		"full_name": frappe.full_name or frappe.get_fullname(frappe.session.user),
	}
)
frappe.log_error(title="vercel_sso:" + token, message=payload)

base = DASHBOARD_URL
if base.endswith("/"):
	base = base[0 : len(base) - 1]

url = base + "/api/auth/sso?token=" + str(token) + "&next=/"

redirect = frappe.form_dict.get("redirect")
if redirect:
	frappe.response["type"] = "redirect"
	frappe.response["location"] = url
else:
	frappe.response["message"] = {"url": url, "user": frappe.session.user}
