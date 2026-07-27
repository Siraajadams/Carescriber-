"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import { supabase } from "../../lib/supabase";
import medicineData from "../../medicine.json";

type Patient = {
  id: string;
  first_name?: string;
  surname?: string;
  last_name?: string;
  id_number?: string;
  patient_id?: string;
  date_of_birth?: string | null;
  dob?: string | null;
  age?: number | null;
  gender?: string | null;
  mobile?: string | null;
  email?: string | null;
  medical_aid?: string | null;
  medical_aid_number?: string | null;
  allergies?: string | null;
};

type Medicine = {
  nappi: string;
  schedule: string;
  brand: string;
  active: string;
  strength: string;
  unit: string;
  form: string;
  pack_size: string;
  quantity: string;
  sep: number | null;
  unit_price: number | null;
  manufacturer: string;
  registration: string;
  atc: string;
  generic_originator: string;
};

type ScriptItem = {
  id: string;
  icdCode: string;
  icdDescription: string;
  medicineQuery: string;
  medicine?: Medicine;
  dosage: string;
  form: string;
  frequency: string;
  timing: string;
  duration: string;
  repeats: string;
  substitution: string;
  notes: string;
};

type DoctorProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  surname: string | null;
  email: string | null;
  mobile: string | null;
  registration_number: string | null;
  practice_number: string | null;
  practice_address: string | null;
  country: string | null;
};

const icd10List = [
  { code: "J01.9", description: "Acute sinusitis, unspecified" },
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified" },
  { code: "J02.9", description: "Acute pharyngitis, unspecified" },
  { code: "J03.9", description: "Acute tonsillitis, unspecified" },
  { code: "R05", description: "Cough" },
  { code: "R50.9", description: "Fever, unspecified" },
  { code: "A09.9", description: "Gastroenteritis and colitis, unspecified" },
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  { code: "M54.5", description: "Low back pain" },
  { code: "Z76.9", description: "Person encountering health services in unspecified circumstances" },
];

const forms = ["Cap", "Crm", "Oint", "Pess", "Pump", "Spray", "Supp", "Tab", "Unit(s)", "Vial", "Syrup", "Not Applicable"];
const frequencies = ["OD", "BD", "TDS", "QID", "Before meals", "After meals", "Morning", "Lunch time", "Evening", "Use as directed", "Use as required"];
const days = Array.from({ length: 29 }, (_, i) => String(i));
const repeats = ["0", "1", "2", "3", "4", "5", "6"];

function newItem(): ScriptItem {
  return {
    id: crypto.randomUUID(),
    icdCode: "",
    icdDescription: "",
    medicineQuery: "",
    dosage: "1",
    form: "Tab",
    frequency: "BD",
    timing: "After meals",
    duration: "5",
    repeats: "0",
    substitution: "Substitution allowed",
    notes: "",
  };
}

function clean(value?: string | null) {
  return value || "";
}

