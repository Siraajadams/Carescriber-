"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loginDoctor(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <Link href="/" className="text-sm font-semibold text-blue-700">
          ← Back to CareScriber
        </Link>

        <p className="mt-6 text-sm font-semibold text-blue-700">
          Videomed Clinical Assistant
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Doctor Login
        </h1>

        <p className="mt-3 text-slate-600">
          Login to access consultations and patient records.
        </p>

        <form onSubmit={loginDoctor} className="mt-6 grid gap-4">
          <input
            type="email"
            className="rounded-xl border border-slate-300 px-4 py-3"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="rounded-xl border border-slate-300 px-4 py-3"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {message && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          )}

          <button
            disabled={loading}
            className="rounded-xl bg-blue-700 px-6 py-4 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Not registered yet?{" "}
          <Link href="/register" className="font-semibold text-blue-700">
            Register as Doctor
          </Link>
        </p>
      </div>
    </main>
  );
}
