"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Patient = {
  id: string;
  first_name?: string | null;
  surname?: string | null;
  last_name?: string | null;
  patient_id?: string | null;
  id_number?: string | null;
  national_id?: string | null;
  date_of_birth?: string | null;
  dob?: string | null;
  gender?: string | null;
  mobile?: string | null;
  phone?: string | null;
  email?: string | null;
  created_at?: string | null;
};

function normaliseId(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function displaySurname(patient: Patient) {
  return patient.surname || patient.last_name || "";
}

function displayPatientId(patient: Patient) {
  return patient.patient_id || patient.id_number || patient.national_id || "";
}

function displayDob(patient: Patient) {
  return patient.date_of_birth || patient.dob || "";
}

function displayMobile(patient: Patient) {
  return patient.mobile || patient.phone || "";
}

function calculateAge(dob?: string | null) {
  if (!dob) return "";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return String(age);
}

export default function PatientsPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [patientId, setPatientId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("Female");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function checkLogin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) router.push("/login");
    }

    checkLogin();
  }, [router]);

  async function searchPatients(searchOverride?: string) {
    setMessage("");
    setSearching(true);

    const term = (searchOverride ?? search).trim();
    const clean = normaliseId(term);

    let query = supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (term) {
      query = query.or(
        [
          `first_name.ilike.%${term}%`,
          `surname.ilike.%${term}%`,
          `last_name.ilike.%${term}%`,
          `patient_id.ilike.%${term}%`,
          `id_number.ilike.%${term}%`,
          `national_id.ilike.%${term}%`,
          `mobile.ilike.%${term}%`,
          `phone.ilike.%${term}%`,
          `email.ilike.%${term}%`,
          `patient_id.ilike.%${clean}%`,
          `id_number.ilike.%${clean}%`,
          `national_id.ilike.%${clean}%`,
        ].join(",")
      );
    }

    const { data, error } = await query;

    setSearching(false);

    if (error) {
      setMessage(error.message);
      return [];
    }

    setPatients((data || []) as Patient[]);

    if (term && (!data || data.length === 0)) {
      setMessage("No matching patient found. Complete the registration form below.");
    }

    if (data && data.length > 1 && clean) {
      const exactMatches = data.filter((p: Patient) => {
        const values = [p.patient_id, p.id_number, p.national_id]
          .filter(Boolean)
          .map((v) => normaliseId(String(v)));
        return values.includes(clean);
      });

      if (exactMatches.length > 1) {
        setMessage(
          `Warning: ${exactMatches.length} records found for this ID. Use the best matching existing patient and clean duplicates later.`
        );
      }
    }

    return (data || []) as Patient[];
  }

  async function createPatient(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (saving) return;

    if (!firstName.trim() || !surname.trim()) {
      setMessage("Please enter patient first name and surname.");
      return;
    }

    if (!patientId.trim()) {
      setMessage("Please enter National ID / Passport number.");
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

    const cleanId = normaliseId(patientId);

    const { data: existing, error: existingError } = await supabase
      .from("patients")
      .select("*")
      .or(
        [
          `patient_id.eq.${cleanId}`,
          `id_number.eq.${cleanId}`,
          `national_id.eq.${cleanId}`,
          `patient_id.eq.${patientId.trim()}`,
          `id_number.eq.${patientId.trim()}`,
          `national_id.eq.${patientId.trim()}`,
        ].join(",")
      )
      .limit(1);

    if (existingError) {
      setSaving(false);
      setMessage("Patient lookup failed: " + existingError.message);
      return;
    }

    if (existing && existing.length > 0) {
      setSaving(false);
      const patient = existing[0] as Patient;
      setMessage(
        "Existing patient found. Opening consultation instead of creating a duplicate."
      );
      router.push(`/consultation?patient=${patient.id}`);
      return;
    }

    const generatedPatientId = cleanId || `PT-${Math.floor(100000 + Math.random() * 900000)}`;

    const payload: Record<string, any> = {
      first_name: firstName.trim(),
      last_name: surname.trim(),
      surname: surname.trim(),
      patient_id: generatedPatientId,
      id_number: generatedPatientId,
      national_id: generatedPatientId,
      date_of_birth: dateOfBirth || null,
      dob: dateOfBirth || null,
      gender,
      mobile: mobile.trim() || null,
      phone: mobile.trim() || null,
      email: email.trim() || null,
      created_at: new Date().toISOString(),
      source: "CareScriber",
    };

    const insertAttempts = [
      payload,
      {
        first_name: payload.first_name,
        last_name: payload.last_name,
        patient_id: payload.patient_id,
        gender: payload.gender,
        mobile: payload.mobile,
        created_at: payload.created_at,
      },
    ];

    let savedId = "";
    let lastError = "";

    for (const attempt of insertAttempts) {
      const { data, error } = await supabase
        .from("patients")
        .insert(attempt)
        .select("id")
        .single();

      if (!error && data?.id) {
        savedId = data.id;
        break;
      }

      lastError = error?.message || "Unknown patient save error.";
    }

    setSaving(false);

    if (!savedId) {
      setMessage(lastError || "Patient was not saved. Please try again.");
      return;
    }

    router.push(`/consultation?patient=${savedId}`);
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/dashboard" style={styles.back}>
          ← Back to Dashboard
        </Link>

        <h1 style={styles.title}>Patient Search</h1>

        <p style={styles.subtitle}>
          Search by National ID / Passport first. This prevents duplicate patient profiles between SymptomAI and CareScriber.
        </p>

        <div style={styles.box}>
          <h2 style={styles.sectionTitle}>Search Existing Patient</h2>

          <div style={styles.searchRow}>
            <input
              style={styles.input}
              placeholder="National ID / Passport, name, surname or mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button onClick={() => searchPatients()} style={styles.smallButton}>
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          {patients.map((patient) => (
            <div key={patient.id} style={styles.patientCard}>
              <strong>
                {patient.first_name || "No first name"} {displaySurname(patient)}
              </strong>

              <p style={styles.patientText}>
                ID: {displayPatientId(patient) || "No ID"} · DOB:{" "}
                {displayDob(patient) || "No DOB"} · Age:{" "}
                {calculateAge(displayDob(patient)) || "N/A"} ·{" "}
                {patient.gender || "No gender"} · {displayMobile(patient) || "No mobile"}
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

          <p style={styles.helper}>
            Only register a new patient after searching by National ID / Passport and confirming no existing record appears.
          </p>

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
            placeholder="National ID / Passport"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          />

          <input
            style={styles.input}
            type="date"
            placeholder="Date of birth"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
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

          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {message && <div style={styles.message}>{message}</div>}

          <button type="submit" disabled={saving} style={styles.button}>
            {saving ? "Saving..." : "Save Patient & Start Consultation"}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
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
  helper: {
    margin: 0,
    color: "#64748b",
    fontSize: 16,
    lineHeight: "24px",
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
    background: "#0f172a",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  button: {
    padding: "16px",
    borderRadius: 14,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
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
  message: {
    background: "#e0f2fe",
    color: "#075985",
    padding: 12,
    borderRadius: 12,
    fontWeight: 700,
  },
};
