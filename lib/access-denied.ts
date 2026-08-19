import { NextResponse } from "next/server";

export function accessDeniedHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>403 — Access Denied</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f7fb; font-family: system-ui, sans-serif; color: #334155; }
    .box { text-align: center; padding: 32px; }
    h1 { margin: 0 0 8px; font-size: 48px; font-weight: 700; color: #0f172a; }
    p { margin: 0; font-size: 16px; color: #64748b; }
  </style>
</head>
<body>
  <div class="box">
    <h1>403</h1>
    <p>Access Denied</p>
  </div>
</body>
</html>`;
}

export function accessDeniedResponse() {
  return new NextResponse(accessDeniedHtml(), {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
