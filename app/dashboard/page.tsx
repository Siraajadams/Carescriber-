
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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

type InboxReferral = {
  id: string;
  referral_code?: string | null;
  consultation_reason?: string | null;
  payment_status?: string | null;
  queue_status?: string | null;
  referral_status?: string | null;
  archived_at?: string | null;
  patient_first_name?: string | null;
  patient_surname?: string | null;
  patient_name?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

type InboxResponse = {
  success?: boolean;
  count?: number;
  referrals?: InboxReferral[];
  error?: string;
  message?: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [doctorName, setDoctorName] =
    useState("Doctor");

  const [profileSummary, setProfileSummary] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [authenticated, setAuthenticated] =
    useState(false);

  const [waitingReferralCount, setWaitingReferralCount] =
    useState(0);

  const [oldestWaitingReferral, setOldestWaitingReferral] =
    useState<InboxReferral | null>(null);

  const [inboxError, setInboxError] =
    useState("");

  const [inboxLoading, setInboxLoading] =
    useState(false);

  const [lastInboxUpdate, setLastInboxUpdate] =
    useState<string | null>(null);

  const requestInProgress = useRef(false);

  // =====================================================
  // AUTHENTICATED INBOX SUMMARY
  // =====================================================

  const loadInboxSummary = useCallback(async () => {
    if (requestInProgress.current) return;

    requestInProgress.current = true;
    setInboxLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Session expired. Please sign in again."
        );
      }

      const response = await fetch(
        "/api/inbox-referrals",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          signal: AbortSignal.timeout(20000),
        }
      );

      const payload =
        (await response
          .json()
          .catch(() => ({}))) as InboxResponse;

      if (!response.ok || payload.success !== true) {
        throw new Error(
          payload.error ||
          payload.message ||
          `Inbox request failed (HTTP ${response.status}).`
        );
      }

      if (!Array.isArray(payload.referrals)) {
        throw new Error(
          "The inbox API returned an invalid referral list."
        );
      }

      const waiting = payload.referrals.filter(
        referral =>
          referral.payment_status === "paid" &&
          referral.queue_status === "waiting" &&
          !referral.archived_at
      );

      waiting.sort((a, b) => {
        const aTime = Date.parse(
          a.paid_at || a.created_at || ""
        );

        const bTime = Date.parse(
          b.paid_at || b.created_at || ""
        );

        return (
          (Number.isFinite(aTime)
            ? aTime
            : Number.MAX_SAFE_INTEGER) -
          (Number.isFinite(bTime)
            ? bTime
            : Number.MAX_SAFE_INTEGER)
        );
      });

      setWaitingReferralCount(waiting.length);
      setOldestWaitingReferral(waiting[0] || null);
      setLastInboxUpdate(new Date().toISOString());
      setInboxError("");

    } catch (error: unknown) {
      console.error(
        "Could not load inbox summary:",
        error
      );

      // Preserve last successful inbox data.
      setInboxError(
        error instanceof Error
          ? error.name === "TimeoutError"
            ? "Inbox request timed out. Please refresh."
            : error.message
          : "Could not load the virtual consult inbox."
      );
    } finally {
      requestInProgress.current = false;
      setInboxLoading(false);
    }
  }, []);

  // =====================================================
  // LOGIN AND DOCTOR PROFILE
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    async function checkLogin() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        let profile: DoctorProfile | null = null;

        const columns = `
          first_name,
          surname,
          last_name,
          email,
          hpcsa,
          registration_number,
          practice_number
        `;

        const byId = await supabase
          .from("profiles")
          .select(columns)
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (!byId.error && byId.data) {
          profile = byId.data as DoctorProfile;
        }

        if (!profile) {
          const byUserId = await supabase
            .from("profiles")
            .select(columns)
            .eq("user_id", user.id)
            .maybeSingle();

          if (cancelled) return;

          if (!byUserId.error && byUserId.data) {
            profile = byUserId.data as DoctorProfile;
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
          summaryParts.join(" • ")
        );

        setAuthenticated(true);

      } catch (error) {
        console.error(
          "Dashboard profile error:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void checkLogin();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // =====================================================
  // AUTOMATIC INBOX REFRESH
  // =====================================================

  useEffect(() => {
    if (!authenticated) return;

    void loadInboxSummary();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadInboxSummary();
      }
    }, 30000);

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        void loadInboxSummary();
      }
    };

    window.addEventListener(
      "focus",
      refreshOnFocus
    );

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(
        "focus",
        refreshOnFocus
      );
    };
  }, [authenticated, loadInboxSummary]);

  // =====================================================
  // LOGOUT
  // =====================================================

  async function logout() {
    setAuthenticated(false);

    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <p style={styles.loading}>
            Loading dashboard...
          </p>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <p style={styles.loading}>
            Verifying doctor access...
          </p>
        </section>
      </main>
    );
  }

  // =====================================================
  // DASHBOARD
  // =====================================================

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
          Secure clinical assistant for virtual
          consultations, SOAP notes, patient
          summaries, prescriptions, referrals
          and clinical documents.
        </p>

        {profileSummary && (
          <div style={styles.profileSummary}>
            {profileSummary}
          </div>
        )}

        <div style={styles.grid}>

          {/* VIRTUAL CONSULT INBOX */}

          <Link
            href="/inbox"
            style={styles.inboxCard}
          >
            <div style={styles.inboxTopRow}>
              <div style={styles.icon}>
                📥
              </div>

              {waitingReferralCount > 0 && (
                <div style={styles.inboxBadge}>
                  {waitingReferralCount}
                </div>
              )}
            </div>

            <h2 style={styles.cardTitle}>
              Virtual Consult Inbox
            </h2>

            <p style={styles.cardText}>
              Review paid SymptomAI referrals,
              accept the oldest waiting request
              and open the linked patient file.
            </p>

            {inboxLoading && !lastInboxUpdate && (
              <div style={styles.inboxStatus}>
                Checking inbox...
              </div>
            )}

            {inboxError && (
              <div style={styles.inboxError}>
                Inbox status unavailable:{" "}
                {inboxError}

                {lastInboxUpdate && (
                  <p style={styles.smallText}>
                    Showing last successful inbox summary.
                  </p>
                )}
              </div>
            )}

            {(!inboxLoading || lastInboxUpdate) && (
              <>
                <div style={styles.inboxStatus}>
                  {waitingReferralCount === 0
                    ? "No paid referrals currently waiting"
                    : `${waitingReferralCount} paid ${
                        waitingReferralCount === 1
                          ? "referral"
                          : "referrals"
                      } waiting`}
                </div>

                {oldestWaitingReferral && (
                  <div style={styles.oldestReferral}>
                    <div style={styles.oldestReferralLabel}>
                      Oldest waiting referral
                    </div>

                    <div style={styles.oldestReferralCode}>
                      {oldestWaitingReferral.referral_code ||
                        "Referral code unavailable"}
                    </div>

                    <div style={styles.oldestReferralReason}>
                      <b>Reason:</b>{" "}
                      {oldestWaitingReferral.consultation_reason ||
                        "No consultation reason recorded"}
                    </div>
                  </div>
                )}
              </>
            )}

            {lastInboxUpdate && (
              <p style={styles.smallText}>
                Last checked:{" "}
                {new Date(lastInboxUpdate).toLocaleTimeString(
                  "en-ZA",
                  {
                    timeZone: "Africa/Johannesburg",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}
              </p>
            )}
          </Link>

          {/* NEW CONSULTATION */}

          <Link
            href="/consultation"
            style={styles.primaryCard}
          >
            <div style={styles.icon}>
              +
            </div>

            <h2 style={styles.cardTitle}>
              New Consultation
            </h2>

            <p style={styles.cardText}>
              Start recording, generate a
              transcript and create a SOAP note.
            </p>
          </Link>

          {/* SEARCH PATIENT */}

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
              Find or register a patient
              before starting a consultation.
            </p>
          </Link>

          {/* RECENT CONSULTATIONS */}

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

          {/* E-SCRIPT */}

          <Link
            href="/e-script"
            style={styles.optionCard}
          >
            <div style={styles.icon}>
              💊
            </div>

            <h2 style={styles.cardTitle}>
              e-Script
            </h2>

            <p style={styles.cardText}>
              Generate and send an
              electronic prescription.
            </p>
          </Link>

          {/* SICK NOTE */}

          <Link
            href="/sick-note"
            style={styles.optionCard}
          >
            <div style={styles.icon}>
              📄
            </div>

            <h2 style={styles.cardTitle}>
              Sick Note
            </h2>

            <p style={styles.cardText}>
              Generate and email a
              medical certificate.
            </p>
          </Link>

          {/* MEDICAL REFERRAL */}

          <Link
            href="/referral"
            style={styles.referralCard}
          >
            <div style={styles.icon}>
              🏥
            </div>

            <h2 style={styles.cardTitle}>
              Medical Referral
            </h2>

            <p style={styles.cardText}>
              Create a structured medical
              referral with patient details,
              clinical information, ICD-10
              diagnosis and referring
              clinician details.
            </p>
          </Link>

          {/* MY PROFILE */}

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
              HPCSA or MP number, practice number,
              qualifications and practice address.
            </p>
          </Link>

        </div>

        {/* WORKFLOW */}

        <div style={styles.workflow}>
          <h3 style={styles.workflowTitle}>
            Virtual Consult Workflow
          </h3>

          <p>1. Open Virtual Consult Inbox</p>
          <p>2. Accept the oldest paid referral</p>
          <p>3. Open the linked patient file</p>
          <p>4. Complete consultation and SOAP note</p>
          <p>
            5. Generate e-Script, Sick Note
            or Medical Referral
          </p>
          <p>6. Mark referral completed</p>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          style={styles.logout}
        >
          Logout
        </button>

      </section>
    </main>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles: Record<string, React.CSSProperties> = {
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

  inboxCard: {
    display: "block",
    background:
      "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
    color: "#ffffff",
    padding: 24,
    borderRadius: 22,
    textDecoration: "none",
    boxShadow:
      "0 14px 30px rgba(15, 118, 110, 0.24)",
  },

  inboxTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  inboxBadge: {
    minWidth: 38,
    height: 38,
    padding: "0 10px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 800,
  },

  inboxStatus: {
    marginTop: 16,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255, 255, 255, 0.16)",
    fontSize: 15,
    fontWeight: 700,
  },

  inboxError: {
    marginTop: 16,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(254, 226, 226, 0.95)",
    color: "#991b1b",
    fontSize: 14,
    fontWeight: 700,
  },

  oldestReferral: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    background: "rgba(255, 255, 255, 0.13)",
  },

  oldestReferralLabel: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    opacity: 0.85,
  },

  oldestReferralCode: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: 800,
  },

  oldestReferralReason: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.45,
  },

  smallText: {
    marginTop: 12,
    marginBottom: 0,
    fontSize: 12,
    lineHeight: 1.5,
    opacity: 0.85,
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

  referralCard: {
    display: "block",
    background: "#f5f3ff",
    color: "#5b21b6",
    padding: 24,
    borderRadius: 22,
    textDecoration: "none",
    border: "2px solid #c4b5fd",
    boxShadow:
      "0 8px 20px rgba(91, 33, 182, 0.08)",
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
    background: "#ecfdf5",
    padding: 22,
    borderRadius: 20,
    color: "#065f46",
    border: "1px solid #a7f3d0",
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
