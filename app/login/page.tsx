import { Suspense } from "react";
import LoginForm from "./login-form";
import { ssoOnly } from "@/lib/session";

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <LoginForm ssoOnly={ssoOnly()} />
    </Suspense>
  );
}
