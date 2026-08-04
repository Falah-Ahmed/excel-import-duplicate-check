# Excel Import & Duplicate Check

Compare an uploaded Excel/CSV file against your Frappe **Register People** records by:

- Passport number
- Phone number
- ID number
- Name (English or Arabic)

Deploy on Vercel, then embed in ERPNext with an iframe (same pattern as the admins dashboard).

---

## 1) Deploy to Vercel

```bash
cd vercel-import-check
npm install
npx vercel
```

Or push this folder to GitHub and import the project in Vercel.

### Environment variables

| Name | Example |
|------|---------|
| `FRAPPE_BASE_URL` | `https://v2.the-nfp.org` |
| `FRAPPE_API_KEY` | from Frappe User API Key |
| `FRAPPE_API_SECRET` | from Frappe User API Secret |
| `FRAPPE_REGISTER_DOCTYPE` | `Register People` |
| `FRAPPE_PASSPORT_FIELD` | `passport_number` |
| `FRAPPE_PHONE_FIELD` | `phone_number` |
| `FRAPPE_ID_FIELD` | `id_number` |
| `FRAPPE_NAME_FIELD` | `full_name` |
| `FRAPPE_NAME_AR_FIELD` | `full_name_ar` |

Use the **field names** from Customize Form (snake_case), not the labels.

Redeploy after adding env vars.

---

## 2) Excel column mapping

The app auto-detects columns from the header row:

| Detected | Header examples |
|----------|-------------------|
| Passport | Passport, Passport No, جواز |
| Phone | Phone, Mobile, Tel, جوال |
| ID | ID, ID Number, National ID, Iqama, هوية |
| Name (English) | Name, Full Name, English Name |
| Name (Arabic) | Arabic Name, Name AR, الاسم |

At least **one identifier** (passport / phone / ID) **and a name** are required per row.

---

## 3) Duplicate rules

| Status | Meaning |
|--------|---------|
| **Exact Duplicate** | Same passport + ID, or 2+ strong fields match one system record |
| **Possible Duplicate** | Only one field matches (e.g. phone only) |
| **New Record** | No match in the system |
| **Invalid Data** | Missing required fields |

Arabic names are normalized (alef/ta marbuta variants) for comparison.

---

## 4) Embed in Frappe iframe

Desk → **HTML Block** → New → paste:

```html
<div style="margin:-8px;height:calc(100vh - 120px);">
  <iframe
    src="https://YOUR-APP.vercel.app"
    title="Excel Import Duplicate Check"
    style="width:100%;height:100%;border:0;background:#f4f5f7;"
    allow="fullscreen"
  ></iframe>
</div>
```

Add the block to your Workspace as a **Custom Block**.

Turn off **Vercel Authentication** for the deployment so the iframe loads without login.

---

## 5) Local test

```bash
cd vercel-import-check
cp .env.example .env.local
# edit .env.local
npm install
npm run dev
```

Open http://localhost:3000 — without env vars it runs in **demo mode** with sample system records.

---

## 6) Import new records

Click **Import New Records Only** to POST only rows marked **New Record** into Frappe.

The API user needs **create** permission on the register DocType.
