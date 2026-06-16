"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Patient = {
  id: string;
  first_name: string;
  surname: string;
  id_number: string;
  mobile: string;
};

export default function NewConsultationPage() {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    searchPatients();
  }, [query]);

  async function searchPatients() {
    if (!query.trim()) {
      setPatients([]);
      return;
    }

    const { data } = await supabase
      .from("patients")
      .select("id, first_name, surname, id_number, mobile")
      .or(`surname.ilike.%${query}%,id_number.ilike.%${query}%`)
      .limit(10);

    setPatients(data || []);
  }

  async function startRecording() {
    if (!consent) {
      alert("Please confirm patient consent first.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.start();
    setRecording(true);

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
    };
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);

    setTranscript(
      transcript +
        "\n\n[Audio recording completed. Transcription API will be connected in Phase 2.]"
    );
  }

  function generateSoapNote() {
    setNote(`
Patient:
${selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.surname}` : "No patient selected"}

Consent:
${consent ? "Patient consented to AI-assisted documentation." : "Consent not confirmed."}

Transcript:
${transcript || "No transcript entered."}

SOAP NOTE

Subjective:
- Patient history to be completed from transcript.

Objective:
- Examination findings not yet recorded.

Assessment:
- Clinical impression pending.

Plan:
- Treatment plan pending.
- Follow-up to be arranged if required.
- Consider ICD-10 coding.
- Consider patient education note.
`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="text-3xl font-bold mb-2">New Consultation</h1>
      <p className="text-slate-300 mb-4">Select patient, record consult and generate SOAP note.</p>

      <Link href="/patients" className="text-emerald-400">Patients</Link>

      <section className="bg-slate-900 rounded-xl p-4 mt-5">
        <h2 className="text-xl font-bold mb-3">Find Patient</h2>

        <input
          className="input"
          placeholder="Search by surname or ID number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="mt-3 space-y-2">
          {patients.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPatient(p)}
              className="block w-full text-left bg-slate-800 rounded-lg p-3"
            >
              {p.first_name} {p.surname} — ID: {p.id_number}
            </button>
          ))}
        </div>

        {selectedPatient && (
          <p className="mt-3 text-emerald-400">
            Selected: {selectedPatient.first_name} {selectedPatient.surname}
          </p>
        )}
      </section>

      <section className="bg-slate-900 rounded-xl p-4 mt-5">
        <h2 className="text-xl font-bold mb-3">AI Consent</h2>

        <label>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />{" "}
          I have the patient's consent to use CareScriber AI for clinical documentation.
        </label>
      </section>

      <section className="bg-slate-900 rounded-xl p-4 mt-5">
        <h2 className="text-xl font-bold mb-3">Recording</h2>

        {!recording ? (
          <button
            onClick={startRecording}
            className="bg-red-500 text-white font-bold rounded-xl p-3"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="bg-slate-700 text-white font-bold rounded-xl p-3"
          >
            Stop Recording
          </button>
        )}
      </section>

      <section className="bg-slate-900 rounded-xl p-4 mt-5">
        <h2 className="text-xl font-bold mb-3">Transcript / Clinical Notes</h2>

        <textarea
          className="input min-h-40"
          placeholder="Type or paste consultation notes here..."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />

        <button
          onClick={generateSoapNote}
          className="mt-4 bg-emerald-500 text-black font-bold rounded-xl p-3"
        >
          Generate SOAP Note
        </button>
      </section>

      {note && (
        <section className="bg-slate-900 rounded-xl p-4 mt-5">
          <h2 className="text-xl font-bold mb-3">Generated Clinical Note</h2>
          <pre className="whitespace-pre-wrap">{note}</pre>
        </section>
      )}
    </main>
  );
}
