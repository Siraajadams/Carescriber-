import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-emerald-400 font-semibold">Videomed Clinical Assistant</p>
          <h1 className="text-4xl font-bold mt-2">CareScriber AI</h1>
          <p className="text-slate-300 mt-3 max-w-2xl">
            AI clinical workflow for doctors, nurses, pharmacists and pharmacy-first consultations.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Link href="/consultations/new" className="bg-emerald-500 text-black rounded-2xl p-5 font-bold">
            🎤 Start Consultation
          </Link>
          <Link href="/patients" className="bg-slate-800 rounded-2xl p-5 font-bold">
            🔍 Search / Register Patient
          </Link>
          <Link href="/login" className="bg-slate-800 rounded-2xl p-5 font-bold">
            🩺 Register Doctor
          </Link>
          <Link href="/dashboard" className="bg-slate-800 rounded-2xl p-5 font-bold">
            📊 Dashboard
          </Link>
        </div>

        <section className="bg-slate-900 rounded-3xl p-6">
          <h2 className="text-2xl font-bold mb-4">Clinical Workflow</h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Patient Search",
              "AI Consent",
              "Voice Recording",
              "Live Transcript",
              "SOAP Note",
              "ICD-10 Coding",
              "Prescription Draft",
              "Referral Letter",
              "Patient Education",
            ].map((item, index) => (
              <div key={item} className="bg-slate-800 rounded-xl p-4">
                <span className="text-emerald-400 font-bold">{index + 1}. </span>
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
