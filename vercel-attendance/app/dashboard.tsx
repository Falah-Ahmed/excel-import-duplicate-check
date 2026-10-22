"use client";

import { useEffect, useState } from "react";

type LateAlert = {
  employee: string;
  employee_name: string;
  department: string;
  time: string;
  minutes: number;
};

type Summary = {
  ok: boolean;
  error?: string;
  user?: string;
  preview?: boolean;
  date: string;
  active_employees: number;
  checked_in: number;
  checked_out: number;
  late: number;
  on_time: number;
  no_checkin: number;
  late_alerts: LateAlert[];
};

function todayInput() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

function clock(value: string) {
  const match = /[ T](\d{2}):(\d{2})/.exec(value || "");
  if (!match) return value || "—";
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${match[2]} ${suffix}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0] || "").join("").toUpperCase() || "•";
}

export default function Dashboard() {
  const [date, setDate] = useState(todayInput);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancel = false;
    setError("");
    fetch(`/api/summary?date=${encodeURIComponent(date)}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Could not load attendance");
        if (!cancel) setData(json);
      })
      .catch((err: Error) => {
        if (!cancel) setError(err.message || "Could not load attendance");
      });
    return () => {
      cancel = true;
    };
  }, [date]);

  const checkedIn = data?.checked_in || 0;
  const onTime = data?.on_time || 0;
  const late = data?.late || 0;
  const totalRing = Math.max(onTime + late, 1);
  const onPct = checkedIn ? Math.round((onTime / totalRing) * 100) : 0;
  const latePct = checkedIn ? Math.round((late / totalRing) * 100) : 0;
  const ring = checkedIn ? `conic-gradient(#2563eb 0 ${onPct}%, #fb923c ${onPct}% 100%)` : "#e2e8f0";

  async function exportLogs() {
    setExporting(true);
    setError("");
    try {
      const res = await fetch(`/api/export?date=${encodeURIComponent(date)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Could not export logs");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `employee-checkins-${date}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export logs");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M8 2v4M16 2v4M3 10h18" />
            </svg>
          </div>
          NFP Attendance
        </div>
        <div className="who">{data?.user || ""}</div>
      </header>

      <div className="heading">
        <div>
          <h1>Attendance Dashboard</h1>
          <p>Today’s check-in, check-out, and late arrivals from Frappe HR.</p>
        </div>
        <label className="date-pill">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      {data?.preview ? (
        <div className="banner">Preview only. Counts connect to v3 when sign-in is added as the last step.</div>
      ) : null}
      {error ? <div className="banner">{error}</div> : null}

      <section className="cards">
        <article className="card">
          <div className="card-top">
            <div className="icon green">IN</div>
          </div>
          <div className="label">Checked in</div>
          <div className="value">{data ? checkedIn : "—"}</div>
          <div className="sub">of {data?.active_employees ?? "—"} active employees</div>
        </article>
        <article className="card">
          <div className="card-top">
            <div className="icon blue">OUT</div>
          </div>
          <div className="label">Checked out</div>
          <div className="value">{data ? data.checked_out : "—"}</div>
          <div className="sub">of {data ? checkedIn : "—"} checked in</div>
        </article>
        <article className="card">
          <div className="card-top">
            <div className="icon orange">LT</div>
          </div>
          <div className="label">Late arrivals</div>
          <div className="value">{data ? late : "—"}</div>
          <div className="sub">IN after shift start</div>
        </article>
        <article className="card">
          <div className="card-top">
            <div className="icon red">—</div>
          </div>
          <div className="label">No check-in</div>
          <div className="value">{data ? data.no_checkin : "—"}</div>
          <div className="sub">active employees with no IN</div>
        </article>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>On-time vs late</h2>
          <div className="donut-wrap">
            <div className="donut" style={{ background: data ? ring : "#e2e8f0" }}>
              <span>
                {data ? checkedIn : "—"}
                <small>Checked in</small>
              </span>
            </div>
            <div className="legend">
              <div><span className="swatch on" /> On time <b>{data ? onTime : "—"}</b> ({data ? onPct : 0}%)</div>
              <div><span className="swatch late" /> Late <b>{data ? late : "—"}</b> ({data ? latePct : 0}%)</div>
            </div>
          </div>
        </article>

        <article className="panel">
          <h2>Late alerts</h2>
          {data && data.late_alerts.length === 0 ? <div className="empty">No late arrivals for this day.</div> : null}
          {data && data.late_alerts.length > 0 ? (
            <table className="alerts">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Check-in</th>
                  <th>Late by</th>
                </tr>
              </thead>
              <tbody>
                {data.late_alerts.map((row) => (
                  <tr key={`${row.employee}-${row.time}`}>
                    <td>
                      <div className="person">
                        <span className="avatar">{initials(row.employee_name)}</span>
                        <span>
                          {row.employee_name}
                          <div className="sub">{row.employee}</div>
                        </span>
                      </div>
                    </td>
                    <td>{row.department || "—"}</td>
                    <td>{clock(row.time)}</td>
                    <td><span className="badge">{row.minutes} min</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {!data && !error ? <div className="empty">Loading…</div> : null}
        </article>
      </section>

      <section className="panel export">
        <div>
          <h2>Employee logs</h2>
          <p>The log list stays in Frappe HR. This downloads IN and OUT for the selected day only.</p>
        </div>
        <button type="button" onClick={exportLogs} disabled={exporting}>
          {exporting ? "Exporting…" : "Export employee logs"}
        </button>
      </section>
    </main>
  );
}
