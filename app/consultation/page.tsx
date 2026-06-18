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

  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("No patient selected");
  const [transcript, setTranscript] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [summary, setSummary] = useState("");
  const [activeTab, setActiveTab] = useState("transcript");
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

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
      setPatientName(`${data.first_name || ""} ${data.last_name || ""}`.trim());
    }
  }

  async function startRecording() {
    try {
      setMessage("");
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        await transcribeRecording();

        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
      setMessage("Recording started. Speak clearly near the device.");
    } catch (error) {
      setMessage(
        "Microphone permission denied or recording is not supported on this device."
      );
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
    setMessage("Recording stopped. Transcribing now...");
  }

  async function transcribeRecording() {
    try {
      const audioBlob = new Blob(chunksRef.current, {
        type: "audio/webm",
      });

      if (audioBlob.size === 0) {
        setMessage("No audio captured. Please try again.");
        setIsTranscribing(false);
        return;
      }

      const formData = new FormData();
      formData.append("audio", audioBlob, "consultation.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Transcription failed.");
        setIsTranscribing(false);
        return;
      }

      if (result.text) {
        setTranscript((prev) =>
          prev ? `${prev}\n\n${result.text}` : result.text
        );
        setActiveTab("transcript");
        setMessage("Transcription completed. Please review the transcript.");
      } else {
        setMessage("No transcript returned.");
      }
    } catch (error) {
      setMessage("Transcription failed. Please check OpenAI setup.");
    } finally {
      setIsTranscribing(false);
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
Doctor to review and confirm clinical assessment.

Plan:
Doctor to complete plan, medication, referral or follow-up.`);

    setSummary(
      `${patientName} was seen for a consultation. Transcript captured and SOAP note generated for doctor review.`
    );

    setActiveTab("soap");
    setMessage("SOAP note generated. Please review before saving.");
  }

  async function saveConsultation() {
    setMessage("");

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
        <Link href="/dashboard" style={styles.link}>
          ← Back to Dashboard
        </Link>

        <h1 style={styles.title}>New Consultation</h1>

        <p style={styles.subtitle}>Patient: {patientName}</p>

        <div style={styles.actions}>
          <button
            onClick={startRecording}
            disabled={isRecording || isTranscribing}
            style={{
              ...styles.green,
              opacity: isRecording || isTranscribing ? 0.6 : 1,
            }}
          >
            🎤 Start Recording
          </button>

          <button
            onClick={stopRecording}
            disabled={!isRecording}
            style={{
              ...styles.red,
              opacity: !isRecording ? 0.6 : 1,
            }}
          >
            ⏹ Stop Recording
          </button>

          <Link href="/patients" style={styles.outline}>
            Select Patient
          </Link>
        </div>

        {isRecording && (
          <div style={styles.recordingBox}>
            Recording in progress...
          </div>
        )}

        {isTranscribing && (
          <div style={styles.message}>
            Processing audio and creating transcript...
          </div>
        )}

        {message && <div style={styles.message}>{message}</div>}

        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab("transcript")}
            style={
              activeTab === "transcript" ? styles.activeTab : styles.tab
            }
          >
            Transcript
          </button>

          <button
            onClick={() => setActiveTab("soap")}
            style={activeTab === "soap" ? styles.activeTab : styles.tab}
          >
            SOAP Note
          </button>

          <button
            onClick={() => setActiveTab("summary")}
            style={activeTab === "summary" ? styles.activeTab : styles.tab}
          >
            Summary
          </button>
        </div>

        {activeTab === "transcript" && (
          <textarea
            style={styles.textarea}
            placeholder="Transcript will appear here after recording. You can also type or paste transcript text here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        )}

        {activeTab === "soap" && (
          <textarea
            style={styles.textarea}
            placeholder="SOAP note will appear here..."
            value={soapNote}
            onChange={(e) => setSoapNote(e.target.value)}
          />
        )}

        {activeTab === "summary" && (
          <textarea
            style={styles.textarea}
            placeholder="Patient summary will appear here..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        )}

        <div style={styles.actions}>
          <button onClick={generateSoap} style={styles.blue}>
            Generate SOAP
          </button>

          <button onClick={saveConsultation} style={styles.dark}>
            Save Consultation
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
    fontSize: 16,
  },
  title: {
    fontSize: 46,
    lineHeight: "52px",
    color: "#0f172a",
    marginTop: 28,
    marginBottom: 16,
  },
  subtitle: {
    color: "#475569",
    fontSize: 22,
    lineHeight: "32px",
  },
  actions: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    marginTop: 24,
  },
  green: {
    background: "#16a34a",
    color: "#ffffff",
    padding: "16px 24px",
    borderRadius: 16,
    border: 0,
    fontSize: 17,
    fontWeight: 700,
    cursor: "pointer",
  },
  red: {
    background: "#dc2626",
    color: "#ffffff",
    padding: "16px 24px",
    borderRadius: 16,
    border: 0,
    fontSize: 17,
    fontWeight: 700,
    cursor: "pointer",
  },
  blue: {
    background: "#2563eb",
    color: "#ffffff",
    padding: "16px 24px",
    borderRadius: 16,
    border: 0,
    fontSize: 17,
    fontWeight: 700,
    cursor: "pointer",
  },
  dark: {
    background: "#0f172a",
    color: "#ffffff",
    padding: "16px 24px",
    borderRadius: 16,
    border: 0,
    fontSize: 17,
    fontWeight: 700,
    cursor: "pointer",
  },
  outline: {
    border: "2px solid #2563eb",
    color: "#2563eb",
    padding: "14px 22px",
    borderRadius: 16,
    textDecoration: "none",
    fontSize: 17,
    fontWeight: 700,
  },
  recordingBox: {
    marginTop: 20,
    background: "#dcfce7",
    color: "#166534",
    padding: 16,
    borderRadius: 16,
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
    padding: "16px 12px",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  activeTab: {
    padding: "16px 12px",
    borderRadius: 16,
    border: "2px solid #2563eb",
    background: "#eff6ff",
    color: "#2563eb",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
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
