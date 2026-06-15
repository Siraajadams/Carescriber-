"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Patient = {
  id: string;
  first_name: string;
  surname: string;
  id_number: string;
  gender: string;
  age: number | null;
  mobile: string;
  allergies: string;
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
    medical_aid: "",
    allergies: "",
    current_medicines: "",
  });

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Load error: " + error.message);
      return;
    }

    setPatients(data || []);
  }

  async function savePatient() {
    setMessage("");

    if (!patient.first_name || !patient.surname || !patient.id_number) {
      setMessage("Please enter name, surname and ID number.");
      return;
    }

    const payload = {
      first_name: patient.first_name,
      surname: patient.surname,
      id_number: patient.id_number,
      gender: patient.gender,
      age: patient.age ? Number(patient.age) : null,
      date_of_birth: patient.date_of_birth || null,
      mobile: patient.mobile,
      email: patient.email,
      medical_aid: patient.medical_aid,
      allergies: patient.allergies,
      current_medicines: patient.current_medicines,
    };

    const { error } = await supabase.from("patients").insert([payload]);

    if (error) {
      setMessage("Save error: " + error.message);
      return;
    }

    setMessage("Patient saved successfully.");

    setPatient({
      first_name: "",
      surname: "",
      id_number: "",
      gender: "",
      age: "",
      date_of_birth: "",
      mobile: "",
      email: "",
      medical_aid: "",
      allergies: "",
      current_medicines: "",
    });

    await loadPatients();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Patients</h1>
            <p className="text-slate-300">Register and manage patient records.</p>
          </div>
          <Link href="/dashboard" className="text-emerald-400">
            Dashboard
          </Link>
        </div>

        <section className="bg-slate-900 rounded-2xl p-5 mb-6">
          <h2 className="text-xl font-bold mb-4">Register Patient</h2>

          <div className="grid md:grid-cols-2 gap-3">
            <input className="input" placeholder="Name" value={patient.first_name} onChange={(e) => setPatient({ ...patient, first_name: e.target.value })} />
            <input className="input" placeholder="Surname" value={patient.surname} onChange={(e) => setPatient({ ...patient, surname: e.target.value })} />
            <input className="input" placeholder="ID / Passport Number" value={patient.id_number} onChange={(e) => setPatient({ ...patient, id_number: e.target.value })} />
            <input className="input" placeholder="Age" value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} />
            <input className="input" type="date" value={patient.date_of_birth} onChange={(e) => setPatient({ ...patient, date_of_birth: e.target.value })} />

            <select className="input" value={patient.gender} onChange={(e) => setPatient({ ...patient, gender: e.target.value })}>
              <option value="">Select gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>

            <input className="input" placeholder="Mobile" value={patient.mobile} onChange={(e) => setPatient({ ...patient, mobile: e.target.value })} />
            <input className="input" placeholder="Email" value={patient.email} onChange={(e) => setPatient({ ...patient, email: e.target.value })} />

            <input className="input" placeholder="Medical Aid" value={patient.medical_aid} onChange={(e) => setPatient({ ...patient, medical_aid: e.target.value })} />

            <select className="input" value={patient.allergies} onChange={(e) => setPatient({ ...patient, allergies: e.target.value })}>
              <option value="">Select allergy status</option>
              <option value="No known allergies">No known allergies</option>
              <option value="Penicillin allergy">Penicillin allergy</option>
              <option value="Sulphur allergy">Sulphur allergy</option>
              <option value="NSAID allergy">NSAID allergy</option>
              <option value="Latex allergy">Latex allergy</option>
              <option value="Food allergy">Food allergy</option>
              <option value="Other allergy">Other allergy</option>
            </select>

            <textarea
              className="input md:col-span-2"
              placeholder="Current medicines"
              value={patient.current_medicines}
              onChange={(e) => setPatient({ ...patient, current_medicines: e.target.value })}
            />
          </div>

          <button onClick={savePatient} className="mt-4 bg-emerald-500 text-black font-bold rounded-xl p-3">
            Save Patient
          </button>

          {message && <p className="mt-3 text-yellow-300">{message}</p>}
        </section>

        <section className="bg-slate-900 rounded-2xl p-5">
          <h2 className="text-xl font-bold mb-4">Patient Directory</h2>

          {patients.length === 0 && <p className="text-slate-400">No patients registered yet.</p>}

          <div className="space-y-3">
            {patients.map((p) => (
              <div key={p.id} className="bg-slate-800 rounded-xl p-4 flex justify-between gap-4">
                <div>
                  <p className="font-bold">{p.first_name} {p.surname}</p>
                  <p className="text-sm text-slate-300">
                    ID: {p.id_number} | {p.gender || "-"} | Age: {p.age || "-"}
                  </p>
                  <p className="text-sm text-slate-400">
                    Mobile: {p.mobile || "-"} | Allergies: {p.allergies || "-"}
                  </p>
                </div>

                <Link href={`/consultations/new?patient=${p.id}`} className="text-emerald-400">
                  Start Consult
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
