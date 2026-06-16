import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-8">
        <div className="mb-6 inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
          Videomed Clinical Assistant
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h1 className="mb-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              CareScriber AI
            </h1>

            <p className="mb-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              AI clinical workflow for doctors, nurses, pharmacists and
              pharmacy-first consultations. Turn consultations into SOAP notes,
              ICD-10 suggestions, referrals, prescription drafts and patient
              summaries.
            </p>

            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Link
                href="/login"
                className="rounded-xl bg-cyan-400 px-5 py-3 text-center font-bold text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:bg-cyan-300"
              >
                Doctor Login
              </Link>

              <Link
                href="/consultations/new"
                className="rounded-xl bg-emerald-400 px-5 py-3 text-center font-bold text-slate-950 shadow-lg shadow-emerald-400/20 transition hover:bg-emerald-300"
              >
                Start Consultation
              </Link>

              <Link
                href="/patients"
                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-center font-bold text-white transition hover:bg-slate-800"
              >
                Search / Register Patient
              </Link>

              <Link
                href="/dashboard"
                className="rounded-xl border border-slate-700 px-5 py-3 text-center font-bold text-slate-200 transition hover:bg-slate-900"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
            <h2 className="mb-4 text-2xl font-bold text-white">
              One Consultation → Multiple Outputs
            </h2>

            <div className="grid gap-3">
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
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 text-sm font-black text-slate-950">
                    {index + 1}
                  </div>
                  <div className="font-semibold text-slate-100">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Doctors",
              text: "Capture consultations, generate SOAP notes and clinical summaries.",
            },
            {
              title: "Nurses",
              text: "Record vitals, BMI, blood pressure and follow-up actions.",
            },
            {
              title: "Pharmacy First",
              text: "Support triage, treatment plans and referral workflows.",
            },
            {
              title: "Clinical Outputs",
              text: "Generate ICD-10, referrals, patient education and prescriptions.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <h3 className="mb-2 text-lg font-bold text-cyan-200">
                {card.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
