"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Entry = { count: number; code?: string; description?: string; name?: string };
type Analytics = { consultations: number; prescriptions: number; topDiagnoses: Entry[]; topMedications: Entry[]; note: string };
export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) throw new Error("Please sign in first.");
        const response = await fetch("/api/admin/analytics", {
          cache: "no-store", headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load analytics");
        if (active) setData(result as Analytics);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Unexpected error"); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);
  return <main style={{ maxWidth: 1050, margin: "40px auto", padding: 24, fontFamily: "Arial, sans-serif" }}>
    <Link href="/dashboard">← Doctor dashboard</Link>
    <h1>CareScriber — Administrator Analytics</h1>
    {loading && <p>Loading secure analytics…</p>}
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {data && <>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div><h2>Consultations</h2><strong style={{ fontSize: 36 }}>{data.consultations}</strong></div>
        <div><h2>Prescriptions</h2><strong style={{ fontSize: 36 }}>{data.prescriptions}</strong></div>
      </div>
      <h2>Top 20 ICD-10 diagnoses</h2>
      <table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>Code</th><th>Diagnosis</th><th>Items</th></tr></thead><tbody>
        {data.topDiagnoses.map(x => <tr key={x.code}><td>{x.code}</td><td>{x.description}</td><td>{x.count}</td></tr>)}
      </tbody></table>
      <h2>Top 20 prescribed medications</h2>
      <table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>Medication</th><th>Items</th></tr></thead><tbody>
        {data.topMedications.map(x => <tr key={x.name}><td>{x.name}</td><td>{x.count}</td></tr>)}
      </tbody></table>
      <p style={{ color: "#475569" }}>{data.note}</p>
    </>}
  </main>;
}
