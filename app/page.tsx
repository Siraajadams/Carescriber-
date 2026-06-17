import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-lg">
        <p className="text-sm font-semibold text-blue-700">
          Videomed Clinical Assistant
        </p>

        <h1 className="mt-4 text-4xl font-bold text-slate-900">
          CareScriber AI
        </h1>

        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Secure AI clinical workflow for registered doctors. Generate SOAP
          notes, ICD-10 suggestions, referral letters, prescription drafts and
          patient summaries after login.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/login"
            className="rounded-2xl bg-blue-700 px-6 py-5 text-center text-lg font-semibold text-white shadow hover:bg-blue-800"
          >
            Doctor Login
          </Link>

          <Link
            href="/register"
            className="rounded-2xl border border-blue-700 bg-white px-6 py-5 text-center text-lg font-semibold text-blue-700 hover:bg-blue-50"
          >
            Register as Doctor
          </Link>
        </div>

        <div className="mt-8 rounded-2xl bg-slate-100 p-5 text-sm text-slate-600">
          <strong className="text-slate-900">Restricted access:</strong>{" "}
          Consultations, patient dashboard, patient search and AI outputs are
          only available after doctor login.
        </div>
      </section>
    </main>
  );
}
