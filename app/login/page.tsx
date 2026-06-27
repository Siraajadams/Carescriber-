"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

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
      email: email.trim(),
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
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/" style={styles.backLink}>
          ← Back to CareScriber
        </Link>

        <p style={styles.label}>Videomed Clinical Assistant</p>

        <h1 style={styles.title}>Doctor Login</h1>

        <p style={styles.subtitle}>
          Login to access consultations, patient records and AI clinical notes.
        </p>

        <form onSubmit={loginDoctor} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {message && <div style={styles.error}>{message}</div>}

          <button disabled={loading} style={styles.button}>
            {loading ? "Logging in..." : "Doctor Login"}
          </button>
        </form>

        <p style={styles.footer}>
          Not registered yet?{" "}
          <Link href="/register" style={styles.link}>
            Register as Doctor
          </Link>
        </p>
      </section>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "24px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "620px",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "36px",
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.14)",
  },
  backLink: {
    color: "#2563eb",
    fontWeight: 700,
    textDecoration: "none",
    fontSize: "16px",
  },
  label: {
    marginTop: "32px",
    color: "#2563eb",
    fontWeight: 700,
    fontSize: "17px",
  },
  title: {
    fontSize: "48px",
    lineHeight: "54px",
    color: "#0f172a",
    marginTop: "16px",
    marginBottom: "18px",
  },
  subtitle: {
    color: "#475569",
    fontSize: "21px",
    lineHeight: "30px",
  },
  form: {
    display: "grid",
    gap: "16px",
    marginTop: "32px",
  },
  input: {
    width: "100%",
    padding: "18px",
    borderRadius: "16px",
    border: "1px solid #cbd5e1",
    fontSize: "18px",
    boxSizing: "border-box",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "16px",
    borderRadius: "16px",
    fontWeight: 700,
  },
  button: {
    width: "100%",
    padding: "18px",
    borderRadius: "16px",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: 700,
    cursor: "pointer",
  },
  footer: {
    marginTop: "28px",
    textAlign: "center",
    color: "#475569",
    fontSize: "17px",
  },
  link: {
    color: "#2563eb",
    fontWeight: 700,
    textDecoration: "none",
  },
};
