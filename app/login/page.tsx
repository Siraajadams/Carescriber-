"use client";

import { useState } from "react";
import Link from "next/link";

export default function DoctorRegisterPage() {
  const [msg, setMsg] = useState("");

  function saveDoctor(e: any) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const doctor = {
      firstName: form.get("firstName"),
      surname: form.get("surname"),
      email: form.get("email"),
      mobile: form.get("mobile"),
      hpcsa: form.get("hpcsa"),
      practiceNumber: form.get("practiceNumber"),
      country: form.get("country"),
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("carescriber_doctor", JSON.stringify(doctor));
    setMsg("Doctor registered successfully.");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-emerald-400">← Back</Link>

        <div className="mt-6 rounded-3xl bg-slate-900 p-6 shadow-xl">
          <h1 className="text-3xl font-bold">Register Doctor</h1>
          <p className="text-slate-400 mt-2">Create the clinician profile for CareScriber.</p>

          <form onSubmit={saveDoctor} className="mt-6 grid gap-4">
            <input name="firstName" required placeholder="First name" className="rounded-xl bg-slate-800 p-4" />
            <input name="surname" required placeholder="Surname" className="rounded-xl bg-slate-800 p-4" />
            <input name="email" required placeholder="Email" className="rounded-xl bg-slate-800 p-4" />
            <input name="mobile" required placeholder="Mobile" className="rounded-xl bg-slate-800 p-4" />
            <input name="hpcsa" placeholder="HPCSA / registration number" className="rounded-xl bg-slate-800 p-4" />
            <input name="practiceNumber" placeholder="Practice number" className="rounded-xl bg-slate-800 p-4" />

            <select name="country" className="rounded-xl bg-slate-800 p-4">
              <option>South Africa</option>
              <option>United Kingdom</option>
              <option>New Zealand</option>
            </select>

            <button className="rounded-xl bg-emerald-500 p-4 font-bold text-black">
              Save Doctor
            </button>
          </form>

          {msg && <p className="mt-4 text-emerald-400">{msg}</p>}
        </div>
      </div>
    </main>
  );
}
