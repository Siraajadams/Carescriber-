"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function ConsultationPage() {
  const router = useRouter();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [consultationId, setConsultationId] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("No patient selected");

  const [transcript, setTranscript] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [summary, setSummary] = useState("");

  const [activeTab, setActiveTab] = useState("transcript");
  const [message, setMessage] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkLogin();

    const params = new URLSearchParams(window.location.search);
    const patient = params.get("patient");
    const consultation = params.get("consultation");

    if (consultation) {
      loadConsultation(consultation);
    } else if (patient) {
      setPatientId(patient);
      loadPatient(patient);
    }
  }, []);

  async function checkLogin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) router.push("/login");
  }

  async function loadPatient(id: string) {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data) {
      const name = `${data.first_name || ""} ${
        data.surname || data.last_name || ""
      }`.trim();

      setPatientName(name || "Patient selected");
    }
  }

  async function loadConsultation(id: string) {
    const { data, error } = await supabase
      .from("consultations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) return;

    setConsultationId(data.id);
    setPatientId(data.patient_id || "");
    setTranscript(data.transcript || "");
    setSoapNote(data.soap_note || "");
    setSummary(data.patient_summary || "");
    setSavedAt(data.created_at || "");
    setMessage("Saved consultation loaded.");

    if (data.patient_id) {
      await loadPatient(data.patient_id);
    }
  }

  async function startRecording() {
    try {
      setMessage("");
      chunksRef.current = [];

      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("Audio recording is not supported on this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let recorder: MediaRecorder;

      if (MediaRecorder.isTypeSupported("audio/webm")) {
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        recorder = new MediaRecorder(stream, { mimeType: "audio/mp4" });
      } else {
        recorder = new MediaRecorder(stream);
      }

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        await transcribeRecording();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start(1000);
      setIsRecording(true);
      setMessage("Recording started.");
    } catch {
      setMessage("Microphone permission denied or not supported.");
    }
  }

  function stopRecording() {
    if (!recorderRef.current) {
      setMessage("No active recording found.");
      return;
    }

    recorderRef.current.stop();
    setIsRecording(false);
    setIsTranscribing(true);
    setMessage("Recording stopped. Transcribing...");
  }

  async function transcribeRecording() {
    try {
      const mimeType =
        chunksRef.current[0]?.type ||
        (MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4");

      const audioBlob = new Blob(chunksRef.current, { type: mimeType });

      if (audioBlob.size === 0) {
        setMessage("No audio captured. Please try again.");
        setIsTranscribing(false);
        return;
      }

      const extension = mimeType.includes("mp4") ? "mp4" : "webm";

      const formData = new FormData();
      formData.append("audio", audioBlob, `consultation.${extension}`);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Transcription failed.");
        return;
      }

      setTranscript((prev) =>
        prev ? `${prev}\n\n${result.text || ""}` : result.text || ""
      );

      setActiveTab("transcript");
      setMessage("Transcription completed.");
    } catch {
      setMessage("Transcription failed.");
    } finally {
      setIsTranscribing(false);
    }
  }

  async function generateSoap() {
    if (!transcript.trim()) {
      setMessage("Please add transcript before generating SOAP.");
      return;
    }

    try {
      setIsGenerating(true);
      setMessage("Generating SOAP and ICD-10...");

      const response = await fetch("/api/generate-clinical-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, patientName }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Clinical note generation failed.");
        return;
      }

      const note = result.clinicalNote || "";
      const generatedSummary = `Patient: ${patientName}\nDate: ${new Date().toLocaleString()}\n\nClinical summary generated for doctor review.`;

      setSoapNote(note);
      setSummary(generatedSummary);
      setActiveTab("soap");
      setMessage("SOAP / ICD-10 generated.");
    } catch {
      setMessage("Clinical note generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveConsultation() {
    setMessage("");

    if (!patientId) {
      setMessage("Please select a patient before saving.");
      return;
    }

    if (!transcript.trim() && !soapNote.trim() && !summary.trim()) {
      setMessage("Please capture consultation content before saving.");
      return;
    }

    setIsSaving(true);

    const payload = {
      patient_id: patientId,
      transcript: transcript.trim(),
      soap_note: soapNote.trim(),
      patient_summary: summary.trim(),
      status: "completed",
      created_at: new Date().toISOString(),
    };

    const { data, error } = consultationId
      ? await supabase
          .from("consultations")
          .update(payload)
          .eq("id", consultationId)
          .select()
          .single()
      : await supabase
          .from("consultations")
          .insert(payload)
          .select()
          .single();

    setIsSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data) {
      setConsultationId(data.id);
      setSavedAt(data.created_at);
      setMessage("Consultation saved with date stamp.");
    }
  }

  function printPdfSummary() {
    const dateText = savedAt
      ? new Date(savedAt).toLocaleString()
      : new Date().toLocaleString();

    const html = `
      <html>
        <head>
          <title>CareScriber Consultation Summary</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            h1 { font-size: 28px; }
            h2 { margin-top: 28px; font-size: 20px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
            pre { white-space: pre-wrap; font-family: Arial, sans-serif; line-height: 1.5; }
          </style>
        </head>
        <body>
          <h1>CareScriber Consultation Summary</h1>
          <p><strong>Patient:</strong> ${patientName}</p>
          <p><strong>Date stamped:</strong> ${dateText}</p>

          <h2>Patient Summary</h2>
          <pre>${summary || "No summary captured."}</pre>

          <h2>SOAP / ICD-10</h2>
          <pre>${soapNote || "No SOAP note captured."}</pre>

          <h2>Transcript</h2>
          <pre>${transcript || "No transcript captured."}</pre>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) {
      setMessage("Popup blocked. Please allow popups to create PDF.");
      return;
    }

    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/dashboard" style={styles.link}>
          ← Back to Dashboard
        </Link>

        <h1 style={styles.title}>
          {consultationId ? "Saved Consultation" : "New Consultation"}
        </h1>

        <p style={styles.subtitle}>Patient: {patientName}</p>

        {savedAt && (
          <p style={styles.dateStamp}>
            Date stamped: {new Date(savedAt).toLocaleString()}
          </p>
        )}

        <div style={styles.actions}>
          <button onClick={startRecording} disabled={isRecording} style={styles.green}>
            🎤 Start Recording
          </button>

          <button onClick={stopRecording} disabled={!isRecording} style={styles.red}>
            ⏹ Stop Recording
          </button>

          <Link href="/patients" style={styles.outline}>
            Select Patient
          </Link>
        </div>

        {message && <div style={styles.message}>{message}</div>}

        <div style={styles.tabs}>
          <button onClick={() => setActiveTab("transcript")} style={activeTab === "transcript" ? styles.activeTab : styles.tab}>
            Transcript
          </button>
          <button onClick={() => setActiveTab("soap")} style={activeTab === "soap" ? styles.activeTab : styles.tab}>
            SOAP / ICD-10
          </button>
          <button onClick={() => setActiveTab("summary")} style={activeTab === "summary" ? styles.activeTab : styles.tab}>
            Summary
          </button>
        </div>

        {activeTab === "transcript" && (
          <textarea style={styles.textarea} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Transcript will appear here..." />
        )}

        {activeTab === "soap" && (
          <textarea style={styles.textarea} value={soapNote} onChange={(e) => setSoapNote(e.target.value)} placeholder="SOAP / ICD-10 will appear here..." />
        )}

        {activeTab === "summary" && (
          <textarea style={styles.textarea} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summary will appear here..." />
        )}

        <div style={styles.actions}>
          <button onClick={generateSoap} disabled={isGenerating} style={styles.blue}>
            {isGenerating ? "Generating..." : "Generate SOAP / ICD-10"}
          </button>

          <button onClick={saveConsultation} disabled={isSaving} style={styles.dark}>
            {isSaving ? "Saving..." : "Save Consultation"}
          </button>

          <button onClick={printPdfSummary} style={styles.pdf}>
            Download PDF Summary
          </button>
        </div>
      </div>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  card: {
    maxWidth: 900,
    margin: "0 auto",
    background: "#ffffff",
    padding: 32,
    borderRadius: 28,
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.14)",
  },
  link: {
    color: "#2563eb",
    fontWeight: 700,
    textDecoration: "none",
  },
  title: {
    fontSize: 46,
    color: "#0f172a",
    marginTop: 28,
    marginBottom: 16,
  },
  subtitle: {
    color: "#475569",
    fontSize: 22,
  },
  dateStamp: {
    background: "#ecfeff",
    color: "#155e75",
    padding: 12,
    borderRadius: 12,
    fontWeight: 700,
  },
  actions: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    marginTop: 24,
  },
  green: {
    background: "#16a34a",
    color: "#fff",
    padding: "16px 24px",
    borderRadius: 16,
    border: 0,
    fontWeight: 700,
  },
  red: {
    background: "#dc2626",
    color: "#fff",
    padding: "16px 24px",
    borderRadius: 16,
    border: 0,
    fontWeight: 700,
  },
  blue: {
    background: "#2563eb",
    color: "#fff",
    padding: "16px 24px",
    borderRadius: 16,
    border: 0,
    fontWeight: 700,
  },
  dark: {
    background: "#0f172a",
    color: "#fff",
    padding: "16px 24px",
    borderRadius: 16,
    border: 0,
    fontWeight: 700,
  },
  pdf: {
    background: "#9333ea",
    color: "#fff",
    padding: "16px 24px",
    borderRadius: 16,
    border: 0,
    fontWeight: 700,
  },
  outline: {
    border: "2px solid #2563eb",
    color: "#2563eb",
    padding: "14px 22px",
    borderRadius: 16,
    textDecoration: "none",
    fontWeight: 700,
  },
  message: {
    background: "#dbeafe",
    color: "#1e40af",
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
    fontWeight: 600,
  },
  tabs: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginTop: 28,
  },
  tab: {
    padding: 16,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    fontWeight: 700,
  },
  activeTab: {
    padding: 16,
    borderRadius: 16,
    border: "2px solid #2563eb",
    background: "#eff6ff",
    color: "#2563eb",
    fontWeight: 700,
  },
  textarea: {
    width: "100%",
    minHeight: 340,
    marginTop: 24,
    padding: 20,
    borderRadius: 18,
    border: "1px solid #cbd5e1",
    fontSize: 17,
    lineHeight: "26px",
    boxSizing: "border-box",
  },
};
