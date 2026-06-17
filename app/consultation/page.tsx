"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Patient = {
  id: string;
  first_name: string;
  surname: string;
  patient_id?: string;
  date_of_birth?: string;
  gender?: string;
  mobile?: string;
};

export default function ConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patient");

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState("transcript");
  const [isRecording, setIsRecording] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkLogin();
  }, []);

  async function checkLogin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (patientId) {
      loadPatient(patientId);
    }
  }

  async function loadPatient(id: string) {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      setPatient(data);
    }
  }

  function startRecording() {
    setIsRecording(true);
    setMessage("Recording started. Speak clearly near the device.");
  }

  function stopRecording() {
    setIsRecording(false);
    setMessage("Recording stopped. Review or paste transcript below.");
  }

  function generateSoap() {
    if (!transcript.trim()) {
      setMessage("Please add transcript text before generating SOAP note.");
      return;
    }

    setSoapNote(`Subjective:
${transcript}

Objective:
Not recorded yet.

Assessment:
AI assessment to be generated from consultation details.

Plan:
Treatment plan, referral, prescription draft and follow-up to be completed by doctor.`);

    setSummary(
      `${patient?.first_name || "Patient"} ${patient?.surname || ""} was seen for a consultation. Key clinical details were captured and require doctor review.`
    );

    setActiveTab("soap");
    setMessage("SOAP note draft generated. Please review before saving.");
  }

  async function saveConsultation() {
    setMessage("");

    const { error } = await supabase.from("consultations").insert({
      patient_id: patient?.id || null,
      transcript,
      soap_note: soapNote,
      patient_summary: summary,
      status: "completed",
      created_at: new Date().toISOString(),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Consultation saved successfully.");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/dashboard" className="font-semibold text-blue-700">
                ← Back to Dashboard
              </Link>

              <h1 className="mt-4 text-3xl font-bold text-slate-900">
                New Consultation
              </h1>

              <p className="mt-2 text-slate-600">
                Simple consultation workspace with transcript, SOAP note and
                patient summary.
              </p>
            </div>

            <Link
              href="/patients"
              className="rounded-xl border border-blue-700 px-5 py-3 font-semibold text-blue-700 hover:bg-blue-50"
            >
              Select Patient
            </Link>
          </div>
        </header>

        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Patient Summary</h2>

          {patient ? (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Info label="Name" value={`${patient.first_name} ${patient.surname}`} />
              <Info label="Patient ID" value={patient.patient_id || "Not recorded"} />
              <Info label="Gender" value={patient.gender || "Not recorded"} />
              <Info label="Mobile" value={patient.mobile || "Not recorded"} />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-amber-800">
              No patient selected. Please select or register a patient before
              saving the consultation.
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Consultation Recorder
              </h2>
              <p className="mt-1 text-slate-600">
                Record, transcribe and generate clinical outputs.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={startRecording}
                disabled={isRecording}
                className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                Start Recording
              </button>

              <button
                onClick={stopRecording}
                disabled={!isRecording}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Stop Recording
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {message}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <TabButton
              label="Transcript"
              active={activeTab === "transcript"}
              onClick={() => setActiveTab("transcript")}
            />
            <TabButton
              label="SOAP Note"
              active={activeTab === "soap"}
              onClick={() => setActiveTab("soap")}
            />
            <TabButton
              label="Patient Summary"
              active={activeTab === "summary"}
              onClick={() => setActiveTab("summary")}
            />
          </div>

          <div className="mt-6">
            {activeTab === "transcript" && (
              <textarea
                className="min-h-[360px] w-full rounded-2xl border border-slate-300 p-5 text-slate-800 outline-none focus:border-blue-600"
                placeholder="Live transcript will appear here. For now, paste or type the transcript here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
            )}

            {activeTab === "soap" && (
              <textarea
                className="min-h-[360px] w-full rounded-2xl border border-slate-300 p-5 text-slate-800 outline-none focus:border-blue-600"
                placeholder="SOAP note will appear here..."
                value={soapNote}
                onChange={(e) => setSoapNote(e.target.value)}
              />
            )}

            {activeTab === "summary" && (
              <textarea
                className="min-h-[360px] w-full rounded-2xl border border-slate-300 p-5 text-slate-800 outline-none focus:border-blue-600"
                placeholder="Patient summary will appear here..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={generateSoap}
              className="rounded-xl bg-blue-700 px-6 py-4 font-semibold text-white hover:bg-blue-800"
            >
              Generate SOAP & Summary
            </button>

            <button
              onClick={saveConsultation}
              className="rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white hover:bg-slate-800"
            >
              Save Consultation
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white"
          : "rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-200"
      }
    >
      {label}
    </button>
  );
}
