"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Patient = {
  firstName: string;
  surname: string;
  idNumber: string;
  age: string;
  dob: string;
  gender: string;
  mobile: string;
  email: string;
  medicalAid: string;
  allergies: string;
  currentMedicines: string;
};

export default function NewConsultationPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const saved = localStorage.getItem("carescriber_patients");
    if (saved) {
      try {
        setPatients(JSON.parse(saved));
      } catch {
        setPatients([]);
      }
    }
  }, []);

  const filteredPatients = patients.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return false;

    return (
      p.firstName?.toLowerCase().includes(q) ||
      p.surname?.toLowerCase().includes(q) ||
      p.idNumber?.toLowerCase().includes(q) ||
      `${p.firstName} ${p.surname}`.toLowerCase().includes(q)
    );
  });

  function startRecording() {
    setMessage("");

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "Microphone transcription is not supported on this browser. On iPhone, use Safari or Chrome, allow microphone access, and keep the browser tab open."
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-ZA";

      recognition.onresult = (event: any) => {
        let interimText = "";
        let newFinalText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            newFinalText += text + " ";
          } else {
            interimText += text + " ";
          }
        }

        if (newFinalText.trim()) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${newFinalText}`
            .replace(/\s+/g, " ")
            .trim();
        }

        setTranscript(
          `${finalTranscriptRef.current} ${interimText}`
            .replace(/\s+/g, " ")
            .trim()
        );
      };

      recognition.onerror = (event: any) => {
        setMessage(
          event?.error === "not-allowed"
            ? "Microphone permission denied. Please allow microphone access in the browser settings."
            : "Recording stopped or microphone error occurred. You can continue typing notes manually."
        );
        setRecording(false);
      };

      recognition.onend = () => {
        setRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setRecording(true);
    } catch {
      setMessage("Unable to start recording. Please try again or type notes manually.");
      setRecording(false);
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  function generateNote() {
    if (!selectedPatient) {
      setMessage("Please select a patient first.");
      return;
    }

    const generated = `
PATIENT SUMMARY
Name: ${selectedPatient.firstName} ${selectedPatient.surname}
ID Number: ${selectedPatient.idNumber}
Age: ${selectedPatient.age}
DOB: ${selectedPatient.dob}
Gender: ${selectedPatient.gender}
Mobile: ${selectedPatient.mobile}
Email: ${selectedPatient.email || "Not captured"}
Medical Aid: ${selectedPatient.medicalAid || "Not captured"}
Allergies: ${selectedPatient.allergies || "No known allergies"}
Current Medicines: ${selectedPatient.currentMedicines || "Not captured"}

CONSENT
${consent ? "Patient consented to AI-assisted clinical documentation." : "Consent not confirmed."}

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
- Consider differential diagnosis based on symptoms.

Plan:
- Treatment plan to be confirmed by clinician.
- Consider ICD-10 coding.
- Consider prescription if clinically appropriate.
- Provide patient education.
- Arrange follow-up if required.

ICD-10 SUGGESTIONS
- To be confirmed by clinician.

