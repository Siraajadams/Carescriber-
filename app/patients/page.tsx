"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function PatientsPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [patientId, setPatientId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("Female");
  const [mobile, setMobile] = useState("");
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

    setLoading(false);
  }

  async function searchPatients() {
    setMessage("");

    let query = supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (search.trim()) {
      query = query.or(
        `first_name.ilike.%${search}%,surname.ilike.%${search}%,patient_id.ilike.%${search}%,mobile.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      setMessage(error.message);
      return;
    }

    setPatients(data || []);
  }

  async function createPatient(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!firstName || !surname) {
      setMessage("Please enter patient first name and surname.");
      return;
    }

    const { data, error } = await supabase
      .from("patients")
      .insert({
        first_name: firstName,
        surname,
        patient_id: patientId || `PT-${Math.floor(100000 + Math.random() * 900000)}`,
        date_of_birth: dateOfBirth || null,
        gender,
        mobile,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push(`/consultation?patient=${data.id}`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading patients...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <Link href="/dashboard" className="font-semibold text-blue-700">
            ← Back to Dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            Patient Search
          </h1>

          <p className="mt-2 text-slate-600">
            Search for an existing patient or create a new patient profile.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Search Patient
            </h2>

            <div className="mt-4 flex gap-3">
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                placeholder="Name, surname, patient ID or mobile"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button
                onClick={searchPatients}
                className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
              >
                Search
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {patients.map((patient) => (
                <div
                  key={patient.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <p className="font-bold text-slate-900">
                    {patient.first_name} {patient.surname}
                  </p>
                  <p className="text-sm text-slate-600">
                    ID: {patient.patient_id || "Not recorded"} ·{" "}
                    {patient.gender || "Gender not recorded"} ·{" "}
                    {patient.mobile || "No mobile"}
                  </p>

                  <Link
                    href={`/consultation?patient=${patient.id}`}
                    className="mt-3 inline-block rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Start Consultation
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={createPatient}
            className="rounded-3xl bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-bold text-slate-900">
              Register New Patient
            </h2>

            <div className="mt-5 grid gap-4">
              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />

              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Surname"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
              />

              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Patient ID / SA ID / Passport"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />

              <input
                type="date"
                className="rounded-xl border border-slate-300 px-4 py-3"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />

              <select
                className="rounded-xl border border-slate-300 px-4 py-3"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>

              <input
                className="rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />

              {message && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {message}
                </div>
              )}

              <button className="rounded-xl bg-blue-700 px-6 py-4 font-semibold text-white hover:bg-blue-800">
                Save Patient & Start Consultation
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
