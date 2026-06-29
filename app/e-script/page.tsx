"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
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
  id?: string;
  first_name?: string;
  surname?: string;
  email?: string;
  mobile?: string;
  hpcsa?: string;
  registration_number?: string;
  practice_number?: string;
  practice_address?: string;
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

export default function EScriptPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);

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

  const [items, setItems] = useState<ScriptItem[]>([newItem()]);
  const [message, setMessage] = useState("");
  const [scriptNumber, setScriptNumber] = useState(`RX-${Date.now()}`);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    loadPatients();
    loadDoctor();
    loadHistory();

    try {
      const raw = Array.isArray(medicineData) ? medicineData : [];
      setMedicines(raw.map(normaliseMedicine).filter((m) => m.brand || m.active || m.nappi));
    } catch {
      setMessage("Medicine file could not be loaded. Confirm medicine.json exists in the project root.");
    } finally {
      setLoadingMeds(false);
    }
  }, []);



  async function loadPatients() {
    const { data, error } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
    if (error) {
      setMessage("Patient load error: " + error.message);
      return;
    }
    setPatients((data || []) as Patient[]);
  }

  async function loadDoctor() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    const profile = data as DoctorProfile | null;

    if (profile) {
      const name = `${profile.first_name || ""} ${profile.surname || ""}`.trim();
      setDoctorName(name ? (name.startsWith("Dr") ? name : `Dr ${name}`) : "Dr");
      setDoctorEmail(profile.email || user.email || "");
      setDoctorMobile(profile.mobile || "");
      setHpcsa(profile.hpcsa || profile.registration_number || "");
      setPracticeNumber(profile.practice_number || "");
      setPracticeAddress(profile.practice_address || "");
      setEditDoctor(!(name && (profile.hpcsa || profile.registration_number) && profile.practice_number));
    } else {
      setDoctorEmail(user.email || "");
      setEditDoctor(true);
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
    setMessage("");
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

  function printPdf() {
    const win = window.open("", "_blank");
    if (!win) {
      setMessage("Popup blocked. Please allow popups to export PDF.");
      return;
    }
    win.document.write(buildPdfHtml());
    win.document.close();
    win.focus();
    win.print();
  }

  async function savePrescription() {
    setMessage("");
    if (!selectedPatient) {
      setMessage("Please select a patient first.");
      return;
    }
    const validItems = items.filter((i) => i.medicine || i.medicineQuery);
    if (validItems.length === 0) {
      setMessage("Please add at least one medicine.");
      return;
    }

    const { error } = await supabase.from("prescriptions").insert({
      prescription_number: scriptNumber,
      patient_id: selectedPatient.id,
      patient_name: patientName(),
      doctor_name: doctorName,
      doctor_hpcsa: hpcsa,
      items: validItems,
      status: "issued",
      pdf_html: buildPdfHtml(),
      issued_at: new Date().toISOString(),
    });

    if (error) {
      setMessage("Prescription generated but save failed: " + error.message);
      return;
    }
    setMessage("Prescription saved.");
    loadHistory();
  }

  function emailPrescription() {
    const subject = encodeURIComponent(`Prescription ${scriptNumber} - ${patientName()}`);
    const body = encodeURIComponent(`Good day,\n\nPlease find prescription ${scriptNumber} for ${patientName()} attached.\n\nThe doctor should export/print the PDF and attach it before sending.\n\nKind regards,\n${doctorName}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
        <input style={styles.input} value={patientSearch} placeholder="Search existing patient by name, ID or mobile" onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }} />
        {filteredPatients.map((p) => <button key={p.id} style={styles.patientCard} onClick={() => selectPatient(p)}><b>{patientName(p)}</b><span>{p.id_number || p.patient_id || "No ID"} · {p.gender || "Gender not captured"} · {p.mobile || "No mobile"}</span></button>)}
        {patientSearch && !selectedPatient && filteredPatients.length === 0 && <p style={styles.muted}>No matching patient found.</p>}
        {selectedPatient && <div style={styles.selected}>Selected: {patientName()} · ID: {selectedPatient.id_number || selectedPatient.patient_id || "Not captured"}</div>}

        <h2 style={styles.heading}>Doctor</h2>
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
        <button style={styles.lightButton} onClick={addItem}>+ Add Medicine</button>

        <h2 style={styles.heading}>Doctor Signature</h2>
        <canvas ref={canvasRef} width={700} height={220} style={styles.canvas} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
        <button style={styles.lightButton} onClick={clearSignature}>Clear Signature</button>

        {message && <div style={styles.message}>{message}</div>}
        <button style={styles.primaryButton} onClick={savePrescription}>Save Prescription</button>
        <button style={styles.pdfButton} onClick={printPdf}>Download / Print PDF</button>
        <button style={styles.emailButton} onClick={emailPrescription}>Email Prescription</button>

        <h2 style={styles.heading}>Prescription History</h2>
        {history.length === 0 && <p style={styles.muted}>No saved prescription history yet.</p>}
        {history.map((h) => <div key={h.id || h.prescription_number} style={styles.historyRow}><b>{h.prescription_number || "Prescription"}</b><span>{h.patient_name || "Patient"} · {h.created_at ? new Date(h.created_at).toLocaleDateString() : ""}</span></div>)}
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
  selected: { marginTop: 14, background: "#dcfce7", color: "#166534", padding: 16, borderRadius: 16, fontWeight: 900, fontSize: 17 },
  doctorSummary: { display: "grid", gap: 6, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 18, padding: 16, fontSize: 16 },
  smallEditButton: { justifySelf: "start", border: 0, borderRadius: 12, padding: "10px 12px", background: "#e2e8f0", color: "#0f172a", fontWeight: 900 },
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
  canvas: { width: "100%", height: 190, border: "2px dashed #cbd5e1", borderRadius: 18, background: "#fff", touchAction: "none" },
  message: { background: "#e0f2fe", color: "#075985", padding: 14, borderRadius: 14, fontWeight: 800, marginTop: 18 },
  historyRow: { border: "1px solid #cbd5e1", borderRadius: 16, padding: 14, marginTop: 10, display: "grid", gap: 6 },
};
