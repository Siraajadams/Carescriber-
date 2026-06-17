"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function RegisterDoctorPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [practiceNumber, setPracticeNumber] = useState("");
  const [country, setCountry] = useState("South Africa");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function registerDoctor(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (
      !firstName ||
      !surname ||
      !email ||
      !mobile ||
      !registrationNumber ||
      !password
    ) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          surname,
          mobile,
          registration_number: registrationNumber,
          practice_number: practiceNumber,
          country,
          role: "doctor",
        },
      },
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    const userId = data.user?.id;

    if (userId) {
      await supabase.from("profiles").upsert({
        id: userId,
        first_name: firstName,
        surname,
        email,
        mobile,
        registration_number: registrationNumber,
        practice_number: practiceNumber,
        country,
        role: "doctor",
        created_at: new Date().toISOString(),
      });
    }

    setLoading(false);
    router.push("/registration-success");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-xl sm:p-10">
        <div className="mb-8">
          <Link href="/" className="text-sm font-semibold text-blue-700">
            ← Back to CareScriber
          </Link>

          <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-blue-700">
            Videomed Clinical Assistant
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Register Doctor
          </h1>

          <p className="mt-3 text-slate-600">
            Create your clinician profile for CareScriber AI.
          </p>
        </div>

        <form onSubmit={registerDoctor} className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                First name *
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Surname *
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="Surname"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email *
              </label>
              <input
                type="email"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@email.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Mobile *
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="082..."
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                HPCSA / registration number *
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="HPCSA number"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Practice number
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                value={practiceNumber}
                onChange={(e) => setPracticeNumber(e.target.value)}
                placeholder="Practice number"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Country
            </label>
            <select
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option>South Africa</option>
              <option>England</option>
              <option>Wales</option>
              <option>Scotland</option>
              <option>New Zealand</option>
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Password *
              </label>
              <input
                type="password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Confirm password *
              </label>
              <input
                type="password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
          </div>

          {message && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-700 px-6 py-4 font-semibold text-white shadow hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? "Registering..." : "Register Doctor"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-blue-700">
            Login here
          </Link>
        </p>
      </div>
    </main>
  );
}
