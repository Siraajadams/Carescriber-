from pathlib import Path
import re

src = Path("/mnt/data/Pasted text(20260812-194449).txt")
code = src.read_text()

# 1) Expand Patient type with weight and address fields.
old_patient = """type Patient = {
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
};"""

new_patient = """type Patient = {
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

  // Weight fields - supports the common field names already used across CareScriber.
  current_weight?: number | string | null;
  weight_kg?: number | string | null;
  weight?: number | string | null;
  weight_updated_at?: string | null;
  weight_recorded_at?: string | null;
  weight_date?: string | null;

  // Address fields - supports both a single stored address and split address fields.
  physical_address?: string | null;
  address?: string | null;
  postal_address?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  suburb?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
};"""

if old_patient not in code:
    raise RuntimeError("Patient type block not found")
code = code.replace(old_patient, new_patient)

# 2) Add formatting / patient detail helpers after today().
old_today = """function today() {
  return new Date().toISOString().slice(0, 10);
}
"""

new_today = """function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value = new Date()) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

function getPatientWeight(patient?: Patient | null) {
  if (!patient) return "";

  const raw =
    patient.current_weight ??
    patient.weight_kg ??
    patient.weight ??
    "";

  if (raw === "" || raw === null || raw === undefined) return "";

  const value = String(raw).trim();
  if (!value) return "";

  return /kg$/i.test(value) ? value : `${value} kg`;
}

function getPatientWeightDate(patient?: Patient | null) {
  if (!patient) return "";

  return formatDate(
    patient.weight_updated_at ||
      patient.weight_recorded_at ||
      patient.weight_date ||
      ""
  );
}

function getPatientAddress(patient?: Patient | null) {
  if (!patient) return "";

  const direct =
    patient.physical_address ||
    patient.address ||
    patient.postal_address;

  if (direct?.trim()) return direct.trim();

  return [
    patient.address_line_1,
    patient.address_line_2,
    patient.suburb,
    patient.city,
    patient.province,
    patient.postal_code,
  ]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function getMedicationQuantity(item: ScriptItem) {
  return (
    item.medicine?.quantity ||
    item.medicine?.pack_size ||
    item.dosage ||
    ""
  );
}
"""

if old_today not in code:
    raise RuntimeError("today() block not found")
code = code.replace(old_today, new_today)

# 3) Replace buildPdfHtml() with a compact clinical format.
pattern_html = re.compile(r"  function buildPdfHtml\(\) \{.*?\n  \}\n\n  function generatePrescriptionPdfBlob\(\)", re.S)
match = pattern_html.search(code)
if not match:
    raise RuntimeError("buildPdfHtml block not found")

