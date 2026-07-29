import Link from "next/link";

export default function HomePage() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.label}>
          Videomed Clinical Assistant
        </p>

        <h1 style={styles.title}>
          CareScriber AI
        </h1>

        <p style={styles.subtitle}>
          Simple AI clinical workflow for doctors. Create SOAP notes,
          consultation summaries, patient records and medical certificates
          after secure login.
        </p>

        <div style={styles.tabs}>
          <Link href="/login" style={styles.activeTab}>
            Doctor Login
          </Link>

          <Link href="/register" style={styles.tab}>
            Register
          </Link>

          <Link href="/profile" style={styles.tab}>
            My Profile
          </Link>
        </div>

        <div style={styles.buttons}>
          <Link href="/login" style={styles.primary}>
            Doctor Login
          </Link>

          <Link href="/register" style={styles.secondary}>
            Register as Doctor
          </Link>

          <Link href="/profile" style={styles.profileButton}>
            Update Doctor Profile
          </Link>
        </div>

        <div style={styles.profileNotice}>
          <strong>Doctor profile updates:</strong> Logged-in doctors can update
          their email address, mobile number, HPCSA or MP registration number,
          practice number, qualifications and practice address.
        </div>

        <div style={styles.notice}>
          <strong>Restricted access:</strong> Patient search, consultations,
          SOAP notes, prescriptions, referrals, sick notes and doctor-profile
          updates are only available after secure doctor login.
        </div>
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
    padding: "24px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Arial, sans-serif",
  },

  card: {
    width: "100%",
    maxWidth: "760px",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "36px",
    boxShadow:
      "0 20px 45px rgba(15, 23, 42, 0.14)",
  },

  label: {
    color: "#2563eb",
    fontWeight: 700,
    fontSize: "16px",
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

  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "28px",
  },

  activeTab: {
    background: "#2563eb",
    color: "#ffffff",
    padding: "12px 16px",
    borderRadius: "14px",
    textAlign: "center",
    fontWeight: 800,
    fontSize: "16px",
    textDecoration: "none",
  },

  tab: {
    background: "#e2e8f0",
    color: "#0f172a",
    padding: "12px 16px",
    borderRadius: "14px",
    textAlign: "center",
    fontWeight: 800,
    fontSize: "16px",
    textDecoration: "none",
  },

  buttons: {
    display: "grid",
    gap: "16px",
    marginTop: "28px",
  },

  primary: {
    background: "#2563eb",
    color: "#ffffff",
    padding: "18px",
    borderRadius: "16px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: "18px",
    textDecoration: "none",
  },

  secondary: {
    background: "#ffffff",
    color: "#2563eb",
    padding: "18px",
    borderRadius: "16px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: "18px",
    textDecoration: "none",
    border: "2px solid #2563eb",
  },

  profileButton: {
    background: "#f97316",
    color: "#ffffff",
    padding: "18px",
    borderRadius: "16px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: "18px",
    textDecoration: "none",
  },

  profileNotice: {
    marginTop: "28px",
    background: "#fff7ed",
    color: "#9a3412",
    padding: "18px",
    borderRadius: "16px",
    fontSize: "15px",
    lineHeight: "22px",
  },

  notice: {
    marginTop: "16px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "18px",
    borderRadius: "16px",
    fontSize: "15px",
    lineHeight: "22px",
  },
};
