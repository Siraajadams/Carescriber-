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

  useEffect(() => {
    const saved = localStorage.getItem("carescriber_patients");
    if (saved) setPatients(JSON.parse(saved));
  }, []);

  const filteredPatients = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.surname.toLowerCase().includes(q) ||
      p.idNumber.toLowerCase().includes(q) ||
      p.firstName.toLowerCase().includes(q)
    );
  });

  function startRecording() {
    setMessage("");

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "Microphone transcription is not supported on this browser. Please use Chrome or Safari with microphone permission enabled."
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-ZA";

    recognition.onresult = (event: any) => {
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + " ";
        }
      }

      if (finalText.trim()) {
        setTranscript((prev) =>
          `${prev} ${finalText}`.replace(/\s+/g, " ").trim()
        );
      }
    };

    recognition.onerror = () => {
      setMessage(
        "Microphone permission denied or recording stopped by the browser."
      );
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
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
- Consider ICD-10 coding.

Plan:
- Treatment plan to be confirmed by clinician.
- Consider prescription if clinically appropriate.
- Provide patient education.
- Arrange follow-up if required.

ICD-10 SUGGESTIONS
- To be confirmed by clinician.

TASKS
- Review note.
- Confirm diagnosis.
- Confirm treatment plan.
- Save consultation.
`;

    setNote(generated.trim());
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/" style={styles.back}>
          ← Back
        </Link>

        <p style={styles.kicker}>Videomed Clinical Assistant</p>
        <h1 style={styles.title}>New Consultation</h1>
        <p style={styles.subtitle}>
          Select a patient, confirm consent, record the consultation and generate
          a clinical SOAP note.
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
                  <strong>
                    {p.firstName} {p.surname}
                  </strong>
                  <br />
                  ID: {p.idNumber} | Age: {p.age} | {p.gender}
                </button>
              ))}
            </div>
          )}

          {selectedPatient && (
            <div style={styles.selected}>
              Selected:{" "}
              <strong>
                {selectedPatient.firstName} {selectedPatient.surname}
              </strong>{" "}
              | ID: {selectedPatient.idNumber}
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
            />
            <span>
              I have the patient’s consent to use CareScriber AI for clinical
              documentation.
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
                opacity: !recording ? 0.5 : 1,
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
            onChange={(e) => setTranscript(e.target.value)}
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
    background: "#f4f7fb",
    padding: "20px",
    fontFamily:
      "Arial, Helvetica, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    color: "#0f172a",
  },
  card: {
    maxWidth: "900px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 12px 40px rgba(15, 23, 42, 0.12)",
  },
  back: {
    display: "inline-block",
    marginBottom: "20px",
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
    fontSize: "clamp(36px, 8vw, 64px)",
    lineHeight: 1,
    margin: "0 0 16px",
    fontWeight: 800,
  },
  subtitle: {
    fontSize: "20px",
    color: "#475569",
    marginBottom: "28px",
    lineHeight: 1.5,
  },
  section: {
    marginTop: "28px",
    paddingTop: "24px",
    borderTop: "1px solid #e2e8f0",
  },
  heading: {
    fontSize: "28px",
    marginBottom: "16px",
    fontWeight: 800,
  },
  input: {
    width: "100%",
    padding: "16px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    fontSize: "18px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "160px",
    padding: "16px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    fontSize: "18px",
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
  buttonRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  primaryButton: {
    padding: "16px 22px",
    borderRadius: "16px",
    border: "none",
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "17px",
  },
  dangerButton: {
    padding: "16px 22px",
    borderRadius: "16px",
    border: "none",
    background: "#dc2626",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "17px",
  },
  secondaryButton: {
    marginTop: "14px",
    padding: "16px 22px",
    borderRadius: "16px",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: "17px",
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
    padding: "20px",
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
