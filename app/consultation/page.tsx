"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Patient = {
  id: string;
  first_name: string;
  surname: string;
  id_number?: string;
  age?: number | null;
  date_of_birth?: string | null;
  gender?: string;
  mobile?: string;
  medical_aid?: string;
  allergies?: string;
  current_medicines?: string;
};

type Consultation = {
  id: string;
  created_at?: string;
  patient_summary?: string;
  transcript?: string;
  soap_note?: string;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function ConsultationPage() {
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPatients();
    loadRecentConsultations();
  }, []);

  async function loadPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Could not load patients: " + error.message);
      return;
    }

    setPatients(
      (data || []).map((p: any) => ({
        id: p.id,
        first_name: p.first_name || p.name || "",
        surname: p.surname || p.last_name || "",
        id_number: p.id_number || p.patient_id || "",
        age: p.age || null,
        date_of_birth: p.date_of_birth || p.dob || null,
        gender: p.gender || "",
        mobile: p.mobile || p.mobile_number || "",
        medical_aid: p.medical_aid || "",
        allergies: p.allergies || "No known allergies",
        current_medicines: p.current_medicines || "",
      }))
    );
  }

  async function loadRecentConsultations() {
    const { data } = await supabase
      .from("consultations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    setRecentConsultations(data || []);
  }

  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q || selectedPatient) return [];

    return patients.filter((p) => {
      const fullText = `
        ${p.first_name}
        ${p.surname}
        ${p.first_name} ${p.surname}
        ${p.id_number}
        ${p.mobile}
      `.toLowerCase();

      return fullText.includes(q);
    });
  }, [patients, search, selectedPatient]);

  function selectPatient(patient: Patient) {
    setSelectedPatient(patient);
    setSearch("");
    setMessage("");
  }

  function changePatient() {
    setSelectedPatient(null);
    setSearch("");
    setNote("");
  }

  function startRecording() {
    setMessage("");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("Microphone transcription is not supported on this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-ZA";

    finalTranscriptRef.current = transcript;

    recognition.onresult = (event: any) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim();

        if (event.results[i].isFinal) {
          if (text && !finalTranscriptRef.current.includes(text)) {
            finalTranscriptRef.current =
              `${finalTranscriptRef.current} ${text}`.trim();
          }
        } else {
          interimTranscript = `${interimTranscript} ${text}`.trim();
        }
      }

      setTranscript(
        `${finalTranscriptRef.current} ${interimTranscript}`.trim()
      );
    };

    recognition.onerror = () => {
      setMessage("Microphone permission denied or not supported.");
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognition.start();
    setRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  async function generateSoapNote() {
    if (!selectedPatient) {
      setMessage("Please select a patient first.");
      return;
    }

    if (!consent) {
      setMessage("Please confirm AI consent first.");
      return;
    }

    const generated = `
PATIENT SUMMARY
Name: ${selectedPatient.first_name} ${selectedPatient.surname}
ID Number: ${selectedPatient.id_number || "Not captured"}
Age: ${selectedPatient.age || "Not captured"}
DOB: ${selectedPatient.date_of_birth || "Not captured"}
Gender: ${selectedPatient.gender || "Not captured"}
Mobile: ${selectedPatient.mobile || "Not captured"}
Medical Aid: ${selectedPatient.medical_aid || "Not captured"}
Allergies: ${selectedPatient.allergies || "No known allergies"}
Current Medicines: ${selectedPatient.current_medicines || "Not captured"}

CONSENT
Patient consented to AI-assisted clinical documentation.

TRANSCRIPT
${transcript || "No transcript captured."}

SOAP NOTE

Subjective:
- Patient reports: ${transcript || "History to be completed."}

Objective:
- Examination findings to be completed by clinician.
- Vitals to be added if available.

Assessment:
- Clinical impression pending clinician confirmation.
- Consider differential diagnosis.

Plan:
- Treatment plan to be confirmed by clinician.
- Consider ICD-10 coding.
- Consider prescription if clinically appropriate.
- Provide patient education.
- Arrange follow-up if required.

ICD-10 SUGGESTIONS
- To be confirmed by clinician.
`;

    setNote(generated);

    await supabase.from("consultations").insert({
      patient_id: selectedPatient.id,
      patient_summary: `${selectedPatient.first_name} ${selectedPatient.surname} clinical note generated`,
      transcript,
      soap_note: generated,
      consent_confirmed: consent,
    });

    loadRecentConsultations();
  }

  function downloadPdf() {
    if (!note) return;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setMessage("Popup blocked. Please allow popups to export PDF.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>CareScriber Clinical Note</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 32px;
              color: #0f172a;
              line-height: 1.6;
            }
            h1 {
              color: #1d4ed8;
            }
            pre {
              white-space: pre-wrap;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <h1>CareScriber Clinical Note</h1>
          <pre>${note.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/dashboard" style={styles.back}>
          ← Back to Dashboard
        </Link>

        <p style={styles.kicker}>Videomed Clinical Assistant</p>
        <h1 style={styles.title}>New Consultation</h1>

        <p style={styles.subtitle}>
          Select a patient, confirm consent, record the consultation and generate
          a clinical SOAP note.
        </p>

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Find Patient</h2>

        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedPatient(null);
          }}
          placeholder="Search by surname, first name, ID number or mobile"
          style={styles.input}
        />

        {search.trim() !== "" &&
          filteredPatients.length === 0 &&
          !selectedPatient && (
            <p style={styles.muted}>No matching patient found.</p>
          )}

        {filteredPatients.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPatient(p)}
            style={styles.patientCard}
          >
            <strong>
              {p.first_name} {p.surname}
            </strong>
            <span>
              ID: {p.id_number || "N/A"} · Age: {p.age || "N/A"} ·{" "}
              {p.gender || "N/A"}
            </span>
          </button>
        ))}

        {selectedPatient && (
          <div style={styles.selected}>
            <strong>
              Selected: {selectedPatient.first_name} {selectedPatient.surname}
            </strong>
            <br />
            ID: {selectedPatient.id_number || "Not captured"}
            <br />
            Age: {selectedPatient.age || "Not captured"} ·{" "}
            {selectedPatient.gender || "Not captured"}
            <br />
            <button type="button" onClick={changePatient} style={styles.changeButton}>
              Change Patient
            </button>
          </div>
        )}

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>AI Consent</h2>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={styles.checkbox}
          />
          <span>
            I have the patient’s consent to use CareScriber AI for clinical
            documentation.
          </span>
        </label>

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Recording</h2>

        <div style={styles.buttonRow}>
          <button
            type="button"
            onClick={startRecording}
            disabled={recording}
            style={{ ...styles.primaryButton, opacity: recording ? 0.5 : 1 }}
          >
            🎙 Start Recording
          </button>

          <button
            type="button"
            onClick={stopRecording}
            disabled={!recording}
            style={{ ...styles.dangerButton, opacity: !recording ? 0.5 : 1 }}
          >
            ⏹ Stop Recording
          </button>
        </div>

        {message && <p style={styles.message}>{message}</p>}

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Transcript / Clinical Notes</h2>

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcript will appear here. You can edit it before generating SOAP."
          style={styles.textarea}
        />

        <button type="button" onClick={generateSoapNote} style={styles.blueButton}>
          Generate SOAP Note
        </button>

        {note && (
          <>
            <h2 style={styles.sectionTitle}>Generated Clinical Note</h2>

            <button type="button" onClick={downloadPdf} style={styles.pdfButton}>
              Download / Print PDF
            </button>

            <pre style={styles.noteBox}>{note}</pre>
          </>
        )}

        <hr style={styles.divider} />

        <h2 style={styles.smallTitle}>Recent Consultations</h2>

        <Link href="/consultation" style={styles.secondaryButton}>
          Start New Consultation
        </Link>

        {recentConsultations.length === 0 ? (
          <p style={styles.muted}>No recent consultations yet.</p>
        ) : (
          recentConsultations.map((c) => (
            <div key={c.id} style={styles.recentCard}>
              <strong>{c.patient_summary || "Clinical consultation"}</strong>
              <span>{c.created_at || ""}</span>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#eef4fb",
    padding: "24px 12px",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    color: "#0f172a",
  },
  card: {
    maxWidth: "760px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "28px",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)",
  },
  back: {
    color: "#2563eb",
    fontWeight: 700,
    textDecoration: "none",
    fontSize: "18px",
  },
  kicker: {
    color: "#2563eb",
    fontWeight: 800,
    marginTop: "32px",
  },
  title: {
    fontSize: "clamp(42px, 10vw, 72px)",
    lineHeight: 1,
    margin: 0,
    fontWeight: 900,
  },
  subtitle: {
    fontSize: "clamp(22px, 5vw, 34px)",
    lineHeight: 1.35,
    color: "#526174",
    marginTop: "28px",
  },
  divider: {
    border: 0,
    borderTop: "1px solid #e2e8f0",
    margin: "36px 0",
  },
  sectionTitle: {
    fontSize: "clamp(34px, 7vw, 52px)",
    marginBottom: "24px",
    fontWeight: 900,
  },
  smallTitle: {
    fontSize: "32px",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "2px solid #cbd5e1",
    borderRadius: "20px",
    padding: "22px",
    fontSize: "22px",
  },
  muted: {
    color: "#64748b",
    fontSize: "20px",
    marginTop: "20px",
  },
  patientCard: {
    width: "100%",
    textAlign: "left",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "20px",
    padding: "20px",
    marginTop: "16px",
    display: "grid",
    gap: "8px",
    fontSize: "20px",
    cursor: "pointer",
  },
  selected: {
    marginTop: "18px",
    padding: "18px",
    background: "#dcfce7",
    borderRadius: "18px",
    color: "#166534",
    fontWeight: 800,
    fontSize: "18px",
  },
  changeButton: {
    marginTop: "12px",
    border: "1px solid #86efac",
    background: "#ffffff",
    borderRadius: "12px",
    padding: "10px 14px",
    color: "#166534",
    fontWeight: 800,
  },
  checkboxRow: {
    display: "flex",
    gap: "18px",
    fontSize: "24px",
    lineHeight: 1.4,
  },
  checkbox: {
    width: "28px",
    height: "28px",
    marginTop: "4px",
  },
  buttonRow: {
    display: "grid",
    gap: "18px",
  },
  primaryButton: {
    border: 0,
    borderRadius: "22px",
    padding: "22px",
    background: "#16a34a",
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: 900,
  },
  dangerButton: {
    border: 0,
    borderRadius: "22px",
    padding: "22px",
    background: "#dc2626",
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: 900,
  },
  blueButton: {
    width: "100%",
    border: 0,
    borderRadius: "18px",
    padding: "20px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: 900,
    marginTop: "18px",
  },
  pdfButton: {
    width: "100%",
    border: 0,
    borderRadius: "18px",
    padding: "18px",
    background: "#0f172a",
    color: "#ffffff",
    fontSize: "20px",
    fontWeight: 900,
    marginBottom: "18px",
  },
  secondaryButton: {
    display: "block",
    textAlign: "center",
    textDecoration: "none",
    borderRadius: "18px",
    padding: "18px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: "20px",
    fontWeight: 900,
    marginBottom: "18px",
  },
  textarea: {
    width: "100%",
    minHeight: "180px",
    boxSizing: "border-box",
    border: "2px solid #cbd5e1",
    borderRadius: "20px",
    padding: "22px",
    fontSize: "20px",
    lineHeight: 1.5,
  },
  message: {
    background: "#dbeafe",
    color: "#1e40af",
    padding: "18px",
    borderRadius: "16px",
    fontWeight: 700,
  },
  noteBox: {
    whiteSpace: "pre-wrap",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "20px",
    padding: "22px",
    fontSize: "16px",
    lineHeight: 1.6,
    overflowX: "auto",
  },
  recentCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "16px",
    marginTop: "12px",
    display: "grid",
    gap: "6px",
  },
};
