"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Patient = {
  id: string;
  first_name: string;
  surname: string;
  id_number?: string;
  patient_id?: string;
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
  const keepRecordingRef = useRef(false);
  const finalTranscriptRef = useRef("");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [recent, setRecent] = useState<Consultation[]>([]);

  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [consent, setConsent] = useState(false);

  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [message, setMessage] = useState("");

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoNote, setPhotoNote] = useState("");
  const [imageAnalysis, setImageAnalysis] = useState("");
  const [analyzingImage, setAnalyzingImage] = useState(false);

  const isInAppBrowser =
    typeof navigator !== "undefined" &&
    /WhatsApp|FBAN|FBAV|Instagram/i.test(navigator.userAgent);

  useEffect(() => {
    loadPatients();
    loadRecent();
  }, []);

  async function loadPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Patient load error: " + error.message);
      return;
    }

    const mapped = (data || []).map((p: any) => ({
      id: p.id,
      first_name: p.first_name || p.name || "",
      surname: p.surname || p.last_name || "",
      id_number: p.id_number || p.patient_id || "",
      patient_id: p.patient_id || p.id_number || "",
      age: p.age || null,
      date_of_birth: p.date_of_birth || p.dob || null,
      gender: p.gender || "",
      mobile: p.mobile || p.mobile_number || "",
      medical_aid: p.medical_aid || "",
      allergies: p.allergies || "No known allergies",
      current_medicines: p.current_medicines || "",
    }));

    setPatients(mapped);
  }

  async function loadRecent() {
    const { data } = await supabase
      .from("consultations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    setRecent((data || []) as Consultation[]);
  }

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q || selectedPatient) return [];

    return patients.filter((p) => {
      const text = [
        p.first_name,
        p.surname,
        p.id_number,
        p.patient_id,
        p.mobile,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [patients, search, selectedPatient]);

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setSearch(`${p.first_name} ${p.surname}`.trim());
    setMessage("");
  }

  function newConsultation() {
    stopRecording();
    setSelectedPatient(null);
    setSearch("");
    setConsent(false);
    setTranscript("");
    setSoapNote("");
    setPhotoPreview(null);
    setPhotoFile(null);
    setPhotoNote("");
    setImageAnalysis("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startRecording() {
    setMessage("");

    if (isInAppBrowser) {
      setMessage(
        "Please open CareScriber in Safari or Chrome. WhatsApp browser often blocks microphone access."
      );
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("Speech recognition is not supported on this browser. Use Chrome or Safari.");
      return;
    }

    keepRecordingRef.current = true;
    finalTranscriptRef.current = transcript.trim();

    const startSession = () => {
      if (!keepRecordingRef.current) return;

      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.lang = "en-ZA";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setRecording(true);
          setMessage("Recording started. Speak clearly.");
        };

        recognition.onresult = (event: any) => {
          let interim = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript.trim();

            if (event.results[i].isFinal) {
              const current = finalTranscriptRef.current.toLowerCase();
              const incoming = text.toLowerCase();

              if (text && !current.endsWith(incoming)) {
                finalTranscriptRef.current = `${finalTranscriptRef.current} ${text}`.trim();
              }
            } else {
              interim = `${interim} ${text}`.trim();
            }
          }

          setTranscript(`${finalTranscriptRef.current} ${interim}`.trim());
        };

        recognition.onerror = (event: any) => {
          if (event.error === "not-allowed") {
            keepRecordingRef.current = false;
            setRecording(false);
            setMessage("Microphone permission denied. Allow microphone access in browser settings.");
          } else {
            setMessage("Recording issue: " + event.error);
          }
        };

        recognition.onend = () => {
          if (keepRecordingRef.current) {
            setTimeout(startSession, 800);
          } else {
            setRecording(false);
          }
        };

        recognition.start();
      } catch {
        setMessage("Could not start microphone. Refresh page and try again.");
        setRecording(false);
      }
    };

    startSession();
  }

  function stopRecording() {
    keepRecordingRef.current = false;

    try {
      recognitionRef.current?.stop();
    } catch {}

    setRecording(false);
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoNote("Image captured. Click AI Analyze Image to review.");
    setImageAnalysis("");
  }

  async function analyzeImage() {
    if (!photoFile) {
      setMessage("Please capture or upload an image first.");
      return;
    }

    setAnalyzingImage(true);
    setMessage("");

    const formData = new FormData();
    formData.append("image", photoFile);

    try {
      const res = await fetch("/api/analyze-clinical-image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Image analysis failed.");
        return;
      }

      setImageAnalysis(data.analysis);
      setTranscript((prev) =>
        `${prev}\n\nCLINICAL IMAGE ANALYSIS:\n${data.analysis}`.trim()
      );
      setPhotoNote("AI image analysis completed. Clinician must verify findings.");
    } catch {
      setMessage("Could not analyze image.");
    } finally {
      setAnalyzingImage(false);
    }
  }

  async function generateSoap() {
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
ID Number: ${selectedPatient.id_number || selectedPatient.patient_id || "Not captured"}
Age: ${selectedPatient.age || "Not captured"}
DOB: ${selectedPatient.date_of_birth || "Not captured"}
Gender: ${selectedPatient.gender || "Not captured"}
Mobile: ${selectedPatient.mobile || "Not captured"}
Medical Aid: ${selectedPatient.medical_aid || "Not captured"}
Allergies: ${selectedPatient.allergies || "No known allergies"}
Current Medicines: ${selectedPatient.current_medicines || "Not captured"}

CONSENT
Patient consented to AI-assisted clinical documentation.

TRANSCRIPT / CLINICAL NOTES
${transcript || "No transcript captured."}

IMAGE ANALYSIS
${imageAnalysis || "No clinical image analysis captured."}

SOAP NOTE

Subjective:
- ${transcript || "Patient history to be completed by clinician."}

Objective:
- Examination findings to be completed by clinician.
- Vitals to be added if available.
${imageAnalysis ? "- Clinical image AI analysis reviewed. Clinician must verify findings." : ""}

Assessment:
- Clinical impression pending clinician confirmation.
- Differential diagnosis to be confirmed by clinician.

Plan:
- Treatment plan to be confirmed by clinician.
- Consider ICD-10 coding.
- Consider prescription if clinically appropriate.
- Provide patient education.
- Arrange follow-up if required.

ICD-10 SUGGESTIONS
- To be confirmed by clinician.

REFERRAL / PRESCRIPTION
- Draft only. Clinician must verify before issuing.
`;

    setSoapNote(generated);

    const { error } = await supabase.from("consultations").insert({
      patient_id: selectedPatient.id,
      patient_summary: `${selectedPatient.first_name} ${selectedPatient.surname}`,
      transcript,
      soap_note: generated,
      consent_confirmed: consent,
    });

    if (error) {
      setMessage("SOAP generated, but save failed: " + error.message);
    } else {
      setMessage("SOAP note generated and saved.");
      loadRecent();
    }
  }

  function exportPdf() {
    window.print();
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/dashboard" style={styles.back}>← Back to Dashboard</Link>

        <p style={styles.kicker}>Videomed Clinical Assistant</p>
        <h1 style={styles.title}>CareScriber Consultation</h1>
        <p style={styles.subtitle}>
          Select patient, confirm consent, record, edit transcript, analyze images, generate SOAP and export PDF.
        </p>

        {isInAppBrowser && (
          <div style={styles.warning}>
            Open in Safari or Chrome for microphone recording. WhatsApp browser may block recording.
          </div>
        )}

        <button style={styles.lightButton} onClick={newConsultation}>
          + New Consultation
        </button>

        <hr style={styles.divider} />

        <h2 style={styles.heading}>Find Patient</h2>

        <input
          style={styles.input}
          value={search}
          placeholder="Search surname, first name, ID or mobile"
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedPatient(null);
          }}
        />

        {search && !selectedPatient && filteredPatients.length === 0 && (
          <p style={styles.muted}>No matching patient found.</p>
        )}

        {filteredPatients.map((p) => (
          <button key={p.id} style={styles.patientCard} onClick={() => selectPatient(p)}>
            <strong>{p.first_name} {p.surname}</strong>
            <span>
              ID: {p.id_number || p.patient_id || "N/A"} · Age: {p.age || "N/A"} · {p.gender || "N/A"}
            </span>
          </button>
        ))}

        {selectedPatient && (
          <div style={styles.selected}>
            Selected: {selectedPatient.first_name} {selectedPatient.surname} · ID:{" "}
            {selectedPatient.id_number || selectedPatient.patient_id || "Not captured"}
          </div>
        )}

        <hr style={styles.divider} />

        <h2 style={styles.heading}>AI Consent</h2>

        <label style={styles.checkRow}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>I have the patient’s consent to use CareScriber AI.</span>
        </label>

        <hr style={styles.divider} />

        <h2 style={styles.heading}>Recording</h2>

        <button
          style={{ ...styles.startButton, opacity: recording ? 0.5 : 1 }}
          disabled={recording}
          onClick={startRecording}
        >
          🎙 Start Recording
        </button>

        <button
          style={{ ...styles.stopButton, opacity: !recording ? 0.5 : 1 }}
          disabled={!recording}
          onClick={stopRecording}
        >
          ⏹ Stop Recording
        </button>

        <hr style={styles.divider} />

        <h2 style={styles.heading}>Camera / Clinical Image</h2>

        <label style={styles.cameraButton}>
          📷 Capture or Upload Image
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            style={{ display: "none" }}
          />
        </label>

        {photoPreview && (
          <>
            <img src={photoPreview} alt="Clinical upload" style={styles.preview} />

            <button
              onClick={analyzeImage}
              disabled={analyzingImage}
              style={styles.primaryButton}
            >
              {analyzingImage ? "Analyzing Image..." : "AI Analyze Image"}
            </button>
          </>
        )}

        {photoNote && <p style={styles.muted}>{photoNote}</p>}

        {imageAnalysis && <pre style={styles.noteBox}>{imageAnalysis}</pre>}

        <hr style={styles.divider} />

        <h2 style={styles.heading}>Editable Transcript / Clinical Notes</h2>

        <textarea
          style={styles.textarea}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcript will appear here. Clinician can edit before generating SOAP."
        />

        <button style={styles.primaryButton} onClick={generateSoap}>
          Generate SOAP Note
        </button>

        {message && <div style={styles.message}>{message}</div>}

        {soapNote && (
          <>
            <button style={styles.pdfButton} onClick={exportPdf}>
              Export / Print PDF
            </button>

            <pre style={styles.noteBox}>{soapNote}</pre>
          </>
        )}

        <hr style={styles.divider} />

        <h2 style={styles.heading}>Recent Consultations</h2>

        {recent.length === 0 && <p style={styles.muted}>No recent consultations yet.</p>}

        {recent.map((c) => (
          <div key={c.id} style={styles.recentCard}>
            <strong>{c.patient_summary || "Consultation"}</strong>
            <small>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</small>
            <button
              style={styles.smallButton}
              onClick={() => {
                setTranscript(c.transcript || "");
                setSoapNote(c.soap_note || "");
                setMessage("Recent consultation loaded.");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Open
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#eef4fb",
    padding: "18px",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#0f172a",
  },
  card: {
    maxWidth: 760,
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.10)",
  },
  back: {
    color: "#2563eb",
    fontWeight: 800,
    textDecoration: "none",
    fontSize: 18,
  },
  kicker: {
    marginTop: 30,
    color: "#2563eb",
    fontWeight: 900,
    fontSize: 18,
  },
  title: {
    fontSize: 48,
    lineHeight: 1,
    margin: "12px 0",
    fontWeight: 900,
  },
  subtitle: {
    fontSize: 22,
    color: "#526174",
    lineHeight: 1.45,
  },
  warning: {
    background: "#fff7ed",
    color: "#9a3412",
    padding: 16,
    borderRadius: 16,
    fontWeight: 800,
    marginTop: 18,
  },
  divider: {
    border: 0,
    borderTop: "1px solid #e2e8f0",
    margin: "32px 0",
  },
  heading: {
    fontSize: 34,
    fontWeight: 900,
    marginBottom: 18,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "2px solid #cbd5e1",
    borderRadius: 20,
    padding: 18,
    fontSize: 20,
  },
  muted: {
    color: "#64748b",
    fontSize: 18,
  },
  patientCard: {
    width: "100%",
    textAlign: "left",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: 18,
    padding: 18,
    marginTop: 12,
    display: "grid",
    gap: 6,
    fontSize: 18,
  },
  selected: {
    marginTop: 16,
    background: "#dcfce7",
    color: "#166534",
    padding: 16,
    borderRadius: 16,
    fontWeight: 900,
    fontSize: 17,
  },
  checkRow: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    fontSize: 20,
    lineHeight: 1.4,
  },
  startButton: {
    width: "100%",
    border: 0,
    borderRadius: 22,
    padding: 22,
    background: "#16a34a",
    color: "#fff",
    fontSize: 22,
    fontWeight: 900,
    marginBottom: 14,
  },
  stopButton: {
    width: "100%",
    border: 0,
    borderRadius: 22,
    padding: 22,
    background: "#dc2626",
    color: "#fff",
    fontSize: 22,
    fontWeight: 900,
  },
  cameraButton: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "center",
    borderRadius: 20,
    padding: 20,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 900,
    fontSize: 20,
  },
  preview: {
    width: "100%",
    borderRadius: 18,
    marginTop: 16,
    border: "1px solid #cbd5e1",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 210,
    border: "2px solid #cbd5e1",
    borderRadius: 22,
    padding: 20,
    fontSize: 20,
    lineHeight: 1.5,
  },
  primaryButton: {
    width: "100%",
    border: 0,
    borderRadius: 20,
    padding: 22,
    background: "#2563eb",
    color: "#fff",
    fontSize: 22,
    fontWeight: 900,
    marginTop: 16,
  },
  lightButton: {
    width: "100%",
    border: 0,
    borderRadius: 20,
    padding: 20,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 20,
    fontWeight: 900,
    marginTop: 16,
  },
  pdfButton: {
    width: "100%",
    border: 0,
    borderRadius: 20,
    padding: 20,
    background: "#0f172a",
    color: "#fff",
    fontSize: 20,
    fontWeight: 900,
    marginTop: 18,
  },
  message: {
    background: "#e0f2fe",
    color: "#075985",
    padding: 14,
    borderRadius: 14,
    fontWeight: 800,
    marginTop: 16,
  },
  noteBox: {
    whiteSpace: "pre-wrap",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: 18,
    padding: 18,
    fontSize: 15,
    marginTop: 18,
    overflowX: "auto",
  },
  recentCard: {
    border: "1px solid #cbd5e1",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    display: "grid",
    gap: 8,
  },
  smallButton: {
    border: 0,
    borderRadius: 14,
    padding: 12,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 900,
  },
};
