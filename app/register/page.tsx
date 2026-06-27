"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function RegisterDoctorPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [practiceNumber, setPracticeNumber] = useState("");
  const [country, setCountry] = useState("South Africa");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function registerDoctor(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!firstName || !surname || !email || !mobile || !registrationNumber || !password) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (password.trim() !== confirmPassword.trim()) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: {
          first_name: firstName.trim(),
          surname: surname.trim(),
          mobile: mobile.trim(),
          registration_number: registrationNumber.trim(),
          practice_number: practiceNumber.trim(),
          country,
          role: "doctor",
        },
      },
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    if (data.user?.id) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        first_name: firstName.trim(),
        surname: surname.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        registration_number: registrationNumber.trim(),
        practice_number: practiceNumber.trim(),
        country,
        role: "doctor",
      });
    }

    setLoading(false);
    router.push("/login");
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/" style={styles.backLink}>← Back to CareScriber</Link>

        <p style={styles.label}>Videomed Clinical Assistant</p>

        <h1 style={styles.title}>Register Doctor</h1>

        <p style={styles.subtitle}>
          Create your clinician profile for CareScriber AI.
        </p>

        <form onSubmit={registerDoctor} style={styles.form}>
          <div style={styles.grid}>
            <input style={styles.input} placeholder="First name *" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input style={styles.input} placeholder="Surname *" value={surname} onChange={(e) => setSurname(e.target.value)} />
          </div>

          <input style={styles.input} type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} />

          <input style={styles.input} placeholder="Mobile *" value={mobile} onChange={(e) => setMobile(e.target.value)} />

          <input style={styles.input} placeholder="HPCSA / registration number *" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />

          <input style={styles.input} placeholder="Practice number" value={practiceNumber} onChange={(e) => setPracticeNumber(e.target.value)} />

          <select style={styles.input} value={country} onChange={(e) => setCountry(e.target.value)}>
            <option>South Africa</option>
            <option>England</option>
            <option>Wales</option>
            <option>Scotland</option>
            <option>New Zealand</option>
          </select>

          <div style={styles.grid}>
            <div style={styles.passwordWrap}>
              <input
                style={styles.passwordInput}
                type={showPassword ? "text" : "password"}
                placeholder="Password *"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            <div style={styles.passwordWrap}>
              <input
                style={styles.passwordInput}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password *"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {message && <div style={styles.error}>{message}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Registering..." : "Register Doctor"}
          </button>
        </form>

        <p style={styles.footer}>
          Already registered?{" "}
          <Link href="/login" style={styles.link}>Login here</Link>
        </p>
      </div>
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
    alignItems: "flex-start",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "720px",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 20px 40px rgba(15, 23, 42, 0.12)",
  },
  backLink: {
    color: "#2563eb",
    fontWeight: 700,
    textDecoration: "none",
  },
  label: {
    marginTop: "28px",
    color: "#2563eb",
    fontWeight: 700,
    fontSize: "14px",
  },
  title: {
    marginTop: "8px",
    fontSize: "36px",
    lineHeight: "42px",
    color: "#0f172a",
  },
  subtitle: {
    color: "#475569",
    fontSize: "17px",
    marginBottom: "24px",
  },
  form: {
    display: "grid",
    gap: "14px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  passwordWrap: {
    position: "relative",
    width: "100%",
  },
  passwordInput: {
    width: "100%",
    padding: "14px 52px 14px 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  eyeButton: {
    position: "absolute",
    right: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "12px 14px",
    borderRadius: "12px",
    fontWeight: 600,
  },
  button: {
    marginTop: "8px",
    width: "100%",
    padding: "16px",
    borderRadius: "14px",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "17px",
    fontWeight: 700,
    cursor: "pointer",
  },
  footer: {
    marginTop: "22px",
    textAlign: "center",
    color: "#475569",
  },
  link: {
    color: "#2563eb",
    fontWeight: 700,
    textDecoration: "none",
  },
};
