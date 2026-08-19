"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./login.module.css";

const ERROR_MESSAGES: Record<string, string> = {
  auth_not_configured: "Server auth is not configured (AUTH_SECRET missing on Vercel).",
  missing_frappe_url: "Server is missing FRAPPE_BASE_URL.",
  invalid_frappe_session: "Your ERPNext session expired. Log in to ERPNext and open this app again.",
  invalid_sso: "SSO link is invalid or expired.",
  missing_sso: "No ERPNext session was found.",
  forbidden_role: "Your ERPNext user does not have permission to open this app.",
};

function formatError(code: string) {
  return ERROR_MESSAGES[code] || code.replace(/_/g, " ");
}

type Props = {
  ssoOnly: boolean;
  frappeUrl?: string;
  title: string;
};

export default function LoginForm({ ssoOnly, frappeUrl, title }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const errorCode = params.get("error") || "";
  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(errorCode ? formatError(errorCode) : "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usr, pwd }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Login failed");
        return;
      }
      const next = params.get("next") || "/";
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Login request failed");
    } finally {
      setLoading(false);
    }
  }

  if (ssoOnly) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1>{title}</h1>
          <p>
            This app only works when opened from ERPNext. Log in to ERPNext, then open the
            workspace that embeds this tool.
          </p>
          {error && <div className={styles.error}>{error}</div>}
          {frappeUrl ? (
            <a className={styles.link} href={frappeUrl} target="_blank" rel="noopener noreferrer">
              Open ERPNext
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <h1>{title}</h1>
        <p>Sign in with your Frappe account to open the duplicate check.</p>
        {error && <div className={styles.error}>{error}</div>}
        <label>
          Username / Email
          <input
            value={usr}
            onChange={(e) => setUsr(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
