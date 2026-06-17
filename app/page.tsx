import Link from "next/link";

export default function HomePage() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.label}>Videomed Clinical Assistant</p>

        <h1 style={styles.title}>CareScriber AI</h1>

        <p style={styles.subtitle}>
          Simple AI clinical workflow for doctors. Create SOAP notes,
          consultation summaries and patient records after secure login.
        </p>

        <div style={styles.buttons}>
          <Link href="/login" style={styles.primary}>
            Doctor Login
          </Link>

          <Link href="/register" style={styles.secondary}>
            Register as Doctor
          </Link>
        </div>

        <div style={styles.notice}>
          <strong>Restricted access:</strong> Patient search, consultations,
          SOAP notes and summaries are only available after doctor login.
        </div>
      </section>
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
  buttons: {
    display: "grid",
    gap: "16px",
    marginTop: "32px",
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
  notice: {
    marginTop: "28px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "18px",
    borderRadius: "16px",
    fontSize: "15px",
    lineHeight: "22px",
  },
};
