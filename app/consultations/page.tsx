import Link from "next/link";

export default function ConsultationsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-3">Consultations</h1>
        <p className="text-slate-300 mb-6">
          Manage GP, nurse and pharmacy-first consultations.
        </p>

        <Link
          href="/consultations/new"
          className="bg-emerald-500 text-black font-bold rounded-xl p-3 inline-block"
        >
          Start New Consultation
        </Link>
      </div>
    </main>
  );
}
