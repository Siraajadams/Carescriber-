import Link from "next/link";

export default function HomePage() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.label}>Videomed Clinical Assistant</p>

        <h1 style={styles.title}>CareScriber AI</h1>

        <p style={styles.subtitle}>
          Secure clinical workflow for doctors. Create SOAP notes,
          prescriptions, consultation summaries, patient records and medical
          certificates after secure login.
        </p>

        <div style={styles.secureFeature}>
          <div style={styles.secureIcon}>🔒</div>

          <div>
            <h2 style={styles.secureTitle}>Secure Doctor Access</h2>

            <p style={styles.secureText}>
              The Virtual Consult Inbox, patient records, prescriptions, sick
              notes and doctor profile are only available after doctor login.
            </p>
          </div>
        </div>

        <div style={styles.buttons}>
          <Link href="/login" style={styles.primary}>
            Doctor Login
          </Link>

          <Link href="/register" style={styles.secondary}>
            Register as Doctor
          </Link>
        </div>

        <div style={styles.workflowNotice}>
          <strong>After login, doctors can:</strong>

          <ol style={styles.workflowList}>
            <li>Open the Virtual Consult Inbox.</li>
            <li>Review paid SymptomAI referrals.</li>
            <li>Accept the oldest waiting request.</li>
            <li>Open the patient using the referral and consent details.</li>
            <li>Create consultation notes, e-Scripts and sick notes.</li>
          </ol>
        </div>

        <div style={styles.notice}>
          <strong>Restricted access:</strong> The Virtual Consult Inbox,
          patient search, consultations, SOAP notes, prescriptions, referrals,
          sick notes and doctor-profile updates require secure doctor login.
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #eff6ff 0%, #f8fafc 55%, #ecfeff 100%)",
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
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.14)",
  },

  label: {
    color: "#2563eb",
    fontWeight: 700,
    fontSize: "16px",
    margin: 0,
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
    marginBottom: "26px",
  },

  secureFeature: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
    background: "#eff6ff",
    border: "2px solid #bfdbfe",
    borderRadius: "20px",
    padding: "20px",
  },

  secureIcon: {
    width: "52px",
    height: "52px",
    flexShrink: 0,
    borderRadius: "16px",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "26px",
  },

  secureTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "22px",
    lineHeight: "28px",
  },

  secureText: {
    marginTop: "8px",
    marginBottom: 0,
    color: "#475569",
    fontSize: "16px",
    lineHeight: "24px",
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

  workflowNotice: {
    marginTop: "28px",
    background: "#ecfdf5",
    color: "#065f46",
    padding: "18px",
    borderRadius: "16px",
    fontSize: "15px",
    lineHeight: "22px",
    border: "1px solid #a7f3d0",
  },

  workflowList: {
    marginTop: "10px",
    marginBottom: 0,
    paddingLeft: "22px",
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
