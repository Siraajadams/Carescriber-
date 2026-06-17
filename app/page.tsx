import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="grid lg:grid-cols-2">
            {/* Left */}
            <div className="p-10 lg:p-16">
              <div className="inline-flex items-center rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                Videomed Clinical Assistant
              </div>

              <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900">
                CareScriber AI
              </h1>

              <p className="mt-6 text-xl leading-8 text-slate-600">
                AI-powered clinical documentation for doctors, nurses,
                prescribing pharmacists and pharmacy-first consultations.
              </p>

              <p className="mt-4 text-lg text-slate-500">
                Generate SOAP Notes, ICD-10 coding suggestions, referrals,
                prescription drafts, patient summaries and consultation records
                in minutes.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/login"
                  className="rounded-2xl bg-blue-700 px-8 py-4 text-center text-lg font-semibold text-white shadow-lg transition hover:bg-blue-800"
                >
                  Doctor Login
                </Link>

                <Link
                  href="/register"
                  className="rounded-2xl border-2 border-blue-700 px-8 py-4 text-center text-lg font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  Register as Doctor
                </Link>
              </div>

              <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <p className="font-semibold text-slate-900">
                  Secure Clinical Access
                </p>

                <p className="mt-2 text-sm text-slate-600">
                  Patient records, consultations, transcription, SOAP notes,
                  ICD-10 coding and prescriptions are only available after
                  authenticated doctor login.
                </p>
              </div>
            </div>

            {/* Right */}
            <div className="bg-gradient-to-br from-blue-700 to-sky-600 p-10 text-white lg:p-16">
              <h2 className="text-3xl font-bold">
                One Consultation → Multiple Outputs
              </h2>

              <div className="mt-8 space-y-4">
                {[
                  "Patient Search",
                  "AI Consent Capture",
                  "Voice Recording",
                  "Live Clinical Transcript",
                  "SOAP Note Generation",
                  "ICD-10 Coding",
                  "Referral Letters",
                  "Prescription Drafts",
                  "Patient Summary",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="flex items-center rounded-xl bg-white/10 p-4 backdrop-blur-sm"
                  >
                    <div className="mr-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-blue-700">
                      {index + 1}
                    </div>

                    <span className="font-medium">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-10 rounded-2xl bg-white/10 p-6 backdrop-blur-sm">
                <p className="text-lg font-semibold">
                  Designed for Modern Clinical Workflows
                </p>

                <p className="mt-3 text-blue-100">
                  Reduce administration time and focus on patient care while
                  CareScriber AI assists with clinical documentation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">
              Clinical Documentation
            </h3>
            <p className="mt-3 text-slate-600">
              Generate structured SOAP notes directly from consultation
              recordings.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">
              ICD-10 Coding
            </h3>
            <p className="mt-3 text-slate-600">
              Receive intelligent coding suggestions based on clinical context.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">
              Patient Summaries
            </h3>
            <p className="mt-3 text-slate-600">
              Automatically generate concise patient summaries and referral
              documentation.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
