"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Patient = {
  id: string;
  first_name?: string | null;
  surname?: string | null;
  last_name?: string | null;
  name?: string | null;
  patient_id?: string | null;
  id_number?: string | null;
  national_id?: string | null;
  date_of_birth?: string | null;
  dob?: string | null;
  gender?: string | null;
  mobile?: string | null;
  email?: string | null;
};

type DoctorProfile = {
  id?: string | null;
  first_name?: string | null;
  surname?: string | null;
  name?: string | null;
  full_name?: string | null;
  qualifications?: string | null;
  hpcsa_number?: string | null;
  registration_number?: string | null;
  practice_number?: string | null;
  email?: string | null;
  mobile?: string | null;
  phone?: string | null;
  practice_name?: string | null;
  practice_address?: string | null;
};

type Icd10 = {
  code: string;
  description: string;
};

function clean(value?: string | null) {
  return (value || "").trim();
}

function patientName(p?: Patient | null) {
  if (!p) return "";
  return (
    `${clean(p.first_name)} ${clean(p.surname || p.last_name)}`.trim() ||
    clean(p.name) ||
    "Patient"
  );
}

function patientIdentifier(p?: Patient | null) {
  if (!p) return "";
  return clean(p.id_number) || clean(p.patient_id) || clean(p.national_id);
}

function patientDob(p?: Patient | null) {
  return clean(p?.date_of_birth) || clean(p?.dob);
}

