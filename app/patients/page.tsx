"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Patient = {
  id: string;
  first_name: string;
  surname: string;
  id_number: string;
  gender: string;
  age: number;
  mobile: string;
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [message, setMessage] = useState("");

  const [patient, setPatient] = useState({
    first_name: "",
    surname: "",
    id_number: "",
    gender: "",
    age: "",
    date_of_birth: "",
    mobile: "",
    email: "",
    allergies: "",
    current_medicines: "",
    medical_aid: "",
  });

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setPatients(data);
  }

  async function registerPatient() {
    setMessage("");

    if (!patient.first_name || !patient.surname || !patient.id_number) {
      setMessage("Please enter patient name, surname and ID number.");
      return;
    }

    const { error } = await supabase.from("patients").insert([
      {
        ...patient,
        age: patient.age ? Number(patient.age) : null,
      },
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Patient registered successfully.");

    setPatient({
      first_name: "",
      surname: "",
      id_number: "",
      gender: "",
      age: "",
      date_of_birth: "",
      mobile: "",
      email: "",
      allergies: "",
      current_medicines: "",
      medical_aid: "",
    });

    loadPatients();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Patients</h1>
            <p className="text-slate-300">Register and manage patient records.</p>
          </div>
          <Link href="/dashboard" className="text-emerald-400">Dashboard</Link>
        </div>

        <section className="bg-slate-900 rounded-2xl p-5 mb-6">
          <h2 className="text-xl font-bold mb-4">Register Patient</h2>

          <div className="grid md:grid-cols-2 gap-3">
            <input className="input" placeholder="Name" value={patient.first_name} onChange={(e) => setPatient({ ...patient, first_name: e.target.value })} />
            <input className="input" placeholder="Surname" value={patient.surname} onChange={(e) => setPatient({ ...patient, surname: e.target.value })} />
            <input className="input" placeholder="ID Number" value={patient.id_number} onChange={(e) => setPatient({ ...patient, id_number: e.target.value })} />
            <input className="input" placeholder="Age" value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} />
            <input className="input" type="date" value={patient.date_of_birth} onChange={(e) => setPatient({ ...patient, date_of_birth: e.target.value })} />

            <select className="input" value={patient.gender} onChange={(e) => setPatient({ ...patient, gender: e.target.value })}>
              <option value="">Select gender</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>

            <input className="input" placeholder="Mobile" value={patient.mobile} onChange={(e) => setPatient({ ...patient, mobile: e.target.value })} />
            <input className="input" placeholder="Email" value={patient.email} onChange={(e) => setPatient({ ...patient, email: e.target.value })} />
            <input className="input" placeholder="Medical Aid" value={patient.medical_aid} onChange={(e) => setPatient({ ...patient, medical_aid: e.target.value })} />
            <input className="input" placeholder="Allergies" value={patient.allergies} onChange={(e) => setPatient({ ...patient, allergies: e.target.value })} />
            <textarea className="input md:col-span-2" placeholder="Current medicines" value={patient.current_medicines} onChange={(e) => setPatient({ ...patient, current_medicines: e.target.value })} />
          </div>

          <button onClick={registerPatient} className="mt-4 bg-emerald-500 text-black font-bold rounded-xl p-3">
            Save Patient
          </button>

          {message && <p className="mt-3 text-yellow-300">{message}</p>}
        </section>

        <section className="bg-slate-900 rounded-2xl p-5">
          <h2 className="text-xl font-bold mb-4">Patient Directory</h2>

          <div className="space-y-3">
            {patients.map((p) => (
              <div key={p.id} className="bg-slate-800 rounded-xl p-4 flex justify-between">
                <div>
                  <p className="font-bold">{p.first_name} {p.surname}</p>
                  <p className="text-sm text-slate-300">
                    ID: {p.id_number || "Not captured"} | {p.gender} | Age: {p.age || "-"}
                  </p>
                  <p className="text-sm text-slate-400">{p.mobile}</p>
                </div>
                <Link href={`/consultations/new?patient=${p.id}`} className="text-emerald-400">
                  Start Consult
                </Link>
              </div>
            ))}

            {patients.length === 0 && (
              <p className="text-slate-400">No patients registered yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