TASKS
- Review clinical note.
- Confirm diagnosis.
- Confirm treatment plan.
- Save consultation.
`;

    setNote(generated.trim());
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/" style={styles.back}>← Back</Link>

        <p style={styles.kicker}>Videomed Clinical Assistant</p>
        <h1 style={styles.title}>New Consultation</h1>
        <p style={styles.subtitle}>
          Select a patient, confirm consent, record the consultation and generate a clinical SOAP note.
        </p>

        <section style={styles.section}>
          <h2 style={styles.heading}>Find Patient</h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by surname, first name or ID number"
            style={styles.input}
          />

          {search && (
            <div style={styles.results}>
              {filteredPatients.length === 0 && (
                <p style={styles.muted}>No matching patient found.</p>
              )}

              {filteredPatients.map((p, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedPatient(p)}
                  style={styles.patientButton}
                >
                  <strong>{p.firstName} {p.surname}</strong>
                  <span>ID: {p.idNumber} | Age: {p.age} | {p.gender}</span>
                </button>
              ))}
            </div>
          )}

          {selectedPatient && (
            <div style={styles.selected}>
              Selected: <strong>{selectedPatient.firstName} {selectedPatient.surname}</strong>
              <br />
              ID: {selectedPatient.idNumber} | Age: {selectedPatient.age} | {selectedPatient.gender}
            </div>
          )}
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>AI Consent</h2>

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={styles.checkbox}
            />
            <span>
              I have the patient’s consent to use CareScriber AI for clinical documentation.
            </span>
          </label>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>Recording</h2>

          <div style={styles.buttonRow}>
            <button
              onClick={startRecording}
              disabled={recording}
              style={{
                ...styles.primaryButton,
                opacity: recording ? 0.6 : 1,
              }}
            >
              🎙 Start Recording
            </button>

            <button
              onClick={stopRecording}
              disabled={!recording}
              style={{
                ...styles.dangerButton,
                opacity: !recording ? 0.45 : 1,
              }}
            >
              ⏹ Stop Recording
            </button>
          </div>

          {recording && <p style={styles.recording}>Recording in progress...</p>}
          {message && <p style={styles.message}>{message}</p>}
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>Transcript / Clinical Notes</h2>

          <textarea
            value={transcript}
            onChange={(e) => {
              finalTranscriptRef.current = e.target.value;
              setTranscript(e.target.value);
            }}
            placeholder="Transcript will appear here. You can also type or edit notes manually."
            style={styles.textarea}
          />

          <button onClick={generateNote} style={styles.secondaryButton}>
            Generate SOAP Note
          </button>
        </section>

        {note && (
          <section style={styles.noteBox}>
            <h2 style={styles.heading}>Generated Clinical Note</h2>
            <pre style={styles.pre}>{note}</pre>
          </section>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#eef4fb",
    padding: "18px",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#0f172a",
  },
  card: {
    maxWidth: "860px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 12px 36px rgba(15,23,42,0.12)",
  },
  back: {
    display: "inline-block",
    marginBottom: "18px",
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 700,
  },
  kicker: {
    color: "#2563eb",
    fontWeight: 700,
    marginBottom: "8px",
  },
  title: {
    fontSize: "clamp(34px, 8vw, 58px)",
    lineHeight: 1,
    margin: "0 0 16px",
    fontWeight: 800,
  },
  subtitle: {
    fontSize: "18px",
    color: "#475569",
    lineHeight: 1.5,
  },
  section: {
    marginTop: "26px",
    paddingTop: "22px",
    borderTop: "1px solid #e2e8f0",
  },
  heading: {
    fontSize: "28px",
    margin: "0 0 16px",
    fontWeight: 800,
  },
  input: {
    width: "100%",
    padding: "16px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    fontSize: "17px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "160px",
    padding: "16px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    fontSize: "17px",
    boxSizing: "border-box",
    resize: "vertical",
  },
  results: {
    marginTop: "12px",
    display: "grid",
    gap: "10px",
  },
  patientButton: {
    textAlign: "left",
    padding: "16px",
    borderRadius: "14px",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    fontSize: "16px",
    cursor: "pointer",
    display: "grid",
    gap: "6px",
  },
  selected: {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "14px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "16px",
  },
  checkboxRow: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    fontSize: "18px",
    lineHeight: 1.4,
  },
  checkbox: {
    width: "22px",
    height: "22px",
    marginTop: "2px",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  primaryButton: {
    padding: "15px 22px",
    borderRadius: "16px",
    border: "none",
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "16px",
  },
  dangerButton: {
    padding: "15px 22px",
    borderRadius: "16px",
    border: "none",
    background: "#dc2626",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "16px",
  },
  secondaryButton: {
    marginTop: "14px",
    padding: "15px 22px",
    borderRadius: "16px",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "16px",
  },
  recording: {
    marginTop: "12px",
    color: "#dc2626",
    fontWeight: 700,
  },
  message: {
    marginTop: "12px",
    padding: "14px",
    borderRadius: "14px",
    background: "#dbeafe",
    color: "#1e40af",
    fontWeight: 700,
  },
  muted: {
    color: "#64748b",
  },
  noteBox: {
    marginTop: "28px",
    padding: "18px",
    borderRadius: "20px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  pre: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: "15px",
    lineHeight: 1.6,
    fontFamily: "Arial, Helvetica, sans-serif",
  },
};
