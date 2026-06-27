"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [doctorName, setDoctorName] = useState("Doctor");

  useEffect(() => {
    async function checkLogin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setDoctorName(user.user_metadata?.first_name || "Doctor");
    }

    checkLogin();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.label}>CareScriber AI</p>

        <h1 style={styles.title}>Welcome, Dr {doctorName}</h1>

        <p style={styles.subtitle}>
          Simple clinical assistant for consultations, SOAP notes and patient
          summaries.
        </p>

        <div style={styles.grid}>
          <Link href="/consultation" style={styles.primaryCard}>
            <div style={styles.icon}>+</div>
            <h2>New Consultation</h2>
            <p>Start recording, generate transcript and SOAP note.</p>
          </Link>

          <Link href="/patients" style={styles.optionCard}>
            <div style={styles.icon}>🔍</div>
            <h2>Search Patient</h2>
            <p>Find or register a patient before consultation.</p>
          </Link>

          <Link href="/consultation" style={styles.optionCard}>
            <div style={styles.icon}>📝</div>
            <h2>Recent Consultations</h2>
            <p>Continue with the latest consultation workflow.</p>
          </Link>
        </div>

        <div style={styles.workflow}>
          <h3>CareScriber Workflow</h3>
          <p>1. Select Patient</p>
          <p>2. Start Recording</p>
          <p>3. Generate SOAP Note</p>
          <p>4. Save Consultation</p>
        </div>

        <button onClick={logout} style={styles.logout}>
          Logout
        </button>
      </section>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  card: {
    maxWidth: 900,
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: 28,
    padding: 32,
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.14)",
  },
  label: {
    color: "#2563eb",
    fontWeight: 700,
    fontSize: 16,
  },
  title: {
    fontSize: 44,
    lineHeight: "50px",
    color: "#0f172a",
  },
  subtitle: {
    color: "#475569",
    fontSize: 20,
    lineHeight: "30px",
  },
  grid: {
    display: "grid",
    gap: 18,
    marginTop: 28,
  },
  primaryCard: {
    background: "#2563eb",
    color: "#ffffff",
    padding: 24,
    borderRadius: 22,
    textDecoration: "none",
  },
  optionCard: {
    background: "#f8fafc",
    color: "#0f172a",
    padding: 24,
    borderRadius: 22,
    textDecoration: "none",
    border: "1px solid #cbd5e1",
  },
  icon: {
    fontSize: 34,
    marginBottom: 10,
  },
  workflow: {
    marginTop: 28,
    background: "#eff6ff",
    padding: 22,
    borderRadius: 20,
    color: "#1e3a8a",
  },
  logout: {
    marginTop: 24,
    width: "100%",
    padding: 16,
    borderRadius: 14,
    border: "none",
    background: "#0f172a",
    color: "#fff",
    fontWeight: 700,
    fontSize: 16,
  },
};
