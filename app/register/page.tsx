"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type MessageType = "error" | "success" | "";

export default function RegisterDoctorPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [speciality, setSpeciality] = useState("General Practitioner");
  const [practiceNumber, setPracticeNumber] = useState("");
  const [practiceAddress, setPracticeAddress] = useState("");
  const [country, setCountry] = useState("South Africa");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("");

  function showError(text: string) {
    setMessageType("error");
    setMessage(text);
  }

  function showSuccess(text: string) {
    setMessageType("success");
    setMessage(text);
  }

  function normaliseMobile(value: string) {
    return value.replace(/[^\d+]/g, "").trim();
  }

  async function registerDoctor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setMessage("");
    setMessageType("");

    const cleanFirstName = firstName.trim();
    const cleanSurname = surname.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = normaliseMobile(mobile);
    const cleanRegistrationNumber = registrationNumber.trim();
    const cleanQualifications = qualifications.trim();
    const cleanSpeciality = speciality.trim();
    const cleanPracticeNumber = practiceNumber.trim();
    const cleanPracticeAddress = practiceAddress.trim();
    const cleanPassword = password.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    if (
      !cleanFirstName ||
      !cleanSurname ||
      !cleanEmail ||
      !cleanMobile ||
      !cleanRegistrationNumber ||
      !cleanQualifications ||
      !cleanPracticeNumber ||
      !cleanPassword ||
      !cleanConfirmPassword
    ) {
      showError("Please complete all required fields.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      showError("Please enter a valid email address.");
      return;
    }

    if (cleanPassword.length < 6) {
      showError("Password must contain at least 6 characters.");
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      showError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      /*
       * The doctor details are added to Auth metadata as a backup.
       *
       * The main profile record is still stored in the profiles table.
       */
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              first_name: cleanFirstName,
              surname: cleanSurname,
              mobile: cleanMobile,

              // Keep this field name aligned with the profiles table.
              registration_number: cleanRegistrationNumber,
              doctor_qualifications: cleanQualifications,
              speciality: cleanSpeciality || "General Practitioner",
              practice_number: cleanPracticeNumber,
              practice_address: cleanPracticeAddress,
              country,
              role: "doctor",
            },
          },
        });

      if (signUpError) {
        showError(signUpError.message);
        return;
      }

      const user = signUpData.user;

      if (!user?.id) {
        showError(
          "The authentication account was created, but no user ID was returned."
        );
        return;
      }

      /*
       * Save the doctor's permanent profile.
       *
       * onConflict: "id" ensures the record is updated if the same authenticated
       * user already has a profile.
       */
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            first_name: cleanFirstName,
            surname: cleanSurname,
            email: cleanEmail,
            mobile: cleanMobile,
            registration_number: cleanRegistrationNumber,
            doctor_qualifications: cleanQualifications,
            speciality: cleanSpeciality || "General Practitioner",
            practice_number: cleanPracticeNumber,
            practice_address: cleanPracticeAddress,
            country,
            role: "doctor",
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          }
        );

      if (profileError) {
        console.error("Doctor profile save error:", profileError);

        showError(
          `The login account was created, but the doctor profile could not be saved: ${profileError.message}`
        );

        return;
      }

      /*
       * Confirm that the profile can be retrieved immediately.
       */
      const { data: savedProfile, error: verificationError } = await supabase
        .from("profiles")
        .select(
          `
            id,
            first_name,
            surname,
            email,
            mobile,
            registration_number,
            doctor_qualifications,
            speciality,
            practice_number,
            practice_address,
            country,
            role
          `
        )
        .eq("id", user.id)
        .maybeSingle();

      if (verificationError) {
        console.error(
          "Doctor profile verification error:",
          verificationError
        );

        showError(
          `The profile was submitted, but CareScriber could not verify it: ${verificationError.message}`
        );

        return;
      }

      if (!savedProfile) {
        showError(
          "The doctor account was created, but no profile record could be retrieved. Check the profiles table and its Row Level Security policies."
        );
        return;
      }

      /*
       * When email confirmation is enabled, Supabase may return a user without
       * an active session. The user must confirm their email before signing in.
       */
      if (!signUpData.session) {
        showSuccess(
          "Doctor registration completed. Please check your email to confirm your account before logging in."
        );

        window.setTimeout(() => {
          router.push("/login?registered=true&confirmation=required");
        }, 2200);

        return;
      }

      showSuccess("Doctor registration completed successfully.");

      window.setTimeout(() => {
        router.push("/login?registered=true");
      }, 1200);
    } catch (error) {
      console.error("Unexpected registration error:", error);

      showError(
        error instanceof Error
          ? error.message
          : "An unexpected registration error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/" style={styles.backLink}>
          ← Back to CareScriber
        </Link>

        <p style={styles.label}>Videomed Clinical Assistant</p>

        <h1 style={styles.title}>Register Doctor</h1>

        <p style={styles.subtitle}>
          Create your clinician profile for CareScriber AI. These details will
          be used on prescriptions, sick notes and clinical documents.
        </p>

        <form onSubmit={registerDoctor} style={styles.form}>
          <div style={styles.grid}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>First name *</span>

              <input
                style={styles.input}
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                disabled={loading}
                required
              />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Surname *</span>

              <input
                style={styles.input}
                placeholder="Surname"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                autoComplete="family-name"
                disabled={loading}
                required
              />
            </label>
          </div>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>Email *</span>

            <input
              style={styles.input}
              type="email"
              placeholder="Doctor email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              disabled={loading}
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>Mobile *</span>

            <input
              style={styles.input}
              type="tel"
              placeholder="Doctor mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              disabled={loading}
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>
              HPCSA / registration number *
            </span>

            <input
              style={styles.input}
              placeholder="HPCSA or professional council number"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              disabled={loading}
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>Qualifications *</span>

            <input
              style={styles.input}
              placeholder="Example: MBChB, MMed, FCFP"
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              disabled={loading}
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>Speciality</span>

            <input
              style={styles.input}
              placeholder="Example: General Practitioner"
              value={speciality}
              onChange={(e) => setSpeciality(e.target.value)}
              disabled={loading}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>Practice number *</span>

            <input
              style={styles.input}
              placeholder="Practice number"
              value={practiceNumber}
              onChange={(e) => setPracticeNumber(e.target.value)}
              disabled={loading}
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>Practice address</span>

            <textarea
              style={styles.textarea}
              placeholder="Practice address"
              value={practiceAddress}
              onChange={(e) => setPracticeAddress(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>Country *</span>

            <select
              style={styles.input}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={loading}
              required
            >
              <option value="South Africa">South Africa</option>
              <option value="England">England</option>
              <option value="Wales">Wales</option>
              <option value="Scotland">Scotland</option>
              <option value="New Zealand">New Zealand</option>
            </select>
          </label>

          <div style={styles.grid}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Password *</span>

              <div style={styles.passwordWrap}>
                <input
                  style={styles.passwordInput}
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  style={styles.eyeButton}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Confirm password *</span>

              <div style={styles.passwordWrap}>
                <input
                  style={styles.passwordInput}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((current) => !current)
                  }
                  style={styles.eyeButton}
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirmed password"
                      : "Show confirmed password"
                  }
                  disabled={loading}
                >
                  {showConfirmPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </label>
          </div>

          {message && (
            <div
              style={
                messageType === "success"
                  ? styles.success
                  : styles.error
              }
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
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? "Registering doctor..." : "Register Doctor"}
          </button>
        </form>

        <p style={styles.footer}>
          Already registered?{" "}
          <Link href="/login" style={styles.link}>
            Login here
          </Link>
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    marginBottom: 0,
    color: "#2563eb",
    fontWeight: 700,
    fontSize: "14px",
  },

  title: {
    marginTop: "8px",
    marginBottom: "8px",
    fontSize: "36px",
    lineHeight: "42px",
    color: "#0f172a",
  },

  subtitle: {
    color: "#475569",
    fontSize: "17px",
    lineHeight: 1.6,
    marginBottom: "24px",
  },

  form: {
    display: "grid",
    gap: "16px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },

  field: {
    display: "grid",
    gap: "7px",
  },

  fieldLabel: {
    color: "#334155",
    fontSize: "14px",
    fontWeight: 700,
  },

  input: {
    width: "100%",
    minHeight: "52px",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "16px",
    boxSizing: "border-box",
    outline: "none",
  },

  textarea: {
    width: "100%",
    minHeight: "100px",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "16px",
    fontFamily: "Arial, sans-serif",
    lineHeight: 1.5,
    resize: "vertical",
    boxSizing: "border-box",
    outline: "none",
  },

  passwordWrap: {
    position: "relative",
    width: "100%",
  },

  passwordInput: {
    width: "100%",
    minHeight: "52px",
    padding: "14px 52px 14px 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "16px",
    boxSizing: "border-box",
    outline: "none",
  },

  eyeButton: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "18px",
  },

  error: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "12px 14px",
    borderRadius: "12px",
    fontWeight: 600,
    lineHeight: 1.5,
  },

  success: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    padding: "12px 14px",
    borderRadius: "12px",
    fontWeight: 600,
    lineHeight: 1.5,
  },

  button: {
    marginTop: "8px",
    width: "100%",
    minHeight: "56px",
    padding: "16px",
    borderRadius: "14px",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "17px",
    fontWeight: 700,
    cursor: "pointer",
  },

  buttonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
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
