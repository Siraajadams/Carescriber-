"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [doctor, setDoctor] = useState({
    first_name: "",
    surname: "",
    email: "",
    mobile: "",
    country: "South Africa",
    profession: "Doctor",
    registration_number: "",
    practice_name: "",
  });

  const [message, setMessage] = useState("");

  async function registerDoctor() {
    setMessage("");

    if (!doctor.first_name || !doctor.surname || !doctor.email) {
      setMessage("Please enter doctor name, surname and email.");
      return;
    }

    const { error } = await supabase.from("doctors").insert([doctor]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Doctor registered successfully.");
    router.push("/patients");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-xl mx-auto bg-slate-900 rounded-2xl p-6 shadow">
        <h1 className="text-3xl font-bold mb-2">CareScriber</h1>
        <p className="text-slate-300 mb-6">
          Register as a doctor to start clinical consultations.
        </p>

        <div className="grid gap-3">
          <input className="input" placeholder="First name" onChange={(e) => setDoctor({ ...doctor, first_name: e.target.value })} />
          <input className="input" placeholder="Surname" onChange={(e) => setDoctor({ ...doctor, surname: e.target.value })} />
          <input className="input" placeholder="Email" onChange={(e) => setDoctor({ ...doctor, email: e.target.value })} />
          <input className="input" placeholder="Mobile" onChange={(e) => setDoctor({ ...doctor, mobile: e.target.value })} />
          <input className="input" placeholder="HPCSA / GMC / NZ Registration Number" onChange={(e) => setDoctor({ ...doctor, registration_number: e.target.value })} />
          <input className="input" placeholder="Practice name" onChange={(e) => setDoctor({ ...doctor, practice_name: e.target.value })} />

          <select className="input" onChange={(e) => setDoctor({ ...doctor, country: e.target.value })}>
            <option>South Africa</option>
            <option>United Kingdom</option>
            <option>New Zealand</option>
          </select>

          <button onClick={registerDoctor} className="bg-emerald-500 text-black font-bold rounded-xl p-3">
            Register Doctor
          </button>

          {message && <p className="text-sm text-yellow-300">{message}</p>}
        </div>
      </div>
    </main>
  );
}
