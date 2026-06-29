"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

const icd10List = [
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified" },
  { code: "J11.1", description: "Influenza with other respiratory manifestations" },
  { code: "A09.9", description: "Gastroenteritis and colitis, unspecified" },
  { code: "M54.5", description: "Low back pain" },
  { code: "R51", description: "Headache" },
  { code: "R50.9", description: "Fever, unspecified" },
  { code: "Z76.9", description: "Person encountering health services in unspecified circumstances" },
];

export default function SickNotePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);

  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [employerEmail, setEmployerEmail] = useState("");
  const [patientEmail, setPatientEmail] = useState("");

  const [doctorName, setDoctorName] = useState("Dr");
  const [hpcsa, setHpcsa] = useState("");
  const [practiceNumber, setPracticeNumber] = useState("");

  const [dateSeen, setDateSeen] = useState(new Date().toISOString().slice(0, 10));
  const [unfitFrom, setUnfitFrom] = useState("");
  const [unfitUntil, setUnfitUntil] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [selectedDiagnosis, setSelectedDiagnosis] = useState("");
  const [comments, setComments] = useState("");
  const [message, setMessage] = useState("");

  const filteredIcd = icd10List.filter((i) =>
    `${i.code} ${i.description}`.toLowerCase().includes(diagnosis.toLowerCase())
  );

  const returnDate = unfitUntil
    ? new Date(new Date(unfitUntil).getTime() + 86400000).toISOString().slice(0, 10)
    : "";

  function startDraw(e: any) {
    setDrawing(true);
    draw(e);
  }

  function stopDraw() {
    setDrawing(false);
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.beginPath();
  }

  function draw(e: any) {
    if (!drawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function saveCertificate() {
    const signature = canvasRef.current?.toDataURL("image/png") || "";

    const certificateNumber = `CS-${Date.now()}`;

    const { error } = await supabase.from("medical_certificates").insert({
      certificate_number: certificateNumber,
      employer_email: employerEmail,
      patient_email: patientEmail,
      diagnosis_code: selectedDiagnosis.split("|")[0]?.trim(),
      diagnosis_description: selectedDiagnosis.split("|")[1]?.trim(),
      date_seen: dateSeen,
      unfit_from: unfitFrom,
      unfit_until: unfitUntil,
      return_to_work: returnDate,
      comments,
      doctor_signature: signature,
      pdf_generated: true,
      emailed_to_employer: false,
    });

    if (error) {
      setMessage("Save failed: " + error.message);
      return;
    }

    setMessage("Sick note saved successfully.");
  }

  function printPdf() {
    window.print();
  }

  function emailPdf() {
    const subject = encodeURIComponent(`Medical Certificate - ${patientName}`);
    const body = encodeURIComponent(
      `Good day,

Please find below the medical certificate details.

Patient: ${patientName}
ID Number: ${patientId}
Seen by: ${doctorName}
Date seen: ${dateSeen}

Unfit from: ${unfitFrom}
Until: ${unfitUntil}
Return to work/school: ${returnDate}

Diagnosis: ${selectedDiagnosis}
Comments: ${comments}

Please note: The doctor must export/print the PDF and attach it to this email.

Kind regards,
${doctorName}`
    );

    window.location.href = `mailto:${employerEmail}?cc=${patientEmail}&subject=${subject}&body=${body}`;
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/dashboard" style={styles.back}>← Back to Dashboard</Link>

        <p style={styles.kicker}>CareScriber AI</p>
        <h1 style={styles.title}>Sick Note</h1>
        <p style={styles.subtitle}>
          Create a medical certificate with ICD-10 diagnosis, doctor signature,
          PDF export and email to employer with patient copied.
        </p>

        <h2 style={styles.heading}>Patient Details</h2>

        <input style={styles.input} placeholder="Patient full name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
        <input style={styles.input} placeholder="Patient ID number" value={patientId} onChange={(e) => setPatientId(e.target.value)} />
        <input style={styles.input} placeholder="Employer email" value={employerEmail} onChange={(e) => setEmployerEmail(e.target.value)} />
        <input style={styles.input} placeholder="Patient email for CC" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} />

        <h2 style={styles.heading}>Doctor Details</h2>

        <input style={styles.input} placeholder="Doctor name" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
        <input style={styles.input} placeholder="HPCSA number" value={hpcsa} onChange={(e) => setHpcsa(e.target.value)} />
        <input style={styles.input} placeholder="Practice number" value={practiceNumber} onChange={(e) => setPracticeNumber(e.target.value)} />

        <h2 style={styles.heading}>Medical Certificate</h2>

        <label style={styles.label}>Date seen</label>
        <input style={styles.input} type="date" value={dateSeen} onChange={(e) => setDateSeen(e.target.value)} />

        <label style={styles.label}>Unfit from</label>
        <input style={styles.input} type="date" value={unfitFrom} onChange={(e) => setUnfitFrom(e.target.value)} />

        <label style={styles.label}>Up to and including</label>
        <input style={styles.input} type="date" value={unfitUntil} onChange={(e) => setUnfitUntil(e.target.value)} />

        {returnDate && (
          <div style={styles.info}>Return to work/school: {returnDate}</div>
        )}

        <h2 style={styles.heading}>Diagnosis</h2>

        <input
          style={styles.input}
          placeholder="Search ICD-10 code or diagnosis"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
        />

        {diagnosis && (
          <div style={styles.icdBox}>
            {filteredIcd.map((item) => (
              <button
                key={item.code}
                style={styles.icdItem}
                onClick={() => {
                  setSelectedDiagnosis(`${item.code} | ${item.description}`);
                  setDiagnosis(`${item.code} | ${item.description}`);
                }}
              >
                {item.code} | {item.description}
              </button>
            ))}
          </div>
        )}

        <textarea
          style={styles.textarea}
          placeholder="Additional comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />

        <h2 style={styles.heading}>Doctor Digital Signature</h2>

        <canvas
          ref={canvasRef}
          width={600}
          height={220}
          style={styles.canvas}
          onMouseDown={startDraw}
          onMouseUp={stopDraw}
          onMouseMove={draw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchEnd={stopDraw}
          onTouchMove={draw}
        />

        <button style={styles.lightButton} onClick={clearSignature}>Clear Signature</button>

        <div style={styles.preview}>
          <h2>Medical Certificate Preview</h2>
          <p>
            This is to certify that <strong>{patientName || "[Patient Name]"}</strong> was
            examined by me, <strong>{doctorName}</strong>, on <strong>{dateSeen}</strong>.
          </p>
          <p>
            He/she has been unfit for work/school from <strong>{unfitFrom || "[date]"}</strong>{" "}
            up to and including <strong>{unfitUntil || "[date]"}</strong>.
          </p>
          {returnDate && <p>Return to work/school: <strong>{returnDate}</strong></p>}
          <p>Diagnosis: <strong>{selectedDiagnosis || diagnosis || "[ICD-10 diagnosis]"}</strong></p>
          <p>Comments: {comments || "None"}</p>
          <p>Doctor: {doctorName}</p>
          <p>HPCSA: {hpcsa || "Not captured"}</p>
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
    background: "#fff",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 20px 60px rgba(15,23,42,.12)",
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
    fontSize: 52,
    lineHeight: 1,
    margin: "12px 0",
    fontWeight: 900,
  },
  subtitle: {
    fontSize: 22,
    color: "#526174",
    lineHeight: 1.45,
  },
  heading: {
    fontSize: 32,
    fontWeight: 900,
    marginTop: 32,
  },
  label: {
    display: "block",
    fontWeight: 800,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "2px solid #cbd5e1",
    borderRadius: 18,
    padding: 18,
    fontSize: 18,
    marginTop: 12,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 130,
    border: "2px solid #cbd5e1",
    borderRadius: 18,
    padding: 18,
    fontSize: 18,
    marginTop: 16,
  },
  info: {
    background: "#dcfce7",
    color: "#166534",
    padding: 14,
    borderRadius: 14,
    fontWeight: 900,
    marginTop: 16,
  },
  icdBox: {
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    marginTop: 8,
    overflow: "hidden",
  },
  icdItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: 14,
    background: "#fff",
    border: 0,
    borderBottom: "1px solid #e2e8f0",
    fontSize: 16,
  },
  canvas: {
    width: "100%",
    height: 180,
    border: "2px dashed #cbd5e1",
    borderRadius: 18,
    background: "#fff",
    touchAction: "none",
  },
  preview: {
    marginTop: 28,
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: 18,
    padding: 20,
    fontSize: 17,
    lineHeight: 1.6,
  },
  lightButton: {
    width: "100%",
    border: 0,
    borderRadius: 18,
    padding: 16,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 900,
    fontSize: 18,
    marginTop: 14,
  },
  primaryButton: {
    width: "100%",
    border: 0,
    borderRadius: 18,
    padding: 20,
    background: "#2563eb",
    color: "#fff",
    fontWeight: 900,
    fontSize: 20,
    marginTop: 18,
  },
  pdfButton: {
    width: "100%",
    border: 0,
    borderRadius: 18,
    padding: 20,
    background: "#0f172a",
    color: "#fff",
    fontWeight: 900,
    fontSize: 20,
    marginTop: 14,
  },
  emailButton: {
    width: "100%",
    border: 0,
    borderRadius: 18,
    padding: 20,
    background: "#16a34a",
    color: "#fff",
    fontWeight: 900,
    fontSize: 20,
    marginTop: 14,
  },
  message: {
    background: "#e0f2fe",
    color: "#075985",
    padding: 14,
    borderRadius: 14,
    fontWeight: 800,
    marginTop: 18,
  },
};
