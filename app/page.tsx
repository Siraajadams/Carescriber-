import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-slate-900 rounded-2xl p-8 shadow-xl">

        <h1 className="text-5xl font-bold mb-2 text-emerald-400">
          CareScriber
        </h1>

        <p className="text-slate-300 mb-8">
          AI Clinical Operating System for Doctors, Nurses, Pharmacists and
          Independent Prescribers.
        </p>

        <div className="grid gap-4">

          <Link
            href="/login"
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl p-4 text-center"
          >
            Register as Doctor
          </Link>

          <Link
            href="/patients"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl p-4 text-center"
          >
            Register Patient
          </Link>

          <Link
            href="/consultations/new"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl p-4 text-center"
          >
            New Consultation
          </Link>

          <Link
            href="/dashboard"
            className="border border-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl p-4 text-center"
          >
            Dashboard
          </Link>

        </div>

        <div className="mt-10 border-t border-slate-800 pt-6">
          <h2 className="font-semibold mb-3">Phase 1 Features</h2>

          <ul className="space-y-2 text-slate-300">
            <li>✅ Doctor Registration</li>
            <li>✅ Patient Registration</li>
            <li>✅ Consultation Management</li>
            <li>✅ AI Clinical Summary</li>
            <li>✅ SOAP Notes</li>
            <li>✅ ICD-10 Coding</li>
            <li>✅ Referral Generation</li>
            <li>✅ Prescription Ready Architecture</li>
          </ul>
        </div>

      </div>
    </main>
  );
}
