"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
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
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified" },
  { code: "J11.1", description: "Influenza with other respiratory manifestations" },
  { code: "A09.9", description: "Gastroenteritis and colitis, unspecified" },
  { code: "M54.5", description: "Low back pain" },
  { code: "R51", description: "Headache" },
  { code: "R50.9", description: "Fever, unspecified" },
  { code: "Z76.9", description: "Person encountering health services in unspecified circumstances" },
  { code: "K52.9", description: "Noninfective gastroenteritis and colitis, unspecified" },
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  { code: "M79.1", description: "Myalgia" },
];

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

  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [employerEmail, setEmployerEmail] = useState("");

  const [doctorName, setDoctorName] = useState("Dr");
  const [hpcsa, setHpcsa] = useState("");
  const [practiceNumber, setPracticeNumber] = useState("");
  const [practiceAddress, setPracticeAddress] = useState("");

  const [dateSeen, setDateSeen] = useState(today());
  const [unfitFrom, setUnfitFrom] = useState(today());
  const [unfitUntil, setUnfitUntil] = useState(today());

  const [diagnosisSearch, setDiagnosisSearch] = useState("");
  const [selectedDiagnosis, setSelectedDiagnosis] = useState("");
  const [comments, setComments] = useState("");
  const [message, setMessage] = useState("");
  const [certificateNumber, setCertificateNumber] = useState(`CS-${Date.now()}`);

  useEffect(() => {
    loadPatients();
    loadDoctor();
  }, []);

  async function loadPatients() {
    const { data, error } = await supabase.from("patients").select("*");
    if (error) {
      setMessage("Could not load patients: " + error.message);
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
      if (name) setDoctorName(name.startsWith("Dr") ? name : `Dr ${name}`);
      setHpcsa(profile.hpcsa || profile.registration_number || "");
      setPracticeNumber(profile.practice_number || "");
      setPracticeAddress(profile.practice_address || "");
    }
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

  const filteredIcd = useMemo(() => {
    const q = diagnosisSearch.trim().toLowerCase();
    if (!q) return icd10List;
    return icd10List.filter((i) => `${i.code} ${i.description}`.toLowerCase().includes(q));
  }, [diagnosisSearch]);

  const returnDate = addOneDay(unfitUntil);

  function selectPatient(patient: Patient) {
    const name = `${patient.first_name || ""} ${patient.surname || patient.last_name || ""}`.trim();
    setSelectedPatient(patient);
    setPatientSearch(name);
    setPatientName(name);
    setPatientId(patient.id_number || patient.patient_id || "");
    setPatientEmail(patient.email || "");
    setMessage("");
  }

  function clearPatient() {
    setSelectedPatient(null);
    setPatientSearch("");
    setPatientName("");
    setPatientId("");
    setPatientEmail("");
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
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.beginPath();
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function signatureDataUrl() {
    return canvasRef.current?.toDataURL("image/png") || "";
  }

  function certificateHtml() {
    const signature = signatureDataUrl();
    const diagnosis = selectedDiagnosis || diagnosisSearch || "Not specified";
    return `
      <html><head><title>CareScriber Medical Certificate</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; padding: 36px; line-height: 1.55; }
        .header { border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 24px; }
        h1 { color: #1d4ed8; margin: 0; font-size: 28px; }
        .small { color: #475569; font-size: 13px; }
        .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; margin: 18px 0; }
        .row { margin: 8px 0; }
        .label { font-weight: bold; }
        .signature { margin-top: 30px; }
        img { max-width: 240px; border-bottom: 1px solid #0f172a; }
        .footer { margin-top: 30px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
      </style></head><body>
        <div class="header"><h1>CareScriber Medical Certificate</h1><div class="small">Certificate No: ${escapeHtml(certificateNumber)}</div><div class="small">Issued: ${new Date().toLocaleString()}</div></div>
        <div class="box"><div class="row"><span class="label">Patient:</span> ${escapeHtml(patientName || "Not captured")}</div><div class="row"><span class="label">ID / Passport:</span> ${escapeHtml(patientId || "Not captured")}</div></div>
        <p>This is to certify that <strong>${escapeHtml(patientName || "[Patient Name]")}</strong> was examined by me on <strong>${escapeHtml(dateSeen)}</strong>.</p>
        <p>In my clinical opinion, the patient is unfit for work/school from <strong>${escapeHtml(unfitFrom || "[date]")}</strong> up to and including <strong>${escapeHtml(unfitUntil || "[date]")}</strong>.</p>
        <p>The patient may return to work/school on <strong>${escapeHtml(returnDate || "[date]")}</strong>, subject to clinical recovery.</p>
        <div class="box"><div class="row"><span class="label">ICD-10 / Diagnosis:</span> ${escapeHtml(diagnosis)}</div><div class="row"><span class="label">Comments:</span> ${escapeHtml(comments || "None")}</div></div>
        <div class="box"><div class="row"><span class="label">Doctor:</span> ${escapeHtml(doctorName || "Dr")}</div><div class="row"><span class="label">HPCSA / Registration:</span> ${escapeHtml(hpcsa || "Not captured")}</div><div class="row"><span class="label">Practice Number:</span> ${escapeHtml(practiceNumber || "Not captured")}</div><div class="row"><span class="label">Practice Address:</span> ${escapeHtml(practiceAddress || "Not captured")}</div></div>
        <div class="signature">${signature ? `<img src="${signature}" />` : "<p>Signature not captured</p>"}<p><strong>Doctor Signature</strong></p></div>
        <div class="footer">This certificate was generated electronically through CareScriber. Employer verification should confirm certificate number, doctor details and issue date only. Clinical details remain confidential.</div>
      </body></html>`;
  }

  function printPdf() {
    const ok = downloadHtmlFile(`${certificateNumber}.html`, certificateHtml());
    if (ok) {
      setMessage("Sick note file downloaded. Open it from Downloads/Files and use Share or Print to save as PDF on iPhone.");
    } else {
      setMessage("Could not create sick note file. Please try Safari/Chrome or update iOS browser settings.");
    }
  }

  async function saveCertificate() {
    setMessage("");
    if (!patientName || !patientId) return setMessage("Please capture patient name and ID number.");
    if (!selectedDiagnosis && !diagnosisSearch) return setMessage("Please select or enter diagnosis.");

    const diagnosisText = selectedDiagnosis || diagnosisSearch;
    const code = diagnosisText.includes("|") ? diagnosisText.split("|")[0].trim() : "";
    const desc = diagnosisText.includes("|") ? diagnosisText.split("|")[1].trim() : diagnosisText;

    const { error } = await supabase.from("medical_certificates").insert({
      certificate_number: certificateNumber,
      patient_id: selectedPatient?.id || null,
      employer_email: employerEmail,
      patient_email: patientEmail,
      diagnosis_code: code,
      diagnosis_description: desc,
      date_seen: dateSeen,
      unfit_from: unfitFrom,
      unfit_until: unfitUntil,
      return_to_work: returnDate,
      comments,
      doctor_signature: signatureDataUrl(),
      pdf_generated: true,
      emailed_to_employer: false,
    });

    if (error) return setMessage("Save failed: " + error.message);
    setMessage("Sick note saved successfully.");
  }

  function emailPdf() {
    const diagnosisText = selectedDiagnosis || diagnosisSearch || "Not specified";
    const subject = encodeURIComponent(`Medical Certificate - ${patientName}`);
    const body = encodeURIComponent(`Good day,\n\nPlease find the medical certificate details below.\n\nPatient: ${patientName}\nID Number: ${patientId}\nDate seen: ${dateSeen}\nUnfit from: ${unfitFrom}\nUntil: ${unfitUntil}\nReturn date: ${returnDate}\n\nDiagnosis / ICD-10: ${diagnosisText}\nComments: ${comments || "None"}\n\nDoctor: ${doctorName}\nHPCSA / Registration: ${hpcsa || "Not captured"}\nPractice Number: ${practiceNumber || "Not captured"}\n\nCertificate Number: ${certificateNumber}\n\nPlease note: The doctor should export/print the certificate PDF and attach it to this email before sending.\n\nKind regards,\n${doctorName}`);
    window.location.href = `mailto:${employerEmail}?cc=${patientEmail}&subject=${subject}&body=${body}`;
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

        <h2 style={styles.heading}>Find Patient</h2>
        <input style={styles.input} placeholder="Search patient by name, surname, ID or mobile" value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatient(null); }} />

        {patientSearch && !selectedPatient && filteredPatients.length === 0 && <p style={styles.muted}>No matching patient found. You can still type details manually below.</p>}

        {filteredPatients.map((p) => (
          <button key={p.id} style={styles.patientCard} onClick={() => selectPatient(p)}>
            <strong>{p.first_name} {p.surname || p.last_name}</strong>
            <span>ID: {p.id_number || p.patient_id || "N/A"} · {p.mobile || "No mobile"}</span>
          </button>
        ))}

        {selectedPatient && <div style={styles.selected}>Selected: {patientName} · ID: {patientId}<button type="button" onClick={clearPatient} style={styles.clearSmall}>Change Patient</button></div>}

        <h2 style={styles.heading}>Patient Details</h2>
        <input style={styles.input} placeholder="Patient full name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
        <input style={styles.input} placeholder="Patient ID / passport number" value={patientId} onChange={(e) => setPatientId(e.target.value)} />
        <input style={styles.input} placeholder="Employer email" value={employerEmail} onChange={(e) => setEmployerEmail(e.target.value)} />
        <input style={styles.input} placeholder="Patient email for CC" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} />

        <h2 style={styles.heading}>Doctor Details</h2>
        <input style={styles.input} placeholder="Doctor name" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
        <input style={styles.input} placeholder="HPCSA / registration number" value={hpcsa} onChange={(e) => setHpcsa(e.target.value)} />
        <input style={styles.input} placeholder="Practice number" value={practiceNumber} onChange={(e) => setPracticeNumber(e.target.value)} />
        <textarea style={styles.textareaSmall} placeholder="Practice address" value={practiceAddress} onChange={(e) => setPracticeAddress(e.target.value)} />

        <h2 style={styles.heading}>Medical Leave</h2>
        <label style={styles.label}>Date seen</label>
        <input style={styles.input} type="date" value={dateSeen} onChange={(e) => setDateSeen(e.target.value)} />
        <label style={styles.label}>Unfit from</label>
        <input style={styles.input} type="date" value={unfitFrom} onChange={(e) => setUnfitFrom(e.target.value)} />
        <label style={styles.label}>Up to and including</label>
        <input style={styles.input} type="date" value={unfitUntil} onChange={(e) => setUnfitUntil(e.target.value)} />
        {returnDate && <div style={styles.info}>Return to work/school: {returnDate}</div>}

        <h2 style={styles.heading}>Diagnosis / ICD-10</h2>
        <input style={styles.input} placeholder="Search ICD-10 code or diagnosis" value={diagnosisSearch} onChange={(e) => { setDiagnosisSearch(e.target.value); setSelectedDiagnosis(""); }} />
        {diagnosisSearch && <div style={styles.icdBox}>{filteredIcd.map((item) => <button key={item.code} type="button" style={styles.icdItem} onClick={() => { const value = `${item.code} | ${item.description}`; setSelectedDiagnosis(value); setDiagnosisSearch(value); }}>{item.code} | {item.description}</button>)}</div>}
        <textarea style={styles.textarea} placeholder="Additional comments" value={comments} onChange={(e) => setComments(e.target.value)} />

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
          <p>HPCSA / Registration: {hpcsa || "Not captured"}</p>
          <p>Practice No: {practiceNumber || "Not captured"}</p>
        </div>

        {message && <div style={styles.message}>{message}</div>}
        <button style={styles.primaryButton} onClick={saveCertificate}>Save Sick Note</button>
        <button style={styles.pdfButton} onClick={printPdf}>Export / Print PDF</button>
        <button style={styles.emailButton} onClick={emailPdf}>Email to Employer and CC Patient</button>
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
  info: { background: "#dcfce7", color: "#166534", padding: 14, borderRadius: 14, fontWeight: 900, marginTop: 16 },
  icdBox: { border: "1px solid #cbd5e1", borderRadius: 16, marginTop: 8, overflow: "hidden" },
  icdItem: { display: "block", width: "100%", textAlign: "left", padding: 14, background: "#fff", border: 0, borderBottom: "1px solid #e2e8f0", fontSize: 16 },
  canvas: { width: "100%", height: 190, border: "2px dashed #cbd5e1", borderRadius: 18, background: "#fff", touchAction: "none" },
  preview: { marginTop: 28, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 18, padding: 20, fontSize: 17, lineHeight: 1.6 },
  lightButton: { width: "100%", border: 0, borderRadius: 18, padding: 16, background: "#dbeafe", color: "#1d4ed8", fontWeight: 900, fontSize: 18, marginTop: 14 },
  primaryButton: { width: "100%", border: 0, borderRadius: 18, padding: 20, background: "#2563eb", color: "#fff", fontWeight: 900, fontSize: 20, marginTop: 18 },
  pdfButton: { width: "100%", border: 0, borderRadius: 18, padding: 20, background: "#0f172a", color: "#fff", fontWeight: 900, fontSize: 20, marginTop: 14 },
  emailButton: { width: "100%", border: 0, borderRadius: 18, padding: 20, background: "#16a34a", color: "#fff", fontWeight: 900, fontSize: 20, marginTop: 14 },
  message: { background: "#e0f2fe", color: "#075985", padding: 14, borderRadius: 14, fontWeight: 800, marginTop: 18 },
};
