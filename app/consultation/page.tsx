"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

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

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function ConsultationPage() {
  const recognitionRef = useRef<any>(null);
  const shouldKeepRecordingRef = useRef(false);
  const finalTranscriptRef = useRef("");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const isInAppBrowser =
    typeof navigator !== "undefined" &&
    /WhatsApp|FBAN|FBAV|Instagram/i.test(navigator.userAgent);

  useEffect(() => {
    loadPatients();
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

  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q || selectedPatient) return [];

    return patients.filter((p) =>
      `${p.first_name} ${p.surname} ${p.id_number} ${p.mobile}`
        .toLowerCase()
        .includes(q)
    );
  }, [patients, search, selectedPatient]);

  function newConsultation() {
    setSelectedPatient(null);
    setSearch("");
    setConsent(false);
    setTranscript("");
    setNote("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startRecording() {
    setMessage("");

    if (isInAppBrowser) {
      setMessage(
        "Microphone may not work inside WhatsApp. Open CareScriber in Safari or Chrome."
      );
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("Speech recognition is not supported. Use Safari or Chrome.");
      return;
    }

    shouldKeepRecordingRef.current = true;
    finalTranscriptRef.current = transcript.trim();

    const startNewRecognition = () => {
      if (!shouldKeepRecordingRef.current) return;

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.lang = "en-ZA";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let interimText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript.trim();

          if (event.results[i].isFinal) {
            if (
              text &&
              !finalTranscriptRef.current.toLowerCase().endsWith(text.toLowerCase())
            ) {
              finalTranscriptRef.current =
                `${finalTranscriptRef.current} ${text}`.trim();
            }
          } else {
            interimText = `${interimText} ${text}`.trim();
          }
        }

        setTranscript(`${finalTranscriptRef.current} ${interimText}`.trim());
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          setMessage("Microphone permission denied.");
          shouldKeepRecordingRef.current = false;
          setRecording(false);
        }
      };

      recognition.onend = () => {
        if (shouldKeepRecordingRef.current) {
          setTimeout(startNewRecognition, 700);
        } else {
          setRecording(false);
        }
      };

      recognition.start();
      setRecording(true);
    };

    startNewRecognition();
  }

  function stopRecording() {
    shouldKeepRecordingRef.current = false;
    recognitionRef.current?.stop();
    setRecording(false);
    setMessage("Recording stopped. You can edit the transcript.");
  }

  async function generateSoapNote() {
    if (!selectedPatient) return setMessage("Please select a patient first.");
    if (!consent) return setMessage("Please confirm AI consent first.");

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

Plan:
- Treatment plan to be confirmed by clinician.
- Consider ICD-10 coding.
- Consider prescription if clinically appropriate.
- Provide patient education.
- Arrange follow-up if required.
`;

    setNote(generated);

    await supabase.from("consultations").insert({
      patient_id: selectedPatient.id,
      patient_summary: `${selectedPatient.first_name} ${selectedPatient.surname}`,
      transcript,
      soap_note: generated,
      consent_confirmed: consent,
    });
  }

  function printPdf() {
    window.print();
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/dashboard" style={styles.back}>← Back to Dashboard</Link>

        {isInAppBrowser && (
          <div style={styles.warningBox}>
            Microphone recording may not work inside WhatsApp. Open this page in Safari or Chrome.
          </div>
        )}

        <p style={styles.kicker}>Videomed Clinical Assistant</p>
        <h1 style={styles.title}>CareScriber Consultation</h1>
        <p style={styles.subtitle}>
          Select patient, confirm consent, record, edit transcript and generate SOAP.
        </p>

        <button onClick={newConsultation} style={styles.secondaryButton}>
          + New Consultation
        </button>

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Find Patient</h2>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedPatient(null);
          }}
          placeholder="Search surname, first name, ID or mobile"
          style={styles.input}
        />

        {search && !selectedPatient && filteredPatients.length === 0 && (
          <p style={styles.muted}>No matching patient found.</p>
        )}

        {filteredPatients.map((p) => (
          <button key={p.id} onClick={() => setSelectedPatient(p)} style={styles.patientCard}>
            <strong>{p.first_name} {p.surname}</strong>
            <span>ID: {p.id_number || "N/A"} · Age: {p.age || "N/A"} · {p.gender || "N/A"}</span>
          </button>
        ))}

        {selectedPatient && (
          <div style={styles.selected}>
            Selected: {selectedPatient.first_name} {selectedPatient.surname} · ID:{" "}
            {selectedPatient.id_number || "Not captured"}
          </div>
        )}

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>AI Consent</h2>
        <label style={styles.checkboxRow}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          I have the patient’s consent to use CareScriber AI.
        </label>

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Recording</h2>
        <button onClick={startRecording} disabled={recording} style={styles.startButton}>
          🎙 Start Recording
        </button>
        <button onClick={stopRecording} disabled={!recording} style={styles.stopButton}>
          ⏹ Stop Recording
        </button>

        {message && <p style={styles.message}>{message}</p>}

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Editable Transcript / Clinical Notes</h2>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcript will appear here. Clinician can edit before generating SOAP."
          style={styles.textarea}
        />

        <button onClick={generateSoapNote} style={styles.primaryButton}>
          Generate SOAP Note
        </button>

        {note && (
          <>
            <button onClick={printPdf} style={styles.pdfButton}>Export / Print PDF</button>
            <pre style={styles.noteBox}>{note}</pre>
          </>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#eef4fb", padding: 18, fontFamily: "Arial, sans-serif", color: "#0f172a" },
  card: { maxWidth: 760, margin: "0 auto", background: "white", borderRadius: 28, padding: 28 },
  back: { color: "#2563eb", fontWeight: 800, textDecoration: "none", fontSize: 18 },
  warningBox: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 16, padding: 16, fontWeight: 700, marginTop: 20 },
  kicker: { color: "#2563eb", fontWeight: 900, marginTop: 30 },
  title: { fontSize: 48, lineHeight: 1, margin: "12px 0", fontWeight: 900 },
  subtitle: { fontSize: 24, color: "#526174", lineHeight: 1.4 },
  divider: { border: 0, borderTop: "1px solid #e2e8f0", margin: "32px 0" },
  sectionTitle: { fontSize: 36, fontWeight: 900 },
  input: { width: "100%", boxSizing: "border-box", border: "2px solid #cbd5e1", borderRadius: 18, padding: 18, fontSize: 20 },
  muted: { color: "#64748b", fontSize: 18 },
  patientCard: { width: "100%", textAlign: "left", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 18, padding: 18, marginTop: 12, display: "grid", gap: 6, fontSize: 18 },
  selected: { marginTop: 16, background: "#dcfce7", color: "#166534", padding: 16, borderRadius: 16, fontWeight: 800 },
  checkboxRow: { display: "flex", gap: 12, fontSize: 20, lineHeight: 1.4 },
  startButton: { width: "100%", border: 0, borderRadius: 22, padding: 22, background: "#16a34a", color: "white", fontSize: 22, fontWeight: 900, marginBottom: 14 },
  stopButton: { width: "100%", border: 0, borderRadius: 22, padding: 22, background: "#dc2626", color: "white", fontSize: 22, fontWeight: 900 },
  textarea: { width: "100%", minHeight: 190, border: "2px solid #cbd5e1", borderRadius: 20, padding: 20, fontSize: 20, boxSizing: "border-box" },
  primaryButton: { width: "100%", border: 0, borderRadius: 18, padding: 20, background: "#2563eb", color: "white", fontSize: 22, fontWeight: 900, marginTop: 16 },
  secondaryButton: { width: "100%", border: 0, borderRadius: 18, padding: 18, background: "#dbeafe", color: "#1d4ed8", fontSize: 20, fontWeight: 900, marginTop: 18 },
  pdfButton: { width: "100%", border: 0, borderRadius: 18, padding: 18, background: "#0f172a", color: "white", fontSize: 20, fontWeight: 900, marginTop: 18 },
  message: { background: "#dbeafe", color: "#1e40af", padding: 14, borderRadius: 14, fontWeight: 700 },
  noteBox: { whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 18, padding: 18, fontSize: 15, marginTop: 18 },
};
