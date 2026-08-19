import { Suspense } from "react";
import LoginForm from "./login-form";
import { ssoOnly } from "@/lib/session";

export default function LoginPage() {
  const frappeUrl = (process.env.FRAPPE_BASE_URL || "").replace(/\/$/, "").trim() || undefined;

  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <LoginForm ssoOnly={ssoOnly()} frappeUrl={frappeUrl} title="ERPNext access only" />
    </Suspense>
  );
}
