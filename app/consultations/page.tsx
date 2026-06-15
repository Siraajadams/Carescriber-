"use client";

import { useState } from "react";
import Link from "next/link";

export default function NewConsultationPage() {
  const [consent, setConsent] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");

  function generateBasicNote() {
    setNote(`
General Practitioner Consult

Consent:
${consent ? "Patient consented to AI-assisted documentation." : "Consent not confirmed."}

Transcript:
${transcript || "No transcript entered."}

History:
- To be completed from consultation.

Examination:
- Not recorded.

Assessment:
- Clinical assessment pending.

Plan:
- Treatment plan pending.
- Follow-up to be arranged if required.

Tasks:
- Confirm diagnosis.
- Add ICD-10 code.
- Generate patient education note.
`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">New Consultation</h1>
            <p className="text-slate-300">Consent, transcript and SOAP note.</p>
          </div>
          <Link href="/patients" className="text-emerald-400">Patients</Link>
        </div>

        <section className="bg-slate-900 rounded-2xl p-5 mb-5">
          <h2 className="text-xl font-bold mb-3">AI Consent</h2>
          <label className="flex gap-3 items-center">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I have the patient's consent to use CareScriber AI for clinical documentation.</span>
          </label>
        </section>

        <section className="bg-slate-900 rounded-2xl p-5 mb-5">
          <h2 className="text-xl font-bold mb-3">Transcript / Clinical Notes</h2>
          <textarea
            className="input min-h-40"
            placeholder="Paste or type consultation transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />

          <button onClick={generateBasicNote} className="mt-4 bg-emerald-500 text-black font-bold rounded-xl p-3">
            Generate SOAP Note
          </button>
        </section>

        {note && (
          <section className="bg-slate-900 rounded-2xl p-5">
            <h2 className="text-xl font-bold mb-3">Generated Clinical Note</h2>
            <pre className="whitespace-pre-wrap text-sm text-slate-100">{note}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
