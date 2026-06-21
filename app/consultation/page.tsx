"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type Patient = {
  firstName: string;
  surname: string;
  idNumber: string;
  age: string;
  dob: string;
  gender: string;
  mobile: string;
  medicalAid: string;
  allergies: string;
  currentMedicines: string;
};

const demoPatients: Patient[] = [
  {
    firstName: "Siraaj",
    surname: "Adams",
    idNumber: "8990",
    age: "49",
    dob: "1974-06-16",
    gender: "Female",
    mobile: "0827427073",
    medicalAid: "Not captured",
    allergies: "No known allergies",
    currentMedicines: "Not captured",
  },
];

export default function ConsultationPage() {
  const recognitionRef = useRef<any>(null);

  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [clinicalNote, setClinicalNote] = useState("");
  const [activeTab, setActiveTab] = useState<"transcript" | "soap" | "summary">(
    "transcript"
  );
  const [message, setMessage] = useState("");

  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];

    return demoPatients.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.surname.toLowerCase().includes(q) ||
        p.idNumber.toLowerCase().includes(q)
    );
  }, [search]);

  function startRecording() {
    setMessage("");

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "Microphone transcription is not supported on this browser. Please use Chrome, Edge, or Safari with microphone permission enabled."
      );
      return;
    }

    if (!consent) {
      setMessage("Please confirm AI consent before recording.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-ZA";

    let finalText = "";

    recognition.onresult = (event: any) => {
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalText += text + " ";
        } else {
          interimText += text;
        }
      }

      setTranscript((finalText + interimText).trim());
    };

    recognition.onerror = () => {
      setMessage(
        "Microphone permission denied or unavailable. Please allow microphone access in browser settings."
      );
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setRecording(false);
  }

  function generateClinicalNote() {
    if (!selectedPatient) {
      setMessage("Please select a patient first.");
      return;
    }

    if (!transcript.trim()) {
      setMessage("Please record or type consultation notes first.");
      return;
    }

    const note = `
PATIENT SUMMARY
Name: ${selectedPatient.firstName} ${selectedPatient.surname}
ID Number: ${selectedPatient.idNumber}
Age: ${selectedPatient.age}
DOB: ${selectedPatient.dob}
Gender: ${selectedPatient.gender}
Mobile: ${selectedPatient.mobile}
Medical Aid: ${selectedPatient.medicalAid}
Allergies: ${selectedPatient.allergies}
Current Medicines: ${selectedPatient.currentMedicines}

CONSENT
${consent ? "Patient consented to AI-assisted clinical documentation." : "Consent not confirmed."}

TRANSCRIPT
${transcript}

SOAP NOTE

Subjective:
- Patient reports: ${transcript}

Objective:
- Examination findings to be completed by clinician.
- Vitals to be added if available.

Assessment:
- Clinical impression pending clinician confirmation.
- Consider differential diagnosis based on symptoms.

Plan:
- Treatment plan to be confirmed by clinician.
- Consider ICD-10 coding.
- Consider prescription if clinically appropriate.
- Provide patient education.
- Arrange follow-up if required.

ICD-10 SUGGESTIONS
- To be confirmed by clinician.

TASKS
- Review diagnosis.
- Confirm treatment.
- Complete patient counselling.
- Arrange follow-up.
`;

    setClinicalNote(note.trim());
    setActiveTab("soap");
    setMessage("");
  }

  function copyNote() {
    navigator.clipboard.writeText(clinicalNote);
    setMessage("Clinical note copied.");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-blue-700">
            ← Back
          </Link>

          <Link
            href="/patients"
            className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm"
          >
            Register Patient
          </Link>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Videomed Clinical Assistant
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            New Consultation
          </h1>

          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            Select a patient, confirm consent, record the consultation and
            generate a clinical SOAP note.
          </p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-1">
            <h2 className="text-xl font-bold">Find Patient</h2>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by surname or ID number"
              className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            <div className="mt-4 space-y-3">
              {filteredPatients.map((patient) => (
                <button
                  key={patient.idNumber}
                  onClick={() => setSelectedPatient(patient)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left hover:border-blue-400 hover:bg-blue-50"
                >
                  <p className="font-bold">
                    {patient.firstName} {patient.surname}
                  </p>
                  <p className="text-sm text-slate-600">
                    ID: {patient.idNumber} | Age: {patient.age} |{" "}
                    {patient.gender}
                  </p>
                </button>
              ))}
            </div>

            {selectedPatient && (
              <div className="mt-5 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100">
                <p className="text-sm font-semibold text-blue-700">
                  Selected Patient
                </p>
                <p className="mt-1 text-lg font-bold">
                  {selectedPatient.firstName} {selectedPatient.surname}
                </p>
                <p className="text-sm text-slate-700">
                  ID: {selectedPatient.idNumber}
                </p>
                <p className="text-sm text-slate-700">
                  Age: {selectedPatient.age} | {selectedPatient.gender}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
            <h2 className="text-xl font-bold">AI Consent</h2>

            <label className="mt-4 flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-5 w-5"
              />
              I have the patient’s consent to use CareScriber AI for clinical
              documentation.
            </label>

            <div className="mt-6">
              <h2 className="text-xl font-bold">Recording</h2>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={startRecording}
                  disabled={recording}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white shadow-sm disabled:opacity-50"
                >
                  🎙️ Start Recording
                </button>

                <button
                  onClick={stopRecording}
                  disabled={!recording}
                  className="rounded-2xl bg-red-600 px-5 py-3 font-bold text-white shadow-sm disabled:opacity-50"
                >
                  ⏹ Stop Recording
                </button>

                <button
                  onClick={generateClinicalNote}
                  className="rounded-2xl bg-blue-700 px-5 py-3 font-bold text-white shadow-sm"
                >
                  Generate SOAP Note
                </button>
              </div>

              {message && (
                <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">
                  {message}
                </div>
              )}
            </div>

            <div className="mt-6">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Transcript will appear here. You can also type or paste notes."
                className="min-h-40 w-full rounded-2xl border border-slate-300 bg-white p-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("transcript")}
              className={`rounded-2xl px-4 py-2 font-bold ${
                activeTab === "transcript"
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              Transcript
            </button>

            <button
              onClick={() => setActiveTab("soap")}
              className={`rounded-2xl px-4 py-2 font-bold ${
                activeTab === "soap"
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              SOAP / ICD-10
            </button>

            <button
              onClick={() => setActiveTab("summary")}
              className={`rounded-2xl px-4 py-2 font-bold ${
                activeTab === "summary"
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              Patient Summary
            </button>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-5">
            {activeTab === "transcript" && (
              <pre className="whitespace-pre-wrap text-sm text-slate-800">
                {transcript || "No transcript captured yet."}
              </pre>
            )}

            {activeTab === "soap" && (
              <>
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={copyNote}
                    disabled={!clinicalNote}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Copy Note
                  </button>
                </div>

                <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                  {clinicalNote || "Generate a SOAP note to view output."}
                </pre>
              </>
            )}

            {activeTab === "summary" && (
              <div>
                {selectedPatient ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info label="Name" value={`${selectedPatient.firstName} ${selectedPatient.surname}`} />
                    <Info label="ID Number" value={selectedPatient.idNumber} />
                    <Info label="Age" value={selectedPatient.age} />
                    <Info label="DOB" value={selectedPatient.dob} />
                    <Info label="Gender" value={selectedPatient.gender} />
                    <Info label="Mobile" value={selectedPatient.mobile} />
                    <Info label="Medical Aid" value={selectedPatient.medicalAid} />
                    <Info label="Allergies" value={selectedPatient.allergies} />
                    <Info
                      label="Current Medicines"
                      value={selectedPatient.currentMedicines}
                    />
                  </div>
                ) : (
                  <p className="text-slate-600">No patient selected.</p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </div>
  );
}
