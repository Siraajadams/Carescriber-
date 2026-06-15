import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-slate-900 rounded-2xl p-8 shadow">
        <h1 className="text-4xl font-bold mb-3">CareScriber</h1>

        <p className="text-slate-300 mb-6">
          AI clinical operating system for doctors, nurses and pharmacy-first consultations.
        </p>

        <div className="grid gap-3">
          <Link
            href="/login"
            className="bg-emerald-500 text-black font-bold rounded-xl p-3 text-center"
          >
            Register as Doctor
          </Link>

          <Link
            href="/patients"
            className="bg-slate-800 text-white font-bold rounded-xl p-3 text-center"
          >
            Register Patient
          </Link>

          <Link
            href="/dashboard"
            className="border border-slate-700 text-white font-bold rounded-xl p-3 text-center"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
