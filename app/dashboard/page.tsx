"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [doctorName, setDoctorName] = useState("Doctor");
  const [loading, setLoading] = useState(true);

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

    setDoctorName(
      user.user_metadata?.first_name
        ? `Dr ${user.user_metadata.first_name}`
        : "Doctor"
    );

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              CareScriber AI
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Welcome, {doctorName}
            </h1>
            <p className="mt-2 text-slate-600">
              Simple clinical assistant for consultations, SOAP notes and
              patient summaries.
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          <Link
            href="/consultation"
            className="rounded-3xl bg-blue-700 p-8 text-white shadow-lg hover:bg-blue-800"
          >
            <div className="text-4xl">➕</div>
            <h2 className="mt-5 text-2xl font-bold">New Consultation</h2>
            <p className="mt-3 text-blue-100">
              Start recording, generate transcript and SOAP note.
            </p>
          </Link>

          <Link
            href="/patients"
            className="rounded-3xl bg-white p-8 shadow-lg hover:bg-blue-50"
          >
            <div className="text-4xl">🔍</div>
            <h2 className="mt-5 text-2xl font-bold text-slate-900">
              Search Patient
            </h2>
            <p className="mt-3 text-slate-600">
              Find or register a patient before consultation.
            </p>
          </Link>

          <Link
            href="/consultation"
            className="rounded-3xl bg-white p-8 shadow-lg hover:bg-blue-50"
          >
            <div className="text-4xl">📝</div>
            <h2 className="mt-5 text-2xl font-bold text-slate-900">
              Recent Consultations
            </h2>
            <p className="mt-3 text-slate-600">
              Continue with the latest consultation workflow.
            </p>
          </Link>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">
            CareScriber Workflow
          </h3>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              "1. Select Patient",
              "2. Start Recording",
              "3. Generate SOAP",
              "4. Save Summary",
            ].map((step) => (
              <div
                key={step}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center font-semibold text-slate-700"
              >
                {step}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
