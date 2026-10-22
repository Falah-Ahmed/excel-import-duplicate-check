"use client";

import { useEffect, useState } from "react";

export default function SsoPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = window.location.hash.replace(/^#/, "").trim();
    window.history.replaceState(null, "", "/sso");
    if (!token || token.length > 80 || /[^A-Za-z0-9]/.test(token)) {
      setFailed(true);
      return;
    }
    fetch("/api/auth/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (!res.ok) {
          setFailed(true);
          return;
        }
        window.location.replace("/");
      })
      .catch(() => setFailed(true));
  }, []);

  return (
    <main className="app">
      <p>{failed ? "Access denied. Open Attendance from Frappe HR while you are logged in." : "Signing in…"}</p>
    </main>
  );
}
