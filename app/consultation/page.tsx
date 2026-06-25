"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  patient_id?: string;
  patient_summary?: string;
  transcript?: string;
  soap_note?: string;
  icd10?: string;
  plan?: string;
  diagnosis?: string;
  summary?: string;
  consent_confirmed?: boolean;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

function safeText(value: string) {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(value?: string) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function cleanTranscriptText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/(\b[\w'’.-]+(?:\s+\b[\w'’.-]+){2,12})\s+\1/gi, "$1")
    .trim();
}

export default function ConsultationPage() {
  const recognitionRef = useRef<any>(null);
  const shouldKeepRecordingRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const lastFinalRef = useRef("");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [recentConsultations, setRecentConsultations] = useState<Consultation[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [icd10, setIcd10] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [plan, setPlan] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPatients();
    loadRecentConsultations();

    return () => {
      shouldKeepRecordingRef.current = false;
      recognitionRef.current?.stop?.();
    };
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
        patient_id: p.patient_id || p.id_number || "",
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
    const { data, error } = await supabase
      .from("consultations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setMessage("Could not load recent consultations: " + error.message);
      return;
    }

    setRecentConsultations(data || []);
  }

  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q || selectedPatient) return [];

    return patients.filter((p) => {
      const fullText = `${p.first_name} ${p.surname} ${p.id_number} ${p.patient_id} ${p.mobile}`.toLowerCase();
      return fullText.includes(q);
    });
  }, [patients, search, selectedPatient]);

  function selectPatient(patient: Patient) {
    setSelectedPatient(patient);
    setSearch("");
    setSelectedConsultation(null);
    setMessage("");
  }

  function startNewConsultation() {
    stopRecording();
    setSelectedConsultation(null);
    setTranscript("");
    setSoapNote("");
    setIcd10("");
    setClinicalSummary("");
    setPlan("");
    setDiagnosis("");
    setConsent(false);
    finalTranscriptRef.current = "";
    lastFinalRef.current = "";
    setMessage("Ready for a new consultation.");
  }

  function openConsultation(c: Consultation) {
    stopRecording();
    setSelectedConsultation(c);
    setTranscript(c.transcript || "");
    setSoapNote(c.soap_note || "");
    setIcd10(c.icd10 || "");
    setClinicalSummary(c.summary || c.patient_summary || "");
    setPlan(c.plan || "");
    setDiagnosis(c.diagnosis || "");
    setConsent(Boolean(c.consent_confirmed));

    const patient = patients.find((p) => p.id === c.patient_id);
    if (patient) setSelectedPatient(patient);

    setMessage("Consultation opened for review. You may edit and save again.");
  }

  function startRecording() {
    setMessage("");

    if (!selectedPatient) {
      setMessage("Please select a patient before recording.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("Speech recording is not supported on this browser. Please type notes manually.");
      return;
    }

    shouldKeepRecordingRef.current = true;
    finalTranscriptRef.current = cleanTranscriptText(transcript);
    lastFinalRef.current = "";

    const startNewRecognition = () => {
      if (!shouldKeepRecordingRef.current) return;

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-ZA";

      recognition.onresult = (event: any) => {
        let interimText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = cleanTranscriptText(event.results[i][0].transcript || "");

          if (event.results[i].isFinal) {
            if (text && text !== lastFinalRef.current) {
              finalTranscriptRef.current = cleanTranscriptText(`${finalTranscriptRef.current} ${text}`);
              lastFinalRef.current = text;
            }
          } else {
            interimText = cleanTranscriptText(`${interimText} ${text}`);
          }
        }

        setTranscript(cleanTranscriptText(`${finalTranscriptRef.current} ${interimText}`));
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          setMessage("Microphone permission denied. Please allow microphone access.");
          shouldKeepRecordingRef.current = false;
          setRecording(false);
        }
      };

      recognition.onend = () => {
        if (shouldKeepRecordingRef.current) {
          setTimeout(startNewRecognition, 600);
        } else {
          setRecording(false);
        }
      };

      try {
        recognition.start();
        setRecording(true);
      } catch {
        setRecording(false);
      }
    };

    startNewRecognition();
  }

  function stopRecording() {
    shouldKeepRecordingRef.current = false;
    try {
      recognitionRef.current?.stop?.();
    } catch {}
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

    const cleanTranscript = cleanTranscriptText(transcript);
    setTranscript(cleanTranscript);

    const patientBlock = `Patient: ${selectedPatient.first_name} ${selectedPatient.surname}\nID/Patient Number: ${selectedPatient.id_number || selectedPatient.patient_id || "Not captured"}\nAge: ${selectedPatient.age || "Not captured"}\nDOB: ${selectedPatient.date_of_birth || "Not captured"}\nGender: ${selectedPatient.gender || "Not captured"}\nMobile: ${selectedPatient.mobile || "Not captured"}\nMedical Aid: ${selectedPatient.medical_aid || "Not captured"}\nAllergies: ${selectedPatient.allergies || "No known allergies"}\nCurrent Medicines: ${selectedPatient.current_medicines || "Not captured"}`;

    const summary = `${selectedPatient.first_name} ${selectedPatient.surname} attended a clinical consultation. Transcript and notes were reviewed by the clinician before finalisation.`;

    const assessment = inferAssessment(cleanTranscript);
    const generatedDiagnosis = assessment.diagnosis;
    const generatedIcd = assessment.icd10;

    const generatedPlan = `PLAN\n- Clinician to confirm final diagnosis and management.\n- Record vital signs, examination findings and red flags before prescribing.\n- Provide patient education and safety-net advice.\n- Arrange follow-up according to clinical risk and response to treatment.\n- Escalate or refer urgently if red flags are present.\n- Prescription only if clinically appropriate and within the clinician's scope of practice.`;

    const generatedSoap = `${patientBlock}\n\nCONSENT\nPatient consented to AI-assisted clinical documentation.\n\nTRANSCRIPT / CLINICAL NOTES\n${cleanTranscript || "No transcript captured. Clinician to complete manually."}\n\nSOAP NOTE\n\nSUBJECTIVE\n${cleanTranscript || "History to be completed by clinician."}\n\nOBJECTIVE\n- Examination findings: To be completed by clinician.\n- Observations/vitals: To be completed by clinician.\n- Investigations/results: To be added if available.\n\nASSESSMENT\n${generatedDiagnosis}\n\n${generatedIcd}\n\n${generatedPlan}\n\nCLINICIAN CONFIRMATION\nThis AI-assisted note must be reviewed, edited and approved by the responsible clinician before clinical use.`;

    setClinicalSummary(summary);
    setDiagnosis(generatedDiagnosis);
    setIcd10(generatedIcd);
    setPlan(generatedPlan);
    setSoapNote(generatedSoap);
    setMessage("SOAP note generated. Please review, edit and save.");
  }

  function inferAssessment(text: string) {
    const lower = text.toLowerCase();
    if (lower.includes("pregnan") || lower.includes("trimester") || lower.includes("gestational")) {
      return {
        diagnosis: "- Pregnancy-related consultation. Consider gestational diabetes, routine antenatal care needs, medication safety review and red-flag screening. Final diagnosis to be confirmed by clinician.",
        icd10: "ICD-10 SUGGESTIONS\n- Z34: Supervision of normal pregnancy, if routine antenatal care applies.\n- O24.4: Diabetes mellitus arising in pregnancy, if gestational diabetes is confirmed.\n- Z33: Pregnant state, incidental, if pregnancy is relevant but not the main diagnosis.\n- Final ICD-10 coding must be confirmed by clinician.",
      };
    }

    return {
      diagnosis: "- Clinical impression pending clinician confirmation. Add diagnosis, differentials and red flags after reviewing the patient.",
      icd10: "ICD-10 SUGGESTIONS\n- To be selected and confirmed by clinician based on final diagnosis.",
    };
  }

  async function saveConsultation() {
    if (!selectedPatient) {
      setMessage("Please select a patient first.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload: any = {
      patient_id: selectedPatient.id,
      patient_summary: clinicalSummary || `${selectedPatient.first_name} ${selectedPatient.surname} consultation`,
      transcript: cleanTranscriptText(transcript),
      soap_note: soapNote,
      icd10,
      plan,
      diagnosis,
      summary: clinicalSummary,
      consent_confirmed: consent,
    };

    const result = selectedConsultation?.id
      ? await supabase.from("consultations").update(payload).eq("id", selectedConsultation.id).select().single()
      : await supabase.from("consultations").insert(payload).select().single();

    setSaving(false);

    if (result.error) {
      setMessage("Could not save consultation: " + result.error.message);
      return;
    }

    setSelectedConsultation(result.data);
    setMessage("Consultation saved successfully.");
    loadRecentConsultations();
  }

  function downloadPdf() {
    const content = soapNote || `TRANSCRIPT / CLINICAL NOTES\n${transcript}`;

    if (!content.trim()) {
      setMessage("There is no note to export yet.");
      return;
    }

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
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; line-height: 1.6; }
            h1 { color: #1d4ed8; margin-bottom: 4px; }
            .meta { color: #475569; margin-bottom: 24px; }
            pre { white-space: pre-wrap; font-size: 14px; border-top: 1px solid #cbd5e1; padding-top: 18px; }
            .sign { margin-top: 48px; display: grid; gap: 18px; }
          </style>
        </head>
        <body>
          <h1>CareScriber Clinical Consultation Report</h1>
          <div class="meta">Generated: ${safeText(new Date().toLocaleString())}</div>
          <pre>${safeText(content)}</pre>
          <div class="sign">
            <div>Clinician Name: ______________________________</div>
            <div>Signature: ___________________________________</div>
            <div>Date: ________________________________________</div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/dashboard" style={styles.back}>← Back to Dashboard</Link>

        <p style={styles.kicker}>Videomed Clinical Assistant</p>
        <h1 style={styles.title}>CareScriber Consultation</h1>
        <p style={styles.subtitle}>Record, edit, generate SOAP, save, review recent consultations and export PDF.</p>

        <div style={styles.actionGrid}>
          <button type="button" onClick={startNewConsultation} style={styles.secondaryButton}>+ New Consultation</button>
          <button type="button" onClick={loadRecentConsultations} style={styles.secondaryButton}>Refresh Recent</button>
        </div>

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

        {search.trim() !== "" && filteredPatients.length === 0 && !selectedPatient && <p style={styles.muted}>No matching patient found.</p>}

        {filteredPatients.map((p) => (
          <button key={p.id} type="button" onClick={() => selectPatient(p)} style={styles.patientCard}>
            <strong>{p.first_name} {p.surname}</strong>
            <span>ID: {p.id_number || p.patient_id || "N/A"} · Age: {p.age || "N/A"} · {p.gender || "N/A"}</span>
          </button>
        ))}

        {selectedPatient && (
          <div style={styles.selected}>
            <strong>Selected: {selectedPatient.first_name} {selectedPatient.surname}</strong><br />
            ID: {selectedPatient.id_number || selectedPatient.patient_id || "Not captured"}<br />
            Age: {selectedPatient.age || "Not captured"} · {selectedPatient.gender || "Not captured"}<br />
            Allergies: {selectedPatient.allergies || "No known allergies"}
          </div>
        )}

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>AI Consent</h2>
        <label style={styles.checkboxRow}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={styles.checkbox} />
          <span>Patient consent confirmed for AI-assisted clinical documentation.</span>
        </label>

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Recording</h2>
        <div style={styles.buttonRow}>
          <button type="button" onClick={startRecording} disabled={recording} style={{ ...styles.primaryButton, opacity: recording ? 0.55 : 1 }}>🎙 Start Recording</button>
          <button type="button" onClick={stopRecording} disabled={!recording} style={{ ...styles.dangerButton, opacity: !recording ? 0.55 : 1 }}>⏹ Stop Recording</button>
        </div>
        {recording && <p style={styles.recording}>Recording active. Speak clearly. Stop when finished.</p>}
        {message && <p style={styles.message}>{message}</p>}

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Editable Transcript / Clinical Notes</h2>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcript will appear here. Clinician can edit before generating SOAP."
          style={styles.textarea}
        />

        <div style={styles.actionGrid}>
          <button type="button" onClick={() => setTranscript(cleanTranscriptText(transcript))} style={styles.secondaryButton}>Clean Duplicates</button>
          <button type="button" onClick={generateSoapNote} style={styles.blueButton}>Generate SOAP Note</button>
        </div>

        {soapNote && (
          <>
            <h2 style={styles.sectionTitle}>Generated SOAP Note</h2>
            <textarea value={soapNote} onChange={(e) => setSoapNote(e.target.value)} style={styles.largeTextarea} />

            <h2 style={styles.smallTitle}>ICD-10 Suggestions</h2>
            <textarea value={icd10} onChange={(e) => setIcd10(e.target.value)} style={styles.textareaSmall} />

            <h2 style={styles.smallTitle}>Plan</h2>
            <textarea value={plan} onChange={(e) => setPlan(e.target.value)} style={styles.textareaSmall} />

            <div style={styles.actionGrid}>
              <button type="button" onClick={saveConsultation} disabled={saving} style={styles.saveButton}>{saving ? "Saving..." : "Save Consultation"}</button>
              <button type="button" onClick={downloadPdf} style={styles.pdfButton}>Download / Print PDF</button>
            </div>
          </>
        )}

        <hr style={styles.divider} />

        <h2 style={styles.sectionTitle}>Recent Consultations</h2>
        {recentConsultations.length === 0 ? (
          <p style={styles.muted}>No recent consultations yet.</p>
        ) : (
          recentConsultations.map((c) => (
            <button key={c.id} type="button" onClick={() => openConsultation(c)} style={styles.recentCard}>
              <strong>{c.patient_summary || "Clinical consultation"}</strong>
              <span>{formatDate(c.created_at)}</span>
              <span>Tap to review, edit, save or export PDF</span>
            </button>
          ))
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#eef4fb", padding: "24px 12px", fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", color: "#0f172a" },
  card: { maxWidth: "820px", margin: "0 auto", background: "#ffffff", borderRadius: "28px", padding: "28px", boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)" },
  back: { color: "#2563eb", fontWeight: 700, textDecoration: "none", fontSize: "18px" },
  kicker: { color: "#2563eb", fontWeight: 800, marginTop: "32px" },
  title: { fontSize: "clamp(38px, 9vw, 64px)", lineHeight: 1, margin: 0, fontWeight: 900 },
  subtitle: { fontSize: "clamp(20px, 4vw, 28px)", lineHeight: 1.35, color: "#526174", marginTop: "24px" },
  divider: { border: 0, borderTop: "1px solid #e2e8f0", margin: "34px 0" },
  sectionTitle: { fontSize: "clamp(30px, 6vw, 44px)", marginBottom: "20px", fontWeight: 900 },
  smallTitle: { fontSize: "26px", fontWeight: 900, marginTop: "24px" },
  input: { width: "100%", boxSizing: "border-box", border: "2px solid #cbd5e1", borderRadius: "20px", padding: "20px", fontSize: "20px" },
  muted: { color: "#64748b", fontSize: "18px", marginTop: "18px" },
  patientCard: { width: "100%", textAlign: "left", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "20px", padding: "18px", marginTop: "14px", display: "grid", gap: "8px", fontSize: "18px", cursor: "pointer" },
  selected: { marginTop: "18px", padding: "18px", background: "#dcfce7", borderRadius: "18px", color: "#166534", fontWeight: 800, fontSize: "17px", lineHeight: 1.5 },
  checkboxRow: { display: "flex", gap: "16px", fontSize: "20px", lineHeight: 1.4 },
  checkbox: { width: "26px", height: "26px", marginTop: "3px" },
  buttonRow: { display: "grid", gap: "16px" },
  actionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginTop: "18px" },
  primaryButton: { border: 0, borderRadius: "22px", padding: "22px", background: "#16a34a", color: "#ffffff", fontSize: "22px", fontWeight: 900 },
  dangerButton: { border: 0, borderRadius: "22px", padding: "22px", background: "#dc2626", color: "#ffffff", fontSize: "22px", fontWeight: 900 },
  blueButton: { border: 0, borderRadius: "18px", padding: "18px", background: "#2563eb", color: "#ffffff", fontSize: "20px", fontWeight: 900 },
  saveButton: { border: 0, borderRadius: "18px", padding: "18px", background: "#15803d", color: "#ffffff", fontSize: "20px", fontWeight: 900 },
  pdfButton: { border: 0, borderRadius: "18px", padding: "18px", background: "#0f172a", color: "#ffffff", fontSize: "20px", fontWeight: 900 },
  secondaryButton: { display: "block", textAlign: "center", textDecoration: "none", border: 0, borderRadius: "18px", padding: "18px", background: "#dbeafe", color: "#1d4ed8", fontSize: "18px", fontWeight: 900 },
  textarea: { width: "100%", minHeight: "220px", boxSizing: "border-box", border: "2px solid #cbd5e1", borderRadius: "20px", padding: "20px", fontSize: "18px", lineHeight: 1.5 },
  largeTextarea: { width: "100%", minHeight: "520px", boxSizing: "border-box", border: "2px solid #cbd5e1", borderRadius: "20px", padding: "20px", fontSize: "16px", lineHeight: 1.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
  textareaSmall: { width: "100%", minHeight: "150px", boxSizing: "border-box", border: "2px solid #cbd5e1", borderRadius: "20px", padding: "18px", fontSize: "16px", lineHeight: 1.5 },
  message: { background: "#dbeafe", color: "#1e40af", padding: "16px", borderRadius: "16px", fontWeight: 700, marginTop: "16px" },
  recording: { background: "#fee2e2", color: "#991b1b", padding: "14px", borderRadius: "16px", fontWeight: 800 },
  recentCard: { width: "100%", textAlign: "left", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", marginTop: "12px", display: "grid", gap: "6px", cursor: "pointer", color: "#0f172a" },
};
