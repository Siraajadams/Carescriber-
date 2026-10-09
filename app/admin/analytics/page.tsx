"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Period = "week" | "month" | "last_month" | "quarter" | "last_quarter" | "ytd" | "last_year";
type Diagnosis = { code: string; description: string; count: number };
type Medication = { name: string; count: number };
type Day = { day: string; consultations: number; prescriptions: number };
type Analytics = {
  period: Period; range: { start: string; end: string }; consultations: number; prescriptions: number;
  topDiagnoses: Diagnosis[]; topMedications: Medication[]; timeline: Day[]; note: string;
};
const periods: { value: Period; label: string }[] = [
  { value: "week", label: "This Week" }, { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" }, { value: "quarter", label: "Current Quarter" },
  { value: "last_quarter", label: "Last Quarter" }, { value: "ytd", label: "Year to Date" },
  { value: "last_year", label: "Last Year" },
];
const palette = { green: "#10b981", teal: "#0f766e", blue: "#2563eb", ink: "#10243a", muted: "#64748b" };
const panel: React.CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: 22, boxShadow: "0 6px 24px rgba(15,23,42,.04)" };

function RankedBars({ title, subtitle, rows, color }: { title: string; subtitle: string; rows: { label: string; detail?: string; count: number }[]; color: string }) {
  const max = Math.max(1, ...rows.map(x => x.count));
  return <section style={panel}>
    <h2 style={{ fontSize: 19, margin: "0 0 5px" }}>{title}</h2>
    <p style={{ color: palette.muted, fontSize: 13, margin: "0 0 20px" }}>{subtitle}</p>
    {rows.length === 0 ? <p style={{ color: palette.muted }}>No records in this reporting period.</p> :
      <div style={{ display: "grid", gap: 15 }}>
        {rows.map((x, i) => <div key={`${x.label}-${i}`}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 6 }}>
            <div style={{ minWidth: 0, fontSize: 13, lineHeight: 1.4 }}><b>{x.label}</b>{x.detail ? <span style={{ color: palette.muted }}> · {x.detail}</span> : null}</div>
            <b style={{ fontSize: 13, flexShrink: 0 }}>{x.count}</b>
          </div>
          <div style={{ height: 9, background: "#eaf0f5", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${(x.count / max) * 100}%`, height: "100%", background: color, borderRadius: 99 }} />
          </div>
        </div>)}
      </div>}
  </section>;
}

function Trend({ rows }: { rows: Day[] }) {
  const points = useMemo(() => {
    if (!rows.length) return [];
    // Weekly bars for longer periods; daily bars for a single week or month.
    const weekly = rows.length > 35;
    const map = new Map<string, { label: string; consultations: number; prescriptions: number }>();
    for (const row of rows) {
      const d = new Date(`${row.day}T12:00:00Z`);
      if (weekly) d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const key = weekly ? d.toISOString().slice(0, 10) : row.day;
      const item = map.get(key) || { label: key.slice(5), consultations: 0, prescriptions: 0 };
      item.consultations += row.consultations; item.prescriptions += row.prescriptions; map.set(key, item);
    }
    return [...map.values()];
  }, [rows]);
  const max = Math.max(1, ...points.flatMap(x => [x.consultations, x.prescriptions]));
  return <section style={panel}>
    <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>Clinical activity</h2>
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", color: palette.muted, fontSize: 13, marginBottom: 18 }}>
      <span><span style={{ color: palette.teal }}>●</span> Consultations</span>
      <span><span style={{ color: palette.blue }}>●</span> Prescriptions</span>
    </div>
    {points.length === 0 ? <p style={{ color: palette.muted }}>No activity in this period.</p> :
      <div style={{ overflowX: "auto" }}><div style={{ display: "flex", alignItems: "end", gap: 7, minHeight: 200, minWidth: Math.max(420, points.length * 22) }}>
        {points.map((x, i) => <div key={i} title={`${x.label}: ${x.consultations} consultations, ${x.prescriptions} prescriptions`} style={{ flex: 1, minWidth: 11, textAlign: "center" }}>
          <div style={{ height: 165, display: "flex", gap: 2, alignItems: "end" }}>
            <div style={{ flex: 1, height: `${Math.max(x.consultations ? 3 : 0, x.consultations / max * 100)}%`, background: palette.teal, borderRadius: "4px 4px 0 0" }} />
            <div style={{ flex: 1, height: `${Math.max(x.prescriptions ? 3 : 0, x.prescriptions / max * 100)}%`, background: palette.blue, borderRadius: "4px 4px 0 0" }} />
          </div>
          <div style={{ color: palette.muted, fontSize: 10, marginTop: 7, whiteSpace: "nowrap" }}>{points.length <= 15 || i % Math.ceil(points.length / 12) === 0 ? x.label : ""}</div>
        </div>)}
      </div></div>}
  </section>;
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (selected: Period, signal: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) throw new Error("Please sign in to CareScriber first.");
      const response = await fetch(`/api/admin/analytics?period=${encodeURIComponent(selected)}`, {
        cache: "no-store", signal, headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load analytics");
      if (!signal.aborted) setData(result as Analytics);
    } catch (e) {
      if (!signal.aborted) { setData(null); setError(e instanceof Error ? e.message : "Unexpected error"); }
    } finally { if (!signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(period, controller.signal); return () => controller.abort(); }, [period, load]);
  const refresh = () => { setPeriod(p => p); const controller = new AbortController(); void load(period, controller.signal); };
  const card = (title: string, value: number, icon: string, accent: string, subtitle: string) =>
    <div style={{ ...panel, borderTop: `4px solid ${accent}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: palette.muted, fontWeight: 600, fontSize: 14 }}>{title}</span><span style={{ fontSize: 25 }}>{icon}</span></div>
      <div style={{ fontSize: 40, fontWeight: 800, margin: "10px 0", color: palette.ink }}>{value.toLocaleString("en-ZA")}</div>
      <div style={{ fontSize: 12, color: palette.muted }}>{subtitle}</div></div>;
  return <main style={{ background: "#f3f7fb", minHeight: "100vh", color: palette.ink, padding: "30px 16px 65px", fontFamily: "Arial, Helvetica, sans-serif" }}>
    <div style={{ maxWidth: 1200, margin: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <Link href="/dashboard" style={{ color: palette.teal, textDecoration: "none", fontWeight: 600 }}>← Doctor dashboard</Link>
        <span style={{ background: "#dcfce7", color: "#166534", padding: "8px 13px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>ADMINISTRATOR ANALYTICS</span>
      </div>
      <h1 style={{ margin: "0 0 8px", fontSize: "clamp(25px, 4vw, 36px)" }}>CareScriber Clinical Insights</h1>
      <p style={{ color: palette.muted, margin: "0 0 26px" }}>Operational performance, prescribing trends and clinical diagnoses</p>
      <section style={{ ...panel, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <strong>Reporting period</strong>
          <button type="button" onClick={refresh} disabled={loading} style={{ cursor: "pointer", border: "1px solid #cbd5e1", borderRadius: 9, background: "white", padding: "9px 14px" }}>↻ Refresh</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {periods.map(p => <button key={p.value} type="button" onClick={() => setPeriod(p.value)} aria-pressed={period === p.value}
            style={{ padding: "10px 13px", borderRadius: 9, border: period === p.value ? "1px solid #0f766e" : "1px solid #d9e2ea", background: period === p.value ? "#0f766e" : "white", color: period === p.value ? "white" : palette.ink, fontWeight: 600, cursor: "pointer" }}>{p.label}</button>)}
        </div>
        {data && <p style={{ fontSize: 13, color: palette.muted, marginBottom: 0 }}>Showing {data.range.start} to {data.range.end} · South Africa time (SAST)</p>}
      </section>
      {loading && <p role="status" style={{ color: palette.muted }}>Updating dashboard…</p>}
      {error && <p role="alert" style={{ color: "#b91c1c", background: "#fef2f2", padding: 15, borderRadius: 10 }}>{error}</p>}
      {data && !loading && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
          {card("Consultations", data.consultations, "🩺", palette.teal, "Consultation records in selected period")}
          {card("Prescriptions", data.prescriptions, "💊", palette.blue, "Prescriptions created in selected period")}
          {card("Medication items", data.topMedications.reduce((sum, x) => sum + x.count, 0), "📋", "#8b5cf6", "Occurrences among top 20 medications")}
        </div>
        <div style={{ marginBottom: 20 }}><Trend rows={data.timeline} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 430px), 1fr))", gap: 20 }}>
          <RankedBars title="Top 20 ICD-10 diagnoses" subtitle="Most frequent diagnosis codes on prescription items" rows={data.topDiagnoses.map(x => ({ label: x.code, detail: x.description, count: x.count }))} color={palette.teal} />
          <RankedBars title="Top 20 prescribed medications" subtitle="Most frequent medicines by brand/name" rows={data.topMedications.map(x => ({ label: x.name, count: x.count }))} color={palette.blue} />
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: palette.muted, marginTop: 18 }}>{data.note} The medication-item card sums the top 20 only, not all medicines.</p>
      </>}
    </div>
  </main>;
}
