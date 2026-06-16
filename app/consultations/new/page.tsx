"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Patient = {
  name: string;
  surname: string;
  idNumber: string;
  age: string;
  dob: string;
  gender: string;
  mobile: string;
  email: string;
  allergies: string;
  medicines: string;
};

export default function NewConsultationPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("carescriber_patients");
    if (saved) setPatients(JSON.parse(saved));
  }, []);

  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];

    return patients.filter((p) =>
      `${p.name} ${p.surname} ${p.idNumber} ${p.mobile}`
        .toLowerCase()
        .includes(q)
    );
  }, [patients, search]);

  function toggleRecording() {
    setRecording(!recording);
  }

  function generateNote() {
    setNote(`
General Practitioner Consult

Patient:
${selectedPatient ? `${selectedPatient.name} ${selectedPatient.surname}` : "No patient selected"}

Consent:
${consent ? "Patient consented to AI-assisted clinical documentation." : "Consent not confirmed."}

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

ICD-10:
- Code to be confirmed by clinician.

Tasks:
- Review diagnosis.
- Confirm prescription.
- Generate patient education note.
`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">New Consultation</h1>
            <p className="text-slate-300 mt-2">
              Select patient, confirm consent, record consultation and generate SOAP note.
            </p>
          </div>

          <div className="flex gap-2">
            <Link href="/" className="rounded-xl bg-slate-800 px-4 py-3 font-bold">
              ← Back
            </Link>
            <Link href="/patients" className="rounded-xl bg-emerald-500 px-4 py-3 font-bold text-black">
              Register Patient
            </Link>
          </div>
        </div>

        <section className="rounded-3xl bg-slate-900 p-5 mb-5">
          <h2 className="text-xl font-bold mb-3">Find Patient</h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by surname, ID number, name or mobile"
            className="w-full rounded-xl bg-slate-800 border border-slate-700 p-4 text-white"
          />

          <div className="mt-4 grid gap-3">
            {filteredPatients.map((p) => (
              <button
                key={`${p.idNumber}-${p.mobile}`}
                onClick={() => setSelectedPatient(p)}
                className="text-left rounded-xl bg-slate-800 p-4 border border-slate-700"
              >
                <p className="font-bold">{p.name} {p.surname}</p>
                <p className="text-sm text-slate-300">ID: {p.idNumber} | Mobile: {p.mobile}</p>
              </button>
            ))}

            {search && filteredPatients.length === 0 && (
              <p className="text-amber-300">No patient found. Register patient first.</p>
            )}
          </div>

          {selectedPatient && (
            <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500 p-4">
              <p className="font-bold text-emerald-300">Selected Patient</p>
              <p>{selectedPatient.name} {selectedPatient.surname}</p>
              <p className="text-sm text-slate-300">ID: {selectedPatient.idNumber}</p>
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-slate-900 p-5 mb-5">
          <h2 className="text-xl font-bold mb-3">AI Consent</h2>

          <label className="flex gap-3 items-start">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              I have the patient’s consent to use CareScriber AI for clinical documentation.
            </span>
          </label>
        </section>

        <section className="rounded-3xl bg-slate-900 p-5 mb-5">
          <h2 className="text-xl font-bold mb-3">Recording</h2>

          <button
            onClick={toggleRecording}
            className={`rounded-xl px-5 py-4 font-bold ${
              recording ? "bg-red-500 text-white" : "bg-emerald-500 text-black"
            }`}
          >
            {recording ? "■ Stop Recording" : "🎤 Start Recording"}
          </button>

          <p className="mt-3 text-sm text-slate-400">
            Demo mode: type or paste the transcript below. Live microphone transcription can be added next.
          </p>
        </section>

        <section className="rounded-3xl bg-slate-900 p-5 mb-5">
          <h2 className="text-xl font-bold mb-3">Transcript / Clinical Notes</h2>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Type or paste consultation transcript here..."
            className="w-full min-h-40 rounded-xl bg-slate-800 border border-slate-700 p-4 text-white"
          />

          <button
            onClick={generateNote}
            className="mt-4 rounded-xl bg-emerald-500 px-5 py-4 font-bold text-black"
          >
            Generate SOAP Note
          </button>
        </section>

        {note && (
          <section className="rounded-3xl bg-white text-slate-950 p-5">
            <h2 className="text-xl font-bold mb-3">Generated Clinical Note</h2>
            <pre className="whitespace-pre-wrap text-sm">{note}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
