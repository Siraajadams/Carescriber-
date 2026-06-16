"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  medicalAid: string;
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
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem("carescriber_patients");
    if (saved) setPatients(JSON.parse(saved));
  }, []);

  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return patients.filter((p) =>
      `${p.name} ${p.surname} ${p.idNumber} ${p.mobile}`.toLowerCase().includes(q)
    );
  }, [patients, search]);

  function startRecording() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-ZA";

    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + " ";
      }
      setTranscript(text);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  function generateSoap() {
    setNote(`
PATIENT SUMMARY
Name: ${selectedPatient ? `${selectedPatient.name} ${selectedPatient.surname}` : "No patient selected"}
ID Number: ${selectedPatient?.idNumber || "Not captured"}
Age: ${selectedPatient?.age || "Not captured"}
DOB: ${selectedPatient?.dob || "Not captured"}
Gender: ${selectedPatient?.gender || "Not captured"}
Mobile: ${selectedPatient?.mobile || "Not captured"}
Medical Aid: ${selectedPatient?.medicalAid || "Not captured"}
Allergies: ${selectedPatient?.allergies || "Not captured"}
Current Medicines: ${selectedPatient?.medicines || "Not captured"}

CONSENT
${consent ? "Patient consented to AI-assisted clinical documentation." : "Consent not confirmed."}

TRANSCRIPT
${transcript || "No transcript captured."}

SOAP NOTE

Subjective:
- Patient reports: ${transcript || "Not documented."}

Objective:
- Examination findings to be completed by clinician.
- Vitals to be added if available.

Assessment:
- Clinical impression pending clinician confirmation.
- Consider differential diagnosis based on presenting symptoms.

Plan:
- Treatment plan to be confirmed by clinician.
- Consider ICD-10 coding.
- Consider prescription if clinically appropriate.
- Provide patient education.
- Arrange follow-up if required.

ICD-10 SUGGESTIONS
- To be confirmed by clinician.

TASKS
- Confirm diagnosis.
- Confirm medication.
- Generate patient education.
- Arrange follow-up.
`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">New Consultation</h1>
            <p className="text-slate-400">Find patient, record consult and generate SOAP note.</p>
          </div>
          <Link href="/" className="rounded-xl bg-slate-800 px-4 py-3 font-bold">← Back</Link>
        </div>

        <section className="mt-6 rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Find Patient</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search surname, ID number, name or mobile"
            className="mt-3 w-full rounded-xl bg-slate-800 p-4"
          />

          <div className="mt-3 grid gap-3">
            {results.map((p, i) => (
              <button
                key={i}
                onClick={() => setSelectedPatient(p)}
                className="rounded-xl bg-slate-800 p-4 text-left border border-slate-700"
              >
                <strong>{p.name} {p.surname}</strong>
                <p className="text-sm text-slate-400">ID: {p.idNumber} | Age: {p.age} | {p.gender}</p>
              </button>
            ))}
          </div>

          {selectedPatient && (
            <div className="mt-4 rounded-xl border border-emerald-500 bg-emerald-500/10 p-4">
              Selected: {selectedPatient.name} {selectedPatient.surname} | ID: {selectedPatient.idNumber}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">AI Consent</h2>
          <label className="mt-3 flex gap-3">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            I have the patient’s consent to use CareScriber AI for clinical documentation.
          </label>
        </section>

        <section className="mt-6 rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Recording</h2>
          {!recording ? (
            <button onClick={startRecording} className="mt-3 rounded-xl bg-emerald-500 px-5 py-4 font-bold text-black">
              🎤 Start Recording
            </button>
          ) : (
            <button onClick={stopRecording} className="mt-3 rounded-xl bg-red-500 px-5 py-4 font-bold text-white">
              ■ Stop Recording
            </button>
          )}
        </section>

        <section className="mt-6 rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Transcript / Clinical Notes</h2>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Live transcript will appear here. You can also type notes manually."
            className="mt-3 min-h-44 w-full rounded-xl bg-slate-800 p-4"
          />
          <button onClick={generateSoap} className="mt-4 rounded-xl bg-emerald-500 px-5 py-4 font-bold text-black">
            Generate SOAP Note
          </button>
        </section>

        {note && (
          <section className="mt-6 rounded-3xl bg-white p-5 text-slate-950">
            <h2 className="text-2xl font-bold">Generated Clinical Note</h2>
            <pre className="mt-4 whitespace-pre-wrap text-sm">{note}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
