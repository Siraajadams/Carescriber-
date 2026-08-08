"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import { supabase } from "../../lib/supabase";

type Patient = {
  id: string;
  first_name?: string;
  surname?: string;
  last_name?: string;
  id_number?: string;
  patient_id?: string;
  age?: number | null;
  gender?: string | null;
  mobile?: string | null;
  email?: string | null;
  dob?: string | null;
  date_of_birth?: string | null;
};

type LinkedReferral = {
  id: string;
  patient_id?: string | null;
  referral_code: string;
  status?: string | null;
  expires_at?: string | null;
};

type DoctorProfile = {
  id?: string;
  first_name?: string;
  surname?: string;
  last_name?: string;
  email?: string;
  mobile?: string;
  hpcsa?: string;
  registration_number?: string;
  practice_number?: string;
  practice_address?: string;
  qualifications?: string;
  qualification?: string;
  phone?: string;
  address?: string;
  user_id?: string;
};

type ICD10Code = {
  id: number;
  code: string;
  description: string;
  category: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addOneDay(date: string) {
  if (!date) return "";
  return new Date(new Date(date).getTime() + 86400000).toISOString().slice(0, 10);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function downloadHtmlFile(filename: string, html: string) {
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const safeName = filename.endsWith(".html") ? filename : `${filename}.html`;

    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

export default function SickNotePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [linkedReferral, setLinkedReferral] = useState<LinkedReferral | null>(null);

  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [employerEmail, setEmployerEmail] = useState("");

  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [doctorName, setDoctorName] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorMobile, setDoctorMobile] = useState("");
  const [hpcsa, setHpcsa] = useState("");
  const [practiceNumber, setPracticeNumber] = useState("");
  const [practiceAddress, setPracticeAddress] = useState("");
  const [doctorQualifications, setDoctorQualifications] = useState("");

  const [dateSeen, setDateSeen] = useState(today());
  const [unfitFrom, setUnfitFrom] = useState(today());
  const [unfitUntil, setUnfitUntil] = useState(today());

  const icdSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [diagnosisSearch, setDiagnosisSearch] = useState("");
  const [selectedDiagnosis, setSelectedDiagnosis] = useState("");
  const [icdSearchResults, setIcdSearchResults] = useState<ICD10Code[]>([]);
  const [icdSearchLoading, setIcdSearchLoading] = useState(false);
  const [comments, setComments] = useState("");
  const [message, setMessage] = useState("");
  const [certificateNumber, setCertificateNumber] = useState(`CS-${Date.now()}`);
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    void loadPatients();
    void loadDoctor();
    restoreLinkedContext();
    void restorePatientFromUrl();
  }, []);

  async function restorePatientFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const patientIdParam = (params.get("patientId") || "").trim();

      if (!patientIdParam) return;

      /*
       * The Consultation page opens Sick Note using:
       * /sick-note?patientId=<patients.id>
       *
       * The old Sick Note page ignored this URL parameter, which is why
       * the clinician had to search for the patient and re-enter the ID.
       */
      const looksLikeUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          patientIdParam
        );

      let query = supabase.from("patients").select("*");

      if (looksLikeUuid) {
        query = query.eq("id", patientIdParam);
      } else {
        query = query.or(
          `patient_id.eq.${patientIdParam},id_number.eq.${patientIdParam}`
        );
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error("Could not load patient from Sick Note URL:", error);
        setMessage(
          "The selected patient could not be loaded automatically: " +
            error.message
        );
        return;
      }

      if (!data) {
        setMessage(
          "The selected patient was not found. Please return to Consultation and select the patient again."
        );
        return;
      }

      const patient = data as Patient;
      const name = `${patient.first_name || ""} ${
        patient.surname || patient.last_name || ""
      }`.trim();

      setSelectedPatient(patient);
      setPatientSearch(name);
      setPatientName(name);
      setPatientId(patient.id_number || patient.patient_id || "");
      setPatientEmail(patient.email || "");

      /*
       * Keep the same patient available when moving between
       * Consultation, Sick Note and eScript.
       */
      localStorage.setItem(
        "carescriber_selected_patient",
        JSON.stringify(patient)
      );
      localStorage.setItem(
        "carescriber_selected_patient_id",
        patient.id
      );

      setMessage("");
    } catch (error) {
      console.error("Could not restore patient from URL:", error);
      setMessage(
        "The selected patient could not be restored automatically."
      );
    }
  }

  function restoreLinkedContext() {
    try {
      const savedPatientJson = localStorage.getItem("carescriber_selected_patient");
      const savedPatientId = localStorage.getItem("carescriber_selected_patient_id");
      const savedReferralJson = localStorage.getItem("carescriber_referral");
      const savedReferralId = localStorage.getItem("carescriber_referral_id");
      const savedReferralCode = localStorage.getItem("carescriber_referral_code");

      let restoredPatient: Patient | null = null;

      if (savedPatientJson) {
        const parsed = JSON.parse(savedPatientJson) as Partial<Patient>;
        const resolvedId = String(parsed.id || savedPatientId || "").trim();

        if (resolvedId) {
          restoredPatient = {
            ...parsed,
            id: resolvedId,
          } as Patient;
        }
      } else if (savedPatientId) {
        restoredPatient = {
          id: savedPatientId,
        };
      }

      if (restoredPatient) {
        const restoredName = `${restoredPatient.first_name || ""} ${
          restoredPatient.surname || restoredPatient.last_name || ""
        }`.trim();

        setSelectedPatient(restoredPatient);
        setPatientSearch(restoredName);
        setPatientName(restoredName);
        setPatientId(
          restoredPatient.id_number ||
            restoredPatient.patient_id ||
            "",
        );
        setPatientEmail(restoredPatient.email || "");
      }

      if (savedReferralJson) {
        const parsed = JSON.parse(savedReferralJson) as Partial<LinkedReferral>;
        const resolvedReferralId = String(
          parsed.id || savedReferralId || "",
        ).trim();
        const resolvedReferralCode = String(
          parsed.referral_code || savedReferralCode || "",
        )
          .trim()
          .replace(/\s+/g, "")
          .toUpperCase();

        if (resolvedReferralId || resolvedReferralCode) {
          setLinkedReferral({
            ...parsed,
            id: resolvedReferralId,
            referral_code: resolvedReferralCode,
          } as LinkedReferral);
        }
      } else if (savedReferralId || savedReferralCode) {
        setLinkedReferral({
          id: savedReferralId || "",
          referral_code: (savedReferralCode || "")
            .trim()
            .replace(/\s+/g, "")
            .toUpperCase(),
        });
      }
    } catch (error) {
      console.error("Could not restore linked patient/referral:", error);
      setMessage(
        "The linked referral could not be restored. Please unlock the SymptomAI referral again.",
      );
    }
  }

  async function loadPatients() {
    const { data, error } = await supabase.from("patients").select("*");
    if (error) {
      setMessage("Could not load patients: " + error.message);
      return;
    }
    setPatients((data || []) as Patient[]);
  }

  async function loadDoctor() {
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Could not load the logged-in doctor.");
      return;
    }

    /*
      Some CareScriber projects link profiles to auth.users using `id`,
      while others use `user_id`. Try both without breaking either setup.
    */
    let profile: DoctorProfile | null = null;

    const byId = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!byId.error && byId.data) {
      profile = byId.data as DoctorProfile;
    }

    if (!profile) {
      const byUserId = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!byUserId.error && byUserId.data) {
        profile = byUserId.data as DoctorProfile;
      }
    }

    if (!profile) {
      setDoctorProfile({ id: user.id, email: user.email || "" });
      setDoctorEmail(user.email || "");
      setMessage(
        "Your doctor profile could not be found. Please update the profiles table with your doctor details.",
      );
      return;
    }

    const firstName = profile.first_name?.trim() || "";
    const surname = (profile.last_name || profile.surname || "").trim();
    const rawName = `${firstName} ${surname}`.trim();
    const formattedName = rawName
      ? /^dr\.?\s/i.test(rawName)
        ? rawName
        : `Dr ${rawName}`
      : "";

    setDoctorProfile({
      ...profile,
      id: profile.id || user.id,
    });
    setDoctorName(formattedName);
    setDoctorEmail(profile.email || user.email || "");
    setDoctorMobile(profile.mobile || profile.phone || "");
    setHpcsa(profile.registration_number || profile.hpcsa || "");
    setPracticeNumber(profile.practice_number || "");
    setPracticeAddress(profile.practice_address || profile.address || "");
    setDoctorQualifications(profile.qualifications || profile.qualification || "");
  }

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q || selectedPatient) return [];
    return patients.filter((p) =>
      [p.first_name, p.surname, p.last_name, p.id_number, p.patient_id, p.mobile, p.email]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [patients, patientSearch, selectedPatient]);

  async function searchIcd10(query: string) {
    const cleanQuery = query
      .trim()
      .replace(/[%_,()]/g, " ")
      .replace(/\s+/g, " ");

    if (cleanQuery.length < 2) {
      setIcdSearchResults([]);
      setIcdSearchLoading(false);
      return;
    }

    setIcdSearchLoading(true);

    const { data, error } = await supabase
      .from("icd10_codes")
      .select("id, code, description, category")
      .eq("active", true)
      .or(`code.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%`)
      .order("code")
      .limit(20);

    if (error) {
      console.error("ICD-10 search error:", error);
      setIcdSearchResults([]);
      setMessage(
        "ICD-10 search failed. Confirm the icd10_codes table and read policy are configured: " +
          error.message
      );
    } else {
      setIcdSearchResults((data || []) as ICD10Code[]);
    }

    setIcdSearchLoading(false);
  }

  function handleDiagnosisSearchChange(value: string) {
    setDiagnosisSearch(value);
    setSelectedDiagnosis("");

    if (icdSearchTimerRef.current) {
      clearTimeout(icdSearchTimerRef.current);
    }

    if (value.trim().length < 2) {
      setIcdSearchResults([]);
      setIcdSearchLoading(false);
      return;
    }

    icdSearchTimerRef.current = setTimeout(() => {
      void searchIcd10(value);
    }, 300);
  }

  function selectDiagnosis(icd: ICD10Code) {
    const value = `${icd.code} | ${icd.description}`;
    setSelectedDiagnosis(value);
    setDiagnosisSearch(value);
    setIcdSearchResults([]);
    setMessage("");
  }

  const returnDate = addOneDay(unfitUntil);

  function selectPatient(patient: Patient) {
    const name = `${patient.first_name || ""} ${
      patient.surname || patient.last_name || ""
    }`.trim();

    setSelectedPatient(patient);
    setPatientSearch(name);
    setPatientName(name);
    setPatientId(patient.id_number || patient.patient_id || "");
    setPatientEmail(patient.email || "");

    localStorage.setItem(
      "carescriber_selected_patient",
      JSON.stringify(patient),
    );
    localStorage.setItem(
      "carescriber_selected_patient_id",
      patient.id,
    );

    // A manually selected patient must not inherit another patient's referral.
    setLinkedReferral(null);
    localStorage.removeItem("carescriber_referral");
    localStorage.removeItem("carescriber_referral_id");
    localStorage.removeItem("carescriber_referral_code");

    setMessage("");
  }

  function clearPatient() {
    setSelectedPatient(null);
    setLinkedReferral(null);
    setPatientSearch("");
    setPatientName("");
    setPatientId("");
    setPatientEmail("");

    localStorage.removeItem("carescriber_selected_patient");
    localStorage.removeItem("carescriber_selected_patient_id");
    localStorage.removeItem("carescriber_referral");
    localStorage.removeItem("carescriber_referral_id");
    localStorage.removeItem("carescriber_referral_code");
  }

  function getCanvasPoint(e: any) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e: any) {
    e.preventDefault();
    setDrawing(true);
    const point = getCanvasPoint(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!point || !ctx) return;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function draw(e: any) {
    if (!drawing) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!point || !ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasSignature(true);
  }

  function stopDraw() {
    setDrawing(false);
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.beginPath();
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function signatureDataUrl() {
    return hasSignature ? canvasRef.current?.toDataURL("image/png") || "" : "";
  }

  function diagnosisParts() {
    const value = (selectedDiagnosis || diagnosisSearch).trim();
    if (!value.includes("|")) return { code: "", description: value };
    const [code, ...description] = value.split("|");
    return { code: code.trim(), description: description.join("|").trim() };
  }

  function validateCertificate(requireEmployer = false) {
    const missing: string[] = [];
    if (!patientName.trim()) missing.push("Patient full name");
    if (!patientId.trim()) missing.push("Patient ID / passport number");
    if (!diagnosisParts().description) missing.push("Diagnosis / ICD-10");
    if (!doctorProfile?.id) missing.push("Logged-in doctor profile");
    if (!doctorName.trim()) missing.push("Doctor name");
    if (!doctorEmail.trim()) missing.push("Doctor email");
    if (!hpcsa.trim()) missing.push("HPCSA registration number");
    if (!practiceNumber.trim()) missing.push("Practice number");
    if (!practiceAddress.trim()) missing.push("Practice address");
    if (!hasSignature) missing.push("Doctor signature");
    if (requireEmployer && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employerEmail.trim())) {
      missing.push("Valid employer email");
    }
    if (patientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail.trim())) {
      missing.push("Valid patient email, or leave it blank");
    }
    if (unfitUntil < unfitFrom) missing.push("Valid medical-leave date range");
    return missing;
  }

  function showMissing(missing: string[]) {
    setMessage(`Please complete the following:\n• ${missing.join("\n• ")}`);
  }

  function buildPdf() {
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    const signature = signatureDataUrl();
    const diagnosis = diagnosisParts();

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 34, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("CareScriber Medical Certificate", margin, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Certificate No: ${certificateNumber}`, margin, 25);
    doc.text(
      `Issued: ${new Date().toLocaleString("en-ZA")}`,
      pageWidth - margin,
      25,
      { align: "right" },
    );

    // Certificate text
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    let y = 46;

    const paragraphs = [
      `This is to certify that ${patientName} (ID / Passport: ${patientId}) was examined by me on ${dateSeen}.`,
      `In my clinical opinion, the patient is unfit for work or school from ${unfitFrom} up to and including ${unfitUntil}.`,
      `The patient may return to work or school on ${returnDate}, subject to clinical recovery.`,
    ];

    for (const paragraph of paragraphs) {
      const lines = doc.splitTextToSize(paragraph, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 6 + 5;
    }

    // Clinical information box.
    // Draw the white/light fill and border separately to avoid Android PDF
    // viewers rendering an "FD" rounded rectangle as a solid black block.
    const clinicalDiagnosis = `Diagnosis / ICD-10: ${
      diagnosis.code ? `${diagnosis.code} — ` : ""
    }${diagnosis.description}`;

    const diagnosisLines = doc.splitTextToSize(
      clinicalDiagnosis,
      contentWidth - 10,
    );
    const commentLines = doc.splitTextToSize(
      `Comments: ${comments || "None"}`,
      contentWidth - 10,
    );
    const clinicalHeight = Math.max(
      35,
      17 + diagnosisLines.length * 5 + commentLines.length * 5 + 8,
    );

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, clinicalHeight, 3, 3, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, contentWidth, clinicalHeight, 3, 3, "S");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("CLINICAL INFORMATION", margin + 5, y + 8);

    doc.setFont("helvetica", "normal");
    doc.text(diagnosisLines, margin + 5, y + 16);
    doc.text(
      commentLines,
      margin + 5,
      y + 16 + diagnosisLines.length * 5 + 5,
    );

    y += clinicalHeight + 9;

    // Medical practitioner box
    const doctorRows = [
      `Doctor: ${doctorName}`,
      doctorQualifications
        ? `Qualifications: ${doctorQualifications}`
        : "",
      `HPCSA / Registration: ${hpcsa}`,
      `Practice number: ${practiceNumber}`,
      doctorMobile ? `Mobile: ${doctorMobile}` : "",
      `Email: ${doctorEmail}`,
      `Practice address: ${practiceAddress}`,
    ].filter(Boolean);

    const doctorLineGroups = doctorRows.map((row) =>
      doc.splitTextToSize(row, contentWidth - 10),
    );
    const doctorTextHeight =
      doctorLineGroups.reduce((total, lines) => total + lines.length * 5, 0) +
      16;
    const doctorBoxHeight = Math.max(48, doctorTextHeight + 4);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, y, contentWidth, doctorBoxHeight, 3, 3, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, contentWidth, doctorBoxHeight, 3, 3, "S");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("MEDICAL PRACTITIONER", margin + 5, y + 8);

    doc.setFont("helvetica", "normal");
    let doctorY = y + 16;

    for (const lines of doctorLineGroups) {
      doc.text(lines, margin + 5, doctorY);
      doctorY += lines.length * 5;
    }

    y += doctorBoxHeight + 8;

    // Signature
    if (signature) {
      const availableSignatureSpace = pageHeight - y - 30;
      const signatureHeight = Math.min(20, Math.max(14, availableSignatureSpace));

      doc.addImage(signature, "PNG", margin, y, 55, signatureHeight);
      doc.setDrawColor(100, 116, 139);
      doc.line(margin, y + signatureHeight + 2, margin + 62, y + signatureHeight + 2);

      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("Doctor signature", margin, y + signatureHeight + 7);
    }

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      doc.splitTextToSize(
        "Generated electronically through CareScriber. Clinical information is confidential and must be handled securely.",
        contentWidth,
      ),
      margin,
      pageHeight - 12,
    );

    doc.text("1 / 1", pageWidth - margin, pageHeight - 8, {
      align: "right",
    });

    const dataUri = doc.output("datauristring");

    return {
      doc,
      base64: dataUri.substring(dataUri.indexOf(",") + 1),
      filename: `${certificateNumber.replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      )}.pdf`,
    };
  }

  async function saveCertificate(options?: { emailed?: boolean; resendId?: string | null }) {
    const missing = validateCertificate(false);
    if (missing.length) {
      showMissing(missing);
      return null;
    }
    if (!doctorProfile?.id) return null;

    const diagnosis = diagnosisParts();
    const payload = {
      certificate_number: certificateNumber,
      doctor_id: doctorProfile.id,
      patient_id: selectedPatient?.id || null,
      referral_id: linkedReferral?.id || null,
      referral_code: linkedReferral?.referral_code || null,
      patient_name: patientName.trim(),
      patient_id_number: patientId.trim(),
      employer_email: employerEmail.trim() || null,
      patient_email: patientEmail.trim() || null,
      diagnosis_code: diagnosis.code || null,
      diagnosis_description: diagnosis.description,
      date_seen: dateSeen,
      unfit_from: unfitFrom,
      unfit_until: unfitUntil,
      return_to_work: returnDate,
      comments: comments.trim() || null,
      doctor_name: doctorName.trim(),
      doctor_qualifications: doctorQualifications.trim() || null,
      doctor_email: doctorEmail.trim(),
      doctor_mobile: doctorMobile.trim() || null,
      doctor_hpcsa: hpcsa.trim(),
      doctor_practice_number: practiceNumber.trim(),
      doctor_practice_address: practiceAddress.trim(),
      doctor_signature: signatureDataUrl(),
      pdf_generated: true,
      emailed_to_employer: Boolean(options?.emailed),
      emailed_at: options?.emailed ? new Date().toISOString() : null,
      resend_email_id: options?.resendId || null,
      status: options?.emailed ? "emailed" : "saved",
    };

    const { data, error } = await supabase
      .from("medical_certificates")
      .upsert(payload, { onConflict: "certificate_number" })
      .select("id, certificate_number")
      .single();

    if (error) {
      setMessage(`Save failed: ${error.message}`);
      return null;
    }
    return data;
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const saved = await saveCertificate();
      if (saved) setMessage(`Sick note ${certificateNumber} saved successfully.`);
    } finally {
      setSaving(false);
    }
  }

  function printPdf() {
    const missing = validateCertificate(false);
    if (missing.length) return showMissing(missing);
    const pdf = buildPdf();
    pdf.doc.save(pdf.filename);
    setMessage("Medical certificate PDF downloaded successfully.");
  }

  async function emailPdf() {
    setEmailing(true);
    setMessage("");
    try {
      const missing = validateCertificate(true);
      if (missing.length) return showMissing(missing);

      if (!selectedPatient?.id) {
        setMessage(
          "No CareScriber patient UUID is linked. Select a patient or unlock the SymptomAI referral again.",
        );
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessage("Your session has expired. Please sign in again.");
        return;
      }

      const pdf = buildPdf();
      const response = await fetch("/api/sick-note/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: employerEmail.trim(),
          cc: patientEmail.trim() || undefined,

          patientId: selectedPatient?.id || null,
          referralId: linkedReferral?.id || null,
          referralCode: linkedReferral?.referral_code || null,

          patientName: patientName.trim(),
          patientFirstName: selectedPatient?.first_name || "",
          patientSurname:
            selectedPatient?.surname ||
            selectedPatient?.last_name ||
            "",
          patientIdentifier:
            selectedPatient?.id_number ||
            selectedPatient?.patient_id ||
            patientId.trim(),
          patientDateOfBirth:
            selectedPatient?.date_of_birth ||
            selectedPatient?.dob ||
            "",
          patientMobile: selectedPatient?.mobile || "",
          patientEmail:
            selectedPatient?.email ||
            patientEmail.trim() ||
            "",

          certificateNumber,

          doctorId: doctorProfile?.id || null,
          doctorName: doctorName.trim(),
          doctorRegistrationNumber: hpcsa.trim(),
          practiceName: "CareScriber",
          practiceAddress: practiceAddress.trim(),

          dateSeen,
          unfitFrom,
          unfitUntil,
          returnDate,

          diagnosis: diagnosisParts().description,
          clinicalNotes: comments.trim(),

          filename: pdf.filename,
          pdfBase64: pdf.base64,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(`Email failed: ${result.error || "Unknown error"}`);
        return;
      }

      const saved = await saveCertificate({
        emailed: true,
        resendId: result.emailId || result.id || null,
      });
      if (saved) setMessage(`Sick note emailed successfully to ${employerEmail}.`);
    } catch (error) {
      setMessage(`Email failed: ${error instanceof Error ? error.message : "Unexpected error"}`);
    } finally {
      setEmailing(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/dashboard" style={styles.back}>← Back to Dashboard</Link>

        <div style={styles.tabRow}>
          <Link href="/dashboard" style={styles.tab}>Dashboard</Link>
          <Link href="/patients" style={styles.tab}>Patients</Link>
          <Link href="/consultation" style={styles.tab}>Consultation</Link>
          <Link href="/sick-note" style={styles.activeTab}>Sick Note</Link>
        </div>

        <p style={styles.kicker}>CareScriber AI</p>
        <h1 style={styles.title}>Medical Certificate</h1>
        <p style={styles.subtitle}>Generate a sick note with ICD-10 diagnosis, digital signature, PDF export and email to employer with patient copied.</p>

        <div style={styles.info}>Certificate Number: {certificateNumber}</div>

        {linkedReferral?.referral_code && (
          <div style={styles.referralInfo}>
            Linked SymptomAI Referral: {linkedReferral.referral_code}
          </div>
        )}

        <h2 style={styles.heading}>Find Patient</h2>
        <input style={styles.input} placeholder="Search patient by name, surname, ID or mobile" value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }} />

        {patientSearch && !selectedPatient && filteredPatients.length === 0 && <p style={styles.muted}>No matching patient found. You can still type details manually below.</p>}

        {filteredPatients.map((p) => (
          <button key={p.id} style={styles.patientCard} onClick={() => selectPatient(p)}>
            <strong>{p.first_name} {p.surname || p.last_name}</strong>
            <span>ID: {p.id_number || p.patient_id || "N/A"} · {p.mobile || "No mobile"}</span>
          </button>
        ))}

        {selectedPatient && (
          <div style={styles.selected}>
            Selected: {patientName} · ID: {patientId || "Not captured"}
            <div style={styles.autoLinkedText}>
              Patient details loaded automatically from CareScriber.
            </div>
            <button
              type="button"
              onClick={clearPatient}
              style={styles.clearSmall}
            >
              Change Patient
            </button>
          </div>
        )}

        <h2 style={styles.heading}>Patient Details</h2>
        <input style={styles.input} placeholder="Patient full name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
        <input
          style={{
            ...styles.input,
            ...(selectedPatient ? styles.readOnlyInput : {}),
          }}
          placeholder="Patient ID / passport number"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          readOnly={Boolean(selectedPatient)}
        />
        <input style={styles.input} placeholder="Employer email" value={employerEmail} onChange={(e) => setEmployerEmail(e.target.value)} />
        <input style={styles.input} placeholder="Patient email for CC" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} />

        <h2 style={styles.heading}>Doctor Details</h2>
        <input style={styles.input} placeholder="Doctor name" value={doctorName} readOnly />
        <input style={styles.input} placeholder="Qualifications" value={doctorQualifications} readOnly />
        <input style={styles.input} placeholder="Doctor email" value={doctorEmail} readOnly />
        <input style={styles.input} placeholder="Doctor mobile" value={doctorMobile} readOnly />
        <input style={styles.input} placeholder="HPCSA / registration number" value={hpcsa} readOnly />
        <input style={styles.input} placeholder="Practice number" value={practiceNumber} readOnly />
        <textarea style={styles.textareaSmall} placeholder="Practice address" value={practiceAddress} readOnly />

        <h2 style={styles.heading}>Medical Leave</h2>
        <label style={styles.label}>Date seen</label>
        <input style={styles.input} type="date" value={dateSeen} onChange={(e) => setDateSeen(e.target.value)} />
        <label style={styles.label}>Unfit from</label>
        <input style={styles.input} type="date" value={unfitFrom} onChange={(e) => setUnfitFrom(e.target.value)} />
        <label style={styles.label}>Up to and including</label>
        <input style={styles.input} type="date" value={unfitUntil} onChange={(e) => setUnfitUntil(e.target.value)} />
        {returnDate && <div style={styles.info}>Return to work/school: {returnDate}</div>}

        <h2 style={styles.heading}>Diagnosis / ICD-10</h2>
        <input
          style={styles.input}
          placeholder="Search full ICD-10 list by code or diagnosis"
          value={diagnosisSearch}
          onChange={(e) => handleDiagnosisSearchChange(e.target.value)}
          autoComplete="off"
        />

        {icdSearchLoading && (
          <div style={styles.icdStatus}>Searching full ICD-10 list…</div>
        )}

        {!icdSearchLoading &&
          diagnosisSearch.trim().length >= 2 &&
          !selectedDiagnosis &&
          icdSearchResults.length === 0 && (
            <div style={styles.icdStatus}>
              No matching active ICD-10 codes found.
            </div>
          )}

        {icdSearchResults.length > 0 && (
          <div style={styles.icdBox}>
            {icdSearchResults.map((item) => (
              <button
                key={item.id || item.code}
                type="button"
                style={styles.icdItem}
                onClick={() => selectDiagnosis(item)}
              >
                <strong>{item.code}</strong> | {item.description}
                {item.category ? (
                  <span style={styles.icdCategory}> · {item.category}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {selectedDiagnosis && (
          <div style={styles.selectedDiagnosis}>
            Selected ICD-10: {selectedDiagnosis}
          </div>
        )}

        <textarea
          style={styles.textarea}
          placeholder="Additional comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />

        <h2 style={styles.heading}>Doctor Digital Signature</h2>
        <canvas ref={canvasRef} width={700} height={240} style={styles.canvas} onMouseDown={startDraw} onMouseUp={stopDraw} onMouseMove={draw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchEnd={stopDraw} onTouchMove={draw} />
        <button style={styles.lightButton} onClick={clearSignature}>Clear Signature</button>

        <div style={styles.preview}>
          <h2>Medical Certificate Preview</h2>
          <p>This is to certify that <strong>{patientName || "[Patient Name]"}</strong> was examined by me, <strong>{doctorName || "Dr"}</strong>, on <strong>{dateSeen}</strong>.</p>
          <p>The patient is unfit for work/school from <strong>{unfitFrom || "[date]"}</strong> up to and including <strong>{unfitUntil || "[date]"}</strong>.</p>
          {returnDate && <p>Return to work/school: <strong>{returnDate}</strong></p>}
          <p>Diagnosis: <strong>{selectedDiagnosis || diagnosisSearch || "[ICD-10 diagnosis]"}</strong></p>
          <p>Comments: {comments || "None"}</p>
          <p>Doctor: {doctorName}</p>
          {doctorQualifications && <p>Qualifications: {doctorQualifications}</p>}
          <p>HPCSA / Registration: {hpcsa || "Not captured"}</p>
          <p>Practice No: {practiceNumber || "Not captured"}</p>
        </div>

        {message && <div style={styles.message}>{message}</div>}
        <button style={styles.primaryButton} onClick={handleSave} disabled={saving || emailing}>{saving ? "Saving…" : "Save Sick Note"}</button>
        <button style={styles.pdfButton} onClick={printPdf} disabled={saving || emailing}>Download PDF</button>
        <button style={styles.emailButton} onClick={emailPdf} disabled={saving || emailing}>{emailing ? "Sending…" : "Email PDF to Employer and CC Patient"}</button>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#eef4fb", padding: 18, fontFamily: "Arial, Helvetica, sans-serif", color: "#0f172a" },
  card: { maxWidth: 760, margin: "0 auto", background: "#fff", borderRadius: 28, padding: 28, boxShadow: "0 20px 60px rgba(15,23,42,.12)" },
  back: { color: "#2563eb", fontWeight: 800, textDecoration: "none", fontSize: 18 },
  tabRow: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 },
  tab: { padding: "12px 14px", borderRadius: 14, background: "#e2e8f0", color: "#0f172a", textDecoration: "none", fontWeight: 900 },
  activeTab: { padding: "12px 14px", borderRadius: 14, background: "#f97316", color: "#fff", textDecoration: "none", fontWeight: 900 },
  kicker: { marginTop: 30, color: "#2563eb", fontWeight: 900, fontSize: 18 },
  title: { fontSize: 48, lineHeight: 1, margin: "12px 0", fontWeight: 900 },
  subtitle: { fontSize: 22, color: "#526174", lineHeight: 1.45 },
  heading: { fontSize: 32, fontWeight: 900, marginTop: 32 },
  label: { display: "block", fontWeight: 800, marginTop: 14, marginBottom: 6 },
  input: { width: "100%", boxSizing: "border-box", border: "2px solid #cbd5e1", borderRadius: 18, padding: 18, fontSize: 18, marginTop: 12 },
  textarea: { width: "100%", boxSizing: "border-box", minHeight: 130, border: "2px solid #cbd5e1", borderRadius: 18, padding: 18, fontSize: 18, marginTop: 16 },
  textareaSmall: { width: "100%", boxSizing: "border-box", minHeight: 90, border: "2px solid #cbd5e1", borderRadius: 18, padding: 18, fontSize: 18, marginTop: 12 },
  muted: { color: "#64748b", fontSize: 17 },
  patientCard: { width: "100%", textAlign: "left", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 18, padding: 16, marginTop: 10, display: "grid", gap: 6, fontSize: 17 },
  selected: { marginTop: 14, background: "#dcfce7", color: "#166534", padding: 16, borderRadius: 16, fontWeight: 900, fontSize: 17 },
  clearSmall: { display: "block", marginTop: 10, border: 0, borderRadius: 12, background: "#fff", color: "#166534", padding: 10, fontWeight: 900 },
  autoLinkedText: { marginTop: 6, fontSize: 14, fontWeight: 700, color: "#15803d" },
  readOnlyInput: { background: "#f8fafc", color: "#334155" },
  info: { background: "#dcfce7", color: "#166534", padding: 14, borderRadius: 14, fontWeight: 900, marginTop: 16 },
  referralInfo: { background: "#dbeafe", color: "#1d4ed8", padding: 14, borderRadius: 14, fontWeight: 900, marginTop: 12 },
  icdBox: { border: "1px solid #cbd5e1", borderRadius: 16, marginTop: 8, overflow: "hidden", maxHeight: 360, overflowY: "auto" },
  icdItem: { display: "block", width: "100%", textAlign: "left", padding: 14, background: "#fff", border: 0, borderBottom: "1px solid #e2e8f0", fontSize: 16, cursor: "pointer" },
  icdStatus: { marginTop: 10, padding: 12, borderRadius: 12, background: "#f8fafc", color: "#64748b", fontWeight: 700 },
  icdCategory: { color: "#64748b", fontSize: 14 },
  selectedDiagnosis: { marginTop: 10, padding: 12, borderRadius: 12, background: "#dcfce7", color: "#166534", fontWeight: 800 },
  canvas: { width: "100%", height: 190, border: "2px dashed #cbd5e1", borderRadius: 18, background: "#fff", touchAction: "none" },
  preview: { marginTop: 28, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 18, padding: 20, fontSize: 17, lineHeight: 1.6 },
  lightButton: { width: "100%", border: 0, borderRadius: 18, padding: 16, background: "#dbeafe", color: "#1d4ed8", fontWeight: 900, fontSize: 18, marginTop: 14 },
  primaryButton: { width: "100%", border: 0, borderRadius: 18, padding: 20, background: "#2563eb", color: "#fff", fontWeight: 900, fontSize: 20, marginTop: 18 },
  pdfButton: { width: "100%", border: 0, borderRadius: 18, padding: 20, background: "#0f172a", color: "#fff", fontWeight: 900, fontSize: 20, marginTop: 14 },
  emailButton: { width: "100%", border: 0, borderRadius: 18, padding: 20, background: "#16a34a", color: "#fff", fontWeight: 900, fontSize: 20, marginTop: 14 },
  message: { background: "#e0f2fe", color: "#075985", padding: 14, borderRadius: 14, fontWeight: 800, marginTop: 18 },
};
