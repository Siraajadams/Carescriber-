"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type InboxReferral = {
  id: string;
  referral_code: string;
  consent_token: string | null;
  consultation_reason: string | null;
  patient_first_name: string | null;
  patient_surname: string | null;
  patient_id: string | null;
  payment_status: string | null;
  queue_status: string | null;
  assigned_doctor_id: string | null;
  assigned_doctor_name: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  paid_at: string | null;
};

export default function InboxPage() {
  const router = useRouter();

  const [referrals, setReferrals] = useState<InboxReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      setCurrentDoctorId(user.id);

      const { data, error } = await supabase
        .from("symptomai_referrals")
        .select(
          `
            id,
            referral_code,
            consent_token,
            consultation_reason,
            patient_first_name,
            patient_surname,
            patient_id,
            payment_status,
            queue_status,
            assigned_doctor_id,
            assigned_doctor_name,
            accepted_at,
            completed_at,
            created_at,
            paid_at
          `,
        )
        .eq("payment_status", "paid")
        .in("queue_status", ["waiting", "accepted"])
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      setReferrals((data || []) as InboxReferral[]);
    } catch (error: unknown) {
      console.error("Inbox loading error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load the virtual consult inbox.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  async function acceptReferral(referralId: string) {
    setWorkingId(referralId);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const firstName =
        typeof user.user_metadata?.first_name === "string"
          ? user.user_metadata.first_name
          : "";

      const surname =
        typeof user.user_metadata?.surname === "string"
          ? user.user_metadata.surname
          : typeof user.user_metadata?.last_name === "string"
            ? user.user_metadata.last_name
            : "";

      const doctorName =
        `${firstName} ${surname}`.trim() || user.email || "Doctor";

      const { data, error } = await supabase
        .from("symptomai_referrals")
        .update({
          queue_status: "accepted",
          assigned_doctor_id: user.id,
          assigned_doctor_name: doctorName,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", referralId)
        .eq("queue_status", "waiting")
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "This request may already have been accepted by another doctor.",
        );
      }

      setMessage("Virtual consultation request accepted.");
      await loadInbox();
    } catch (error: unknown) {
      console.error("Accept referral error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not accept this referral.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function completeReferral(referralId: string) {
    setWorkingId(referralId);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("symptomai_referrals")
        .update({
          queue_status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", referralId)
        .eq("assigned_doctor_id", user.id);

      if (error) {
        throw error;
      }

      setMessage("Referral marked as completed.");
      await loadInbox();
    } catch (error: unknown) {
      console.error("Complete referral error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not complete this referral.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  function openReferral(referral: InboxReferral) {
    const params = new URLSearchParams();

    params.set("code", referral.referral_code);

    if (referral.consent_token) {
      params.set("token", referral.consent_token);
    }

    router.push(`/referral?${params.toString()}`);
  }

  function patientName(referral: InboxReferral) {
    const fullName =
      `${referral.patient_first_name || ""} ${
        referral.patient_surname || ""
      }`.trim();

    return fullName || "Patient name not recorded";
  }

  function formatDate(value: string | null) {
    if (!value) return "Not recorded";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not recorded";
    }

    return date.toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.label}>CareScriber AI</p>
          <h1 style={styles.title}>Virtual Consult Inbox</h1>
          <p style={styles.subtitle}>
            Paid requests are displayed from the oldest request to the most
            recent request.
          </p>
        </div>

        <div style={styles.headerButtons}>
          <button
            type="button"
            style={styles.refreshButton}
            onClick={() => void loadInbox()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh inbox"}
          </button>

          <button
            type="button"
            style={styles.dashboardButton}
            onClick={() => router.push("/dashboard")}
          >
            Dashboard
          </button>
        </div>
      </section>

      {message && <div style={styles.message}>{message}</div>}

      {loading ? (
        <section style={styles.emptyCard}>
          <h2 style={styles.emptyTitle}>Loading inbox...</h2>
        </section>
      ) : referrals.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={styles.emptyTitle}>No paid referrals waiting</h2>
          <p style={styles.emptyText}>
            New paid SymptomAI virtual-consult requests will appear here.
          </p>
        </section>
      ) : (
        <section style={styles.queue}>
          {referrals.map((referral, index) => {
            const isWaiting = referral.queue_status === "waiting";

            const acceptedByCurrentDoctor =
              referral.queue_status === "accepted" &&
              referral.assigned_doctor_id === currentDoctorId;

            const acceptedByAnotherDoctor =
              referral.queue_status === "accepted" &&
              referral.assigned_doctor_id !== currentDoctorId;

            return (
              <article key={referral.id} style={styles.referralCard}>
                <div style={styles.queueNumber}>Queue #{index + 1}</div>

                <div style={styles.cardHeader}>
                  <div>
                    <h2 style={styles.patientName}>
                      {patientName(referral)}
                    </h2>

                    <div style={styles.referralCode}>
                      Referral: {referral.referral_code}
                    </div>
                  </div>

                  <span
                    style={{
                      ...styles.statusBadge,
                      ...(isWaiting
                        ? styles.waitingBadge
                        : styles.acceptedBadge),
                    }}
                  >
                    {isWaiting ? "Waiting" : "Accepted"}
                  </span>
                </div>

                <div style={styles.detailsGrid}>
                  <div style={styles.detailBox}>
                    <span style={styles.detailLabel}>Reason</span>
                    <span style={styles.detailValue}>
                      {referral.consultation_reason ||
                        "No consultation reason recorded"}
                    </span>
                  </div>

                  <div style={styles.detailBox}>
                    <span style={styles.detailLabel}>Requested</span>
                    <span style={styles.detailValue}>
                      {formatDate(referral.created_at)}
                    </span>
                  </div>

                  <div style={styles.detailBox}>
                    <span style={styles.detailLabel}>Payment</span>
                    <span style={styles.detailValue}>Paid</span>
                  </div>

                  <div style={styles.detailBox}>
                    <span style={styles.detailLabel}>Assigned doctor</span>
                    <span style={styles.detailValue}>
                      {referral.assigned_doctor_name || "Not yet assigned"}
                    </span>
                  </div>
                </div>

                {acceptedByAnotherDoctor && (
                  <div style={styles.assignedNotice}>
                    This request has already been accepted by{" "}
                    <strong>
                      {referral.assigned_doctor_name || "another doctor"}
                    </strong>
                    .
                  </div>
                )}

                <div style={styles.buttonRow}>
                  {isWaiting && (
                    <button
                      type="button"
                      style={styles.acceptButton}
                      disabled={workingId === referral.id}
                      onClick={() => void acceptReferral(referral.id)}
                    >
                      {workingId === referral.id
                        ? "Accepting..."
                        : "Accept request"}
                    </button>
                  )}

                  {acceptedByCurrentDoctor && (
                    <>
                      <button
                        type="button"
                        style={styles.openButton}
                        onClick={() => openReferral(referral)}
                      >
                        Open patient
                      </button>

                      <button
                        type="button"
                        style={styles.completeButton}
                        disabled={workingId === referral.id}
                        onClick={() => void completeReferral(referral.id)}
                      >
                        {workingId === referral.id
                          ? "Updating..."
                          : "Mark completed"}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
    color: "#0f172a",
  },

  header: {
    maxWidth: "1100px",
    margin: "0 auto 24px",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    flexWrap: "wrap",
  },

  label: {
    margin: 0,
    color: "#2563eb",
    fontSize: "15px",
    fontWeight: 700,
  },

  title: {
    margin: "8px 0",
    fontSize: "38px",
  },

  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "17px",
    lineHeight: "25px",
  },

  headerButtons: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },

  refreshButton: {
    border: 0,
    borderRadius: "14px",
    padding: "14px 18px",
    background: "#0f766e",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },

  dashboardButton: {
    border: "2px solid #2563eb",
    borderRadius: "14px",
    padding: "12px 18px",
    background: "#ffffff",
    color: "#2563eb",
    fontWeight: 700,
    cursor: "pointer",
  },

  message: {
    maxWidth: "1100px",
    margin: "0 auto 20px",
    padding: "16px",
    borderRadius: "14px",
    background: "#eff6ff",
    color: "#1e3a8a",
    fontWeight: 700,
  },

  queue: {
    maxWidth: "1100px",
    margin: "0 auto",
    display: "grid",
    gap: "18px",
  },

  referralCard: {
    background: "#ffffff",
    borderRadius: "22px",
    padding: "24px",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
  },

  queueNumber: {
    color: "#2563eb",
    fontWeight: 700,
    fontSize: "14px",
    marginBottom: "12px",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  patientName: {
    margin: 0,
    fontSize: "26px",
  },

  referralCode: {
    marginTop: "8px",
    color: "#475569",
    fontWeight: 700,
  },

  statusBadge: {
    padding: "9px 14px",
    borderRadius: "999px",
    fontWeight: 700,
    fontSize: "14px",
  },

  waitingBadge: {
    background: "#fff7ed",
    color: "#c2410c",
  },

  acceptedBadge: {
    background: "#ecfdf5",
    color: "#047857",
  },

  detailsGrid: {
    marginTop: "20px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },

  detailBox: {
    background: "#f8fafc",
    borderRadius: "14px",
    padding: "15px",
    display: "grid",
    gap: "6px",
  },

  detailLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
  },

  detailValue: {
    color: "#0f172a",
    fontSize: "16px",
    lineHeight: "23px",
  },

  assignedNotice: {
    marginTop: "16px",
    padding: "14px",
    borderRadius: "14px",
    background: "#fff7ed",
    color: "#9a3412",
  },

  buttonRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "20px",
  },

  acceptButton: {
    border: 0,
    borderRadius: "14px",
    padding: "14px 20px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },

  openButton: {
    border: 0,
    borderRadius: "14px",
    padding: "14px 20px",
    background: "#0f766e",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },

  completeButton: {
    border: 0,
    borderRadius: "14px",
    padding: "14px 20px",
    background: "#475569",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
  },

  emptyCard: {
    maxWidth: "1100px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "22px",
    padding: "36px",
    textAlign: "center",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
  },

  emptyTitle: {
    margin: 0,
    fontSize: "25px",
  },

  emptyText: {
    color: "#64748b",
    fontSize: "17px",
  },
};
