import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 font-semibold">
              Videomed Clinical Assistant
            </p>
            <h1 className="text-2xl font-bold text-slate-900">CareScriber AI</h1>
          </div>

          <Link
            href="/login"
            className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold text-sm"
          >
            Doctor Login
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold mb-4">
              AI clinical operating system
            </span>

            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-4">
              One consultation.
              <br />
              Multiple clinical outputs.
            </h2>

            <p className="text-lg text-slate-600 mb-6">
              Turn doctor, nurse and pharmacy-first consultations into SOAP
              notes, ICD-10 suggestions, referrals, prescription drafts and
              patient summaries.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/consultations/new"
                className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold text-center"
              >
                Start Consultation
              </Link>

              <Link
                href="/patients"
                className="bg-white text-slate-900 border border-slate-300 px-5 py-3 rounded-xl font-bold text-center"
              >
                Search / Register Patient
              </Link>

              <Link
                href="/dashboard"
                className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-center"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">
              Clinical Workflow
            </h3>

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
                  className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <p className="font-semibold text-slate-800">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-10">
          <FeatureCard
            title="Doctors"
            text="Register clinician profiles and generate structured consultation notes."
          />
          <FeatureCard
            title="Patients"
            text="Capture patient demographics, allergies, medicines and consent."
          />
          <FeatureCard
            title="Pharmacy First"
            text="Support triage, prescribing workflows, referral letters and follow-up."
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{text}</p>
    </div>
  );
}
