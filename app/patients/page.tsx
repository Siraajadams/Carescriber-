"use client";

import { useEffect, useState } from "react";
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

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("carescriber_patients");
    if (saved) setPatients(JSON.parse(saved));
  }, []);

  function savePatient(e: any) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const patient: Patient = {
      name: String(form.get("name") || ""),
      surname: String(form.get("surname") || ""),
      idNumber: String(form.get("idNumber") || ""),
      age: String(form.get("age") || ""),
      dob: String(form.get("dob") || ""),
      gender: String(form.get("gender") || ""),
      mobile: String(form.get("mobile") || ""),
      email: String(form.get("email") || ""),
      medicalAid: String(form.get("medicalAid") || ""),
      allergies: String(form.get("allergies") || ""),
      medicines: String(form.get("medicines") || ""),
    };

    const updated = [...patients, patient];
    setPatients(updated);
    localStorage.setItem("carescriber_patients", JSON.stringify(updated));
    setMsg("Patient saved successfully.");
    e.currentTarget.reset();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-emerald-400">← Back</Link>

        <div className="mt-6 rounded-3xl bg-slate-900 p-6">
          <h1 className="text-3xl font-bold">Patient Registration</h1>

          <form onSubmit={savePatient} className="mt-6 grid gap-4 md:grid-cols-2">
            <input name="name" required placeholder="Name" className="rounded-xl bg-slate-800 p-4" />
            <input name="surname" required placeholder="Surname" className="rounded-xl bg-slate-800 p-4" />
            <input name="idNumber" required placeholder="ID / Passport number" className="rounded-xl bg-slate-800 p-4" />
            <input name="age" placeholder="Age" className="rounded-xl bg-slate-800 p-4" />
            <input name="dob" type="date" className="rounded-xl bg-slate-800 p-4" />

            <select name="gender" className="rounded-xl bg-slate-800 p-4">
              <option value="">Select gender</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>

            <input name="mobile" placeholder="Mobile" className="rounded-xl bg-slate-800 p-4" />
            <input name="email" placeholder="Email" className="rounded-xl bg-slate-800 p-4" />
            <input name="medicalAid" placeholder="Medical aid / none" className="rounded-xl bg-slate-800 p-4" />

            <select name="allergies" className="rounded-xl bg-slate-800 p-4">
              <option>No known allergies</option>
              <option>Penicillin</option>
              <option>Sulfa</option>
              <option>NSAIDs</option>
              <option>Latex</option>
              <option>Food allergy</option>
              <option>Other</option>
            </select>

            <textarea name="medicines" placeholder="Current medicines" className="md:col-span-2 rounded-xl bg-slate-800 p-4" />

            <button className="md:col-span-2 rounded-xl bg-emerald-500 p-4 font-bold text-black">
              Save Patient
            </button>
          </form>

          {msg && <p className="mt-4 text-emerald-400">{msg}</p>}
        </div>

        <div className="mt-6 rounded-3xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Patient Directory</h2>
          <div className="mt-4 grid gap-3">
            {patients.map((p, i) => (
              <div key={i} className="rounded-xl bg-slate-800 p-4">
                <p className="font-bold">{p.name} {p.surname}</p>
                <p className="text-sm text-slate-400">ID: {p.idNumber} | Age: {p.age} | {p.gender}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
