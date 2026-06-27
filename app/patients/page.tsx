"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  patient_id?: string;
  gender?: string;
  mobile?: string;
};

export default function PatientsPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [patientId, setPatientId] = useState("");
  const [gender, setGender] = useState("Female");
  const [mobile, setMobile] = useState("");

  useEffect(() => {
    async function checkLogin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) router.push("/login");
    }

    checkLogin();
  }, [router]);

  async function searchPatients() {
    setMessage("");

    let query = supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (search.trim()) {
      const term = search.trim();
      query = query.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,patient_id.ilike.%${term}%,mobile.ilike.%${term}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      setMessage(error.message);
      return;
    }

    setPatients(data || []);
  }

  async function createPatient(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (saving) return;

    if (!firstName.trim() || !surname.trim()) {
      setMessage("Please enter patient first name and surname.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Your login session expired. Please login again.");
      router.push("/login");
      return;
    }

    setSaving(true);

    const generatedPatientId =
      patientId.trim() || `PT-${Math.floor(100000 + Math.random() * 900000)}`;

    const { data, error } = await supabase
      .from("patients")
      .insert({
        first_name: firstName.trim(),
        last_name: surname.trim(),
        patient_id: generatedPatientId,
        gender,
        mobile: mobile.trim(),
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data?.id) {
      setMessage("Patient was not saved. Please try again.");
      return;
    }

    router.push(`/consultation?patient=${data.id}`);
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/dashboard" style={styles.back}>
          ← Back to Dashboard
        </Link>

        <h1 style={styles.title}>Patient Search</h1>

        <p style={styles.subtitle}>
          Search for an existing patient or create a new patient profile.
        </p>

        <div style={styles.box}>
          <h2 style={styles.sectionTitle}>Search Patient</h2>

          <div style={styles.searchRow}>
            <input
              style={styles.input}
              placeholder="Name, surname, patient ID or mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button onClick={searchPatients} style={styles.smallButton}>
              Search
            </button>
          </div>

          {patients.map((patient) => (
            <div key={patient.id} style={styles.patientCard}>
              <strong>
                {patient.first_name} {patient.last_name}
              </strong>

              <p style={styles.patientText}>
                {patient.patient_id || "No ID"} ·{" "}
                {patient.gender || "No gender"} ·{" "}
                {patient.mobile || "No mobile"}
              </p>

              <Link
                href={`/consultation?patient=${patient.id}`}
                style={styles.startButton}
              >
                Start Consultation
              </Link>
            </div>
          ))}
        </div>

        <form onSubmit={createPatient} style={styles.box}>
          <h2 style={styles.sectionTitle}>Register New Patient</h2>

          <input
            style={styles.input}
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Surname"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Patient ID / SA ID / Passport"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />

          <select
            style={styles.input}
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option>Female</option>
            <option>Male</option>
            <option>Other</option>
          </select>

          <input
            style={styles.input}
            placeholder="Mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />

          {message && <div style={styles.error}>{message}</div>}

          <button type="submit" disabled={saving} style={styles.button}>
            {saving ? "Saving..." : "Save Patient & Start Consultation"}
          </button>
        </form>
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
    maxWidth: 760,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 28,
    padding: 32,
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.14)",
  },
  back: {
    color: "#2563eb",
    fontWeight: 700,
    textDecoration: "none",
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
  box: {
    marginTop: 28,
    display: "grid",
    gap: 14,
  },
  sectionTitle: {
    fontSize: 26,
    color: "#0f172a",
  },
  searchRow: {
    display: "grid",
    gap: 12,
  },
  input: {
    width: "100%",
    padding: "16px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    fontSize: 16,
    boxSizing: "border-box",
  },
  smallButton: {
    padding: "14px",
    borderRadius: 14,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
  },
  button: {
    padding: "16px",
    borderRadius: 14,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    fontSize: 16,
  },
  patientCard: {
    border: "1px solid #cbd5e1",
    borderRadius: 18,
    padding: 16,
  },
  patientText: {
    color: "#64748b",
  },
  startButton: {
    display: "inline-block",
    marginTop: 10,
    padding: "10px 14px",
    borderRadius: 12,
    background: "#2563eb",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 700,
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 12,
    fontWeight: 700,
  },
};
