
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Patient = {
  id: string | null;
  first_name: string;
  surname: string;
  patient_id?: string;
  date_of_birth?: string;
  gender?: string;
  mobile?: string;
  email?: string;
};

type Referral = {
  id: string;
  referral_code: string;
  status?: string;
  submitted_at?: string;
};

type RecentConsultation = {
  id: string;
  patient_summary?: string;
  transcript?: string;
  soap_note?: string;
  created_at?: string;
};

function mapPatient(p: any): Patient {
  return {
    id: p.id || null,
    first_name: p.first_name || "",
    surname: p.surname || p.last_name || "",
    patient_id:
      p.patient_id ||
      p.identity_number ||
      p.id_number ||
      p.national_id ||
      "",
    date_of_birth:
      p.date_of_birth || p.dob || "",
    gender: p.gender || "",
    mobile:
      p.mobile || p.mobile_number || p.phone || "",
    email: p.email || "",
  };
}

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export default function ConsultationPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] =
    useState<Patient | null>(null);

  const [search, setSearch] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [consentToken, setConsentToken] = useState("");
  const [referral, setReferral] =
    useState<Referral | null>(null);

  const [referralSource, setReferralSource] =
    useState("");
  const [triage, setTriage] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);

  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [soapNote, setSoapNote] = useState("");

  const [photoFile, setPhotoFile] =
    useState<File | null>(null);
  const [photoPreview, setPhotoPreview] =
    useState("");
  const [imageAnalysis, setImageAnalysis] =
    useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const [recent, setRecent] =
    useState<RecentConsultation[]>([]);

  const recognitionRef = useRef<any>(null);
  const keepRecordingRef = useRef(false);
  const transcriptRef = useRef("");
  const initializedRef = useRef(false);

  useEffect(() => {
    void loadPatients();
    void loadRecent();

    if (initializedRef.current) return;
    initializedRef.current = true;

    const params = new URLSearchParams(
      window.location.search
    );

    const code =
      params.get("referralCode") ||
      params.get("code") ||
      "";

    const token =
      params.get("consentToken") ||
      params.get("token") ||
      "";

    const patientId =
      params.get("patientId") ||
      params.get("patient") ||
      "";

    if (code) setReferralCode(code.toUpperCase());
    if (token) setConsentToken(token);

    // Remove sensitive credentials from browser history.
    if (token || patientId) {
      const safeUrl = new URL(window.location.href);
      safeUrl.searchParams.delete("consentToken");
      safeUrl.searchParams.delete("token");
      safeUrl.searchParams.delete("patientId");
      safeUrl.searchParams.delete("patient");

      window.history.replaceState(
        {},
        "",
        safeUrl.pathname + safeUrl.search
      );
    }

    if (code && token) {
      void unlockReferral(code, token);
    } else if (patientId && isUUID(patientId)) {
      void loadPatientById(patientId);
    }

    return () => {
      keepRecordingRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  async function loadPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .limit(200);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPatients((data || []).map(mapPatient));
  }

  async function loadRecent() {
    const { data } = await supabase
      .from("consultations")
      .select(
        "id,patient_summary,transcript,soap_note,created_at"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(5);

    setRecent(data || []);
  }

  async function loadPatientById(id: string) {
    if (!isUUID(id)) return;

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data) {
      selectPatient(mapPatient(data));
    }
  }

  function selectPatient(patient: Patient) {
    setSelectedPatient(patient);

    setSearch(
      `${patient.first_name} ${patient.surname}`
    );

    if (patient.id) {
      sessionStorage.setItem(
        "carescriber_selected_patient_id",
        patient.id
      );
    }
  }

  async function findExistingPatient(
    external: Patient
  ): Promise<Patient | null> {
    const identity = external.patient_id?.trim();

    // Search locally loaded records first.
    if (identity) {
      const local = patients.find(
        (p) => p.patient_id === identity
      );

      if (local) return local;
    }

    // Avoid assuming which optional identity
    // columns exist in the patients table.
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .limit(500);

    if (error) {
      console.error(
        "Patient matching failed:",
        error.message
      );
      return null;
    }

    const matches = (data || [])
      .map(mapPatient)
      .filter((p) => {
        if (!identity) return false;
        return p.patient_id === identity;
      });

    // Never select an ambiguous patient.
    return matches.length === 1
      ? matches[0]
      : null;
  }

  async function unlockReferral(
    codeOverride?: string,
    tokenOverride?: string
  ) {
    const code = (
      codeOverride || referralCode
    )
      .trim()
      .toUpperCase();

    const token = (
      tokenOverride || consentToken
    ).trim();

    if (!code || !/^\d{6}$/.test(token)) {
      setMessage(
        "Enter a referral code and six-digit consent token."
      );
      return;
    }

    setLoading(true);
    setMessage("");
    setReferral(null);
    setSelectedPatient(null);
    setTriage(null);
    setConsent(false);

    try {
      const { data: sessionData, error: authError } =
        await supabase.auth.getSession();

      const accessToken =
        sessionData.session?.access_token;

      if (authError || !accessToken) {
        throw new Error(
          "Please sign in to CareScriber before opening a referral."
        );
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      };

      // Check the referral and recorded consent.
      const lookupResponse = await fetch(
        "/api/referral-lookup",
        {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({
            referralCode: code,
            consentToken: token,
          }),
        }
      );

      const lookupData =
        await lookupResponse.json();

      if (!lookupResponse.ok) {
        throw new Error(
          lookupData.error ||
            "Referral lookup failed."
        );
      }

      const referralId =
        lookupData.referral?.id;

      if (!referralId) {
        throw new Error(
          "Referral database ID is missing."
        );
      }

      // Open using the same code and token.
      // The previous page sent only referralId,
      // which caused the integration failure.
      const openResponse = await fetch(
        "/api/referral-open",
        {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({
            referralId,
            referralCode: code,
            consentToken: token,
          }),
        }
      );

      const openData =
        await openResponse.json();

      if (!openResponse.ok) {
        throw new Error(
          openData.error ||
            "Unable to open referral."
        );
      }

      if (!openData.success) {
        throw new Error(
          "Referral opening was unsuccessful."
        );
      }

      const openedReferral =
        openData.referral as Referral;

      const source =
        openData.source || lookupData.source;

      setReferral(openedReferral);
      setReferralSource(source || "");

      const clinicalTriage =
        openData.triage ||
        lookupData.triage ||
        null;

      setTriage(clinicalTriage);

      if (clinicalTriage) {
        const heading =
          source === "hivclintest"
            ? "HIVCLINTEST ASSESSMENT"
            : "SYMPTOMAI ASSESSMENT";

        const text =
          `${heading}\n` +
          JSON.stringify(
            clinicalTriage,
            null,
            2
          );

        setTranscript(text);
        transcriptRef.current = text;
      }

      const externalPatient =
        mapPatient(
          openData.patient ||
            lookupData.patient ||
            {}
        );

      const existing =
        await findExistingPatient(
          externalPatient
        );

      if (existing?.id) {
        selectPatient(existing);

        setMessage(
          "Referral opened. Existing CareScriber patient loaded. Confirm AI documentation consent before recording."
        );
      } else {
        // Display external demographics without
        // pretending they are a CareScriber row.
        setSelectedPatient(externalPatient);

        setSearch(
          `${externalPatient.first_name} ${externalPatient.surname}`
        );

        setMessage(
          "Referral opened. Patient details retrieved, but no unique CareScriber patient record was matched. Verify and register or link the patient before saving."
        );
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function searchPatients() {
    const term = search
      .trim()
      .toLowerCase();

    if (!term) return;

    setSelectedPatient(null);

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .limit(500);

    if (error) {
      setMessage(error.message);
      return;
    }

    const matches = (data || [])
      .map(mapPatient)
      .filter((p) =>
        [
          p.first_name,
          p.surname,
          p.patient_id,
          p.mobile,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      );

    setPatients(matches);

    if (matches.length === 1) {
      selectPatient(matches[0]);
    } else {
      setMessage(
        `${matches.length} matching patient(s).`
      );
    }
  }

  function startRecording() {
    if (!selectedPatient?.id) {
      setMessage(
        "Link the patient to CareScriber first."
      );
      return;
    }

    if (!consent) {
      setMessage(
        "Confirm AI documentation consent first."
      );
      return;
    }

    const browser = window as any;

    const Recognition =
      browser.SpeechRecognition ||
      browser.webkitSpeechRecognition;

    if (!Recognition) {
      setMessage(
        "Speech recognition is unavailable. Use a supported browser or enter notes manually."
      );
      return;
    }

    keepRecordingRef.current = true;
    transcriptRef.current = transcript;

    const begin = () => {
      if (!keepRecordingRef.current) return;

      const recognition = new Recognition();
      recognitionRef.current = recognition;

      recognition.lang = "en-ZA";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () =>
        setRecording(true);

      recognition.onresult = (event: any) => {
        let interim = "";

        for (
          let i = event.resultIndex;
          i < event.results.length;
          i++
        ) {
          const result = event.results[i];
          const words =
            result[0].transcript;

          if (result.isFinal) {
            transcriptRef.current +=
              ` ${words}`;
          } else {
            interim += ` ${words}`;
          }
        }

        setTranscript(
          (
            transcriptRef.current +
            interim
          ).trim()
        );
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          keepRecordingRef.current = false;
          setMessage(
            "Microphone permission denied."
          );
        }
      };

      recognition.onend = () => {
        setRecording(false);

        if (keepRecordingRef.current) {
          begin();
        }
      };

      recognition.start();
    };

    begin();
  }

  function stopRecording() {
    keepRecordingRef.current = false;
    recognitionRef.current?.stop();
    setRecording(false);
  }

  function handlePhoto(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setPhotoFile(file);
    setPhotoPreview(
      URL.createObjectURL(file)
    );
    setImageAnalysis("");
  }

  async function analyzeImage() {
    if (!photoFile) return;

    if (!consent) {
      setMessage(
        "Confirm AI documentation consent first."
      );
      return;
    }

    setAnalyzing(true);

    try {
      const form = new FormData();
      form.append("image", photoFile);

      const response = await fetch(
        "/api/analyze-clinical-image",
        {
          method: "POST",
          body: form,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Image analysis failed."
        );
      }

      setImageAnalysis(
        data.analysis || ""
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  }

  async function generateSoap() {
    if (!selectedPatient?.id) {
      setMessage(
        "A verified CareScriber patient record is required before saving."
      );
      return;
    }

    if (!consent) {
      setMessage(
        "Confirm AI documentation consent."
      );
      return;
    }

    const note = `
PATIENT
Name: ${selectedPatient.first_name} ${selectedPatient.surname}
Identity: ${selectedPatient.patient_id || "Not recorded"}
DOB: ${selectedPatient.date_of_birth || "Not recorded"}
Gender: ${selectedPatient.gender || "Not recorded"}

REFERRAL
Source: ${referralSource || "Direct consultation"}
Code: ${referral?.referral_code || "None"}

ASSESSMENT INFORMATION
${triage ? JSON.stringify(triage, null, 2) : "Not provided"}

CLINICAL TRANSCRIPT
${transcript || "Not recorded"}

CLINICAL IMAGE ANALYSIS
${imageAnalysis || "Not provided"}

SOAP NOTE - CLINICIAN DRAFT

Subjective:
${transcript || "Complete clinical history."}

Objective:
Enter examination findings and observations.

Assessment:
Clinician to document and confirm diagnosis.

Plan:
Clinician to document treatment, investigations,
referrals, safety-netting and follow-up.

All clinical findings, diagnoses and treatment
decisions require clinician verification.
`.trim();

    setSoapNote(note);

    const payload = {
      patient_id: selectedPatient.id,
      patient_summary:
        `${selectedPatient.first_name} ${selectedPatient.surname}`,
      transcript,
      soap_note: note,
      consent_confirmed: true,
    };

    const { error } = await supabase
      .from("consultations")
      .insert(payload);

    if (error) {
      setMessage(
        "SOAP generated but saving failed: " +
          error.message
      );
      return;
    }

    setMessage(
      "SOAP draft generated and saved."
    );

    void loadRecent();
  }

  function contactPatient(
    mode: "whatsapp" | "phone"
  ) {
    const mobile =
      selectedPatient?.mobile || "";

    if (!mobile) {
      setMessage(
        "No patient mobile number available."
      );
      return;
    }

    if (mode === "phone") {
      window.location.href =
        `tel:${mobile}`;
      return;
    }

    const digits =
      mobile.replace(/\D/g, "");

    const number =
      digits.startsWith("0")
        ? "27" + digits.slice(1)
        : digits;

    window.open(
      `https://wa.me/${number}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function newConsultation() {
    stopRecording();

    setSelectedPatient(null);
    setReferral(null);
    setReferralCode("");
    setConsentToken("");
    setReferralSource("");
    setTriage(null);
    setConsent(false);
    setTranscript("");
    setSoapNote("");
    setSearch("");
    setPhotoFile(null);
    setPhotoPreview("");
    setImageAnalysis("");
    setMessage("");

    sessionStorage.removeItem(
      "carescriber_selected_patient_id"
    );

    void loadPatients();
  }

  const button: React.CSSProperties = {
    padding: 15,
    border: 0,
    borderRadius: 12,
    background: "#2563eb",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    fontSize: 16,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#eef4fb",
        padding: 20,
        color: "#0f172a",
      }}
    >
      <section
        style={{
          maxWidth: 850,
          margin: "auto",
          background: "white",
          padding: 25,
          borderRadius: 20,
        }}
      >
        <Link href="/dashboard">
          Back to Dashboard
        </Link>

        <h1>CareScriber Consultation</h1>

        <nav
          style={{
            display: "flex",
            gap: 15,
            flexWrap: "wrap",
          }}
        >
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/inbox">Virtual Consult Inbox</Link>
          <Link href="/patients">Patients</Link>
          <Link href="/consultation">Consultation</Link>
          <Link href="/sick-note">Sick Note</Link>
          <Link href="/e-script">eScript</Link>
        </nav>

        <hr />

        <button
          style={button}
          onClick={newConsultation}
        >
          New Consultation
        </button>

        <h2>Unlock Referral</h2>

        <p>
          Supports HIVClinTest and SymptomAI.
        </p>

        <input
          style={input}
          placeholder="Referral code"
          value={referralCode}
          onChange={(e) =>
            setReferralCode(
              e.target.value.toUpperCase()
            )
          }
        />

        <br /><br />

        <input
          style={input}
          type="password"
          autoComplete="off"
          placeholder="Six-digit consent token"
          value={consentToken}
          onChange={(e) =>
            setConsentToken(e.target.value)
          }
        />

        <br /><br />

        <button
          style={button}
          disabled={loading}
          onClick={() =>
            void unlockReferral()
          }
        >
          {loading
            ? "Opening Referral..."
            : "Unlock Referral"}
        </button>

        {referral && (
          <div
            style={{
              marginTop: 15,
              padding: 15,
              background: "#dcfce7",
              borderRadius: 12,
            }}
          >
            <strong>
              Referral opened successfully
            </strong>

            <p>
              {referral.referral_code}
            </p>

            <p>
              Source: {referralSource}
            </p>

            <p>
              Status: {referral.status}
            </p>
          </div>
        )}

        {message && (
          <div
            role="status"
            style={{
              marginTop: 15,
              padding: 15,
              background: "#dbeafe",
              borderRadius: 12,
            }}
          >
            {message}
          </div>
        )}

        <hr />

        <h2>Find Patient</h2>

        <input
          style={input}
          placeholder="Search name or identity number"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />

        <br /><br />

        <button
          style={button}
          onClick={() =>
            void searchPatients()
          }
        >
          Search Patient
        </button>

        {patients
          .filter((p) =>
            search &&
            !selectedPatient &&
            [
              p.first_name,
              p.surname,
              p.patient_id,
            ]
              .join(" ")
              .toLowerCase()
              .includes(
                search.toLowerCase()
              )
          )
          .map((p) => (
            <button
              key={p.id}
              onClick={() =>
                selectPatient(p)
              }
              style={{
                ...input,
                marginTop: 10,
                textAlign: "left",
                background: "#f8fafc",
                cursor: "pointer",
              }}
            >
              {p.first_name} {p.surname}
              <br />
              {p.patient_id}
            </button>
          ))}

        {selectedPatient && (
          <div
            style={{
              background: "#f0fdf4",
              padding: 20,
              borderRadius: 15,
              marginTop: 20,
            }}
          >
            <h3>Selected Patient</h3>

            <p>
              {selectedPatient.first_name}{" "}
              {selectedPatient.surname}
            </p>

            <p>
              ID: {selectedPatient.patient_id}
            </p>

            <p>
              DOB: {selectedPatient.date_of_birth}
            </p>

            {!selectedPatient.id && (
              <p>
                External referral patient.
                Link or register in CareScriber
                before saving.
              </p>
            )}

            <button
              style={button}
              onClick={() =>
                contactPatient("whatsapp")
              }
            >
              WhatsApp Patient
            </button>

            {" "}

            <button
              style={button}
              onClick={() =>
                contactPatient("phone")
              }
            >
              Call Patient
            </button>

            {selectedPatient.id && (
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  gap: 15,
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href={`/sick-note?patientId=${encodeURIComponent(selectedPatient.id)}`}
                >
                  Sick Note
                </Link>

                <Link
                  href={`/e-script?patientId=${encodeURIComponent(selectedPatient.id)}`}
                >
                  eScript
                </Link>

                <Link
                  href={`/referral?patientId=${encodeURIComponent(selectedPatient.id)}`}
                >
                  Referral
                </Link>
              </div>
            )}
          </div>
        )}

        <hr />

        <h2>AI Documentation Consent</h2>

        <label>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) =>
              setConsent(e.target.checked)
            }
          />

          I have verified the patient's consent
          to AI-assisted clinical documentation.
        </label>

        <hr />

        <h2>Recording</h2>

        <button
          style={{
            ...button,
            background: "#16a34a",
          }}
          disabled={recording}
          onClick={startRecording}
        >
          Start Recording
        </button>

        {" "}

        <button
          style={{
            ...button,
            background: "#dc2626",
          }}
          disabled={!recording}
          onClick={stopRecording}
        >
          Stop Recording
        </button>

        <hr />

        <h2>Clinical Image</h2>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
        />

        {photoPreview && (
          <>
            <img
              src={photoPreview}
              alt="Clinical image"
              style={{
                maxWidth: "100%",
                marginTop: 15,
              }}
            />

            <button
              style={button}
              disabled={analyzing}
              onClick={() =>
                void analyzeImage()
              }
            >
              {analyzing
                ? "Analyzing..."
                : "AI Analyze Image"}
            </button>
          </>
        )}

        {imageAnalysis && (
          <pre
            style={{
              whiteSpace: "pre-wrap",
            }}
          >
            {imageAnalysis}
          </pre>
        )}

        <hr />

        <h2>Transcript / Clinical Notes</h2>

        <textarea
          style={{
            ...input,
            minHeight: 220,
          }}
          value={transcript}
          onChange={(e) => {
            setTranscript(e.target.value);
            transcriptRef.current =
              e.target.value;
          }}
        />

        <br /><br />

        <button
          style={button}
          onClick={() =>
            void generateSoap()
          }
        >
          Generate SOAP Note
        </button>

        {soapNote && (
          <>
            <button
              style={{
                ...button,
                marginTop: 15,
                background: "#0f172a",
              }}
              onClick={() =>
                window.print()
              }
            >
              Export / Print PDF
            </button>

            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "#f8fafc",
                padding: 20,
                borderRadius: 12,
              }}
            >
              {soapNote}
            </pre>
          </>
        )}

        <hr />

        <h2>Recent Consultations</h2>

        {recent.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid #cbd5e1",
              padding: 15,
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <strong>
              {item.patient_summary ||
                "Consultation"}
            </strong>

            <br />

            <button
              style={{
                ...button,
                marginTop: 10,
              }}
              onClick={() => {
                setTranscript(
                  item.transcript || ""
                );
                setSoapNote(
                  item.soap_note || ""
                );
              }}
            >
              View Notes
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}