function formatDateZA(value?: string | null) {
  if (!value) return "";
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function calculateAge(value?: string | null) {
  if (!value) return "";
  const dob = new Date(`${value}T12:00:00`);
  if (Number.isNaN(dob.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 ? String(age) : "";
}

function generateReferralNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const token = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `REF-${y}${m}${d}-${token}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function ReferralPage() {
  const searchParams = useSearchParams();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientLoading, setPatientLoading] = useState(true);

  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(true);

  const [recipientName, setRecipientName] = useState("");
  const [recipientSpeciality, setRecipientSpeciality] = useState("");
  const [recipientFacility, setRecipientFacility] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  const [urgency, setUrgency] = useState("Routine");
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [examinationFindings, setExaminationFindings] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [currentMedication, setCurrentMedication] = useState("");
  const [allergies, setAllergies] = useState("");
  const [investigations, setInvestigations] = useState("");
  const [managementToDate, setManagementToDate] = useState("");
  const [referralRequest, setReferralRequest] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [icdSearch, setIcdSearch] = useState("");
  const [icdResults, setIcdResults] = useState<Icd10[]>([]);
  const [selectedIcd, setSelectedIcd] = useState<Icd10 | null>(null);
  const [icdLoading, setIcdLoading] = useState(false);

  const [includeConsultationSummary, setIncludeConsultationSummary] = useState(false);
  const [includeLabs, setIncludeLabs] = useState(false);
  const [includeImaging, setIncludeImaging] = useState(false);
  const [includePrescription, setIncludePrescription] = useState(false);
  const [includeOther, setIncludeOther] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [referralNumber, setReferralNumber] = useState("");

  useEffect(() => {
    setReferralNumber(generateReferralNumber());
    void loadPatients();
    void loadDoctor();
  }, []);

  async function loadPatients() {
    setPatientLoading(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select(
          "id,first_name,surname,last_name,name,patient_id,id_number,national_id,date_of_birth,dob,gender,mobile,email"
        )
        .order("first_name", { ascending: true })
        .limit(2000);

      if (error) throw error;

      const rows = (data || []) as Patient[];
      setPatients(rows);

      const queryPatientId = searchParams.get("patientId");
      const storedPatientId =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem("carescriber_selected_patient_id")
          : null;

      const wanted = queryPatientId || storedPatientId;

      if (wanted) {
        const match = rows.find((p) => p.id === wanted);
        if (match) {
          selectPatient(match);
          return;
        }

        const { data: exact, error: exactError } = await supabase
          .from("patients")
          .select(
            "id,first_name,surname,last_name,name,patient_id,id_number,national_id,date_of_birth,dob,gender,mobile,email"
          )
          .eq("id", wanted)
          .maybeSingle();

        if (!exactError && exact) {
          selectPatient(exact as Patient);
        }
      }
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? `Could not load patients: ${error.message}`
          : "Could not load patients."
      );
    } finally {
      setPatientLoading(false);
    }
  }

  async function loadDoctor() {
    setDoctorLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please sign in to create a referral.");
        return;
      }

      let profile: any = null;

      const byUser = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!byUser.error && byUser.data) {
        profile = byUser.data;
      } else {
        const byEmail = await supabase
          .from("profiles")
          .select("*")
          .eq("email", user.email || "")
          .maybeSingle();

        if (!byEmail.error && byEmail.data) profile = byEmail.data;
      }

      const doctorProfile: DoctorProfile = {
        ...(profile || {}),
        id: profile?.id || user.id,
        email: profile?.email || user.email || "",
      };

      setDoctor(doctorProfile);
    } catch (error) {
      console.error(error);
      setMessage("Could not load the logged-in clinician profile.");
    } finally {
      setDoctorLoading(false);
    }
  }

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setPatientSearch(patientName(p));

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("carescriber_selected_patient_id", p.id);
    }
  }

  function clearPatient() {
    setSelectedPatient(null);
    setPatientSearch("");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("carescriber_selected_patient_id");
    }
  }

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q || selectedPatient) return [];

    return patients
      .filter((p) => {
        const haystack = [
          patientName(p),
          p.id_number,
          p.patient_id,
          p.national_id,
          p.mobile,
          p.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .slice(0, 12);
  }, [patients, patientSearch, selectedPatient]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchIcd10(icdSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [icdSearch]);

  async function searchIcd10(query: string) {
    const q = query.trim();
    if (q.length < 2 || selectedIcd) {
      setIcdResults([]);
      return;
    }

    setIcdLoading(true);

    try {
      // SAME full ICD-10 table used by eScript / Sick Note.
      // Search both code and description; do not use a hard-coded shortlist.
      const { data, error } = await supabase
        .from("icd10_codes")
        .select("code,description")
        .or(`code.ilike.%${q}%,description.ilike.%${q}%`)
        .order("code", { ascending: true })
        .limit(50);

      if (error) throw error;
      setIcdResults((data || []) as Icd10[]);
    } catch (error) {
      console.error("ICD-10 search failed", error);
      setIcdResults([]);
      setMessage(
        "ICD-10 search could not load. Confirm the existing icd10_codes table contains the full dataset."
      );
    } finally {
      setIcdLoading(false);
    }
  }

  function chooseIcd(item: Icd10) {
    setSelectedIcd(item);
    setIcdSearch(`${item.code} - ${item.description}`);
    setIcdResults([]);
  }

  function clearIcd() {
    setSelectedIcd(null);
    setIcdSearch("");
    setIcdResults([]);
  }

  const doctorName = useMemo(() => {
    if (!doctor) return "";
    return (
      clean(doctor.full_name) ||
      clean(doctor.name) ||
      `${clean(doctor.first_name)} ${clean(doctor.surname)}`.trim()
    );
  }, [doctor]);

  const doctorRegistration =
    clean(doctor?.hpcsa_number) || clean(doctor?.registration_number);

  function validate() {
    if (!selectedPatient) return "Please select a patient.";
    if (!patientIdentifier(selectedPatient))
      return "The selected patient has no ID / passport number. Update the patient record before issuing the referral.";
    if (!doctorName) return "The logged-in clinician profile is missing the clinician name.";
    if (!reason.trim()) return "Please enter the reason for referral.";
    if (!referralRequest.trim()) return "Please enter the specific request to the receiving clinician.";
    return "";
  }

  async function saveReferral(status: "draft" | "issued") {
    const validation = validate();
    if (validation) {
      setMessage(validation);
      return false;
    }

    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        referral_number: referralNumber,
        patient_id: selectedPatient!.id,
        patient_identifier: patientIdentifier(selectedPatient),
        patient_name: patientName(selectedPatient),
        patient_date_of_birth: patientDob(selectedPatient) || null,
        patient_gender: selectedPatient!.gender || null,
        patient_mobile: selectedPatient!.mobile || null,
        patient_email: selectedPatient!.email || null,

        consultation_id: searchParams.get("consultationId") || null,
        symptomai_referral_id: searchParams.get("referralId") || null,

        referred_by_user_id: user?.id || null,
        doctor_name: doctorName,
        doctor_qualifications: doctor?.qualifications || null,
        doctor_registration_number: doctorRegistration || null,
        doctor_practice_number: doctor?.practice_number || null,
        doctor_email: doctor?.email || null,
        doctor_mobile: doctor?.mobile || doctor?.phone || null,
        practice_name: doctor?.practice_name || "CareScriber",
        practice_address: doctor?.practice_address || null,

        recipient_name: recipientName.trim() || null,
        recipient_speciality: recipientSpeciality.trim() || null,
        recipient_facility: recipientFacility.trim() || null,
        recipient_email: recipientEmail.trim() || null,
        recipient_phone: recipientPhone.trim() || null,

        urgency,
        reason_for_referral: reason.trim(),
        clinical_summary: clinicalSummary.trim() || null,
        examination_findings: examinationFindings.trim() || null,
        relevant_medical_history: medicalHistory.trim() || null,
        current_medication: currentMedication.trim() || null,
        allergies: allergies.trim() || null,
        investigations: investigations.trim() || null,

        icd10_code: selectedIcd?.code || null,
        icd10_description: selectedIcd?.description || null,
        working_diagnosis: selectedIcd?.description || null,

        management_to_date: managementToDate.trim() || null,
        referral_request: referralRequest.trim(),
        additional_notes: additionalNotes.trim() || null,

        include_consultation_summary: includeConsultationSummary,
        include_laboratory_results: includeLabs,
        include_imaging: includeImaging,
        include_prescription: includePrescription,
        include_other_attachment: includeOther,

        status,
        issued_at: status === "issued" ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from("medical_referrals")
        .upsert(payload, { onConflict: "referral_number" });

      if (error) throw error;

      setMessage(
        status === "issued"
          ? `Referral ${referralNumber} issued and saved.`
          : `Referral ${referralNumber} saved as draft.`
      );

      return true;
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? `Referral save failed: ${error.message}`
          : "Referral save failed."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  function buildLetterHtml() {
    if (!selectedPatient) return "";

    const dob = patientDob(selectedPatient);
    const age = calculateAge(dob);
    const icd = selectedIcd
      ? `${escapeHtml(selectedIcd.code)} - ${escapeHtml(selectedIcd.description)}`
      : "Not recorded";

    const doctorContact = [doctor?.email, doctor?.mobile || doctor?.phone]
      .filter(Boolean)
      .join(" · ");

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(referralNumber)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111827; margin:0; font-size:12px; line-height:1.5; }
  .top { border-bottom:3px solid #f97316; padding-bottom:12px; margin-bottom:16px; }
  h1 { font-size:24px; margin:0 0 4px; }
  h2 { font-size:13px; margin:18px 0 6px; color:#374151; text-transform:uppercase; letter-spacing:.04em; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }
  .box { border:1px solid #e5e7eb; padding:12px; border-radius:8px; margin:10px 0; }
  .label { color:#6b7280; font-size:10px; text-transform:uppercase; }
  .value { font-weight:600; }
  .urgency { display:inline-block; padding:4px 9px; border:1px solid #111827; border-radius:999px; font-weight:700; }
  .footer { margin-top:28px; border-top:1px solid #d1d5db; padding-top:12px; }
  p { white-space:pre-wrap; }
</style>
</head>
<body>
  <div class="top">
    <div class="label">CareScriber AI · Medical Referral</div>
    <h1>Medical Referral</h1>
    <div>Reference: <strong>${escapeHtml(referralNumber)}</strong></div>
    <div>Date: ${escapeHtml(new Date().toLocaleDateString("en-ZA"))}</div>
  </div>

  <div class="grid">
    <div>
      <div class="label">Patient</div>
      <div class="value">${escapeHtml(patientName(selectedPatient))}</div>
    </div>
    <div>
      <div class="label">ID / Passport</div>
      <div class="value">${escapeHtml(patientIdentifier(selectedPatient))}</div>
    </div>
    <div>
      <div class="label">Date of birth</div>
      <div class="value">${escapeHtml(formatDateZA(dob) || "Not recorded")}${age ? ` · Age ${escapeHtml(age)}` : ""}</div>
    </div>
    <div>
      <div class="label">Gender</div>
      <div class="value">${escapeHtml(clean(selectedPatient.gender) || "Not recorded")}</div>
    </div>
  </div>

  <div class="box">
    <div class="grid">
      <div>
        <div class="label">Referred to</div>
        <div class="value">${escapeHtml(recipientName || "Receiving clinician")}</div>
      </div>
      <div>
        <div class="label">Speciality / Facility</div>
        <div class="value">${escapeHtml([recipientSpeciality, recipientFacility].filter(Boolean).join(" · ") || "Not specified")}</div>
      </div>
    </div>
    <div style="margin-top:10px"><span class="urgency">${escapeHtml(urgency)}</span></div>
  </div>

  <p>Dear Colleague,</p>
  <p>Thank you for assessing the above-mentioned patient.</p>

  <h2>Reason for referral</h2>
  <p>${escapeHtml(reason || "Not recorded")}</p>

  <h2>Clinical summary / history</h2>
  <p>${escapeHtml(clinicalSummary || "Not recorded")}</p>

  <h2>Relevant examination / clinical findings</h2>
  <p>${escapeHtml(examinationFindings || "Not recorded")}</p>

  <h2>Relevant medical history</h2>
  <p>${escapeHtml(medicalHistory || "Not recorded")}</p>

  <h2>Current medication</h2>
  <p>${escapeHtml(currentMedication || "Not recorded")}</p>

  <h2>Allergies</h2>
  <p>${escapeHtml(allergies || "Not recorded")}</p>

  <h2>Investigations / results</h2>
  <p>${escapeHtml(investigations || "Not recorded")}</p>

  <h2>Working diagnosis / ICD-10</h2>
  <p>${icd}</p>

  <h2>Treatment / management to date</h2>
  <p>${escapeHtml(managementToDate || "Not recorded")}</p>

  <h2>Specific referral request</h2>
  <p>${escapeHtml(referralRequest || "Please assess and advise regarding further management.")}</p>

  ${additionalNotes ? `<h2>Additional notes</h2><p>${escapeHtml(additionalNotes)}</p>` : ""}

  <p>Please assess and manage as clinically appropriate. Kindly communicate significant findings and the ongoing management plan where appropriate.</p>

  <div class="footer">
    <div>Kind regards,</div>
    <div class="value">${escapeHtml(doctorName || "Referring clinician")}</div>
    ${doctor?.qualifications ? `<div>${escapeHtml(doctor.qualifications)}</div>` : ""}
    <div>HPCSA / Registration: ${escapeHtml(doctorRegistration || "Not recorded")}</div>
    <div>Practice No: ${escapeHtml(clean(doctor?.practice_number) || "Not recorded")}</div>
    ${doctorContact ? `<div>${escapeHtml(doctorContact)}</div>` : ""}
    ${doctor?.practice_address ? `<div>${escapeHtml(doctor.practice_address)}</div>` : ""}
    <div style="margin-top:8px;color:#6b7280;font-size:10px">Generated securely by CareScriber.</div>
  </div>
</body>
</html>`;
  }

  async function issueAndPrint() {
    const ok = await saveReferral("issued");
    if (!ok) return;

    const html = buildLetterHtml();
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      setMessage("Referral saved, but the print window was blocked. Allow pop-ups and try Print / PDF again.");
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/dashboard" style={styles.back}>
          ← Back to Dashboard
        </Link>

        <div style={styles.tabs}>
          <Link href="/dashboard" style={styles.tab}>Dashboard</Link>
          <Link href="/inbox" style={styles.tab}>Virtual Consult Inbox</Link>
          <Link href="/patients" style={styles.tab}>Patients</Link>
          <Link href="/consultation" style={styles.tab}>Consultation</Link>
          <Link href="/e-script" style={styles.tab}>eScript</Link>
          <Link href="/sick-note" style={styles.tab}>Sick Note</Link>
          <Link href="/referral" style={styles.activeTab}>Referral</Link>
        </div>

        <p style={styles.kicker}>CareScriber AI</p>
        <h1 style={styles.title}>Medical Referral</h1>
        <p style={styles.subtitle}>
          Create a structured clinical referral with linked patient details,
          full ICD-10 search and referring clinician details.
        </p>

        <div style={styles.info}>Referral No: {referralNumber || "Generating..."}</div>

        {message && <div style={styles.message}>{message}</div>}

        <h2 style={styles.heading}>Patient</h2>

        {patientLoading && <div style={styles.info}>Loading patient record...</div>}

        <input
          style={styles.input}
          value={patientSearch}
          placeholder="Search patient by name, ID / passport or mobile"
          onChange={(e) => {
            setPatientSearch(e.target.value);
            setSelectedPatient(null);
          }}
        />

        {filteredPatients.map((p) => (
          <button
            type="button"
            key={p.id}
            style={styles.patientCard}
            onClick={() => selectPatient(p)}
          >
            <strong>{patientName(p)}</strong>
            <span>
              ID: {patientIdentifier(p) || "Not captured"} ·{" "}
              DOB: {formatDateZA(patientDob(p)) || "Not captured"} ·{" "}
              {p.mobile || "No mobile"}
            </span>
          </button>
        ))}

        {selectedPatient && (
          <div style={styles.selected}>
            <div>
              <strong>{patientName(selectedPatient)}</strong>
              <div>
                ID / Passport: <b>{patientIdentifier(selectedPatient) || "Not captured"}</b>
              </div>
              <div>
                DOB: {formatDateZA(patientDob(selectedPatient)) || "Not captured"}
                {calculateAge(patientDob(selectedPatient))
                  ? ` · Age ${calculateAge(patientDob(selectedPatient))}`
                  : ""}
              </div>
              <div>
                {selectedPatient.gender || "Gender not captured"} ·{" "}
                {selectedPatient.mobile || "No mobile"} ·{" "}
                {selectedPatient.email || "No email"}
              </div>
            </div>
            <button type="button" style={styles.smallButton} onClick={clearPatient}>
              Change patient
            </button>
          </div>
        )}

        <h2 style={styles.heading}>Referring Clinician</h2>
        {doctorLoading ? (
          <div style={styles.info}>Loading clinician profile...</div>
        ) : (
          <div style={styles.summaryBox}>
            <strong>{doctorName || "Clinician name missing"}</strong>
            <span>
              {doctor?.qualifications || "Qualifications not captured"}
            </span>
            <span>
              HPCSA / Registration: {doctorRegistration || "Not captured"} · Practice:{" "}
              {doctor?.practice_number || "Not captured"}
            </span>
            <span>
              {doctor?.email || "No email"} ·{" "}
              {doctor?.mobile || doctor?.phone || "No mobile"}
            </span>
          </div>
        )}

        <h2 style={styles.heading}>Receiving Clinician</h2>
        <div style={styles.grid2}>
          <input style={styles.input} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Clinician name" />
          <input style={styles.input} value={recipientSpeciality} onChange={(e) => setRecipientSpeciality(e.target.value)} placeholder="Speciality" />
          <input style={styles.input} value={recipientFacility} onChange={(e) => setRecipientFacility(e.target.value)} placeholder="Practice / facility" />
          <input style={styles.input} value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="Email" />
          <input style={styles.input} value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="Telephone" />
          <select style={styles.input} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option>Routine</option>
            <option>Urgent</option>
            <option>Same-day</option>
            <option>Emergency</option>
          </select>
        </div>

        <h2 style={styles.heading}>Reason for Referral *</h2>
        <textarea style={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Primary reason for referral and relevant clinical question." />

        <h2 style={styles.heading}>Clinical Summary / History</h2>
        <textarea style={styles.textarea} value={clinicalSummary} onChange={(e) => setClinicalSummary(e.target.value)} placeholder="Presenting complaint, duration, progression and relevant associated symptoms." />

        <h2 style={styles.heading}>Relevant Examination / Clinical Findings</h2>
        <textarea style={styles.textarea} value={examinationFindings} onChange={(e) => setExaminationFindings(e.target.value)} placeholder="Vitals, examination findings and clinically relevant negatives." />

        <div style={styles.grid2}>
          <div>
            <h2 style={styles.heading}>Relevant Medical History</h2>
            <textarea style={styles.textarea} value={medicalHistory} onChange={(e) => setMedicalHistory(e.target.value)} placeholder="Relevant medical / surgical history." />
          </div>
          <div>
            <h2 style={styles.heading}>Current Medication</h2>
            <textarea style={styles.textarea} value={currentMedication} onChange={(e) => setCurrentMedication(e.target.value)} placeholder="Current medication." />
          </div>
        </div>

        <h2 style={styles.heading}>Allergies</h2>
        <textarea style={styles.textareaSmall} value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Drug / food / other allergies, or NKDA if confirmed." />

        <h2 style={styles.heading}>Investigations / Results</h2>
        <textarea style={styles.textarea} value={investigations} onChange={(e) => setInvestigations(e.target.value)} placeholder="Relevant pathology, imaging and other results." />

        <h2 style={styles.heading}>Working Diagnosis / ICD-10</h2>
        <p style={styles.help}>
          Searches the same full <b>icd10_codes</b> table used by CareScriber eScript / Sick Note.
          Search by ICD-10 code or diagnosis description.
        </p>
        <div style={styles.icdWrap}>
          <input
            style={styles.input}
            value={icdSearch}
            onChange={(e) => {
              setSelectedIcd(null);
              setIcdSearch(e.target.value);
            }}
            placeholder="Search full ICD-10 list, e.g. Z71, dental pain, depression..."
            autoComplete="off"
          />
          {icdLoading && <div style={styles.help}>Searching ICD-10...</div>}
          {icdResults.length > 0 && (
            <div style={styles.icdResults}>
              {icdResults.map((item) => (
                <button key={`${item.code}-${item.description}`} type="button" style={styles.icdItem} onClick={() => chooseIcd(item)}>
                  <strong>{item.code}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedIcd && (
          <div style={styles.selectedIcd}>
            <div><b>{selectedIcd.code}</b> — {selectedIcd.description}</div>
            <button type="button" style={styles.smallButton} onClick={clearIcd}>Change ICD-10</button>
          </div>
        )}

        <h2 style={styles.heading}>Treatment / Management to Date</h2>
        <textarea style={styles.textarea} value={managementToDate} onChange={(e) => setManagementToDate(e.target.value)} placeholder="Treatment already given, response and outstanding management." />

        <h2 style={styles.heading}>Specific Request to Receiving Clinician *</h2>
        <textarea style={styles.textarea} value={referralRequest} onChange={(e) => setReferralRequest(e.target.value)} placeholder="Please assess and advise regarding..." />

        <h2 style={styles.heading}>Attachments / Supporting Information</h2>
        <div style={styles.checkGrid}>
          <label style={styles.check}><input type="checkbox" checked={includeConsultationSummary} onChange={(e) => setIncludeConsultationSummary(e.target.checked)} /> Consultation summary</label>
          <label style={styles.check}><input type="checkbox" checked={includeLabs} onChange={(e) => setIncludeLabs(e.target.checked)} /> Laboratory results</label>
          <label style={styles.check}><input type="checkbox" checked={includeImaging} onChange={(e) => setIncludeImaging(e.target.checked)} /> Imaging / report</label>
          <label style={styles.check}><input type="checkbox" checked={includePrescription} onChange={(e) => setIncludePrescription(e.target.checked)} /> Prescription</label>
          <label style={styles.check}><input type="checkbox" checked={includeOther} onChange={(e) => setIncludeOther(e.target.checked)} /> Other</label>
        </div>

        <h2 style={styles.heading}>Additional Notes</h2>
        <textarea style={styles.textareaSmall} value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} placeholder="Optional additional information." />

        <div style={styles.warning}>
          The clinician remains responsible for confirming the diagnosis, ICD-10 code,
          urgency, clinical information and referral destination before issuing the referral.
        </div>

        <div style={styles.actions}>
          <button type="button" style={styles.secondaryButton} disabled={saving} onClick={() => void saveReferral("draft")}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button type="button" style={styles.primaryButton} disabled={saving} onClick={() => void issueAndPrint()}>
            {saving ? "Saving..." : "Issue Referral + Print / PDF"}
          </button>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: "24px 14px 60px",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  card: {
    maxWidth: 1050,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 12px 35px rgba(0,0,0,.08)",
  },
  back: { color: "#374151", textDecoration: "none", fontWeight: 700 },
  tabs: { display: "flex", flexWrap: "wrap", gap: 8, margin: "18px 0 24px" },
  tab: {
    textDecoration: "none",
    border: "1px solid #e5e7eb",
    color: "#374151",
    padding: "9px 12px",
    borderRadius: 10,
    fontWeight: 700,
  },
  activeTab: {
    textDecoration: "none",
    background: "#f97316",
    color: "#fff",
    padding: "9px 12px",
    borderRadius: 10,
    fontWeight: 800,
  },
  kicker: { color: "#f97316", fontWeight: 800, marginBottom: 4 },
  title: { fontSize: 34, margin: "0 0 8px", color: "#111827" },
  subtitle: { color: "#6b7280", lineHeight: 1.6, marginTop: 0 },
  info: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    padding: 12,
    borderRadius: 10,
    margin: "12px 0",
  },
  message: {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    padding: 12,
    borderRadius: 10,
    margin: "12px 0",
  },
  heading: { fontSize: 17, margin: "24px 0 8px", color: "#111827" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "12px 13px",
    fontSize: 15,
    background: "#fff",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: 13,
    minHeight: 115,
    resize: "vertical",
    fontSize: 15,
    fontFamily: "inherit",
  },
  textareaSmall: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: 13,
    minHeight: 80,
    resize: "vertical",
    fontSize: 15,
    fontFamily: "inherit",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
    gap: 12,
  },
  patientCard: {
    display: "flex",
    width: "100%",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    padding: 12,
    marginTop: 7,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "left",
  },
  selected: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    lineHeight: 1.6,
  },
  summaryBox: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
  },
  help: { color: "#6b7280", fontSize: 13, marginTop: 0 },
  icdWrap: { position: "relative" },
  icdResults: {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 330,
    overflowY: "auto",
    background: "#fff",
    boxShadow: "0 10px 25px rgba(0,0,0,.08)",
  },
  icdItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 3,
    width: "100%",
    padding: 11,
    border: 0,
    borderBottom: "1px solid #f3f4f6",
    background: "#fff",
    textAlign: "left",
    cursor: "pointer",
  },
  selectedIcd: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  checkGrid: { display: "flex", flexWrap: "wrap", gap: 12 },
  check: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "10px 12px",
  },
  warning: {
    marginTop: 22,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 10,
    padding: 12,
    color: "#78350f",
  },
  actions: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 },
  primaryButton: {
    border: 0,
    borderRadius: 10,
    padding: "12px 17px",
    background: "#f97316",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "12px 17px",
    background: "#fff",
    color: "#111827",
    fontWeight: 800,
    cursor: "pointer",
  },
  smallButton: {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "8px 10px",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