new_build_html = r'''  function buildPdfHtml() {
    const p = selectedPatient;
    const pName = patientName() || "Patient not selected";
    const dob = clean(p?.date_of_birth || p?.dob);
    const age = calcAge(dob, p?.age);
    const signature = signatureDataUrl();
    const weight = getPatientWeight(p);
    const weightDate = getPatientWeightDate(p);
    const address = getPatientAddress(p);
    const issuedAt = formatDateTime(new Date());

    const rows = items
      .map((item) => {
        const med = item.medicine;
        const strength = [med?.strength, med?.unit].filter(Boolean).join(" ");
        const medicineTitle = [
          med?.brand || item.medicineQuery || "",
          strength,
          item.form || med?.form || "",
        ]
          .filter(Boolean)
          .join(" - ");

        const directions = [
          `${item.dosage} ${item.form || med?.form || ""}`.trim(),
          item.frequency,
          item.timing,
          item.duration ? `for ${item.duration} day${item.duration === "1" ? "" : "s"}` : "",
        ]
          .filter(Boolean)
          .join(", ");

        const extra = [
          `Repeats: ${item.repeats}`,
          item.substitution,
          item.notes,
        ]
          .filter(Boolean)
          .join(" · ");

        return `<tr>
          <td class="icd"><b>${escapeHtml(item.icdCode || "")}</b>${
            item.icdDescription
              ? `<div class="small">${escapeHtml(item.icdDescription)}</div>`
              : ""
          }</td>
          <td class="med">
            <b>${escapeHtml(medicineTitle)}</b>
            <div>${escapeHtml(directions)}</div>
            ${extra ? `<div class="small">${escapeHtml(extra)}</div>` : ""}
          </td>
          <td class="qty">${escapeHtml(getMedicationQuantity(item))}</td>
        </tr>`;
      })
      .join("");

    return `<!doctype html>
<html>
<head>
  <title>${escapeHtml(scriptNumber)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px}
    .header{text-align:center;border-bottom:1px solid #bbb;padding-bottom:10px}
    .brand{font-size:23px;font-weight:800}
    .brand span{color:#15803d}
    .practice-no{margin-top:3px;color:#444}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:12px}
    .block-title{font-weight:700;font-size:13px;margin-bottom:5px}
    .line{line-height:1.45}
    .rx-title{text-align:center;font-size:16px;font-weight:700;margin:12px 0 2px}
    .rx-date{text-align:right;font-size:11px;margin-bottom:7px}
    .patient{width:100%;border-collapse:collapse;background:#f6f6f6}
    .patient td{padding:5px 7px;vertical-align:top}
    .patient .label{width:16%;color:#555}
    .patient .value{width:34%;font-weight:600}
    .address{white-space:pre-line}
    .rx{width:100%;border-collapse:collapse;margin-top:10px}
    .rx th{background:#f0f0f0;border-bottom:1px solid #777;text-align:left;padding:6px}
    .rx td{border-bottom:1px solid #ddd;padding:7px 6px;vertical-align:top}
    .rx .icd{width:18%}.rx .med{width:70%}.rx .qty{width:12%;text-align:center}
    .small{font-size:10px;color:#555;margin-top:2px}
    .end{margin-top:7px;font-size:11px}
    .signature{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:end}
    .signature img{max-width:190px;max-height:70px}
    .sig-line{border-top:1px solid #222;padding-top:5px;max-width:220px}
    .footer{position:fixed;bottom:18px;left:24px;right:24px;border-top:1px solid #ddd;padding-top:6px;font-size:9px;color:#666;display:flex;justify-content:space-between}
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Care<span>Scriber</span></div>
    <div class="practice-no">Practice number: ${escapeHtml(practiceNumber || "Not captured")}</div>
  </div>

  <div class="two-col">
    <div>
      <div class="block-title">Practice details</div>
      <div class="line">${escapeHtml(practiceAddress || "Practice address not captured")}</div>
      <div class="line">${escapeHtml(doctorMobile || "")}</div>
      <div class="line">${escapeHtml(doctorEmail || "")}</div>
    </div>
    <div>
      <div class="block-title">Treating provider</div>
      <div class="line"><b>${escapeHtml(doctorName)}</b></div>
      <div class="line">HPCSA / Council No: ${escapeHtml(hpcsa || "Not captured")}</div>
      <div class="line">Practice No: ${escapeHtml(practiceNumber || "Not captured")}</div>
    </div>
  </div>

  <div class="rx-title">Prescription</div>
  <div class="rx-date">${escapeHtml(issuedAt)} · Script ${escapeHtml(scriptNumber)}</div>

  <table class="patient">
    <tbody>
      <tr>
        <td class="label">Patient</td>
        <td class="value">${escapeHtml(pName)}</td>
        <td class="label">Medical aid</td>
        <td class="value">${escapeHtml(clean(p?.medical_aid) || "Not captured")}</td>
      </tr>
      <tr>
        <td class="label">DOB / Age</td>
        <td class="value">${escapeHtml(dob ? `${formatDate(dob)} / ${age || ""}` : String(age || "Not captured"))}</td>
        <td class="label">Member no.</td>
        <td class="value">${escapeHtml(clean(p?.medical_aid_number) || "Not captured")}</td>
      </tr>
      <tr>
        <td class="label">ID / Passport</td>
        <td class="value">${escapeHtml(p?.id_number || p?.patient_id || "Not captured")}</td>
        <td class="label">Current weight</td>
        <td class="value">${escapeHtml(weight || "Not captured")}${
          weightDate ? ` <span class="small">(updated ${escapeHtml(weightDate)})</span>` : ""
        }</td>
      </tr>
      <tr>
        <td class="label">Contact no.</td>
        <td class="value">${escapeHtml(clean(p?.mobile) || "Not captured")}</td>
        <td class="label">Gender</td>
        <td class="value">${escapeHtml(clean(p?.gender) || "Not captured")}</td>
      </tr>
      <tr>
        <td class="label">Patient address</td>
        <td class="value address" colspan="3">${escapeHtml(address || "Not captured")}</td>
      </tr>
    </tbody>
  </table>

  <table class="rx">
    <thead>
      <tr>
        <th>Diagnosis / ICD-10</th>
        <th>Description / Directions</th>
        <th>Quantity</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="end">End of prescription · ${items.length} item(s)</div>

  <div class="signature">
    <div>
      ${signature ? `<img src="${signature}" alt="Doctor signature" />` : ""}
      <div class="sig-line"><b>${escapeHtml(doctorName)}</b><br/>HPCSA / Council: ${escapeHtml(hpcsa || "Not captured")}</div>
    </div>
    <div class="small">
      This prescription must be clinically checked and signed by the prescriber before dispensing.
    </div>
  </div>

  <div class="footer">
    <span>CareScriber Electronic Prescription · ${escapeHtml(scriptNumber)}</span>
    <span>Page 1</span>
  </div>
</body>
</html>`;
  }

  function generatePrescriptionPdfBlob()'''

