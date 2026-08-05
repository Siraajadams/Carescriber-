"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Patient = {
  id: string;
  first_name: string;
  surname: string;
  last_name?: string;
  id_number?: string;
  patient_id?: string;
  national_id?: string;
  age?: number | null;
  date_of_birth?: string | null;
  dob?: string | null;
  gender?: string;
  mobile?: string;
  phone?: string;
  email?: string;
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

type SymptomReferral = {
  id: string;
  patient_id?: string;
  referral_code?: string;
  consent_token?: string;
  consent_given?: boolean;
  status?: string;
  expires_at?: string | null;
  submitted_at?: string | null;
  viewed_at?: string | null;
  triage_summary?: string | null;
  urgency_level?: string | null;
  recommendation?: string | null;
  patient_snapshot?: any;
  triage_snapshot?: any;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

function normaliseId(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function patientSurname(patient: Patient) {
  return patient.surname || patient.last_name || "";
}

function patientIdValue(patient: Patient) {
  return patient.patient_id || patient.id_number || patient.national_id || "";
}

function patientDob(patient: Patient) {
  return patient.date_of_birth || patient.dob || "";
}

function patientMobile(patient: Patient) {
  return patient.mobile || patient.phone || "";
}

function calculateAge(dob?: string | null, fallback?: number | null) {
  if (fallback) return String(fallback);
  if (!dob) return "Not captured";

  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "Not captured";

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return String(age);
}

function mapPatient(p: any): Patient {
  return {
    id: p.id,
    first_name: p.first_name || p.name || "",
    surname: p.surname || p.last_name || "",
    last_name: p.last_name || p.surname || "",
    id_number: p.id_number || p.patient_id || p.national_id || "",
    patient_id: p.patient_id || p.id_number || p.national_id || "",
    national_id: p.national_id || p.patient_id || p.id_number || "",
    age: p.age || null,
    date_of_birth: p.date_of_birth || p.dob || null,
    dob: p.dob || p.date_of_birth || null,
    gender: p.gender || "",
    mobile: p.mobile || p.phone || p.mobile_number || "",
    phone: p.phone || p.mobile || p.mobile_number || "",
    email: p.email || "",
    medical_aid: p.medical_aid || "",
    allergies: p.allergies || "No known allergies",
    current_medicines: p.current_medicines || "",
  };
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

  const [referralCode, setReferralCode] = useState("");
  const [consentToken, setConsentToken] = useState("");
  const [referralLoading, setReferralLoading] = useState(false);
  const [referral, setReferral] = useState<SymptomReferral | null>(null);
  const [referralNote, setReferralNote] = useState("");

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
    void loadPatients();
    void loadRecent();
    void initialiseConsultationFromUrl();
  }, []);

  async function initialiseConsultationFromUrl() {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    const patientId =
      params.get("patient") ||
      params.get("patientId");

    const code =
      params.get("referralCode") ||
      params.get("code") ||
      "";

    const token =
      params.get("consentToken") ||
      params.get("token") ||
      "";

    if (patientId) {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .limit(1);

      if (error) {
        setMessage("Patient load error: " + error.message);
      } else if (data && data.length > 0) {
        selectPatient(mapPatient(data[0]));
      }
    }

    if (code) {
      setReferralCode(code.toUpperCase());
    }

    if (token) {
      setConsentToken(token);
    }

    if (code && token) {
      await unlockSymptomAIReferral(
        code.toUpperCase(),
        token,
      );
    }
  }

  async function loadPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setMessage("Patient load error: " + error.message);
      return;
    }

    setPatients((data || []).map(mapPatient));
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

    return patients.filter((p) =>
      [p.first_name, patientSurname(p), p.id_number, p.patient_id, p.national_id, p.mobile, p.phone]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [patients, search, selectedPatient]);

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setSearch(`${p.first_name} ${patientSurname(p)}`.trim());
    setMessage("");
  }

  async function searchCareScriberPatients() {
    const term = search.trim();

    if (!term) {
      setMessage("Enter name, surname, National ID / Passport or mobile.");
      return;
    }

    const clean = normaliseId(term);

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .or(
        [
          `first_name.ilike.%${term}%`,
          `surname.ilike.%${term}%`,
          `last_name.ilike.%${term}%`,
          `patient_id.ilike.%${term}%`,
          `id_number.ilike.%${term}%`,
          `national_id.ilike.%${term}%`,
          `mobile.ilike.%${term}%`,
          `phone.ilike.%${term}%`,
          `patient_id.ilike.%${clean}%`,
          `id_number.ilike.%${clean}%`,
          `national_id.ilike.%${clean}%`,
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setMessage("Patient search failed: " + error.message);
      return;
    }

    const mapped = (data || []).map(mapPatient);
    setPatients(mapped);

    if (mapped.length === 0) {
      setMessage("No matching patient found. Register the patient first.");
    } else if (mapped.length === 1) {
      selectPatient(mapped[0]);
    } else {
      setSelectedPatient(null);
      setMessage(`${mapped.length} possible patients found. Select the correct patient.`);
    }
  }

  async function unlockSymptomAIReferral(
    referralCodeOverride?: string,
    consentTokenOverride?: string,
  ) {
    setMessage("");
    setReferralNote("");
    setReferralLoading(true);

    const code = (
      referralCodeOverride ??
      referralCode
    )
      .trim()
      .toUpperCase();

    const token = (
      consentTokenOverride ??
      consentToken
    ).trim();

    if (code) {
      setReferralCode(code);
    }

    if (token) {
      setConsentToken(token);
    }

    if (!code || !token) {
      setReferralLoading(false);
      setReferralNote("Enter both the referral code and patient consent token.");
      return;
    }

    try {
      const lookupRes = await fetch("/api/referral-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: code, consentToken: token }),
      });

      const lookupData = await lookupRes.json().catch(() => ({}));

      if (!lookupRes.ok) {
        setReferralNote(
          "Referral lookup failed: " +
            (lookupData.error || "Could not unlock referral.")
        );
        return;
      }

      const referralFound = lookupData.referral as SymptomReferral;
      setReferral(referralFound);

      const openRes = await fetch("/api/referral-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralId: referralFound.id }),
      });

      const openData = await openRes.json().catch(() => ({}));

      if (!openRes.ok) {
        setReferralNote(
          "Referral opened, but patient load failed: " +
            (openData.error || "Could not load patient.")
        );
        return;
      }

      if (openData.patient) {
        selectPatient(mapPatient(openData.patient));
      }

      const triageText = openData.triage
        ? `SYMPTOMAI TRIAGE DETAILS:\n${JSON.stringify(openData.triage, null, 2)}`
        : referralFound.triage_snapshot
          ? `SYMPTOMAI TRIAGE DETAILS:\n${JSON.stringify(referralFound.triage_snapshot, null, 2)}`
          : "";

      if (triageText) {
        setTranscript((prev) => `${triageText}\n\n${prev}`.trim());
      }

      setConsent(true);
      setReferralNote("Referral unlocked. Patient profile and SymptomAI triage are loaded.");
    } catch (err: any) {
      setReferralNote("Referral lookup failed: " + (err.message || "Unknown error"));
    } finally {
      setReferralLoading(false);
    }
  }

  function newConsultation() {
    stopRecording();
    setSelectedPatient(null);
    setSearch("");
    setConsent(false);
    setReferralCode("");
    setConsentToken("");
    setReferral(null);
    setReferralNote("");
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
      setMessage("Open in Safari or Chrome. WhatsApp browser may block microphone access.");
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
            setTimeout(startSession, 700);
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
      setMessage("Could not analyze image. Check API route.");
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

    const referralText = referral
      ? `
SYMPTOMAI REFERRAL
Referral code: ${referral.referral_code || "Not captured"}
Submitted: ${referral.submitted_at || "Not captured"}
Urgency: ${referral.urgency_level || "Not captured"}
Recommendation: ${referral.recommendation || "Not captured"}
Summary: ${referral.triage_summary || "Not captured"}
`
      : "";

    const generated = `
PATIENT SUMMARY
Name: ${selectedPatient.first_name} ${patientSurname(selectedPatient)}
ID Number: ${patientIdValue(selectedPatient) || "Not captured"}
Age: ${calculateAge(patientDob(selectedPatient), selectedPatient.age)}
DOB: ${patientDob(selectedPatient) || "Not captured"}
Gender: ${selectedPatient.gender || "Not captured"}
Mobile: ${patientMobile(selectedPatient) || "Not captured"}
Email: ${selectedPatient.email || "Not captured"}
Medical Aid: ${selectedPatient.medical_aid || "Not captured"}
Allergies: ${selectedPatient.allergies || "No known allergies"}
Current Medicines: ${selectedPatient.current_medicines || "Not captured"}

${referralText}

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
- Review SymptomAI triage findings and confirm the diagnosis clinically.
- Perform focused clinical examination based on the presenting symptoms.
- Check vital signs if clinically indicated: BP, pulse, temperature, respiratory rate and oxygen saturation.
- Assess severity, duration, red flags, pregnancy status, allergies, current medicines and comorbid risk factors.
- Provide treatment according to the confirmed diagnosis, local prescribing rules, SA STG/EML principles and pharmacist/doctor scope of practice.
- If symptoms are worsening, prolonged, recurrent, severe, or associated with red flags, escalate to GP / emergency care.
- Provide safety-net advice: return urgently if chest pain, shortness of breath, severe headache, persistent fever, confusion, dehydration, bleeding, neurological symptoms, visual disturbance, severe abdominal pain, or worsening symptoms occur.
- Counsel the patient on medicine use, dosing, side effects, adherence, expected response and when to seek urgent help.
- Follow up within 24–72 hours depending on severity and clinical judgement.
- Consider prescription, sick note, referral letter, pathology, or further investigation only after clinician confirmation.

ICD-10 SUGGESTIONS
- R51 - Headache, if headache symptoms are present.
- G43.9 - Migraine, unspecified, if migraine is clinically confirmed.
- K30 - Functional dyspepsia, if gastric / indigestion symptoms are present.
- M54.9 - Dorsalgia, unspecified, if backache is present.
- R50.9 - Fever, unspecified, if fever is present.
- R10.4 - Other and unspecified abdominal pain, if stomach cramps / abdominal pain are present.
- N39.0 - Urinary tract infection, site not specified, if UTI symptoms are clinically confirmed.
- J00 - Acute nasopharyngitis / common cold, if cold and flu symptoms are present.
- H10.9 - Conjunctivitis, unspecified, if red eye / eye infection symptoms are clinically confirmed.
- H92.0 - Otalgia, if earache is present.
- K08.8 - Other specified disorders of teeth and supporting structures, if dental pain is present.
- L50.9 - Urticaria, unspecified, if allergic rash / hives are present.
- Z71.9 - Counselling, unspecified, if only advice or reassurance is provided.

Clinical note:
- ICD-10 codes are suggestions only. The clinician must confirm the final diagnosis, treatment plan and ICD-10 code before issuing any prescription, referral or sick note.

REFERRAL / PRESCRIPTION
- Draft only. Clinician must verify before issuing.
`;

    setSoapNote(generated);

    const { error } = await supabase.from("consultations").insert({
      patient_id: selectedPatient.id,
      patient_summary: `${selectedPatient.first_name} ${patientSurname(selectedPatient)}`,
      transcript,
      soap_note: generated,
      consent_confirmed: consent,
      referral_id: referral?.id || null,
    });

    if (error) {
      const { error: fallbackError } = await supabase.from("consultations").insert({
        patient_id: selectedPatient.id,
        patient_summary: `${selectedPatient.first_name} ${patientSurname(selectedPatient)}`,
        transcript,
        soap_note: generated,
        consent_confirmed: consent,
      });

      if (fallbackError) {
        setMessage("SOAP generated, but save failed: " + fallbackError.message);
      } else {
        setMessage("SOAP note generated and saved.");
        loadRecent();
      }
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
          Search patient, unlock SymptomAI referrals, confirm consent, record, edit transcript, analyze images, generate SOAP and export PDF.
        </p>

        <div style={styles.tabRow}>
          <Link href="/dashboard" style={styles.tab}>Dashboard</Link>
          <Link href="/inbox" style={styles.tab}>Virtual Consult Inbox</Link>
          <Link href="/patients" style={styles.tab}>Patients</Link>
          <Link href="/consultation" style={styles.activeTab}>Consultation</Link>
          <Link href="/sick-note" style={styles.sickTab}>Sick Note</Link>
          <Link href="/e-script" style={styles.escriptTab}>eScript</Link>
        </div>

        {isInAppBrowser && (
          <div style={styles.warning}>
            Open in Safari or Chrome for microphone recording. WhatsApp browser may block recording.
          </div>
        )}

        <button style={styles.lightButton} onClick={newConsultation}>
          + New Consultation
        </button>

        <hr style={styles.divider} />

        <h2 style={styles.heading}>Unlock SymptomAI Referral</h2>
        <p style={styles.muted}>
          Enter the patient referral code and consent token generated on SymptomAI.
        </p>

        <div style={styles.twoCol}>
          <input
            style={styles.input}
            value={referralCode}
            placeholder="Referral code e.g. CS-ABC123"
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          />

          <input
            style={styles.input}
            value={consentToken}
            placeholder="Patient consent token"
            onChange={(e) => setConsentToken(e.target.value)}
          />
        </div>

        <button
          style={styles.primaryButton}
          onClick={() => void unlockSymptomAIReferral()}
          disabled={referralLoading}
        >
          {referralLoading ? "Unlocking Referral..." : "Unlock Referral"}
        </button>

        {referralNote && <div style={styles.message}>{referralNote}</div>}

        {referral && (
          <div style={styles.selected}>
            SymptomAI referral unlocked: {referral.referral_code} · Status:{" "}
            {referral.status || "Ready for consultation"}
          </div>
        )}

        <hr style={styles.divider} />

        <h2 style={styles.heading}>Find Patient</h2>

        <div style={styles.searchRow}>
          <input
            style={styles.input}
            value={search}
            placeholder="Search surname, first name, National ID / Passport or mobile"
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedPatient(null);
            }}
          />

          <button style={styles.smallButton} onClick={searchCareScriberPatients}>
            Search Patient
          </button>
        </div>

        {search && !selectedPatient && filteredPatients.length === 0 && (
          <p style={styles.muted}>No matching patient found.</p>
        )}

        {filteredPatients.map((p) => (
          <button key={p.id} style={styles.patientCard} onClick={() => selectPatient(p)}>
            <strong>{p.first_name} {patientSurname(p)}</strong>
            <span>
              ID: {patientIdValue(p) || "N/A"} · Age: {calculateAge(patientDob(p), p.age)} · {p.gender || "N/A"} · {patientMobile(p) || "No mobile"}
            </span>
          </button>
        ))}

        {selectedPatient && (
          <div style={styles.selected}>
            Selected: {selectedPatient.first_name} {patientSurname(selectedPatient)} · ID:{" "}
            {patientIdValue(selectedPatient) || "Not captured"} · DOB:{" "}
            {patientDob(selectedPatient) || "Not captured"}
          </div>
        )}

        {selectedPatient && (
          <div style={styles.actionGrid}>
            <Link
              href={`/sick-note?patientId=${selectedPatient.id}`}
              style={styles.sickNoteButton}
            >
              Create Sick Note for Selected Patient
            </Link>

            <Link
              href={`/e-script?patientId=${selectedPatient.id}`}
              style={styles.escriptButton}
            >
              Create eScript for Selected Patient
            </Link>
          </div>
        )}

        <hr style={styles.divider} />

        <h2 style={styles.heading}>AI Consent</h2>

        <label style={styles.checkRow}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I have the patient’s consent to use CareScriber AI.</span>
        </label>

        <hr style={styles.divider} />

        <h2 style={styles.heading}>Recording</h2>

        <button style={{ ...styles.startButton, opacity: recording ? 0.5 : 1 }} disabled={recording} onClick={startRecording}>
          🎙 Start Recording
        </button>

        <button style={{ ...styles.stopButton, opacity: !recording ? 0.5 : 1 }} disabled={!recording} onClick={stopRecording}>
          ⏹ Stop Recording
        </button>

        <hr style={styles.divider} />

        <h2 style={styles.heading}>Camera / Clinical Image</h2>

        <label style={styles.cameraButton}>
          📷 Capture or Upload Image
          <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
        </label>

        {photoPreview && (
          <>
            <img src={photoPreview} alt="Clinical upload" style={styles.preview} />
            <button onClick={analyzeImage} disabled={analyzingImage} style={styles.primaryButton}>
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
  page: { minHeight: "100vh", background: "#eef4fb", padding: "18px", fontFamily: "Arial, Helvetica, sans-serif", color: "#0f172a" },
  card: { maxWidth: 760, margin: "0 auto", background: "#ffffff", borderRadius: 28, padding: 28, boxShadow: "0 20px 60px rgba(15, 23, 42, 0.10)" },
  back: { color: "#2563eb", fontWeight: 800, textDecoration: "none", fontSize: 18 },
  kicker: { marginTop: 30, color: "#2563eb", fontWeight: 900, fontSize: 18 },
  title: { fontSize: 48, lineHeight: 1, margin: "12px 0", fontWeight: 900 },
  subtitle: { fontSize: 22, color: "#526174", lineHeight: 1.45 },
  tabRow: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 },
  tab: { padding: "12px 14px", borderRadius: 14, background: "#e2e8f0", color: "#0f172a", textDecoration: "none", fontWeight: 900 },
  activeTab: { padding: "12px 14px", borderRadius: 14, background: "#2563eb", color: "#fff", textDecoration: "none", fontWeight: 900 },
  sickTab: { padding: "12px 14px", borderRadius: 14, background: "#f97316", color: "#fff", textDecoration: "none", fontWeight: 900 },
  escriptTab: { padding: "12px 14px", borderRadius: 14, background: "#16a34a", color: "#fff", textDecoration: "none", fontWeight: 900 },
  warning: { background: "#fff7ed", color: "#9a3412", padding: 16, borderRadius: 16, fontWeight: 800, marginTop: 18 },
  divider: { border: 0, borderTop: "1px solid #e2e8f0", margin: "32px 0" },
  heading: { fontSize: 34, fontWeight: 900, marginBottom: 18 },
  input: { width: "100%", boxSizing: "border-box", border: "2px solid #cbd5e1", borderRadius: 20, padding: 18, fontSize: 20 },
  twoCol: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  searchRow: { display: "grid", gridTemplateColumns: "1fr", gap: 12 },
  muted: { color: "#64748b", fontSize: 18 },
  patientCard: { width: "100%", textAlign: "left", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 18, padding: 18, marginTop: 12, display: "grid", gap: 6, fontSize: 18 },
  selected: { marginTop: 16, background: "#dcfce7", color: "#166534", padding: 16, borderRadius: 16, fontWeight: 900, fontSize: 17 },
  actionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 },
  sickNoteButton: { display: "block", textAlign: "center", padding: 18, borderRadius: 18, background: "#f97316", color: "#fff", textDecoration: "none", fontWeight: 900, fontSize: 18 },
  escriptButton: { display: "block", textAlign: "center", padding: 18, borderRadius: 18, background: "#16a34a", color: "#fff", textDecoration: "none", fontWeight: 900, fontSize: 18 },
  checkRow: { display: "flex", gap: 14, alignItems: "flex-start", fontSize: 20, lineHeight: 1.4 },
  startButton: { width: "100%", border: 0, borderRadius: 22, padding: 22, background: "#16a34a", color: "#fff", fontSize: 22, fontWeight: 900, marginBottom: 14 },
  stopButton: { width: "100%", border: 0, borderRadius: 22, padding: 22, background: "#dc2626", color: "#fff", fontSize: 22, fontWeight: 900 },
  cameraButton: { display: "block", width: "100%", boxSizing: "border-box", textAlign: "center", borderRadius: 20, padding: 20, background: "#dbeafe", color: "#1d4ed8", fontWeight: 900, fontSize: 20 },
  preview: { width: "100%", borderRadius: 18, marginTop: 16, border: "1px solid #cbd5e1" },
  textarea: { width: "100%", boxSizing: "border-box", minHeight: 210, border: "2px solid #cbd5e1", borderRadius: 22, padding: 20, fontSize: 20, lineHeight: 1.5 },
  primaryButton: { width: "100%", border: 0, borderRadius: 20, padding: 22, background: "#2563eb", color: "#fff", fontSize: 22, fontWeight: 900, marginTop: 16 },
  lightButton: { width: "100%", border: 0, borderRadius: 20, padding: 20, background: "#dbeafe", color: "#1d4ed8", fontSize: 20, fontWeight: 900, marginTop: 16 },
  pdfButton: { width: "100%", border: 0, borderRadius: 20, padding: 20, background: "#0f172a", color: "#fff", fontSize: 20, fontWeight: 900, marginTop: 18 },
  smallButton: { border: 0, borderRadius: 14, padding: 14, background: "#0f172a", color: "#fff", fontWeight: 900, fontSize: 16 },
  message: { background: "#e0f2fe", color: "#075985", padding: 14, borderRadius: 14, fontWeight: 800, marginTop: 16 },
  noteBox: { whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 18, padding: 18, fontSize: 15, marginTop: 18, overflowX: "auto" },
  recentCard: { border: "1px solid #cbd5e1", borderRadius: 18, padding: 16, marginBottom: 12, display: "grid", gap: 8 },
};
