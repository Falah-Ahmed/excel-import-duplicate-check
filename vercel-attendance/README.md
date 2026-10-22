# NFP Attendance

Summary for Frappe HR on v3. Leave, settings, and the employee log screen stay in HRMS. This page shows today’s counts, late arrivals, and an export of that day’s IN/OUT logs. The check-in vs check-out chart stays on v3.

The Frappe session id is never put in a link.

## Vercel env

| Variable | Value |
|---|---|
| `FRAPPE_BASE_URL` | `https://v3.the-nfp.org` |
| `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` | System Manager key, server only |
| `AUTH_SECRET` | long random string |
| `AUTH_ALLOWED_ROLES` | `HR Manager,HR User,System Manager,Administrator` |
| `FRAME_ANCESTORS` | `https://v3.the-nfp.org` |

## Frappe server scripts

Allow Guest **off** on both.

1. API Method `get_vercel_attendance_sso_url` — `frappe-server-script-sso.py`
2. API Method `redeem_attendance_sso` — `frappe-server-script-redeem-sso.py`

Set `DASHBOARD_URL` in the first script to the Vercel URL.

## Workspace HTML

```html
<div style="margin:-8px;height:calc(100vh - 120px);">
  <iframe
    src="/api/method/get_vercel_attendance_sso_url?redirect=1"
    title="NFP Attendance"
    referrerpolicy="no-referrer"
    style="width:100%;height:100%;border:0;background:#f4f7fb;"
    allow="fullscreen"
  ></iframe>
</div>
```

The iframe address on v3 has no session id. Copying `/api/auth/sso?sid=...` returns Access Denied.
