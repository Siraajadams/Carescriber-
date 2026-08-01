import Link from "next/link";

export default function HomePage() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.label}>Videomed Clinical Assistant</p>

        <h1 style={styles.title}>CareScriber AI</h1>

        <p style={styles.subtitle}>
          Secure clinical workflow for doctors. Review paid virtual-consult
          referrals, accept patients from the inbox, create SOAP notes,
          prescriptions, consultation summaries and medical certificates.
        </p>

        <div style={styles.inboxFeature}>
          <div style={styles.inboxIcon}>📥</div>

          <div>
            <h2 style={styles.inboxTitle}>Virtual Consult Inbox</h2>

            <p style={styles.inboxText}>
              Paid SymptomAI referrals will appear in the doctor queue, with
              the oldest waiting request displayed first.
            </p>
          </div>
        </div>

        <div style={styles.buttons}>
          <Link href="/login" style={styles.primary}>
            Doctor Login
          </Link>

          <Link href="/inbox" style={styles.inboxButton}>
            Open Virtual Consult Inbox
          </Link>

          <Link href="/register" style={styles.secondary}>
            Register as Doctor
          </Link>

          <Link href="/profile" style={styles.profileButton}>
            Update My Doctor Profile
          </Link>
        </div>

        <div style={styles.workflowNotice}>
          <strong>Virtual consult workflow:</strong>
          <ol style={styles.workflowList}>
            <li>Paid referrals enter the doctor inbox.</li>
            <li>The oldest waiting request appears first.</li>
            <li>The doctor accepts the request.</li>
            <li>
              The doctor opens the patient using the referral code and consent
              token.
            </li>
            <li>
              The existing consultation, e-Script and sick-note workflows
              continue as normal.
            </li>
          </ol>
        </div>

        <div style={styles.profileNotice}>
          <strong>Doctor profile:</strong> Logged-in doctors can update their
          email address, mobile number, HPCSA or MP registration number,
          practice number, qualifications and practice address.
        </div>

        <div style={styles.notice}>
          <strong>Restricted access:</strong> The virtual consult inbox,
          patient search, consultations, SOAP notes, prescriptions, referrals,
          sick notes and doctor-profile updates are only available after secure
          doctor login.
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

  inboxFeature: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
    background: "#eff6ff",
    border: "2px solid #bfdbfe",
    borderRadius: "20px",
    padding: "20px",
  },

  inboxIcon: {
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

  inboxTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "22px",
    lineHeight: "28px",
  },

  inboxText: {
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

  inboxButton: {
    background: "#0f766e",
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

  profileNotice: {
    marginTop: "16px",
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