code = code[:match.start()] + new_build_html + code[match.end():]

# 4) Replace generatePrescriptionPdfBlob() with a compact A4 portrait layout.
pattern_pdf = re.compile(r"  function generatePrescriptionPdfBlob\(\) \{.*?\n  \}\n\n  async function printPdf\(\)", re.S)
match = pattern_pdf.search(code)
if not match:
    raise RuntimeError("generatePrescriptionPdfBlob block not found")

new_pdf = r'''  function generatePrescriptionPdfBlob() {
    const patient = selectedPatient;
    const patientFullName = patientName() || "Patient not selected";
    const dob = clean(patient?.date_of_birth || patient?.dob);
    const age = calcAge(dob, patient?.age);
    const signature = signatureDataUrl();
    const weight = getPatientWeight(patient);
    const weightDate = getPatientWeightDate(patient);
    const address = getPatientAddress(patient);
    const issuedAt = formatDateTime(new Date());

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const right = pageWidth - margin;
    const footerY = pageHeight - 10;

    function setText(fontSize = 9, bold = false, color = 25) {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(fontSize);
      pdf.setTextColor(color);
    }

    function drawFooter(pageNo: number) {
      pdf.setDrawColor(210);
      pdf.line(margin, pageHeight - 15, right, pageHeight - 15);
      setText(7.5, false, 100);
      pdf.text(
        `CareScriber Electronic Prescription · ${scriptNumber}`,
        margin,
        footerY
      );
      pdf.text(`Page ${pageNo}`, right, footerY, { align: "right" });
    }

    function startNewPage() {
      drawFooter(pdf.getNumberOfPages());
      pdf.addPage();
      return 18;
    }

    function ensureSpace(y: number, required = 20) {
      return y + required > pageHeight - 20 ? startNewPage() : y;
    }

    function textInCell(
      value: string,
      x: number,
      y: number,
      width: number,
      options?: { bold?: boolean; size?: number; color?: number }
    ) {
      setText(
        options?.size ?? 8.5,
        options?.bold ?? false,
        options?.color ?? 30
      );
      const lines = pdf.splitTextToSize(value || "Not captured", width);
      pdf.text(lines, x, y);
      return lines.length;
    }

    // Header
    let y = 14;
    setText(19, true, 20);
    pdf.text("CareScriber", pageWidth / 2, y, { align: "center" });
    y += 5;

    setText(8.5, false, 80);
    pdf.text(
      `Practice number: ${practiceNumber || "Not captured"}`,
      pageWidth / 2,
      y,
      { align: "center" }
    );
    y += 5;

    pdf.setDrawColor(175);
    pdf.line(margin, y, right, y);
    y += 6;

    // Practice / treating provider header in two columns.
    const colGap = 8;
    const colWidth = (contentWidth - colGap) / 2;
    const leftX = margin;
    const rightX = margin + colWidth + colGap;
    const headerTop = y;

    setText(9.5, true);
    pdf.text("Practice details", leftX, y);
    pdf.text("Treating provider", rightX, y);
    y += 4.5;

    setText(8.2, false);
    const practiceLines = pdf.splitTextToSize(
      [practiceAddress, doctorMobile, doctorEmail].filter(Boolean).join("\n") ||
        "Practice details not captured",
      colWidth
    );
    pdf.text(practiceLines, leftX, y);

    const providerLines = pdf.splitTextToSize(
      [
        doctorName,
        `HPCSA / Council No: ${hpcsa || "Not captured"}`,
        `Practice No: ${practiceNumber || "Not captured"}`,
      ].join("\n"),
      colWidth
    );
    pdf.text(providerLines, rightX, y);

    const headerHeight =
      Math.max(practiceLines.length, providerLines.length) * 4 + 2;
    y = headerTop + 5 + headerHeight;

    // Prescription heading.
    setText(12, true);
    pdf.text("Prescription", pageWidth / 2, y, { align: "center" });
    setText(8, false, 70);
    pdf.text(`${issuedAt}  ·  ${scriptNumber}`, right, y, {
      align: "right",
    });
    y += 5;

    // Patient details box - two column layout.
    const patientTop = y;
    const rowHeights = [7, 7, 7, 7, 11];
    const patientBoxHeight = rowHeights.reduce((a, b) => a + b, 0);
    pdf.setFillColor(247, 247, 247);
    pdf.rect(margin, patientTop, contentWidth, patientBoxHeight, "F");
    pdf.setDrawColor(220);
    pdf.rect(margin, patientTop, contentWidth, patientBoxHeight);

    const half = contentWidth / 2;
    const labelW = 29;
    let rowY = patientTop;

    const rows = [
      [
        ["Patient", patientFullName],
        ["Medical aid", clean(patient?.medical_aid) || "Not captured"],
      ],
      [
        [
          "DOB / Age",
          dob
            ? `${formatDate(dob)} / ${age || ""}`
            : String(age || "Not captured"),
        ],
        [
          "Member no.",
          clean(patient?.medical_aid_number) || "Not captured",
        ],
      ],
      [
        [
          "ID / Passport",
          patient?.id_number || patient?.patient_id || "Not captured",
        ],
        [
          "Current weight",
          `${weight || "Not captured"}${
            weightDate ? ` (updated ${weightDate})` : ""
          }`,
        ],
      ],
      [
        ["Contact no.", clean(patient?.mobile) || "Not captured"],
        ["Gender", clean(patient?.gender) || "Not captured"],
      ],
    ];

    rows.forEach((row, index) => {
      const baseline = rowY + 4.7;
      setText(7.5, false, 95);
      pdf.text(row[0][0], margin + 2, baseline);
      pdf.text(row[1][0], margin + half + 2, baseline);

      textInCell(
        row[0][1],
        margin + labelW,
        baseline,
        half - labelW - 3,
        { bold: true, size: 8 }
      );
      textInCell(
        row[1][1],
        margin + half + labelW,
        baseline,
        half - labelW - 3,
        { bold: true, size: 8 }
      );

      rowY += rowHeights[index];
      pdf.setDrawColor(230);
      pdf.line(margin, rowY, right, rowY);
    });

    setText(7.5, false, 95);
    pdf.text("Patient address", margin + 2, rowY + 4.5);
    textInCell(
      address || "Not captured",
      margin + labelW,
      rowY + 4.5,
      contentWidth - labelW - 4,
      { bold: true, size: 8 }
    );

    y = patientTop + patientBoxHeight + 6;

    // Medication table header.
    const xIcd = margin;
    const icdW = 34;
    const qtyW = 19;
    const xDesc = xIcd + icdW;
    const descW = contentWidth - icdW - qtyW;
    const xQty = xDesc + descW;

    function drawMedicationHeader(currentY: number) {
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, currentY, contentWidth, 8, "F");
      pdf.setDrawColor(180);
      pdf.line(margin, currentY + 8, right, currentY + 8);

      setText(8, true);
      pdf.text("Diagnosis / ICD-10", xIcd + 2, currentY + 5);
      pdf.text("Description / Directions", xDesc + 2, currentY + 5);
      pdf.text("Quantity", xQty + qtyW / 2, currentY + 5, {
        align: "center",
      });

      return currentY + 8;
    }

    y = drawMedicationHeader(y);

    items.forEach((item) => {
      const med = item.medicine;
      const strength = [med?.strength, med?.unit].filter(Boolean).join(" ");
      const medicineTitle = [
        med?.brand || item.medicineQuery || "Medicine not captured",
        strength,
        item.form || med?.form || "",
      ]
        .filter(Boolean)
        .join(" - ");

      const directions = [
        `${item.dosage} ${item.form || med?.form || ""}`.trim(),
        item.frequency,
        item.timing,
        item.duration
          ? `for ${item.duration} day${item.duration === "1" ? "" : "s"}`
          : "",
      ]
        .filter(Boolean)
        .join(", ");

      const extra = [
        `Repeats: ${item.repeats}`,
        item.substitution,
        item.notes,
      ]
        .filter(Boolean)
        .join(" · ");

      const icdText = [
        item.icdCode || "",
        item.icdDescription || "",
      ]
        .filter(Boolean)
        .join("\n");

      const descTitleLines = pdf.splitTextToSize(
        medicineTitle,
        descW - 4
      );
      const directionLines = pdf.splitTextToSize(
        directions,
        descW - 4
      );
      const extraLines = extra
        ? pdf.splitTextToSize(extra, descW - 4)
        : [];
      const icdLines = pdf.splitTextToSize(icdText, icdW - 4);

      const textLines = Math.max(
        icdLines.length,
        descTitleLines.length + directionLines.length + extraLines.length
      );
      const rowHeight = Math.max(13, textLines * 3.8 + 5);

      if (y + rowHeight > pageHeight - 22) {
        y = startNewPage();
        y = drawMedicationHeader(y);
      }

      const rowTop = y;
      setText(8, true);
      pdf.text(icdLines, xIcd + 2, rowTop + 4.5);

      setText(8.5, true);
      pdf.text(descTitleLines, xDesc + 2, rowTop + 4.5);

      let descY = rowTop + 4.5 + descTitleLines.length * 3.7;
      setText(8, false);
      pdf.text(directionLines, xDesc + 2, descY);
      descY += directionLines.length * 3.7;

      if (extraLines.length) {
        setText(7.2, false, 90);
        pdf.text(extraLines, xDesc + 2, descY);
      }

      setText(8.5, true);
      pdf.text(
        getMedicationQuantity(item) || "-",
        xQty + qtyW / 2,
        rowTop + 4.5,
        { align: "center" }
      );

      pdf.setDrawColor(220);
      pdf.line(margin, rowTop + rowHeight, right, rowTop + rowHeight);

      y = rowTop + rowHeight;
    });

    y += 5;
    y = ensureSpace(y, 37);

    setText(8.5, false);
    pdf.text(`End of prescription · ${items.length} item(s)`, margin, y);
    y += 8;

    // Signature.
    if (signature && signature !== "data:,") {
      try {
        pdf.addImage(signature, "PNG", margin, y, 48, 18);
        y += 20;
      } catch {
        y += 3;
      }
    } else {
      y += 12;
    }

    pdf.setDrawColor(80);
    pdf.line(margin, y, margin + 56, y);
    y += 4;
    setText(8.5, true);
    pdf.text(doctorName || "Doctor", margin, y);
    y += 4;
    setText(7.5, false, 80);
    pdf.text(
      `HPCSA / Council: ${hpcsa || "Not captured"}`,
      margin,
      y
    );

    setText(7.2, false, 100);
    const clinicalNote = pdf.splitTextToSize(
      "This prescription must be clinically checked and signed by the prescriber before dispensing.",
      82
    );
    pdf.text(clinicalNote, right - 82, y - 8);

    drawFooter(pdf.getNumberOfPages());

    return pdf.output("blob");
  }

  async function printPdf()'''

