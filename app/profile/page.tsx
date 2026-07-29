"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type DoctorProfile = {
  id?: string;
  user_id?: string | null;

  first_name?: string | null;
  surname?: string | null;
  last_name?: string | null;

  email?: string | null;
  mobile?: string | null;
  phone?: string | null;

  hpcsa?: string | null;
  registration_number?: string | null;

  practice_number?: string | null;
  practice_address?: string | null;

  qualifications?: string | null;
  qualification?: string | null;
};

export default function DoctorProfilePage() {
  const [profileId, setProfileId] = useState("");
  const [authUserId, setAuthUserId] = useState("");

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");

  const [email, setEmail] = useState("");
  const [originalEmail, setOriginalEmail] =
    useState("");

  const [mobile, setMobile] = useState("");
  const [registrationNumber, setRegistrationNumber] =
    useState("");
  const [practiceNumber, setPracticeNumber] =
    useState("");
  const [practiceAddress, setPracticeAddress] =
    useState("");
  const [qualifications, setQualifications] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage(
          "Your login session could not be found. Please sign in again.",
        );
        return;
      }

      setAuthUserId(user.id);

      let profile: DoctorProfile | null = null;

      /*
       * Some CareScriber installations use profiles.id
       * as the auth user ID.
       */
      const byId = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!byId.error && byId.data) {
        profile = byId.data as DoctorProfile;
      }

      /*
       * Other installations use profiles.user_id.
       */
      if (!profile) {
        const byUserId = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!byUserId.error && byUserId.data) {
          profile = byUserId.data as DoctorProfile;
        }
      }

      if (!profile) {
        setMessage(
          "No doctor profile is linked to this login. Please ask the administrator to create your profile.",
        );
        return;
      }

      setProfileId(profile.id || "");

      setFirstName(profile.first_name || "");
      setSurname(
        profile.surname ||
          profile.last_name ||
          "",
      );

      const resolvedEmail =
        profile.email || user.email || "";

      setEmail(resolvedEmail);
      setOriginalEmail(user.email || resolvedEmail);

      setMobile(
        profile.mobile ||
          profile.phone ||
          "",
      );

      setRegistrationNumber(
        profile.registration_number ||
          profile.hpcsa ||
          "",
      );

      setPracticeNumber(
        profile.practice_number || "",
      );

      setPracticeAddress(
        profile.practice_address || "",
      );

      setQualifications(
        profile.qualifications ||
          profile.qualification ||
          "",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load your profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  function validate() {
    const missing: string[] = [];

    if (!firstName.trim()) {
      missing.push("First name");
    }

    if (!surname.trim()) {
      missing.push("Surname");
    }

    if (
      !email.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email.trim(),
      )
    ) {
      missing.push("Valid email address");
    }

    if (!registrationNumber.trim()) {
      missing.push(
        "HPCSA or MP registration number",
      );
    }

    if (!practiceNumber.trim()) {
      missing.push("Practice number");
    }

    if (!practiceAddress.trim()) {
      missing.push("Practice address");
    }

    return missing;
  }

  async function saveProfile() {
    setSaving(true);
    setMessage("");

    try {
      const missing = validate();

      if (missing.length > 0) {
        setMessage(
          `Please complete:\n• ${missing.join(
            "\n• ",
          )}`,
        );
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage(
          "Your session has expired. Please sign in again.",
        );
        return;
      }

      const payload = {
        first_name: firstName.trim(),

        /*
         * Save to both surname conventions so all
         * CareScriber pages continue to work.
         */
        surname: surname.trim(),
        last_name: surname.trim(),

        email: email.trim().toLowerCase(),

        mobile: mobile.trim() || null,
        phone: mobile.trim() || null,

        registration_number:
          registrationNumber.trim(),
        hpcsa: registrationNumber.trim(),

        practice_number:
          practiceNumber.trim(),

        practice_address:
          practiceAddress.trim(),

        qualifications:
          qualifications.trim() || null,
        qualification:
          qualifications.trim() || null,

        updated_at: new Date().toISOString(),
      };

      let updateQuery = supabase
        .from("profiles")
        .update(payload);

      if (profileId) {
        updateQuery = updateQuery.eq(
          "id",
          profileId,
        );
      } else {
        updateQuery = updateQuery.eq(
          "user_id",
          authUserId,
        );
      }

      const {
        data: updatedProfile,
        error: profileError,
      } = await updateQuery
        .select("id")
        .maybeSingle();

      if (profileError) {
        throw new Error(
          `Profile update failed: ${profileError.message}`,
        );
      }

      if (!updatedProfile) {
        throw new Error(
          "The profile was not updated. Check that the profile is linked to the logged-in user and that the RLS policy is active.",
        );
      }

      /*
       * Keep the login email synchronized.
       *
       * Supabase may send confirmation links before
       * applying the new login email.
       */
      const normalizedNewEmail =
        email.trim().toLowerCase();

      const normalizedOriginalEmail =
        originalEmail.trim().toLowerCase();

      if (
        normalizedNewEmail !==
        normalizedOriginalEmail
      ) {
        const { error: emailError } =
          await supabase.auth.updateUser({
            email: normalizedNewEmail,
          });

        if (emailError) {
          setMessage(
            `Your professional profile was updated, but the login email could not be changed: ${emailError.message}`,
          );
          return;
        }

        setMessage(
          "Profile updated. Please check your current and new email addresses for the email-change confirmation messages.",
        );
        setOriginalEmail(normalizedNewEmail);
        return;
      }

      setMessage(
        "Your doctor profile was updated successfully.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Profile update failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <p style={styles.loading}>
            Loading doctor profile…
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link
          href="/dashboard"
          style={styles.back}
        >
          ← Back to Dashboard
        </Link>

        <p style={styles.kicker}>
          CareScriber
        </p>

        <h1 style={styles.title}>
          My Profile
        </h1>

        <p style={styles.subtitle}>
          Update the professional details that
          appear on prescriptions, referrals and
          medical certificates.
        </p>

        <div style={styles.notice}>
          Changes to your login email may require
          confirmation from both your current and
          new email addresses.
        </div>

        <h2 style={styles.heading}>
          Personal details
        </h2>

        <label style={styles.label}>
          First name
        </label>
        <input
          style={styles.input}
          value={firstName}
          onChange={(event) =>
            setFirstName(event.target.value)
          }
          placeholder="First name"
        />

        <label style={styles.label}>
          Surname
        </label>
        <input
          style={styles.input}
          value={surname}
          onChange={(event) =>
            setSurname(event.target.value)
          }
          placeholder="Surname"
        />

        <label style={styles.label}>
          Email address
        </label>
        <input
          style={styles.input}
          type="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          placeholder="doctor@example.com"
        />

        <label style={styles.label}>
          Mobile number
        </label>
        <input
          style={styles.input}
          value={mobile}
          onChange={(event) =>
            setMobile(event.target.value)
          }
          placeholder="Mobile number"
        />

        <h2 style={styles.heading}>
          Professional details
        </h2>

        <label style={styles.label}>
          HPCSA / MP registration number
        </label>
        <input
          style={styles.input}
          value={registrationNumber}
          onChange={(event) =>
            setRegistrationNumber(
              event.target.value,
            )
          }
          placeholder="HPCSA or MP number"
        />

        <label style={styles.label}>
          Practice number
        </label>
        <input
          style={styles.input}
          value={practiceNumber}
          onChange={(event) =>
            setPracticeNumber(
              event.target.value,
            )
          }
          placeholder="Practice number"
        />

        <label style={styles.label}>
          Qualifications
        </label>
        <input
          style={styles.input}
          value={qualifications}
          onChange={(event) =>
            setQualifications(
              event.target.value,
            )
          }
          placeholder="Example: MBChB, Dip HIV Man"
        />

        <label style={styles.label}>
          Practice address
        </label>
        <textarea
          style={styles.textarea}
          value={practiceAddress}
          onChange={(event) =>
            setPracticeAddress(
              event.target.value,
            )
          }
          placeholder="Practice address"
        />

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        <button
          type="button"
          style={styles.saveButton}
          onClick={saveProfile}
          disabled={saving}
        >
          {saving
            ? "Saving…"
            : "Save Profile"}
        </button>
      </section>
    </main>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#eef4fb",
    padding: 18,
    fontFamily:
      "Arial, Helvetica, sans-serif",
    color: "#0f172a",
  },

  card: {
    maxWidth: 760,
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: 28,
    padding: 28,
    boxShadow:
      "0 20px 60px rgba(15,23,42,.12)",
  },

  back: {
    color: "#2563eb",
    fontWeight: 800,
    textDecoration: "none",
    fontSize: 18,
  },

  kicker: {
    marginTop: 30,
    color: "#2563eb",
    fontWeight: 900,
    fontSize: 18,
  },

  title: {
    fontSize: 48,
    lineHeight: 1,
    margin: "12px 0",
    fontWeight: 900,
  },

  subtitle: {
    fontSize: 20,
    color: "#526174",
    lineHeight: 1.45,
  },

  heading: {
    fontSize: 28,
    fontWeight: 900,
    marginTop: 30,
  },

  label: {
    display: "block",
    fontWeight: 800,
    marginTop: 16,
    marginBottom: 7,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "2px solid #cbd5e1",
    borderRadius: 16,
    padding: 16,
    fontSize: 17,
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 120,
    border: "2px solid #cbd5e1",
    borderRadius: 16,
    padding: 16,
    fontSize: 17,
    resize: "vertical",
  },

  notice: {
    marginTop: 18,
    padding: 15,
    borderRadius: 14,
    background: "#fff7ed",
    color: "#9a3412",
    fontWeight: 700,
    lineHeight: 1.5,
  },

  message: {
    marginTop: 20,
    padding: 15,
    borderRadius: 14,
    background: "#e0f2fe",
    color: "#075985",
    fontWeight: 800,
    whiteSpace: "pre-line",
  },

  saveButton: {
    width: "100%",
    marginTop: 22,
    border: 0,
    borderRadius: 18,
    padding: 19,
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 20,
    cursor: "pointer",
  },

  loading: {
    fontSize: 20,
    fontWeight: 800,
  },
};
