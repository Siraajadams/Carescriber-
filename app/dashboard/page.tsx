"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type DoctorProfile = {
  first_name?: string | null;
  surname?: string | null;
  last_name?: string | null;
  email?: string | null;
  hpcsa?: string | null;
  registration_number?: string | null;
  practice_number?: string | null;
};

export default function DashboardPage() {
  const router = useRouter();

  const [doctorName, setDoctorName] =
    useState("Doctor");

  const [profileSummary, setProfileSummary] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function checkLogin() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        let profile: DoctorProfile | null =
          null;

        /*
         * Some profiles use profiles.id =
         * auth.users.id.
         */
        const byId = await supabase
          .from("profiles")
          .select(`
            first_name,
            surname,
            last_name,
            email,
            hpcsa,
            registration_number,
            practice_number
          `)
          .eq("id", user.id)
          .maybeSingle();

        if (!byId.error && byId.data) {
          profile =
            byId.data as DoctorProfile;
        }

        /*
         * Other profiles use profiles.user_id.
         */
        if (!profile) {
          const byUserId = await supabase
            .from("profiles")
            .select(`
              first_name,
              surname,
              last_name,
              email,
              hpcsa,
              registration_number,
              practice_number
            `)
            .eq("user_id", user.id)
            .maybeSingle();

          if (
            !byUserId.error &&
            byUserId.data
          ) {
            profile =
              byUserId.data as DoctorProfile;
          }
        }

        const firstName =
          profile?.first_name ||
          user.user_metadata?.first_name ||
          "Doctor";

        const surname =
          profile?.surname ||
          profile?.last_name ||
          user.user_metadata?.surname ||
          user.user_metadata?.last_name ||
          "";

        const fullName = [
          firstName,
          surname,
        ]
          .filter(Boolean)
          .join(" ");

        setDoctorName(fullName);

        const registrationNumber =
          profile?.registration_number ||
          profile?.hpcsa ||
          "";

        const practiceNumber =
          profile?.practice_number || "";

        const summaryParts = [
          registrationNumber
            ? `HPCSA/MP: ${registrationNumber}`
            : "",
          practiceNumber
            ? `Practice: ${practiceNumber}`
            : "",
        ].filter(Boolean);

        setProfileSummary(
          summaryParts.join(" • "),
        );
      } catch (error) {
        console.error(
          "Dashboard profile error:",
          error,
        );
      } finally {
        setLoading(false);
      }
    }

    void checkLogin();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <p style={styles.loading}>
            Loading dashboard…
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.label}>
          CareScriber AI
        </p>

        <h1 style={styles.title}>
          Welcome, Dr {doctorName}
        </h1>

        <p style={styles.subtitle}>
          Simple clinical assistant for
          consultations, SOAP notes, patient
          summaries and clinical documents.
        </p>

        {profileSummary && (
          <div style={styles.profileSummary}>
            {profileSummary}
          </div>
        )}

        <div style={styles.grid}>
          <Link
            href="/consultation"
            style={styles.primaryCard}
          >
            <div style={styles.icon}>+</div>

            <h2 style={styles.cardTitle}>
              New Consultation
            </h2>

            <p style={styles.cardText}>
              Start recording, generate a
              transcript and create a SOAP note.
            </p>
          </Link>

          <Link
            href="/patients"
            style={styles.optionCard}
          >
            <div style={styles.icon}>
              🔍
            </div>

            <h2 style={styles.cardTitle}>
              Search Patient
            </h2>

            <p style={styles.cardText}>
              Find or register a patient before
              starting a consultation.
            </p>
          </Link>

          <Link
            href="/consultation"
            style={styles.optionCard}
          >
            <div style={styles.icon}>
              📝
            </div>

            <h2 style={styles.cardTitle}>
              Recent Consultations
            </h2>

            <p style={styles.cardText}>
              Continue with the latest
              consultation workflow.
            </p>
          </Link>

          <Link
            href="/profile"
            style={styles.profileCard}
          >
            <div style={styles.icon}>
              👤
            </div>

            <h2 style={styles.cardTitle}>
              My Profile
            </h2>

            <p style={styles.cardText}>
              Update your email, mobile number,
              HPCSA or MP number, practice
              number, qualifications and
              practice address.
            </p>
          </Link>
        </div>

        <div style={styles.workflow}>
          <h3 style={styles.workflowTitle}>
            CareScriber Workflow
          </h3>

          <p>1. Select Patient</p>
          <p>2. Start Recording</p>
          <p>3. Generate SOAP Note</p>
          <p>4. Save Consultation</p>
        </div>

        <button
          type="button"
          onClick={logout}
          style={styles.logout}
        >
          Logout
        </button>
      </section>
    </main>
  );
}

const styles: {
  [key: string]: React.CSSProperties;
} = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },

  card: {
    width: "100%",
    maxWidth: 900,
    boxSizing: "border-box",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: 28,
    padding: 32,
    boxShadow:
      "0 20px 45px rgba(15, 23, 42, 0.14)",
  },

  label: {
    color: "#2563eb",
    fontWeight: 700,
    fontSize: 16,
  },

  title: {
    fontSize: "clamp(34px, 7vw, 44px)",
    lineHeight: 1.15,
    color: "#0f172a",
    marginTop: 16,
    marginBottom: 16,
  },

  subtitle: {
    color: "#475569",
    fontSize: 20,
    lineHeight: "30px",
  },

  profileSummary: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    background: "#eff6ff",
    color: "#1e3a8a",
    fontWeight: 700,
    lineHeight: 1.5,
  },

  grid: {
    display: "grid",
    gap: 18,
    marginTop: 28,
  },

  primaryCard: {
    display: "block",
    background: "#2563eb",
    color: "#ffffff",
    padding: 24,
    borderRadius: 22,
    textDecoration: "none",
  },

  optionCard: {
    display: "block",
    background: "#f8fafc",
    color: "#0f172a",
    padding: 24,
    borderRadius: 22,
    textDecoration: "none",
    border: "1px solid #cbd5e1",
  },

  profileCard: {
    display: "block",
    background: "#fff7ed",
    color: "#9a3412",
    padding: 24,
    borderRadius: 22,
    textDecoration: "none",
    border: "2px solid #fdba74",
  },

  icon: {
    fontSize: 34,
    marginBottom: 10,
  },

  cardTitle: {
    marginTop: 0,
    marginBottom: 10,
    fontSize: 26,
  },

  cardText: {
    margin: 0,
    fontSize: 17,
    lineHeight: 1.5,
  },

  workflow: {
    marginTop: 28,
    background: "#eff6ff",
    padding: 22,
    borderRadius: 20,
    color: "#1e3a8a",
  },

  workflowTitle: {
    marginTop: 0,
    fontSize: 22,
  },

  logout: {
    marginTop: 24,
    width: "100%",
    padding: 16,
    borderRadius: 14,
    border: "none",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },

  loading: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
  },
};
