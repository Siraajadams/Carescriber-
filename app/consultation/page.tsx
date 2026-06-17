"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function ConsultationPage() {
  const router = useRouter();

  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("No patient selected");
  const [transcript, setTranscript] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [summary, setSummary] = useState("");
  const [activeTab, setActiveTab] = useState("transcript");
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkLogin();

    const params = new URLSearchParams(window.location.search);
    const id = params.get("patient");

    if (id) {
      setPatientId(id);
      loadPatient(id);
    }
  }, []);

  async function checkLogin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
    }
  }

  async function loadPatient(id: string) {
    const { data } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single();

    if (data) {
      setPatientName(`${data.first_name} ${data.surname}`);
    }
  }

  function generateSoap() {
    if (!transcript.trim()) {
      setMessage("Please add transcript before generating SOAP note.");
      return;
    }

    setSoapNote(`Subjective:
${transcript}

Objective:
Not recorded.

Assessment:
Doctor to review.

Plan:
Doctor to complete plan, medication, referral or follow-up.`);

    setSummary(`${patientName} consultation summary generated for doctor review.`);
    setActiveTab("soap");
    setMessage("SOAP note generated.");
  }

  async function saveConsultation() {
    const { error } = await supabase.from("consultations").insert({
      patient_id: patientId || null,
      transcript,
      soap_note: soapNote,
      patient_summary: summary,
      status: "completed",
      created_at: new Date().toISOString(),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Consultation saved successfully.");
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/dashboard" style={styles.link}>← Back to Dashboard</Link>

        <h1 style={styles.title}>New Consultation</h1>
        <p style={styles.subtitle}>Patient: {patientName}</p>

        <div style={styles.actions}>
          <button style={styles.green}>Start Recording</button>
          <button style={styles.red}>Stop Recording</button>
          <Link href="/patients" style={styles.outline}>Select Patient</Link>
        </div>

        {message && <div style={styles.message}>{message}</div>}

        <div style={styles.tabs}>
          <button onClick={() => setActiveTab("transcript")} style={styles.tab}>Transcript</button>
          <button onClick={() => setActiveTab("soap")} style={styles.tab}>SOAP Note</button>
          <button onClick={() => setActiveTab("summary")} style={styles.tab}>Summary</button>
        </div>

        {activeTab === "transcript" && (
          <textarea
            style={styles.textarea}
            placeholder="Type or paste transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        )}

        {activeTab === "soap" && (
          <textarea
            style={styles.textarea}
            value={soapNote}
            onChange={(e) => setSoapNote(e.target.value)}
          />
        )}

        {activeTab === "summary" && (
          <textarea
            style={styles.textarea}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        )}

        <div style={styles.actions}>
          <button onClick={generateSoap} style={styles.blue}>Generate SOAP</button>
          <button onClick={saveConsultation} style={styles.dark}>Save Consultation</button>
        </div>
      </div>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: { minHeight: "100vh", background: "#f1f5f9", padding: 24, fontFamily: "Arial" },
  card: { maxWidth: 1000, margin: "0 auto", background: "#fff", padding: 28, borderRadius: 24 },
  link: { color: "#2563eb", fontWeight: 700, textDecoration: "none" },
  title: { fontSize: 36, color: "#0f172a" },
  subtitle: { color: "#475569", fontSize: 18 },
  actions: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 },
  green: { background: "#16a34a", color: "#fff", padding: "12px 18px", borderRadius: 12, border: 0 },
  red: { background: "#dc2626", color: "#fff", padding: "12px 18px", borderRadius: 12, border: 0 },
  blue: { background: "#2563eb", color: "#fff", padding: "14px 20px", borderRadius: 12, border: 0 },
  dark: { background: "#0f172a", color: "#fff", padding: "14px 20px", borderRadius: 12, border: 0 },
  outline: { border: "1px solid #2563eb", color: "#2563eb", padding: "12px 18px", borderRadius: 12, textDecoration: "none" },
  message: { background: "#dbeafe", color: "#1e40af", padding: 12, borderRadius: 12, marginTop: 18 },
  tabs: { display: "flex", gap: 10, marginTop: 24 },
  tab: { padding: "10px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc" },
  textarea: { width: "100%", minHeight: 320, marginTop: 18, padding: 18, borderRadius: 16, border: "1px solid #cbd5e1", fontSize: 16 },
};
