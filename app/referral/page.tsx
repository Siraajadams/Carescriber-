"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../../lib/supabase";

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
  phone?: string | null;
  email?: string | null;
  medical_aid?: string | null;
  allergies?: string | null;
  current_medicines?: string | null;
};

type DoctorProfile = {
  id?: string | null;
  first_name?: string | null;
  surname?: string | null;
  name?: string | null;
  full_name?: string | null;
  qualifications?: string | null;
  hpcsa?: string | null;
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

type ReferralAttachment = {
  id?: string;
  file_name: string;
  storage_path: string;
  mime_type?: string | null;
  file_size?: number | null;
  signed_url?: string | null;
};

const COMMON_ALLERGIES = [
  "No known allergies",
  "Penicillin",
  "Aspirin",
  "Sulfonamides",
  "Cephalosporins",
  "NSAIDs",
  "Codeine",
  "Latex",
  "Other",
];

function clean(value?: string | null) {
  return (value || "").trim();
}

function mapPatient(row: any): Patient {
  return {
    id: row.id,
    first_name: row.first_name || row.name || "",
    surname: row.surname || row.last_name || "",
    last_name: row.last_name || row.surname || "",
    name: row.name || "",
    patient_id: row.patient_id || row.id_number || row.national_id || "",
    id_number: row.id_number || row.patient_id || row.national_id || "",
    national_id: row.national_id || row.id_number || row.patient_id || "",
    date_of_birth: row.date_of_birth || row.dob || null,
    dob: row.dob || row.date_of_birth || null,
    gender: row.gender || "",
    mobile: row.mobile || row.phone || row.mobile_number || "",
    phone: row.phone || row.mobile || row.mobile_number || "",
    email: row.email || "",
    medical_aid: row.medical_aid || "",
    allergies: row.allergies || "",
    current_medicines: row.current_medicines || "",
  };
}

function patientName(patient?: Patient | null) {
  if (!patient) return "";
  return (
    `${clean(patient.first_name)} ${clean(patient.surname || patient.last_name)}`.trim() ||
    clean(patient.name) ||
    "Patient"
  );
}

function patientIdentifier(patient?: Patient | null) {
  if (!patient) return "";
  return clean(patient.id_number) || clean(patient.patient_id) || clean(patient.national_id);
}

function patientDob(patient?: Patient | null) {
  return clean(patient?.date_of_birth) || clean(patient?.dob);
}

function patientMobile(patient?: Patient | null) {
  return clean(patient?.mobile) || clean(patient?.phone);
}

function formatDateZA(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function calculateAge(value?: string | null) {
  if (!value) return "";
  const dob = new Date(`${value}T12:00:00`);
  if (Number.isNaN(dob.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDifference = today.getMonth() - dob.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dob.getDate())
  ) {
    age--;
  }

  return age >= 0 ? String(age) : "";
}

function generateReferralNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const randomPart = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `REF-${year}${month}${day}-${randomPart}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normaliseId(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export default function ReferralPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientLoading, setPatientLoading] = useState(true);
  const [patientSearching, setPatientSearching] = useState(false);

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
  const [investigations, setInvestigations] = useState("");
  const [managementToDate, setManagementToDate] = useState("");
  const [referralRequest, setReferralRequest] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [otherAllergy, setOtherAllergy] = useState("");

  const [icdSearch, setIcdSearch] = useState("");
  const [icdResults, setIcdResults] = useState<Icd10[]>([]);
  const [selectedIcd, setSelectedIcd] = useState<Icd10 | null>(null);
  const [icdLoading, setIcdLoading] = useState(false);

  const [includeConsultationSummary, setIncludeConsultationSummary] = useState(false);
  const [includeLabs, setIncludeLabs] = useState(false);
  const [includeImaging, setIncludeImaging] = useState(false);
  const [includePrescription, setIncludePrescription] = useState(false);
  const [includeOther, setIncludeOther] = useState(false);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<ReferralAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [operationMessage, setOperationMessage] = useState("");
  const [referralNumber, setReferralNumber] = useState("");

  const getQueryParam = (name: string) => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(name);
  };

  useEffect(() => {
    setReferralNumber(generateReferralNumber());
    void loadPatients();
    void loadDoctor();
  }, []);

  async function loadPatients() {
    setPatientLoading(true);
    setMessage("");

    try {
      // Use select("*") so this page does not fail when optional columns
      // differ between CareScriber database versions.
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;

      const rows = (data || []).map(mapPatient);
      setPatients(rows);

      const queryPatientId =
        getQueryParam("patientId") ||
        getQueryParam("patient");

      const storedPatientId =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem("carescriber_selected_patient_id")
          : null;

      const wantedPatientId = queryPatientId || storedPatientId;

      if (!wantedPatientId) return;

      const match = rows.find((patient) => patient.id === wantedPatientId);

      if (match) {
        selectPatient(match);
        return;
      }

      const { data: exactPatient, error: exactError } = await supabase
        .from("patients")
        .select("*")
        .eq("id", wantedPatientId)
        .maybeSingle();

      if (!exactError && exactPatient) {
        selectPatient(mapPatient(exactPatient));
      }
    } catch (error) {
      console.error("Patient load failed:", error);
      setMessage(
        error instanceof Error
          ? `Could not load patients: ${error.message}`
          : "Could not load patients.",
      );
    } finally {
      setPatientLoading(false);
    }
  }

  async function searchPatients() {
    const term = patientSearch.trim();

    if (!term) {
      setMessage("Enter patient name, surname, ID / passport or mobile number.");
      return;
    }

    setPatientSearching(true);
    setMessage("");
    setSelectedPatient(null);

    try {
      const normalised = normaliseId(term);

      // Search broad text fields, but gracefully fall back if one optional
      // column does not exist in this Supabase schema.
      const searchSets = [
        [
          `first_name.ilike.%${term}%`,
          `surname.ilike.%${term}%`,
          `last_name.ilike.%${term}%`,
          `patient_id.ilike.%${term}%`,
          `id_number.ilike.%${term}%`,
          `national_id.ilike.%${term}%`,
          `mobile.ilike.%${term}%`,
          `phone.ilike.%${term}%`,
          `patient_id.ilike.%${normalised}%`,
          `id_number.ilike.%${normalised}%`,
          `national_id.ilike.%${normalised}%`,
        ],
        [
          `first_name.ilike.%${term}%`,
          `surname.ilike.%${term}%`,
          `patient_id.ilike.%${term}%`,
          `id_number.ilike.%${term}%`,
          `mobile.ilike.%${term}%`,
        ],
        [
          `first_name.ilike.%${term}%`,
          `surname.ilike.%${term}%`,
          `patient_id.ilike.%${term}%`,
        ],
      ];

      let found: any[] = [];
      let lastError: any = null;

      for (const filters of searchSets) {
        const result = await supabase
          .from("patients")
          .select("*")
          .or(filters.join(","))
          .limit(30);

        if (!result.error) {
          found = result.data || [];
          lastError = null;
          break;
        }

        lastError = result.error;
      }

      if (lastError) throw lastError;

      const mapped = found.map(mapPatient);
      setPatients(mapped);

      if (mapped.length === 0) {
        setMessage("No matching patient found.");
      } else if (mapped.length === 1) {
        selectPatient(mapped[0]);
      } else {
        setMessage(`${mapped.length} matching patients found. Select the correct patient.`);
      }
    } catch (error) {
      console.error("Patient search failed:", error);
      setMessage(
        error instanceof Error
          ? `Patient search failed: ${error.message}`
          : "Patient search failed.",
      );
    } finally {
      setPatientSearching(false);
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

      let profile: Record<string, any> | null = null;

      const byId = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!byId.error && byId.data) {
        profile = byId.data;
      } else {
        const byUserId = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!byUserId.error && byUserId.data) {
          profile = byUserId.data;
        } else if (user.email) {
          const byEmail = await supabase
            .from("profiles")
            .select("*")
            .eq("email", user.email)
            .maybeSingle();

          if (!byEmail.error && byEmail.data) profile = byEmail.data;
        }
      }

      setDoctor({
        ...(profile || {}),
        id: profile?.id || user.id,
        email: profile?.email || user.email || "",
      });
    } catch (error) {
      console.error("Clinician profile load failed:", error);
      setMessage("Could not load the logged-in clinician profile.");
    } finally {
      setDoctorLoading(false);
    }
  }

  function selectPatient(patient: Patient) {
    setSelectedPatient(patient);
    setPatientSearch(patientName(patient));
    setCurrentMedication(patient.current_medicines || "");

    if (patient.allergies) {
      const existing = patient.allergies
        .split(/[,;|]/)
        .map((item) => item.trim())
        .filter(Boolean);

      const known = existing.filter((item) =>
        COMMON_ALLERGIES.some(
          (common) => common.toLowerCase() === item.toLowerCase(),
        ),
      );

      const unknown = existing.filter(
        (item) =>
          !COMMON_ALLERGIES.some(
            (common) => common.toLowerCase() === item.toLowerCase(),
          ),
      );

      setSelectedAllergies(known);
      setOtherAllergy(unknown.join(", "));

      if (unknown.length > 0 && !known.includes("Other")) {
        setSelectedAllergies([...known, "Other"]);
      }
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "carescriber_selected_patient_id",
        patient.id,
      );
    }

    setMessage("");
  }

  function clearPatient() {
    setSelectedPatient(null);
    setPatientSearch("");
    setCurrentMedication("");
    setSelectedAllergies([]);
    setOtherAllergy("");

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("carescriber_selected_patient_id");
    }
  }

  const filteredPatients = useMemo(() => {
    const query = patientSearch.trim().toLowerCase();

    if (!query || selectedPatient) return [];

    return patients
      .filter((patient) => {
        const searchableText = [
          patientName(patient),
          patient.id_number,
          patient.patient_id,
          patient.national_id,
          patient.mobile,
          patient.phone,
          patient.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      })
      .slice(0, 15);
  }, [patients, patientSearch, selectedPatient]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchIcd10(icdSearch);
    }, 250);

    return () => clearTimeout(timer);
  }, [icdSearch, selectedIcd]);

  async function searchIcd10(query: string) {
    const cleanedQuery = query.trim();

    if (cleanedQuery.length < 2 || selectedIcd) {
      setIcdResults([]);
      return;
    }

    setIcdLoading(true);

    try {
      const safeQuery = cleanedQuery.replace(/[(),]/g, " ");

      const { data, error } = await supabase
        .from("icd10_codes")
        .select("code,description")
        .or(`code.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
        .order("code", { ascending: true })
        .limit(60);

      if (error) throw error;

      setIcdResults((data || []) as Icd10[]);
    } catch (error) {
      console.error("ICD-10 search failed:", error);
      setIcdResults([]);
      setMessage(
        "ICD-10 search could not load. Confirm the full dataset exists in public.icd10_codes.",
      );
    } finally {
      setIcdLoading(false);
    }
  }

  function selectIcd(item: Icd10) {
    setSelectedIcd(item);
    setIcdSearch(`${item.code} - ${item.description}`);
    setIcdResults([]);
  }

  function clearIcd() {
    setSelectedIcd(null);
    setIcdSearch("");
    setIcdResults([]);
  }

  function toggleAllergy(allergy: string) {
    setSelectedAllergies((current) => {
      if (allergy === "No known allergies") {
        return current.includes(allergy) ? [] : [allergy];
      }

      const withoutNkda = current.filter(
        (item) => item !== "No known allergies",
      );

      return withoutNkda.includes(allergy)
        ? withoutNkda.filter((item) => item !== allergy)
        : [...withoutNkda, allergy];
    });
  }

  const allergyText = useMemo(() => {
    const values = selectedAllergies.filter(
      (item) => item !== "Other",
    );

    if (selectedAllergies.includes("Other") && otherAllergy.trim()) {
      values.push(otherAllergy.trim());
    }

    return values.join(", ");
  }, [selectedAllergies, otherAllergy]);

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    const allowed = files.filter((file) => file.size <= 10 * 1024 * 1024);

    if (allowed.length !== files.length) {
      setMessage("Files larger than 10 MB were not added.");
    }

    setPendingFiles((current) => [...current, ...allowed].slice(0, 10));
  }

  function removePendingFile(index: number) {
    setPendingFiles((current) => current.filter((_, i) => i !== index));
  }

  async function uploadAttachments(referralId: string) {
    if (pendingFiles.length === 0) return uploadedAttachments;

    setUploadingAttachments(true);

    try {
      const uploaded: ReferralAttachment[] = [];

      for (const file of pendingFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${referralId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("referral-attachments")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadError) throw uploadError;

        const { data: signedData, error: signedError } = await supabase.storage
          .from("referral-attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 7);

        if (signedError) throw signedError;

        const record: ReferralAttachment = {
          file_name: file.name,
          storage_path: path,
          mime_type: file.type || null,
          file_size: file.size,
          signed_url: signedData?.signedUrl || null,
        };

        const { data: attachmentRow, error: rowError } = await supabase
          .from("medical_referral_attachments")
          .insert({
            referral_id: referralId,
            file_name: record.file_name,
            storage_path: record.storage_path,
            mime_type: record.mime_type,
            file_size: record.file_size,
          })
          .select("id")
          .single();

        if (rowError) throw rowError;

        uploaded.push({
          ...record,
          id: attachmentRow.id,
        });
      }

      setUploadedAttachments((current) => [...current, ...uploaded]);
      setPendingFiles([]);
      return [...uploadedAttachments, ...uploaded];
    } finally {
      setUploadingAttachments(false);
    }
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
    clean(doctor?.hpcsa_number) ||
    clean(doctor?.registration_number) ||
    clean(doctor?.hpcsa);

  function validateReferral(requireEmail = false) {
    if (!selectedPatient) return "Please select a patient.";
    if (!patientIdentifier(selectedPatient)) {
      return "The selected patient does not have an ID / passport number.";
    }
    if (!doctorName) return "The logged-in clinician profile is missing the clinician name.";
    if (!reason.trim()) return "Please enter the reason for referral.";
    if (!referralRequest.trim()) {
      return "Please enter the specific request to the receiving clinician.";
    }
    if (requireEmail && !recipientEmail.trim()) {
      return "Please enter the receiving clinician's email address before sending.";
    }
    return "";
  }

  async function saveReferral(status: "draft" | "issued" | "emailed") {
    const validationError = validateReferral(status === "emailed");

    if (validationError) {
      setMessage(validationError);
      return null;
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
        patient_mobile: patientMobile(selectedPatient) || null,
        patient_email: selectedPatient!.email || null,

        consultation_id: getQueryParam("consultationId") || null,
        symptomai_referral_id: getQueryParam("referralId") || null,

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
        allergies: allergyText || null,
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
        issued_at:
          status === "issued" || status === "emailed"
            ? new Date().toISOString()
            : null,
      };

      const { data, error } = await supabase
        .from("medical_referrals")
        .upsert(payload, { onConflict: "referral_number" })
        .select("id")
        .single();

      if (error) throw error;

      const attachments = await uploadAttachments(data.id);

      setMessage(
        status === "draft"
          ? `Referral ${referralNumber} saved as draft.`
          : `Referral ${referralNumber} saved successfully.`,
      );

      return {
        referralId: data.id as string,
        attachments,
      };
    } catch (error) {
      console.error("Referral save failed:", error);
      setMessage(
        error instanceof Error
          ? `Referral save failed: ${error.message}`
          : "Referral save failed.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  function buildLetterHtml(forEmail = false) {
    if (!selectedPatient) return "";

    const dob = patientDob(selectedPatient);
    const age = calculateAge(dob);

    const icdText = selectedIcd
      ? `${escapeHtml(selectedIcd.code)} - ${escapeHtml(selectedIcd.description)}`
      : "Not recorded";

    const doctorContact = [
      doctor?.email,
      doctor?.mobile || doctor?.phone,
    ]
      .filter(Boolean)
      .join(" · ");

    const attachmentList =
      uploadedAttachments.length > 0
        ? `<h2>Attachments</h2><ul>${uploadedAttachments
            .map(
              (attachment) =>
                `<li>${escapeHtml(attachment.file_name)}</li>`,
            )
            .join("")}</ul>`
        : "";

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(referralNumber)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; width:100%; background:#fff; }
  body { font-family:Arial,Helvetica,sans-serif; color:#111827; font-size:11.5px; line-height:1.45; }
  .document { width:100%; max-width:178mm; margin:0 auto; }
  .top { width:100%; text-align:center; border-bottom:3px solid #f97316; padding-bottom:12px; margin-bottom:16px; }
  .brand { color:#f97316; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; }
  h1 { font-size:24px; text-align:center; margin:3px 0 4px; }
  .reference { text-align:center; font-size:10.5px; color:#4b5563; }
  .grid { width:100%; display:grid; grid-template-columns:1fr 1fr; column-gap:22px; row-gap:8px; }
  .box { width:100%; border:1px solid #e5e7eb; padding:12px; border-radius:8px; margin:10px 0; }
  .label { color:#6b7280; font-size:9px; text-transform:uppercase; letter-spacing:.04em; }
  .value { font-weight:600; }
  .urgency { display:inline-block; margin-top:9px; padding:3px 9px; border:1px solid #111827; border-radius:999px; font-weight:700; }
  h2 { width:100%; font-size:11px; margin:15px 0 5px; padding-bottom:3px; color:#374151; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #e5e7eb; }
  p { width:100%; margin:5px 0; white-space:pre-wrap; overflow-wrap:break-word; }
  .footer { width:100%; margin-top:24px; padding-top:11px; border-top:1px solid #d1d5db; }
  @media print {
    .document { width:100%; max-width:none; margin:0 auto; }
    .box, .footer { break-inside:avoid; }
  }
</style>
</head>
<body>
<div class="document">
  <div class="top">
    <div class="brand">CareScriber AI</div>
    <h1>Medical Referral</h1>
    <div class="reference">
      Reference: <strong>${escapeHtml(referralNumber)}</strong>
      &nbsp; · &nbsp;
      Date: ${escapeHtml(new Date().toLocaleDateString("en-ZA"))}
    </div>
  </div>

  <div class="box">
    <div class="grid">
      <div><div class="label">Patient</div><div class="value">${escapeHtml(patientName(selectedPatient))}</div></div>
      <div><div class="label">ID / Passport</div><div class="value">${escapeHtml(patientIdentifier(selectedPatient))}</div></div>
      <div><div class="label">Date of birth</div><div class="value">${escapeHtml(formatDateZA(dob) || "Not recorded")}${age ? ` · Age ${escapeHtml(age)}` : ""}</div></div>
      <div><div class="label">Gender</div><div class="value">${escapeHtml(clean(selectedPatient.gender) || "Not recorded")}</div></div>
    </div>
  </div>

  <div class="box">
    <div class="grid">
      <div><div class="label">Referred to</div><div class="value">${escapeHtml(recipientName.trim() || "Receiving clinician")}</div></div>
      <div><div class="label">Speciality / Facility</div><div class="value">${escapeHtml([recipientSpeciality.trim(), recipientFacility.trim()].filter(Boolean).join(" · ") || "Not specified")}</div></div>
    </div>
    <span class="urgency">${escapeHtml(urgency)}</span>
  </div>

  <p>Dear Colleague,</p>
  <p>Thank you for assessing the above-mentioned patient.</p>

  <h2>Reason for Referral</h2>
  <p>${escapeHtml(reason || "Not recorded")}</p>

  <h2>Clinical Summary / History</h2>
  <p>${escapeHtml(clinicalSummary || "Not recorded")}</p>

  <h2>Relevant Examination / Clinical Findings</h2>
  <p>${escapeHtml(examinationFindings || "Not recorded")}</p>

  <h2>Relevant Medical History</h2>
  <p>${escapeHtml(medicalHistory || "Not recorded")}</p>

  <h2>Current Medication</h2>
  <p>${escapeHtml(currentMedication || "Not recorded")}</p>

  <h2>Allergies</h2>
  <p>${escapeHtml(allergyText || "Not recorded")}</p>

  <h2>Investigations / Results</h2>
  <p>${escapeHtml(investigations || "Not recorded")}</p>

  <h2>Working Diagnosis / ICD-10</h2>
  <p>${icdText}</p>

  <h2>Treatment / Management to Date</h2>
  <p>${escapeHtml(managementToDate || "Not recorded")}</p>

  <h2>Specific Referral Request</h2>
  <p>${escapeHtml(referralRequest || "Please assess and advise regarding further management.")}</p>

  ${
    additionalNotes
      ? `<h2>Additional Notes</h2><p>${escapeHtml(additionalNotes)}</p>`
      : ""
  }

  ${attachmentList}

  <p>Please assess and manage as clinically appropriate. Kindly communicate significant findings and the ongoing management plan where appropriate.</p>

  <div class="footer">
    <div>Kind regards,</div>
    <div><strong>${escapeHtml(doctorName || "Referring clinician")}</strong></div>
    ${doctor?.qualifications ? `<div>${escapeHtml(doctor.qualifications)}</div>` : ""}
    <div>HPCSA / Registration: ${escapeHtml(doctorRegistration || "Not recorded")}</div>
    <div>Practice No: ${escapeHtml(clean(doctor?.practice_number) || "Not recorded")}</div>
    ${doctorContact ? `<div>${escapeHtml(doctorContact)}</div>` : ""}
    ${doctor?.practice_address ? `<div>${escapeHtml(doctor.practice_address)}</div>` : ""}
    <div style="margin-top:8px;color:#6b7280;font-size:9.5px">Generated securely by CareScriber.</div>
  </div>
</div>
</body>
</html>`;
  }


  function buildReferralPdf() {
    if (!selectedPatient) {
      throw new Error("Please select a patient before creating the PDF.");
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    const addText = (
      text: string,
      options?: { bold?: boolean; size?: number; heading?: boolean; gap?: number },
    ) => {
      const size = options?.size ?? 10;
      doc.setFont("helvetica", options?.bold ? "bold" : "normal");
      doc.setFontSize(size);

      if (options?.heading) {
        if (y > 270) {
          doc.addPage();
          y = 18;
        }
        doc.setDrawColor(220);
        doc.line(margin, y + 1, pageWidth - margin, y + 1);
        y += 5;
      }

      const lines = doc.splitTextToSize(text || "Not recorded", contentWidth);

      if (y + lines.length * 5 > 280) {
        doc.addPage();
        y = 18;
      }

      doc.text(lines, margin, y);
      y += lines.length * 5 + (options?.gap ?? 3);
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(249, 115, 22);
    doc.text("CareScriber AI", pageWidth / 2, y, { align: "center" });

    y += 8;
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(20);
    doc.text("Medical Referral", pageWidth / 2, y, { align: "center" });

    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Reference: ${referralNumber} | Date: ${new Date().toLocaleDateString("en-ZA")}`,
      pageWidth / 2,
      y,
      { align: "center" },
    );

    y += 8;
    doc.setDrawColor(249, 115, 22);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    addText(`Patient: ${patientName(selectedPatient)}`, { bold: true });
    addText(`ID / Passport: ${patientIdentifier(selectedPatient) || "Not recorded"}`);
    addText(
      `DOB: ${formatDateZA(patientDob(selectedPatient)) || "Not recorded"}${
        calculateAge(patientDob(selectedPatient))
          ? ` | Age: ${calculateAge(patientDob(selectedPatient))}`
          : ""
      }`,
    );
    addText(`Gender: ${selectedPatient.gender || "Not recorded"}`);
    addText(`Referred to: ${recipientName || "Receiving clinician"}`);
    addText(
      `Speciality / Facility: ${
        [recipientSpeciality, recipientFacility].filter(Boolean).join(" / ") ||
        "Not specified"
      }`,
    );
    addText(`Urgency: ${urgency}`, { bold: true, gap: 5 });

    const section = (heading: string, value: string) => {
      addText(heading, { bold: true, heading: true });
      addText(value || "Not recorded");
    };

    section("Reason for Referral", reason);
    section("Clinical Summary / History", clinicalSummary);
    section("Relevant Examination / Clinical Findings", examinationFindings);
    section("Relevant Medical History", medicalHistory);
    section("Current Medication", currentMedication);
    section("Allergies", allergyText || "Not recorded");
    section("Investigations / Results", investigations);
    section(
      "Working Diagnosis / ICD-10",
      selectedIcd ? `${selectedIcd.code} - ${selectedIcd.description}` : "Not recorded",
    );
    section("Treatment / Management to Date", managementToDate);
    section("Specific Referral Request", referralRequest);

    if (additionalNotes.trim()) {
      section("Additional Notes", additionalNotes);
    }

    const attachmentNames = [
      ...uploadedAttachments.map((file) => file.file_name),
      ...pendingFiles.map((file) => file.name),
    ];

    if (attachmentNames.length > 0) {
      section("Attachments", attachmentNames.map((name) => `• ${name}`).join("\n"));
    }

    addText("Referring Clinician", { bold: true, heading: true });
    addText(doctorName || "Referring clinician", { bold: true });
    if (doctor?.qualifications) addText(doctor.qualifications);
    addText(`HPCSA / Registration: ${doctorRegistration || "Not recorded"}`);
    addText(`Practice No: ${doctor?.practice_number || "Not recorded"}`);
    if (doctor?.email) addText(`Email: ${doctor.email}`);
    if (doctor?.mobile || doctor?.phone) {
      addText(`Mobile: ${doctor?.mobile || doctor?.phone}`);
    }

    return doc;
  }

  function pdfToBase64(doc: jsPDF) {
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async function downloadReferralPdf() {
    const validationError = validateReferral();

    if (validationError) {
      setOperationMessage(validationError);
      return;
    }

    setOperationMessage("Saving referral and preparing PDF...");

    const saved = await saveReferral("issued");

    if (!saved) {
      setOperationMessage(
        "The referral could not be saved, so the PDF was not created. Check the database error above.",
      );
      return;
    }

    try {
      const doc = buildReferralPdf();
      const fileName = `CareScriber-Referral-${referralNumber}.pdf`;
      doc.save(fileName);
      setOperationMessage(`PDF downloaded successfully: ${fileName}`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      setOperationMessage(
        error instanceof Error ? `PDF generation failed: ${error.message}` : "PDF generation failed.",
      );
    }
  }

  async function issueAndPrint() {
    const validationError = validateReferral();

    if (validationError) {
      setOperationMessage(validationError);
      return;
    }

    const saved = await saveReferral("issued");

    if (!saved) {
      setOperationMessage("Referral could not be saved. Print was cancelled.");
      return;
    }

    const popup = window.open("", "_blank");

    if (!popup) {
      setOperationMessage(
        "Referral saved, but the print window was blocked. Use Download PDF instead.",
      );
      return;
    }

    popup.document.open();
    popup.document.write(buildLetterHtml());
    popup.document.close();
    popup.focus();

    setTimeout(() => popup.print(), 350);
    setOperationMessage("Referral saved. Browser print window opened.");
  }

  async function sendReferral() {
    const validationError = validateReferral(true);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSending(true);
    setMessage("");
    setOperationMessage("Saving referral and preparing email...");

    try {
      const saved = await saveReferral("emailed");
      if (!saved) return;

      const attachmentsForEmail = saved.attachments || uploadedAttachments;

      const pdf = buildReferralPdf();
      const pdfBase64 = pdfToBase64(pdf);
      const pdfFileName = `CareScriber-Referral-${referralNumber}.pdf`;

      setOperationMessage("Referral saved. Sending email...");

      const sendReferralUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/api/referral-email`
          : "/api/referral-email";

      const requestBody = {
        to: recipientEmail.trim(),
        recipientName: recipientName.trim(),
        patientName: patientName(selectedPatient),
        referralNumber,
        subject: `Medical Referral - ${patientName(selectedPatient)} - ${referralNumber}`,
        html: buildLetterHtml(true),
        pdfBase64,
        pdfFileName,
        attachments: attachmentsForEmail.map((attachment) => ({
          fileName: attachment.file_name,
          signedUrl: attachment.signed_url,
        })),
      };

      console.log("CareScriber referral-email request:", {
        url: sendReferralUrl,
        recipient: requestBody.to,
        referralNumber: requestBody.referralNumber,
        attachmentCount: requestBody.attachments.length,
      });

      const response = await fetch(sendReferralUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(requestBody),
      });

      const rawResponse = await response.text();

      let result: Record<string, any> = {};

      try {
        result = rawResponse ? JSON.parse(rawResponse) : {};
      } catch {
        result = {
          error:
            rawResponse ||
            `CareScriber referral-email returned HTTP ${response.status}.`,
        };
      }

      console.log("CareScriber referral-email response:", {
        url: response.url,
        status: response.status,
        ok: response.ok,
        result,
      });

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.message ||
            `Could not send referral email. HTTP ${response.status}.`,
        );
      }

      setMessage(
        `Referral ${referralNumber} sent successfully to ${recipientEmail.trim()}.`,
      );
      setOperationMessage(
        `Referral sent successfully to ${recipientEmail.trim()}. The PDF was attached to the email.`,
      );
    } catch (error) {
      console.error("Referral email failed:", error);
      const errorMessage =
        error instanceof Error
          ? `Referral email failed: ${error.message}`
          : "Referral email failed.";

      setMessage(errorMessage);
      setOperationMessage(errorMessage);
    } finally {
      setSending(false);
    }
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
          Create, attach supporting clinical files, print or securely email a medical referral.
        </p>

        <div style={styles.info}>
          Referral No: {referralNumber || "Generating..."}
        </div>

        {message && <div style={styles.message}>{message}</div>}

        <h2 style={styles.heading}>Patient</h2>

        {patientLoading && (
          <div style={styles.info}>Loading patient records...</div>
        )}

        <div style={styles.searchRow}>
          <input
            style={styles.input}
            value={patientSearch}
            placeholder="Search patient by name, ID / passport or mobile"
            onChange={(event) => {
              setPatientSearch(event.target.value);
              setSelectedPatient(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchPatients();
              }
            }}
          />

          <button
            type="button"
            style={styles.smallDarkButton}
            disabled={patientSearching}
            onClick={() => void searchPatients()}
          >
            {patientSearching ? "Searching..." : "Search"}
          </button>
        </div>

        {filteredPatients.map((patient) => (
          <button
            type="button"
            key={patient.id}
            style={styles.patientCard}
            onClick={() => selectPatient(patient)}
          >
            <strong>{patientName(patient)}</strong>
            <span>
              ID: {patientIdentifier(patient) || "Not captured"} · DOB:{" "}
              {formatDateZA(patientDob(patient)) || "Not captured"} ·{" "}
              {patientMobile(patient) || "No mobile"}
            </span>
          </button>
        ))}

        {selectedPatient && (
          <div style={styles.selected}>
            <div>
              <strong>{patientName(selectedPatient)}</strong>
              <div>
                ID / Passport:{" "}
                <b>{patientIdentifier(selectedPatient) || "Not captured"}</b>
              </div>
              <div>
                DOB: {formatDateZA(patientDob(selectedPatient)) || "Not captured"}
                {calculateAge(patientDob(selectedPatient))
                  ? ` · Age ${calculateAge(patientDob(selectedPatient))}`
                  : ""}
              </div>
              <div>
                {selectedPatient.gender || "Gender not captured"} ·{" "}
                {patientMobile(selectedPatient) || "No mobile"} ·{" "}
                {selectedPatient.email || "No email"}
              </div>
            </div>

            <button
              type="button"
              style={styles.smallButton}
              onClick={clearPatient}
            >
              Change
            </button>
          </div>
        )}

        <h2 style={styles.heading}>Referring Clinician</h2>

        {doctorLoading ? (
          <div style={styles.info}>Loading clinician profile...</div>
        ) : (
          <div style={styles.summaryBox}>
            <strong>{doctorName || "Clinician name missing"}</strong>
            <span>{doctor?.qualifications || "Qualifications not captured"}</span>
            <span>
              HPCSA / Registration: {doctorRegistration || "Not captured"} ·
              Practice: {doctor?.practice_number || "Not captured"}
            </span>
            <span>
              {doctor?.email || "No email"} ·{" "}
              {doctor?.mobile || doctor?.phone || "No mobile"}
            </span>
          </div>
        )}

        <h2 style={styles.heading}>Receiving Clinician</h2>

        <div style={styles.grid2}>
          <input
            style={styles.input}
            value={recipientName}
            onChange={(event) => setRecipientName(event.target.value)}
            placeholder="Clinician name"
          />

          <input
            style={styles.input}
            value={recipientSpeciality}
            onChange={(event) => setRecipientSpeciality(event.target.value)}
            placeholder="Speciality"
          />

          <input
            style={styles.input}
            value={recipientFacility}
            onChange={(event) => setRecipientFacility(event.target.value)}
            placeholder="Practice / facility"
          />

          <input
            type="email"
            style={styles.input}
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            placeholder="Receiving clinician email"
          />

          <input
            style={styles.input}
            value={recipientPhone}
            onChange={(event) => setRecipientPhone(event.target.value)}
            placeholder="Telephone"
          />

          <select
            style={styles.input}
            value={urgency}
            onChange={(event) => setUrgency(event.target.value)}
          >
            <option>Routine</option>
            <option>Urgent</option>
            <option>Same-day</option>
            <option>Emergency</option>
          </select>
        </div>

        <h2 style={styles.heading}>Reason for Referral *</h2>
        <textarea
          style={styles.textarea}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Primary reason for referral and relevant clinical question."
        />

        <h2 style={styles.heading}>Clinical Summary / History</h2>
        <textarea
          style={styles.textarea}
          value={clinicalSummary}
          onChange={(event) => setClinicalSummary(event.target.value)}
          placeholder="Presenting complaint, duration, progression and relevant associated symptoms."
        />

        <h2 style={styles.heading}>Relevant Examination / Clinical Findings</h2>
        <textarea
          style={styles.textarea}
          value={examinationFindings}
          onChange={(event) => setExaminationFindings(event.target.value)}
          placeholder="Vitals, examination findings and clinically relevant negatives."
        />

        <div style={styles.grid2}>
          <div>
            <h2 style={styles.heading}>Relevant Medical History</h2>
            <textarea
              style={styles.textarea}
              value={medicalHistory}
              onChange={(event) => setMedicalHistory(event.target.value)}
              placeholder="Relevant medical / surgical history."
            />
          </div>

          <div>
            <h2 style={styles.heading}>Current Medication</h2>
            <textarea
              style={styles.textarea}
              value={currentMedication}
              onChange={(event) => setCurrentMedication(event.target.value)}
              placeholder="Current medication."
            />
          </div>
        </div>

        <h2 style={styles.heading}>Allergies</h2>

        <p style={styles.help}>
          Select all that apply. Use Other for any allergy not listed.
        </p>

        <div style={styles.allergyGrid}>
          {COMMON_ALLERGIES.map((allergy) => (
            <label key={allergy} style={styles.allergyOption}>
              <input
                type="checkbox"
                checked={selectedAllergies.includes(allergy)}
                onChange={() => toggleAllergy(allergy)}
              />
              <span>{allergy}</span>
            </label>
          ))}
        </div>

        {selectedAllergies.includes("Other") && (
          <input
            style={{ ...styles.input, marginTop: 12 }}
            value={otherAllergy}
            onChange={(event) => setOtherAllergy(event.target.value)}
            placeholder="Other allergy / allergies — free text"
          />
        )}

        {allergyText && (
          <div style={styles.allergySummary}>
            Recorded allergies: <b>{allergyText}</b>
          </div>
        )}

        <h2 style={styles.heading}>Investigations / Results</h2>
        <textarea
          style={styles.textarea}
          value={investigations}
          onChange={(event) => setInvestigations(event.target.value)}
          placeholder="Relevant pathology, imaging and other results."
        />

        <h2 style={styles.heading}>Working Diagnosis / ICD-10</h2>

        <p style={styles.help}>
          Searches the full <b>icd10_codes</b> table by code or description.
        </p>

        <div style={styles.icdWrap}>
          <input
            style={styles.input}
            value={icdSearch}
            onChange={(event) => {
              setSelectedIcd(null);
              setIcdSearch(event.target.value);
            }}
            placeholder="Search ICD-10, e.g. Z71, dental pain, depression..."
            autoComplete="off"
          />

          {icdLoading && <div style={styles.help}>Searching ICD-10...</div>}

          {icdResults.length > 0 && (
            <div style={styles.icdResults}>
              {icdResults.map((item) => (
                <button
                  key={`${item.code}-${item.description}`}
                  type="button"
                  style={styles.icdItem}
                  onClick={() => selectIcd(item)}
                >
                  <strong>{item.code}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedIcd && (
          <div style={styles.selectedIcd}>
            <div>
              <b>{selectedIcd.code}</b> — {selectedIcd.description}
            </div>
            <button type="button" style={styles.smallButton} onClick={clearIcd}>
              Change
            </button>
          </div>
        )}

        <h2 style={styles.heading}>Treatment / Management to Date</h2>
        <textarea
          style={styles.textarea}
          value={managementToDate}
          onChange={(event) => setManagementToDate(event.target.value)}
          placeholder="Treatment already given, response and outstanding management."
        />

        <h2 style={styles.heading}>Specific Request to Receiving Clinician *</h2>
        <textarea
          style={styles.textarea}
          value={referralRequest}
          onChange={(event) => setReferralRequest(event.target.value)}
          placeholder="Please assess and advise regarding..."
        />

        <h2 style={styles.heading}>Supporting Information</h2>

        <div style={styles.checkGrid}>
          <label style={styles.check}>
            <input
              type="checkbox"
              checked={includeConsultationSummary}
              onChange={(event) => setIncludeConsultationSummary(event.target.checked)}
            />
            Consultation summary
          </label>

          <label style={styles.check}>
            <input
              type="checkbox"
              checked={includeLabs}
              onChange={(event) => setIncludeLabs(event.target.checked)}
            />
            Laboratory results
          </label>

          <label style={styles.check}>
            <input
              type="checkbox"
              checked={includeImaging}
              onChange={(event) => setIncludeImaging(event.target.checked)}
            />
            Imaging / report
          </label>

          <label style={styles.check}>
            <input
              type="checkbox"
              checked={includePrescription}
              onChange={(event) => setIncludePrescription(event.target.checked)}
            />
            Prescription
          </label>

          <label style={styles.check}>
            <input
              type="checkbox"
              checked={includeOther}
              onChange={(event) => setIncludeOther(event.target.checked)}
            />
            Other
          </label>
        </div>

        <h2 style={styles.heading}>Upload Attachments</h2>

        <p style={styles.help}>
          Attach clinical photos, pathology, imaging reports, prescriptions or other supporting files.
          Maximum 10 files, 10 MB each.
        </p>

        <label style={styles.uploadButton}>
          📎 Add Photo / Document
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.csv"
            onChange={handleFiles}
            style={{ display: "none" }}
          />
        </label>

        {pendingFiles.length > 0 && (
          <div style={styles.fileList}>
            {pendingFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} style={styles.fileRow}>
                <div>
                  <strong>{file.name}</strong>
                  <div style={styles.help}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>

                <button
                  type="button"
                  style={styles.removeButton}
                  onClick={() => removePendingFile(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadedAttachments.length > 0 && (
          <div style={styles.uploadedBox}>
            <strong>Attached to referral</strong>
            {uploadedAttachments.map((attachment) => (
              <div key={attachment.id || attachment.storage_path}>
                ✓ {attachment.file_name}
              </div>
            ))}
          </div>
        )}

        <h2 style={styles.heading}>Additional Notes</h2>
        <textarea
          style={styles.textareaSmall}
          value={additionalNotes}
          onChange={(event) => setAdditionalNotes(event.target.value)}
          placeholder="Optional additional information."
        />

        <div style={styles.warning}>
          The clinician remains responsible for confirming the diagnosis,
          ICD-10 code, urgency, clinical information and referral destination
          before issuing the referral.
        </div>

        {operationMessage && (
          <div style={styles.operationMessage}>
            {operationMessage}
          </div>
        )}

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={saving || sending || uploadingAttachments}
            onClick={async () => {
              const saved = await saveReferral("draft");
              setOperationMessage(
                saved
                  ? `Draft ${referralNumber} saved successfully.`
                  : "Draft could not be saved. Check the error message above.",
              );
            }}
          >
            {saving || uploadingAttachments ? "Saving..." : "Save Draft"}
          </button>

          <button
            type="button"
            style={styles.pdfButton}
            disabled={saving || sending || uploadingAttachments}
            onClick={() => void downloadReferralPdf()}
          >
            ↓ Download PDF
          </button>

          <button
            type="button"
            style={styles.printButton}
            disabled={saving || sending || uploadingAttachments}
            onClick={() => void issueAndPrint()}
          >
            Print Referral
          </button>

          <button
            type="button"
            style={styles.sendButton}
            disabled={saving || sending || uploadingAttachments}
            onClick={() => void sendReferral()}
          >
            {sending ? "Sending Referral..." : "✉ Send Referral"}
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
    padding: "20px 12px 60px",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 1050,
    margin: "0 auto",
    boxSizing: "border-box",
    background: "#ffffff",
    borderRadius: 22,
    padding: "24px clamp(16px, 4vw, 30px)",
    boxShadow: "0 12px 35px rgba(0,0,0,.08)",
  },
  back: {
    color: "#374151",
    textDecoration: "none",
    fontWeight: 700,
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    margin: "18px 0 28px",
  },
  tab: {
    textDecoration: "none",
    border: "1px solid #e5e7eb",
    color: "#374151",
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 700,
  },
  activeTab: {
    textDecoration: "none",
    background: "#f97316",
    color: "#ffffff",
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 800,
  },
  kicker: {
    color: "#f97316",
    fontWeight: 800,
    marginBottom: 4,
    fontSize: 18,
  },
  title: {
    fontSize: "clamp(36px, 7vw, 52px)",
    margin: "0 0 12px",
    color: "#111827",
  },
  subtitle: {
    color: "#6b7280",
    lineHeight: 1.6,
    fontSize: 19,
    marginTop: 0,
  },
  info: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    padding: 14,
    borderRadius: 12,
    margin: "14px 0",
    fontSize: 17,
  },
  message: {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    padding: 14,
    borderRadius: 12,
    margin: "14px 0",
    fontSize: 17,
  },
  heading: {
    fontSize: 20,
    margin: "28px 0 10px",
    color: "#111827",
  },
  input: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "14px 15px",
    fontSize: 16,
    background: "#ffffff",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    resize: "vertical",
    fontSize: 16,
    fontFamily: "inherit",
  },
  textareaSmall: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: 14,
    minHeight: 90,
    resize: "vertical",
    fontSize: 16,
    fontFamily: "inherit",
  },
  searchRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "stretch",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
    gap: 12,
  },
  patientCard: {
    display: "flex",
    width: "100%",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    padding: 14,
    marginTop: 8,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    cursor: "pointer",
    textAlign: "left",
    fontSize: 15,
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
    fontSize: 16,
  },
  help: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 0,
    lineHeight: 1.5,
  },
  allergyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 10,
  },
  allergyOption: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#ffffff",
    cursor: "pointer",
  },
  allergySummary: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  },
  icdWrap: {
    position: "relative",
  },
  icdResults: {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 330,
    overflowY: "auto",
    background: "#ffffff",
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
    background: "#ffffff",
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
  checkGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  check: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "10px 12px",
  },
  uploadButton: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "center",
    padding: "16px 18px",
    borderRadius: 12,
    background: "#ede9fe",
    color: "#5b21b6",
    border: "2px dashed #c4b5fd",
    fontWeight: 800,
    cursor: "pointer",
  },
  fileList: {
    display: "grid",
    gap: 8,
    marginTop: 12,
  },
  fileRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
  },
  uploadedBox: {
    display: "grid",
    gap: 5,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
  },
  warning: {
    marginTop: 24,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 12,
    padding: 14,
    color: "#78350f",
    fontSize: 15,
  },
  operationMessage: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    background: "#eff6ff",
    border: "1px solid #93c5fd",
    color: "#1e3a8a",
    fontWeight: 800,
    lineHeight: 1.5,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 10,
    marginTop: 24,
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "14px 16px",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  },
  pdfButton: {
    border: 0,
    borderRadius: 12,
    padding: "14px 16px",
    background: "#7c3aed",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  },
  printButton: {
    border: 0,
    borderRadius: 12,
    padding: "14px 16px",
    background: "#f97316",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  },
  sendButton: {
    border: 0,
    borderRadius: 12,
    padding: "14px 16px",
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  },
  smallButton: {
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "8px 10px",
    background: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  smallDarkButton: {
    border: 0,
    borderRadius: 12,
    padding: "0 18px",
    minHeight: 48,
    background: "#111827",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  removeButton: {
    border: 0,
    borderRadius: 8,
    padding: "8px 10px",
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 700,
    cursor: "pointer",
  },
}