function splitDoctorName(value: string) {
  const withoutTitle = value.replace(/^\s*dr\.?\s+/i, "").trim();
  const parts = withoutTitle.split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function calcAge(dob?: string | null, fallback?: number | null) {
  if (fallback) return fallback;
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normaliseText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function medicineScore(m: Medicine, query: string) {
  const q = normaliseText(query);
  if (!q) return 0;

  const brand = normaliseText(m.brand || "");
  const active = normaliseText(m.active || "");
  const combined = normaliseText([
    m.brand,
    m.active,
    m.strength,
    m.unit,
    m.form,
    m.nappi,
    m.schedule,
    m.manufacturer,
  ].join(" "));

  if (brand.startsWith(q)) return 100;
  if (active.startsWith(q)) return 90;
  if (brand.includes(q)) return 80;
  if (active.includes(q)) return 70;
  if (combined.includes(q)) return 60;

  const tokens = q.split(" ").filter(Boolean);
  const matchedTokens = tokens.filter((t) => combined.includes(t)).length;
  if (matchedTokens > 0) return 40 + matchedTokens;

  return 0;
}

function normaliseMedicine(raw: any): Medicine {
  return {
    nappi: String(raw.nappi || raw.NAPPI || raw["NAPPI Code"] || raw.code || ""),
    schedule: String(raw.schedule || raw.Schedule || raw.scheduling || ""),
    brand: String(raw.brand || raw.Brand || raw.product || raw.Product || raw["Product Name"] || raw.name || ""),
    active: String(raw.active || raw.Active || raw.ingredient || raw["Active Ingredient"] || raw.generic || ""),
    strength: String(raw.strength || raw.Strength || ""),
    unit: String(raw.unit || raw.Unit || ""),
    form: String(raw.form || raw.Form || raw.dosage_form || raw["Dosage Form"] || ""),
    pack_size: String(raw.pack_size || raw.Pack_Size || raw["Pack Size"] || ""),
    quantity: String(raw.quantity || raw.Quantity || ""),
    sep: raw.sep ?? raw.SEP ?? raw.price ?? null,
    unit_price: raw.unit_price ?? raw["Unit Price"] ?? null,
    manufacturer: String(raw.manufacturer || raw.Manufacturer || ""),
    registration: String(raw.registration || raw.Registration || ""),
    atc: String(raw.atc || raw.ATC || ""),
    generic_originator: String(raw.generic_originator || raw["Generic/Originator"] || ""),
  };
}


function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function EScriptPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [linkedPatientId, setLinkedPatientId] = useState<string | null>(null);
  const [pageInitialised, setPageInitialised] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [patientLoading, setPatientLoading] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);

  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [doctorName, setDoctorName] = useState("Dr");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorMobile, setDoctorMobile] = useState("");
  const [hpcsa, setHpcsa] = useState("");
  const [practiceNumber, setPracticeNumber] = useState("");
  const [practiceAddress, setPracticeAddress] = useState("");
  const [editDoctor, setEditDoctor] = useState(false);
  const [doctorLoading, setDoctorLoading] = useState(true);
  const [doctorSaving, setDoctorSaving] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  const [items, setItems] = useState<ScriptItem[]>([newItem()]);
  const [message, setMessage] = useState("");
  const [scriptNumber, setScriptNumber] = useState(`RX-${Date.now()}`);
  const [history, setHistory] = useState<any[]>([]);
  const [emailing, setEmailing] = useState(false);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const patientIdFromUrl = params.get("patientId");

    setLinkedPatientId(patientIdFromUrl);
    setPageInitialised(true);
  }, []);

  useEffect(() => {
    if (!pageInitialised) return;

    void initialisePage();

    try {
      const raw = Array.isArray(medicineData) ? medicineData : [];
      setMedicines(
        raw
          .map(normaliseMedicine)
          .filter((m) => m.brand || m.active || m.nappi)
      );
    } catch {
      setMessage(
        "Medicine file could not be loaded. Confirm medicine.json exists in the project root."
      );
    } finally {
      setLoadingMeds(false);
    }
  }, [pageInitialised, linkedPatientId]);

  async function initialisePage() {
    await Promise.all([loadPatients(), loadDoctor(), loadHistory()]);

    let patientId = linkedPatientId;

    if (!patientId && typeof window !== "undefined") {
      patientId = window.sessionStorage.getItem(
        "carescriber_selected_patient_id"
      );
    }

    if (patientId) {
      await loadLinkedPatient(patientId);
    }
  }



  async function loadPatients() {
    const { data, error } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
    if (error) {
      setMessage("Patient load error: " + error.message);
      return;
    }
    setPatients((data || []) as Patient[]);
  }

  async function loadLinkedPatient(patientId: string) {
    setPatientLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .maybeSingle();

      if (error) {
        console.error("Linked patient load error:", error);
        setMessage(
          "The selected patient could not be loaded: " + error.message
        );
        return;
      }

      if (!data) {
        setMessage(
          "The selected patient was not found. Please search for the patient again."
        );
        return;
      }

      const patient = data as Patient;
      setSelectedPatient(patient);
      setPatientSearch(
        `${patient.first_name || ""} ${
          patient.surname || patient.last_name || ""
        }`.trim()
      );
      setRecipientEmail(patient.email || "");

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "carescriber_selected_patient_id",
          patient.id
        );
      }
    } catch (error) {
      console.error("Unexpected linked patient load error:", error);
      setMessage(
        error instanceof Error
          ? "The selected patient could not be loaded: " + error.message
          : "An unexpected error occurred while loading the selected patient."
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
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setMessage("Doctor login error: " + userError.message);
        setEditDoctor(true);
        return;
      }

      if (!user) {
        setMessage("No logged-in doctor was found. Please log in again.");
        setEditDoctor(true);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, surname, email, mobile, registration_number, practice_number, practice_address, country"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Doctor profile retrieval failed:", error);
        setDoctorEmail(user.email || "");
        setMessage("Doctor profile load error: " + error.message);
        setEditDoctor(true);
        return;
      }

      const profile = data as DoctorProfile | null;

      if (!profile) {
        setDoctorEmail(user.email || "");
        setMessage(
          "No doctor profile is linked to this login. Complete the fields below and press Save Doctor Details."
        );
        setEditDoctor(true);
        return;
      }

      setDoctorProfile(profile);

      const surnameValue = profile.last_name || profile.surname || "";
      const fullName = `${profile.first_name || ""} ${surnameValue}`.trim();

      setDoctorName(
        fullName
          ? /^dr\.?\s/i.test(fullName)
            ? fullName
            : `Dr ${fullName}`
          : "Dr"
      );
      setDoctorEmail(profile.email || user.email || "");
      setDoctorMobile(profile.mobile || "");
      setHpcsa(profile.registration_number || "");
      setPracticeNumber(profile.practice_number || "");
      setPracticeAddress(profile.practice_address || "");

      const profileComplete = Boolean(
        fullName &&
          profile.registration_number &&
          profile.practice_number &&
          profile.mobile &&
          (profile.email || user.email)
      );

      setEditDoctor(!profileComplete);
    } catch (error) {
      console.error("Unexpected doctor profile error:", error);
      setMessage(
        error instanceof Error
          ? "Doctor profile load error: " + error.message
          : "An unexpected doctor profile error occurred."
      );
      setEditDoctor(true);
    } finally {
      setDoctorLoading(false);
    }
  }

  async function saveDoctorProfile() {
    if (doctorSaving) return;

    setDoctorSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setMessage("Doctor login error: " + userError.message);
        return;
      }

      if (!user) {
        setMessage("No logged-in doctor was found. Please log in again.");
        return;
      }

      const parsedName = splitDoctorName(doctorName);

      if (!parsedName.firstName || !parsedName.lastName) {
        setMessage("Please enter the doctor's full first name and surname.");
        return;
      }

      if (!hpcsa.trim()) {
        setMessage("Please enter the HPCSA / council registration number.");
        return;
      }

      const profilePayload = {
        id: user.id,
        role: "doctor",
        first_name: parsedName.firstName,
        last_name: parsedName.lastName,
        surname: parsedName.lastName,
        email: doctorEmail.trim().toLowerCase() || user.email || null,
        mobile: doctorMobile.trim() || null,
        registration_number: hpcsa.trim(),
        practice_number: practiceNumber.trim() || null,
        practice_address: practiceAddress.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" })
        .select(
          "id, first_name, last_name, surname, email, mobile, registration_number, practice_number, practice_address, country"
        )
        .single();

      if (error) {
        console.error("Doctor profile save failed:", error);
        setMessage("Doctor profile save failed: " + error.message);
        return;
      }

      setDoctorProfile(data as DoctorProfile);
      setDoctorName(`Dr ${parsedName.firstName} ${parsedName.lastName}`.trim());
      setDoctorEmail(profilePayload.email || "");
      setDoctorMobile(profilePayload.mobile || "");
      setHpcsa(profilePayload.registration_number);
      setPracticeNumber(profilePayload.practice_number || "");
      setPracticeAddress(profilePayload.practice_address || "");
      setEditDoctor(false);
      setMessage("Doctor details saved and will be loaded automatically on future scripts.");
    } catch (error) {
      console.error("Unexpected doctor profile save error:", error);
      setMessage(
        error instanceof Error
          ? "Doctor profile save failed: " + error.message
          : "An unexpected error occurred while saving the doctor profile."
      );
    } finally {
      setDoctorSaving(false);
    }
  }

  async function loadHistory() {
    const { data } = await supabase.from("prescriptions").select("*").order("created_at", { ascending: false }).limit(10);
    setHistory(data || []);
  }

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q || selectedPatient) return [];
    return patients.filter((p) => [p.first_name, p.surname, p.last_name, p.id_number, p.patient_id, p.mobile, p.email].join(" ").toLowerCase().includes(q));
  }, [patientSearch, patients, selectedPatient]);

  function patientName(p = selectedPatient) {
    if (!p) return "";
    return `${p.first_name || ""} ${p.surname || p.last_name || ""}`.trim();
  }

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setPatientSearch(patientName(p));
    setRecipientEmail(p.email || "");
    setMessage("");

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "carescriber_selected_patient_id",
        p.id
      );
    }
  }

  function clearSelectedPatient() {
    setSelectedPatient(null);
    setPatientSearch("");
    setRecipientEmail("");

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(
        "carescriber_selected_patient_id"
      );
    }
  }

  function medicineResults(query: string) {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    return medicines
      .map((m) => ({ medicine: m, score: medicineScore(m, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || (a.medicine.brand || "").localeCompare(b.medicine.brand || ""))
      .slice(0, 20)
      .map((r) => r.medicine);
  }

  function icdResults(item: ScriptItem) {
    const q = item.icdCode.trim().toLowerCase();
    if (!q) return [];
    return icd10List.filter((i) => `${i.code} ${i.description}`.toLowerCase().includes(q));
  }

  function updateItem(id: string, patch: Partial<ScriptItem>) {
    setItems((old) => old.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function addItem() {
    setItems((old) => [...old, newItem()]);
  }

  function removeItem(id: string) {
    setItems((old) => old.length === 1 ? old : old.filter((i) => i.id !== id));
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
  }

  function stopDraw() {
    setDrawing(false);
    canvasRef.current?.getContext("2d")?.beginPath();
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function signatureDataUrl() {
    return canvasRef.current?.toDataURL("image/png") || "";
  }

  function buildPdfHtml() {
    const p = selectedPatient;
    const pName = patientName() || "Patient not selected";
    const dob = clean(p?.date_of_birth || p?.dob);
    const age = calcAge(dob, p?.age);
    const signature = signatureDataUrl();

    const rows = items.map((item) => {
      const med = item.medicine;
      return `<tr>
        <td>${escapeHtml(item.icdCode || "")}${item.icdDescription ? " | " + escapeHtml(item.icdDescription) : ""}</td>
        <td>${escapeHtml(med?.brand || item.medicineQuery || "")}</td>
        <td>${escapeHtml([med?.strength, med?.unit].filter(Boolean).join(" "))}</td>
        <td>${escapeHtml(item.form || med?.form || "")}</td>
        <td>${escapeHtml(`${item.dosage} ${item.frequency} ${item.timing} for ${item.duration} days`)}</td>
        <td>${escapeHtml(item.substitution)}</td>
        <td>${escapeHtml(item.repeats)}</td>
        <td>${escapeHtml(item.notes)}</td>
      </tr>`;
    }).join("");

    return `<!doctype html><html><head><title>${escapeHtml(scriptNumber)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:28px;font-size:13px}
      .top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:28px}
      .logo{font-size:38px;font-weight:800;color:#1d4ed8}.logo span{color:#16a34a}
      table{width:100%;border-collapse:collapse}.box td{border:1px solid #334155;padding:7px}.rx th{border-bottom:2px solid #111827;text-align:left;padding:7px}.rx td{border-bottom:1px solid #cbd5e1;padding:7px;vertical-align:top}
      .section{margin-top:22px}.muted{color:#64748b}.sig{margin-top:30px}.sig img{max-width:220px;border-bottom:1px solid #111827}
      .footer{margin-top:30px;border-top:1px solid #cbd5e1;padding-top:10px;font-size:11px;color:#64748b}
    </style></head><body>
      <div class="top">
        <div><div class="logo">Care<span>Scriber</span></div><div class="muted">Electronic Prescription</div></div>
        <table class="box" style="max-width:360px"><tbody>
          <tr><td><b>Prescription issued on</b></td><td>${today()}</td></tr>
          <tr><td><b>Patient Name</b></td><td>${escapeHtml(pName)}</td></tr>
          <tr><td><b>Patient Identifier</b></td><td>${escapeHtml(p?.id_number || p?.patient_id || "")}</td></tr>
          <tr><td><b>Gender</b></td><td>${escapeHtml(clean(p?.gender))}</td></tr>
          <tr><td><b>Age (DOB)</b></td><td>${escapeHtml(String(age || ""))}${dob ? ` (${escapeHtml(dob)})` : ""}</td></tr>
          <tr><td><b>Medical Aid Scheme</b></td><td>${escapeHtml(clean(p?.medical_aid))}</td></tr>
          <tr><td><b>Medical Aid Number</b></td><td>${escapeHtml(clean(p?.medical_aid_number))}</td></tr>
        </tbody></table>
      </div>
      <div class="section"><b>Prescription Details</b><br/>
        Name: ${escapeHtml(doctorName)}<br/>
        Professional Council No: ${escapeHtml(hpcsa || "Not captured")}<br/>
        Practice Name: ${escapeHtml(practiceNumber || "Not captured")}<br/>
        Tel: ${escapeHtml(doctorMobile)}<br/>
        Email: ${escapeHtml(doctorEmail)}<br/>
        Address: ${escapeHtml(practiceAddress)}
      </div>
      <div class="section"><table class="rx"><thead><tr><th>ICD</th><th>MEDICATION</th><th>DOSAGE</th><th>FORM</th><th>INSTRUCTIONS</th><th>SUBSTITUTION</th><th>REPEATS</th><th>NOTES</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="sig">${signature ? `<img src="${signature}" />` : "<p>Signature not captured</p>"}<br/><b>Doctor Signature</b></div>
      <div class="footer">Script No: ${escapeHtml(scriptNumber)}. This prescription must be clinically checked by the prescriber before dispensing. QR verification can be added when the verification route is live.</div>
    </body></html>`;
  }

  function generatePrescriptionPdfBlob() {
    const patient = selectedPatient;
    const patientFullName = patientName() || "Patient not selected";
    const dob = clean(patient?.date_of_birth || patient?.dob);
    const age = calcAge(dob, patient?.age);
    const signature = signatureDataUrl();

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const left = 16;
    const right = pageWidth - 16;
    let y = 18;

    function ensureSpace(required = 18) {
      if (y + required > 282) {
        pdf.addPage();
        y = 18;
      }
    }

    function addLabelValue(label: string, value: string) {
      ensureSpace(9);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(`${label}:`, left, y);

      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(value || "Not captured", right - left - 42);
      pdf.text(lines, left + 42, y);
      y += Math.max(6, lines.length * 5);
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text("CareScriber", left, y);
    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text("Electronic Prescription", left, y);
    y += 10;

    pdf.setDrawColor(203, 213, 225);
    pdf.line(left, y, right, y);
    y += 8;

    addLabelValue("Script number", scriptNumber);
    addLabelValue("Issued on", today());
    addLabelValue("Patient", patientFullName);
    addLabelValue(
      "Patient identifier",
      patient?.id_number || patient?.patient_id || "Not captured"
    );
    addLabelValue("Gender", clean(patient?.gender) || "Not captured");
    addLabelValue(
      "Age / DOB",
      `${age || "Not captured"}${dob ? ` / ${dob}` : ""}`
    );
    addLabelValue("Mobile", clean(patient?.mobile) || "Not captured");
    addLabelValue("Email", clean(patient?.email) || "Not captured");
    addLabelValue("Medical aid", clean(patient?.medical_aid) || "Not captured");
    addLabelValue(
      "Medical aid number",
      clean(patient?.medical_aid_number) || "Not captured"
    );

    y += 4;
    ensureSpace(20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Prescriber", left, y);
    y += 8;

    addLabelValue("Doctor", doctorName);
    addLabelValue("HPCSA / Council", hpcsa || "Not captured");
    addLabelValue("Practice number", practiceNumber || "Not captured");
    addLabelValue("Mobile", doctorMobile || "Not captured");
    addLabelValue("Email", doctorEmail || "Not captured");
    addLabelValue("Practice address", practiceAddress || "Not captured");

    y += 5;
    ensureSpace(20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Prescription", left, y);
    y += 8;

    items.forEach((item, index) => {
      ensureSpace(42);

      const medicineName =
        item.medicine?.brand || item.medicineQuery || "Medicine not captured";
      const strength = [item.medicine?.strength, item.medicine?.unit]
        .filter(Boolean)
        .join(" ");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(`${index + 1}. ${medicineName}`, left, y);
      y += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);

      const details = [
        item.icdCode
          ? `ICD-10: ${item.icdCode}${
              item.icdDescription ? ` — ${item.icdDescription}` : ""
            }`
          : "",
        strength ? `Strength: ${strength}` : "",
        `Directions: ${item.dosage} ${item.form} ${item.frequency} ${item.timing} for ${item.duration} days`,
        `Repeats: ${item.repeats}`,
        `Substitution: ${item.substitution}`,
        item.notes ? `Notes: ${item.notes}` : "",
      ].filter(Boolean);

      details.forEach((line) => {
        const wrapped = pdf.splitTextToSize(line, right - left);
        ensureSpace(wrapped.length * 5 + 2);
        pdf.text(wrapped, left + 4, y);
        y += wrapped.length * 5;
      });

      y += 5;
    });

    ensureSpace(45);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Doctor signature", left, y);
    y += 5;

    if (signature && signature !== "data:,") {
      try {
        pdf.addImage(signature, "PNG", left, y, 55, 22);
        y += 26;
      } catch {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text("Signature image could not be added.", left, y);
        y += 7;
      }
    } else {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("Signature not captured.", left, y);
      y += 7;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    const footer = pdf.splitTextToSize(
      "This prescription must be clinically checked and signed by the prescriber before dispensing.",
      right - left
    );
    pdf.text(footer, left, 289 - footer.length * 3);

    return pdf.output("blob");
  }

  function printPdf() {
    try {
      if (!selectedPatient) {
        setMessage("Please select a patient before creating the PDF.");
        return;
      }

      const blob = generatePrescriptionPdfBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${scriptNumber}.pdf`;
      link.rel = "noopener";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage("Prescription PDF downloaded successfully.");
    } catch (error) {
      console.error("PDF generation error:", error);
      setMessage(
        error instanceof Error
          ? "Could not generate the prescription PDF: " + error.message
          : "Could not generate the prescription PDF."
      );
    }
  }

  async function persistPrescription(options?: {
    silent?: boolean;
  }): Promise<boolean> {
    if (!selectedPatient) {
      setMessage("Please select a patient first.");
      return false;
    }

    const validItems = items.filter(
      (item) => item.medicine || item.medicineQuery.trim()
    );

    if (validItems.length === 0) {
      setMessage("Please add at least one medicine.");
      return false;
    }

    if (!doctorName.trim() || doctorName.trim().toLowerCase() === "dr") {
      setMessage("Please complete the doctor's full name.");
      return false;
    }

    if (!hpcsa.trim()) {
      setMessage("Please complete the HPCSA / council number.");
      return false;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage(
        userError
          ? "Doctor login error: " + userError.message
          : "No logged-in doctor was found."
      );
      return false;
    }

    const payload = {
      prescription_number: scriptNumber,
      patient_id: selectedPatient.id,
      patient_name: patientName(),
      doctor_id: user.id,
      doctor_name: doctorName,
      doctor_hpcsa: hpcsa,
      items: validItems,
      status: "issued",
      pdf_html: buildPdfHtml(),
      issued_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("prescriptions")
      .upsert(payload, {
        onConflict: "prescription_number",
      });

    if (error) {
      setMessage("Prescription save failed: " + error.message);
      return false;
    }

    if (!options?.silent) {
      setMessage("Prescription saved successfully.");
    }

    await loadHistory();
    return true;
  }

  async function savePrescription() {
    if (savingPrescription) return;

    setSavingPrescription(true);
    setMessage("");

    try {
      await persistPrescription();
    } catch (error) {
      console.error("Unexpected prescription save error:", error);
      setMessage(
        error instanceof Error
          ? "Prescription save failed: " + error.message
          : "An unexpected prescription save error occurred."
      );
    } finally {
      setSavingPrescription(false);
    }
  }

  async function emailPrescription() {
    if (emailing) return;

    if (!selectedPatient) {
      setMessage("Please select a patient before emailing the prescription.");
      return;
    }

    const recipient = recipientEmail.trim().toLowerCase();

    if (!recipient || !recipient.includes("@")) {
      setMessage("Please enter a valid recipient email address.");
      return;
    }

    setEmailing(true);
    setMessage("");

    try {
      const saved = await persistPrescription({ silent: true });

      if (!saved) {
        return;
      }

      const pdfBlob = generatePrescriptionPdfBlob();
      const pdfBase64 = await blobToBase64(pdfBlob);

      const response = await fetch("/api/prescriptions/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: recipient,
          subject: `Electronic Prescription ${scriptNumber} - ${patientName()}`,
          body: `Good day,

Please find the electronic prescription ${scriptNumber} for ${patientName()} attached.

Prescriber: ${doctorName}
HPCSA / Council number: ${hpcsa}

This prescription was generated securely using CareScriber.

Kind regards,
CareScriber
https://carescriber.com`,
          filename: `${scriptNumber}.pdf`,
          pdfBase64,
          prescriptionNumber: scriptNumber,
          patientId: selectedPatient.id,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.error || "The prescription email could not be sent."
        );
      }

      await supabase
        .from("prescriptions")
        .update({
          status: "emailed",
        })
        .eq("prescription_number", scriptNumber);

      setMessage(
        `Prescription saved and PDF emailed successfully to ${recipient}.`
      );
      await loadHistory();
    } catch (error) {
      console.error("Prescription email error:", error);
      setMessage(
        error instanceof Error
          ? "Prescription email failed: " + error.message
          : "Prescription email failed."
      );
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
          <Link href="/patients" style={styles.tab}>Patient Info</Link>
          <Link href="/consultation" style={styles.tab}>Consultation</Link>
          <Link href="/e-script" style={styles.activeTab}>E-Script</Link>
          <Link href="/sick-note" style={styles.tab}>Sick Note</Link>
        </div>

        <p style={styles.kicker}>CareScriber Digital Prescribing</p>
        <h1 style={styles.title}>E-Script</h1>
        <p style={styles.subtitle}>Search ICD-10, select medicines from the SA price database, issue a prescription and export a VideoMed-style PDF.</p>
        <div style={styles.notice}>Medicine database: {loadingMeds ? "Loading..." : `${medicines.length.toLocaleString()} medicines loaded`} · Script No: {scriptNumber}</div>

        <h2 style={styles.heading}>Patient</h2>

        {patientLoading && (
          <div style={styles.notice}>Loading selected patient...</div>
        )}

        <input
          style={styles.input}
          value={patientSearch}
          placeholder="Search existing patient by name, ID or mobile"
          onChange={(e) => {
            setPatientSearch(e.target.value);
            setSelectedPatient(null);

            if (typeof window !== "undefined") {
              window.sessionStorage.removeItem(
                "carescriber_selected_patient_id"
              );
            }
          }}
        />

        {filteredPatients.map((p) => (
          <button
            key={p.id}
            type="button"
            style={styles.patientCard}
            onClick={() => selectPatient(p)}
          >
            <b>{patientName(p)}</b>
            <span>
              {p.id_number || p.patient_id || "No ID"} ·{" "}
              {p.gender || "Gender not captured"} ·{" "}
              {p.mobile || "No mobile"}
            </span>
          </button>
        ))}

        {patientSearch &&
          !selectedPatient &&
          !patientLoading &&
          filteredPatients.length === 0 && (
            <p style={styles.muted}>No matching patient found.</p>
          )}

        {selectedPatient && (
          <div style={styles.selected}>
            <div>
              Selected: {patientName()} · ID:{" "}
              {selectedPatient.id_number ||
                selectedPatient.patient_id ||
                "Not captured"}
            </div>

            <div>
              DOB:{" "}
              {selectedPatient.date_of_birth ||
                selectedPatient.dob ||
                "Not captured"}{" "}
              · Mobile: {selectedPatient.mobile || "Not captured"}
            </div>

            <button
              type="button"
              style={styles.changePatientButton}
              onClick={clearSelectedPatient}
            >
              Change Patient
            </button>
          </div>
        )}

        <h2 style={styles.heading}>Doctor</h2>
        {doctorLoading && <div style={styles.notice}>Loading logged-in doctor profile...</div>}
        <div style={styles.doctorSummary}>
          <b>{doctorName || "Doctor profile not captured"}</b>
          <span>HPCSA / Council: {hpcsa || "Missing"} · Practice: {practiceNumber || "Missing"}</span>
          <span>{doctorEmail || "No email"} · {doctorMobile || "No mobile"}</span>
          {practiceAddress && <span>{practiceAddress}</span>}
          <button style={styles.smallEditButton} onClick={() => setEditDoctor((v) => !v)}>
            {editDoctor ? "Hide Doctor Edit" : "Edit Doctor Details"}
          </button>
        </div>

        {editDoctor && (
          <>
            <div style={styles.warning}>
              These details should normally come from the logged-in doctor profile. Complete missing fields once in the profile so the doctor does not need to recapture them.
            </div>
            <div style={styles.grid2}>
              <input style={styles.input} value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Doctor name" />
              <input style={styles.input} value={hpcsa} onChange={(e) => setHpcsa(e.target.value)} placeholder="HPCSA / council no" />
              <input style={styles.input} value={practiceNumber} onChange={(e) => setPracticeNumber(e.target.value)} placeholder="Practice number" />
              <input style={styles.input} value={doctorMobile} onChange={(e) => setDoctorMobile(e.target.value)} placeholder="Doctor mobile" />
              <input style={styles.input} value={doctorEmail} onChange={(e) => setDoctorEmail(e.target.value)} placeholder="Doctor email" />
            </div>
            <textarea style={styles.textareaSmall} value={practiceAddress} onChange={(e) => setPracticeAddress(e.target.value)} placeholder="Practice address" />
            <button
              type="button"
              style={styles.saveDoctorButton}
              onClick={saveDoctorProfile}
              disabled={doctorSaving}
            >
              {doctorSaving ? "Saving Doctor Details..." : "Save Doctor Details"}
            </button>
          </>
        )}

        <h2 style={styles.heading}>Proposed Rx</h2>
        {items.map((item, index) => (
          <div key={item.id} style={styles.rxCard}>
            <div style={styles.rxHeader}><b>Medicine {index + 1}</b><button style={styles.removeButton} onClick={() => removeItem(item.id)}>Remove</button></div>
            <label style={styles.label}>ICD</label>
            <input style={styles.input} value={item.icdCode} placeholder="Type ICD code or description" onChange={(e) => updateItem(item.id, { icdCode: e.target.value, icdDescription: "" })} />
            {icdResults(item).length > 0 && <div style={styles.resultBox}>{icdResults(item).map((icd) => <button key={icd.code} style={styles.resultItem} onClick={() => updateItem(item.id, { icdCode: icd.code, icdDescription: icd.description })}>{icd.code} | {icd.description}</button>)}</div>}

            <label style={styles.label}>Medication</label>
            <input style={styles.input} value={item.medicineQuery} placeholder="Type medicine name, active ingredient or NAPPI" onChange={(e) => updateItem(item.id, { medicineQuery: e.target.value, medicine: undefined })} />
            {medicineResults(item.medicineQuery).length > 0 && !item.medicine && <div style={styles.resultBox}>{medicineResults(item.medicineQuery).map((med) => <button key={`${med.nappi}-${med.brand}`} style={styles.resultItem} onClick={() => updateItem(item.id, { medicine: med, medicineQuery: `${med.brand} ${med.strength}${med.unit ? " " + med.unit : ""}` , form: med.form || item.form })}><b>{med.brand}</b> {med.strength}{med.unit} · {med.active} · {med.schedule} · NAPPI {med.nappi}</button>)}</div>}
            {item.medicine && <div style={styles.medSelected}>{item.medicine.brand} · {item.medicine.active} · {item.medicine.schedule} · SEP R{item.medicine.sep || "N/A"}</div>}

            <div style={styles.grid2}>
              <label style={styles.fieldLabel}>Dose / Quantity
                <input style={styles.input} value={item.dosage} onChange={(e) => updateItem(item.id, { dosage: e.target.value })} placeholder="e.g. 1" />
              </label>

              <label style={styles.fieldLabel}>Form
                <select style={styles.input} value={item.form} onChange={(e) => updateItem(item.id, { form: e.target.value })}>{forms.map((f) => <option key={f}>{f}</option>)}</select>
              </label>

              <label style={styles.fieldLabel}>Frequency
                <select style={styles.input} value={item.frequency} onChange={(e) => updateItem(item.id, { frequency: e.target.value })}>{frequencies.map((f) => <option key={f}>{f}</option>)}</select>
              </label>

              <label style={styles.fieldLabel}>Days
                <select style={styles.input} value={item.duration} onChange={(e) => updateItem(item.id, { duration: e.target.value })}>{days.map((d) => <option key={d}>{d}</option>)}</select>
              </label>

              <label style={styles.fieldLabel}>Repeats
                <select style={styles.input} value={item.repeats} onChange={(e) => updateItem(item.id, { repeats: e.target.value })}>{repeats.map((r) => <option key={r}>{r}</option>)}</select>
              </label>

              <label style={styles.fieldLabel}>Substitution
                <select style={styles.input} value={item.substitution} onChange={(e) => updateItem(item.id, { substitution: e.target.value })}><option>Substitution allowed</option><option>Do not substitute</option></select>
              </label>
            </div>
            <textarea style={styles.textareaSmall} value={item.notes} onChange={(e) => updateItem(item.id, { notes: e.target.value })} placeholder="Notes / counselling instructions" />
          </div>
        ))}
        <button type="button" style={styles.lightButton} onClick={addItem}>+ Add Medicine</button>

        <h2 style={styles.heading}>Doctor Signature</h2>
        <canvas ref={canvasRef} width={700} height={220} style={styles.canvas} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
        <button type="button" style={styles.lightButton} onClick={clearSignature}>Clear Signature</button>

        <h2 style={styles.heading}>Send Prescription</h2>
        <label style={styles.fieldLabel}>
          Recipient email
          <input
            style={styles.input}
            type="email"
            inputMode="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="patient@example.com"
          />
        </label>

        {message && <div style={styles.message}>{message}</div>}

        <button
          style={{
            ...styles.primaryButton,
            ...(savingPrescription ? styles.disabledButton : {}),
          }}
          onClick={savePrescription}
          disabled={savingPrescription}
        >
          {savingPrescription ? "Saving Prescription..." : "Save Prescription"}
        </button>
        <button style={styles.pdfButton} onClick={printPdf}>Download / Print PDF</button>
        <button
          style={{
            ...styles.emailButton,
            ...(emailing ? styles.disabledButton : {}),
          }}
          onClick={emailPrescription}
          disabled={emailing}
        >
          {emailing ? "Emailing PDF..." : "Email Prescription PDF"}
        </button>

        <h2 style={styles.heading}>Prescription History</h2>
        {history.length === 0 && <p style={styles.muted}>No saved prescription history yet.</p>}
        {history.map((h) => (
          <div
            key={h.id || h.prescription_number}
            style={styles.historyRow}
          >
            <b>{h.prescription_number || "Prescription"}</b>
            <span>
              {h.patient_name || "Patient"} ·{" "}
              {h.created_at
                ? new Date(h.created_at).toLocaleDateString("en-ZA")
                : ""}
            </span>
            <span>Status: {h.status || "issued"}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#eef4fb", padding: 18, fontFamily: "Arial, Helvetica, sans-serif", color: "#0f172a" },
  card: { maxWidth: 900, margin: "0 auto", background: "#fff", borderRadius: 28, padding: 28, boxShadow: "0 20px 60px rgba(15,23,42,.12)" },
  back: { color: "#2563eb", fontWeight: 900, textDecoration: "none", fontSize: 18 },
  tabRow: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 },
  tab: { padding: "12px 14px", borderRadius: 14, background: "#e2e8f0", color: "#0f172a", textDecoration: "none", fontWeight: 900 },
  activeTab: { padding: "12px 14px", borderRadius: 14, background: "#f97316", color: "#fff", textDecoration: "none", fontWeight: 900 },
  kicker: { marginTop: 30, color: "#2563eb", fontWeight: 900, fontSize: 18 },
  title: { fontSize: 56, lineHeight: 1, margin: "12px 0", fontWeight: 900 },
  subtitle: { fontSize: 22, color: "#526174", lineHeight: 1.45 },
  notice: { marginTop: 18, background: "#dbeafe", color: "#1e40af", padding: 14, borderRadius: 14, fontWeight: 900 },
  warning: { marginTop: 12, background: "#fff7ed", color: "#9a3412", padding: 14, borderRadius: 14, fontWeight: 800 },
  heading: { fontSize: 34, fontWeight: 900, marginTop: 34, marginBottom: 16 },
  label: { display: "block", fontWeight: 900, marginTop: 14, marginBottom: 6 },
  fieldLabel: { display: "block", fontWeight: 900, marginTop: 10 },
  input: { width: "100%", boxSizing: "border-box", border: "2px solid #cbd5e1", borderRadius: 18, padding: 16, fontSize: 17, marginTop: 10, background: "#fff" },
  textareaSmall: { width: "100%", boxSizing: "border-box", minHeight: 88, border: "2px solid #cbd5e1", borderRadius: 18, padding: 16, fontSize: 17, marginTop: 10 },
  patientCard: { width: "100%", textAlign: "left", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 18, padding: 16, marginTop: 10, display: "grid", gap: 6, fontSize: 17 },
  selected: { marginTop: 14, background: "#dcfce7", color: "#166534", padding: 16, borderRadius: 16, fontWeight: 900, fontSize: 17, display: "grid", gap: 8 },
  changePatientButton: { justifySelf: "start", border: 0, borderRadius: 12, padding: "10px 12px", background: "#166534", color: "#fff", fontWeight: 900, cursor: "pointer" },
  doctorSummary: { display: "grid", gap: 6, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 18, padding: 16, fontSize: 16 },
  smallEditButton: { justifySelf: "start", border: 0, borderRadius: 12, padding: "10px 12px", background: "#e2e8f0", color: "#0f172a", fontWeight: 900 },
  saveDoctorButton: { width: "100%", border: 0, borderRadius: 18, padding: 16, background: "#16a34a", color: "#fff", fontWeight: 900, fontSize: 18, marginTop: 14 },
  muted: { color: "#64748b", fontSize: 17 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  rxCard: { border: "1px solid #cbd5e1", borderRadius: 20, padding: 18, marginBottom: 18, background: "#fbfdff" },
  rxHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  removeButton: { border: 0, borderRadius: 12, padding: "10px 12px", background: "#fee2e2", color: "#991b1b", fontWeight: 900 },
  resultBox: { border: "1px solid #cbd5e1", borderRadius: 16, marginTop: 8, overflow: "hidden", background: "#fff", maxHeight: 260, overflowY: "auto" },
  resultItem: { display: "block", width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #e2e8f0", background: "#fff", padding: 14, fontSize: 15 },
  medSelected: { marginTop: 12, background: "#ecfdf5", color: "#166534", padding: 14, borderRadius: 14, fontWeight: 800 },
  lightButton: { width: "100%", border: 0, borderRadius: 18, padding: 16, background: "#dbeafe", color: "#1d4ed8", fontWeight: 900, fontSize: 18, marginTop: 14 },
  primaryButton: { width: "100%", border: 0, borderRadius: 18, padding: 20, background: "#2563eb", color: "#fff", fontWeight: 900, fontSize: 20, marginTop: 18 },
  pdfButton: { width: "100%", border: 0, borderRadius: 18, padding: 20, background: "#0f172a", color: "#fff", fontWeight: 900, fontSize: 20, marginTop: 14 },
  emailButton: { width: "100%", border: 0, borderRadius: 18, padding: 20, background: "#16a34a", color: "#fff", fontWeight: 900, fontSize: 20, marginTop: 14 },
  disabledButton: { opacity: 0.65, cursor: "not-allowed" },
  canvas: { width: "100%", height: 190, border: "2px dashed #cbd5e1", borderRadius: 18, background: "#fff", touchAction: "none" },
  message: { background: "#e0f2fe", color: "#075985", padding: 14, borderRadius: 14, fontWeight: 800, marginTop: 18 },
  historyRow: { border: "1px solid #cbd5e1", borderRadius: 16, padding: 14, marginTop: 10, display: "grid", gap: 6 },
};