code = code[:match.start()] + new_pdf + code[match.end():]

# 5) Update selected patient summary to show address + weight/date.
old_selected = """            <div>
              DOB:{" "}
              {selectedPatient.date_of_birth ||
                selectedPatient.dob ||
                "Not captured"}{" "}
              · Mobile: {selectedPatient.mobile || "Not captured"}
            </div>

            <button"""

new_selected = """            <div>
              DOB:{" "}
              {selectedPatient.date_of_birth ||
                selectedPatient.dob ||
                "Not captured"}{" "}
              · Mobile: {selectedPatient.mobile || "Not captured"}
            </div>

            <div>
              Current weight: {getPatientWeight(selectedPatient) || "Not captured"}
              {getPatientWeightDate(selectedPatient)
                ? ` · Updated: ${getPatientWeightDate(selectedPatient)}`
                : ""}
            </div>

            <div>
              Patient address: {getPatientAddress(selectedPatient) || "Not captured"}
            </div>

            <button"""

if old_selected not in code:
    raise RuntimeError("Selected patient display block not found")
code = code.replace(old_selected, new_selected)

# 6) Update subtitle to reflect new layout.
code = code.replace(
    'issue a prescription and export a VideoMed-style PDF.',
    'issue a prescription and export a compact professional A4 prescription PDF.'
)

# Write updated file.
out = Path("/mnt/data/app_e-script_page_updated.tsx")
out.write_text(code)

# Basic integrity checks.
checks = {
    "patient_weight_fields": "current_weight?" in code,
    "patient_address_fields": "physical_address?" in code,
    "weight_helper": "function getPatientWeight" in code,
    "address_helper": "function getPatientAddress" in code,
    "compact_pdf": 'pdf.text("Prescription", pageWidth / 2' in code,
    "selected_patient_weight": "Current weight:" in code,
    "selected_patient_address": "Patient address:" in code,
}
print("Updated:", out)
print("Characters:", len(code))
print(checks)
