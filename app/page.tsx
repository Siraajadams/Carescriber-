import Link from "next/link";

export default function HomePage() {
  const steps = [
    "Patient Search",
    "AI Consent",
    "Voice Recording",
    "Live Transcript",
    "SOAP Note",
    "ICD-10 Coding",
    "Prescription Draft",
    "Referral Letter",
    "Patient Education",
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white px-5 py-6">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 p-6 md:p-10 shadow-2xl">
          <p className="text-emerald-400 font-semibold mb-3">
            Videomed Clinical Assistant
          </p>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">
            CareScriber AI
          </h1>

          <p className="text-slate-300 text-lg md:text-xl max-w-3xl mb-8">
            AI clinical workflow for doctors, nurses, pharmacists and
            pharmacy-first consultations. Turn consultations into SOAP notes,
            ICD-10 suggestions, referrals, prescription drafts and patient
            summaries.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Link className="rounded-xl bg-emerald-500 text-slate-950 font-bold p-4 text-center" href="/login">
              Doctor Login
            </Link>

            <Link className="rounded-xl bg-blue-500 text-white font-bold p-4 text-center" href="/consultations/new">
              Start Consultation
            </Link>

            <Link className="rounded-xl bg-slate-700 text-white font-bold p-4 text-center" href="/patients">
              Search / Register Patient
            </Link>

            <Link className="rounded-xl border border-slate-600 text-white font-bold p-4 text-center" href="/dashboard">
              Dashboard
            </Link>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-2xl md:text-4xl font-bold mb-5">
            One Consultation → Multiple Outputs
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map((step, index) => (
              <div
                key={step}
                className="rounded-2xl bg-slate-900 border border-slate-700 p-5"
              >
                <div className="text-emerald-400 text-sm font-bold mb-2">
                  Step {index + 1}
                </div>
                <div className="text-xl font-semibold">{step}</div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
