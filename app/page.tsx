import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="px-6 py-12 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex rounded-full bg-emerald-500/10 text-emerald-300 px-4 py-2 text-sm mb-5">
              Videomed Clinical Assistant
            </div>

            <h1 className="text-5xl font-bold leading-tight mb-5">
              CareScriber AI
            </h1>

            <p className="text-xl text-slate-300 mb-8">
              AI clinical operating system for doctors, nurses, pharmacists and
              independent prescribers. Turn consultations into SOAP notes,
              ICD-10 codes, referrals, prescriptions and patient summaries.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/consultations/new"
                className="bg-emerald-500 text-black font-bold rounded-xl px-6 py-4"
              >
                🎤 Start Consultation
              </Link>

              <Link
                href="/patients"
                className="bg-white text-slate-950 font-bold rounded-xl px-6 py-4"
              >
                🔍 Search / Register Patient
              </Link>

              <Link
                href="/login"
                className="border border-slate-700 text-white font-bold rounded-xl px-6 py-4"
              >
                🩺 Register Doctor
              </Link>
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">One Consultation → Multiple Outputs</h2>

            <div className="space-y-4">
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
                "Secure Record",
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="bg-slate-800 rounded-xl px-4 py-3 flex-1">
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="grid md:grid-cols-4 gap-4 mt-12">
          <Stat title="Patients" value="Register & search" />
          <Stat title="Consultations" value="Record & document" />
          <Stat title="Clinical Notes" value="SOAP + summary" />
          <Stat title="Coding" value="ICD-10 ready" />
        </section>

        <section className="mt-14">
          <h2 className="text-3xl font-bold mb-6">Clinical Workflow Modules</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <Feature
              icon="🏥"
              title="Pharmacy First"
              text="Triage symptoms, generate pharmacy outcomes, refer to GP or emergency when needed."
            />
            <Feature
              icon="🧑‍⚕️"
              title="Nurse Clinics"
              text="Capture vitals, BMI, BP, glucose, weight-loss and chronic disease reviews."
            />
            <Feature
              icon="🩺"
              title="GP Consultation"
              text="Create structured notes, diagnoses, treatment plans, referrals and follow-ups."
            />
            <Feature
              icon="💊"
              title="Prescription Ready"
              text="Draft medicine, dose, frequency, duration, warnings and pharmacy routing."
            />
            <Feature
              icon="📄"
              title="Referral Engine"
              text="Create referral letters with clinical summary, reason and supporting notes."
            />
            <Feature
              icon="🧬"
              title="HIV / GLP-1 Workflows"
              text="Support PrEP, PEP, DoxyPEP and weight-loss eligibility workflows."
            />
          </div>
        </section>
      </section>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <p className="text-slate-400 text-sm">{title}</p>
      <p className="text-xl font-bold mt-2">{value}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-slate-300">{text}</p>
    </div>
  );
}
