import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">CareScriber Dashboard</h1>
        <p className="text-slate-300 mb-6">
          AI clinical operating system for doctors, nurses and pharmacies.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/patients" className="bg-slate-900 rounded-2xl p-6 hover:bg-slate-800">
            <h2 className="text-xl font-bold">Patients</h2>
            <p className="text-slate-300">Register and manage patients.</p>
          </Link>

          <Link href="/consultations/new" className="bg-slate-900 rounded-2xl p-6 hover:bg-slate-800">
            <h2 className="text-xl font-bold">New Consultation</h2>
            <p className="text-slate-300">Start SOAP note and clinical workflow.</p>
          </Link>

          <Link href="/login" className="bg-slate-900 rounded-2xl p-6 hover:bg-slate-800">
            <h2 className="text-xl font-bold">Doctor Registration</h2>
            <p className="text-slate-300">Register doctor profile.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
