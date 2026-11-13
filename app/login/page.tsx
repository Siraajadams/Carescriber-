
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
  const [showPassword, setShowPassword] = useState(false);

  async function loginDoctor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setMessage("");
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail || !password) {
        throw new Error(
          "Please enter your email address and password."
        );
      }

      // Sign in using the existing CareScriber
      // Supabase authentication client.
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        throw new Error(error.message);
      }

      // Verify that Supabase created a session.
      if (!data.session?.access_token) {
        throw new Error(
          "Login succeeded but no authentication session was created."
        );
      }

      // Validate the session with Supabase Auth.
      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser(
        data.session.access_token
      );

      if (userError || !userData.user) {
        throw new Error(
          "Unable to verify your login session."
        );
      }

      // Verify that the session can be retrieved
      // by other CareScriber pages.
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Authentication session was not saved. Please try again."
        );
      }

      // Confirm the session belongs to the
      // authenticated doctor.
      if (session.user.id !== userData.user.id) {
        throw new Error(
          "Authentication session mismatch. Please sign in again."
        );
      }

      // Redirect only after successful verification.
      router.replace("/dashboard");
      router.refresh();

    } catch (error: unknown) {
      console.error("CareScriber login error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/" style={styles.backLink}>
          ← Back to CareScriber
        </Link>

        <p style={styles.label}>
          Videomed Clinical Assistant
        </p>

        <h1 style={styles.title}>
          Doctor Login
        </h1>

        <p style={styles.subtitle}>
          Login to access consultations, patient
          records and AI clinical notes.
        </p>

        <form
          onSubmit={loginDoctor}
          style={styles.form}
        >
          <label style={styles.fieldLabel}>
            Email address
          </label>

          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={loading}
          />

          <label style={styles.fieldLabel}>
            Password
          </label>

          <div style={styles.passwordContainer}>
            <input
              style={styles.passwordInput}
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              autoComplete="current-password"
              required
              disabled={loading}
            />

            <button
              type="button"
              style={styles.passwordToggle}
              onClick={() =>
                setShowPassword(!showPassword)
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {message && (
            <div
              style={styles.error}
              role="alert"
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Verifying login..."
              : "Doctor Login"}
          </button>
        </form>

        <p style={styles.footer}>
          Not registered yet?{" "}
          <Link
            href="/register"
            style={styles.link}
          >
            Register as Doctor
          </Link>
        </p>

        <div style={styles.securityNotice}>
          <span style={styles.securityIcon}>
            🔒
          </span>

          <div>
            <strong>
              Secure Doctor Access
            </strong>

            <p style={styles.securityText}>
              Patient records, consultations,
              prescriptions, medical certificates
              and referrals require authenticated
              clinical access.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "24px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },

  card: {
    width: "100%",
    maxWidth: "620px",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "36px",
    boxShadow:
      "0 20px 45px rgba(15, 23, 42, 0.14)",
    boxSizing: "border-box",
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
    fontSize: "clamp(34px, 7vw, 48px)",
    lineHeight: 1.12,
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

  fieldLabel: {
    color: "#334155",
    fontSize: "15px",
    fontWeight: 700,
  },

  input: {
    width: "100%",
    padding: "18px",
    borderRadius: "16px",
    border: "1px solid #cbd5e1",
    fontSize: "18px",
    boxSizing: "border-box",
    background: "#ffffff",
    color: "#0f172a",
  },

  passwordContainer: {
    position: "relative",
    width: "100%",
  },

  passwordInput: {
    width: "100%",
    padding: "18px",
    paddingRight: "85px",
    borderRadius: "16px",
    border: "1px solid #cbd5e1",
    fontSize: "18px",
    boxSizing: "border-box",
    background: "#ffffff",
    color: "#0f172a",
  },

  passwordToggle: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    color: "#2563eb",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    padding: "8px",
  },

  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "16px",
    borderRadius: "16px",
    fontWeight: 700,
    lineHeight: 1.5,
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

  securityNotice: {
    display: "flex",
    gap: "14px",
    marginTop: "28px",
    padding: "18px",
    background: "#eff6ff",
    borderRadius: "16px",
    color: "#1e3a8a",
    lineHeight: 1.5,
  },

  securityIcon: {
    fontSize: "24px",
  },

  securityText: {
    marginTop: "6px",
    marginBottom: 0,
    fontSize: "14px",
    lineHeight: 1.6,
  },
};
