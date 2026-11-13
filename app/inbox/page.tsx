"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type InboxReferral = {
  id: string;
  referral_code: string;
  consent_token: string | null;
  consultation_reason: string | null;

  patient_first_name: string | null;
  patient_surname: string | null;
  patient_name: string | null;

  patient_id: string | null;
  national_id: string | null;

  email: string | null;
  mobile: string | null;

  payment_status: string | null;
  queue_status: string | null;
  referral_status: string | null;

  assigned_doctor_id: string | null;
  assigned_doctor_name: string | null;

  accepted_at: string | null;
  completed_at: string | null;

  created_at: string;
  paid_at: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  archive_reason?: string | null;
};

type InboxResponse = {
  success?: boolean;
  referrals?: InboxReferral[];
  count?: number;
  error?: string;
  message?: string;
};

export default function InboxPage() {
  const router = useRouter();

  const [referrals, setReferrals] =
    useState<InboxReferral[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [isError, setIsError] =
    useState(false);

  const [workingId, setWorkingId] =
    useState<string | null>(null);

  const [currentDoctorId, setCurrentDoctorId] =
    useState<string | null>(null);

  const [currentDoctorName, setCurrentDoctorName] =
    useState("Doctor");

  // Archive controls use the existing authenticated API. The API must
  // independently authorize archive/restore and enforce clinical review.
  const [view, setView] = useState<"active" | "review" | "archive">("active");
  const [search, setSearch] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState<Record<string, boolean>>({});
  const [archiveReason, setArchiveReason] = useState<Record<string, string>>({});

  const requestInProgress = useRef(false);

  const loadInbox = useCallback(async () => {
    if (requestInProgress.current) return;
    setLoading(true);

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
        typeof user.user_metadata?.first_name ===
        "string"
          ? user.user_metadata.first_name
          : "";

      const surname =
        typeof user.user_metadata?.surname ===
        "string"
          ? user.user_metadata.surname
          : typeof user.user_metadata?.last_name ===
              "string"
            ? user.user_metadata.last_name
            : "";

      const doctorName =
        `${firstName} ${surname}`.trim() ||
        user.email ||
        "Doctor";

      setCurrentDoctorId(user.id);
      setCurrentDoctorName(doctorName);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expired. Please log in again.");

      const response = await fetch(
        "/api/inbox-referrals",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(15000),
        },
      );

      const payload =
        (await response
          .json()
          .catch(() => ({}))) as InboxResponse;

      if (!response.ok || payload.success === false) {
        throw new Error(
          payload.error ||
            "Could not load the virtual consult inbox.",
        );
      }

      setReferrals(payload.referrals || []);
    } catch (error: unknown) {
      console.error(
        "Inbox loading error:",
        error,
      );

      setReferrals([]);
      setIsError(true);

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

  /*
   * Automatically refresh every 30 seconds so doctors
   * do not have to keep pressing Refresh inbox.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!requestInProgress.current) void loadInbox();
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadInbox]);

  async function updateReferral(
    action: "accept" | "complete",
    referralId: string,
  ) {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    setWorkingId(referralId);
    setMessage("");
    setIsError(false);

    try {
      // The server must independently verify the user's identity and
      // atomically claim an unassigned referral; never trust doctorId alone.
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("Login expired. Please sign in again.");
      }
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Session unavailable. Please sign in again.");
      }

      const response = await fetch("/api/inbox-referrals", {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          action,
          referralId,
          doctorId: userData.user.id,
          doctorName: currentDoctorName,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as InboxResponse;
      if (!response.ok || payload.success !== true) {
        throw new Error(
          payload.error || payload.message ||
            `Could not ${action} referral (HTTP ${response.status}).`,
        );
      }

      // Do not declare success based solely on a response from the API.
      // The next refresh will show the authoritative queue state.
      setMessage(
        payload.message ||
          (action === "accept"
            ? "Acceptance submitted. Check the assigned doctor below."
            : "Completion submitted. Refresh to confirm status."),
      );
    } catch (error: unknown) {
      console.error(`${action} referral error:`, error);
      setIsError(true);
      setMessage(
        error instanceof Error && error.name === "TimeoutError"
          ? "Request timed out after 15 seconds. Refresh to check whether it was accepted before trying again."
          : error instanceof Error
            ? error.message
            : "Could not update this referral.",
      );
    } finally {
      requestInProgress.current = false;
      setWorkingId(null);
      // Refresh even after timeout: the server may have committed the update.
      void loadInbox();
    }
  }

  async function changeArchive(action: "archive" | "restore", referral: InboxReferral) {
    if (requestInProgress.current) return;
    if (action === "archive") {
      if (!reviewConfirmed[referral.id]) {
        setIsError(true);
        setMessage("Confirm clinical review before archiving this referral.");
        return;
      }
      if (!archiveReason[referral.id]?.trim()) {
        setIsError(true);
        setMessage("Enter an archive reason before continuing.");
        return;
      }
    }
    if (!window.confirm(action === "archive"
      ? "Archive this consultation after clinical review? Patient and clinical records must be retained."
      : "Restore this consultation to its previous queue status?")) return;

    requestInProgress.current = true;
    setWorkingId(referral.id);
    setMessage("");
    setIsError(false);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Please sign in again.");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error("Session expired. Please sign in again.");
      const response = await fetch("/api/inbox-referrals", {
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          action,
          referralId: referral.id,
          reviewConfirmed: action === "archive" ? true : undefined,
          archiveReason: action === "archive" ? archiveReason[referral.id]?.trim() : undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as InboxResponse;
      if (!response.ok || payload.success !== true) {
        throw new Error(payload.error || payload.message ||
          `The server did not ${action} this referral. The API may need the archive update.`);
      }
      setMessage(payload.message || `${action === "archive" ? "Archive" : "Restore"} request accepted. Refreshing records.`);
      setReviewConfirmed(prev => ({ ...prev, [referral.id]: false }));
    } catch (error: unknown) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Unable to update archive status.");
    } finally {
      requestInProgress.current = false;
      setWorkingId(null);
      void loadInbox();
    }
  }

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const isOlderThan30Days = (referral: InboxReferral) =>
    new Date(referral.created_at).getTime() < thirtyDaysAgo;

  const paidReferrals = referrals.filter(referral => referral.payment_status === "paid");
  const activeReferrals = paidReferrals.filter(referral =>
    !referral.archived_at &&
    !isOlderThan30Days(referral) &&
    ["waiting", "accepted"].includes(referral.queue_status || "")
  );
  const reviewReferrals = paidReferrals.filter(referral =>
    !referral.archived_at && isOlderThan30Days(referral) &&
    ["waiting", "accepted", "completed"].includes(referral.queue_status || "")
  );
  const archivedReferrals = paidReferrals.filter(referral => !!referral.archived_at);
  const selectedReferrals = (view === "active" ? activeReferrals :
    view === "review" ? reviewReferrals : archivedReferrals).filter(referral => {
    const haystack = [referral.referral_code, referral.patient_first_name,
      referral.patient_surname, referral.patient_name, referral.assigned_doctor_name,
      referral.consultation_reason].join(" ").toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  function openReferral(
    referral: InboxReferral,
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "referralCode",
      referral.referral_code,
    );

    if (referral.consent_token) {
      params.set(
        "consentToken",
        referral.consent_token,
      );
    }

    if (referral.patient_id) {
      params.set(
        "patientId",
        referral.patient_id,
      );
    }

    router.push(
      `/consultation?${params.toString()}`,
    );
  }

  function patientName(
    referral: InboxReferral,
  ) {
    const combinedName =
      `${referral.patient_first_name || ""} ${
        referral.patient_surname || ""
      }`.trim();

    return (
      combinedName ||
      referral.patient_name ||
      "Patient name not recorded"
    );
  }

  function patientIdentifier(
    referral: InboxReferral,
  ) {
    return (
      referral.patient_id ||
      referral.national_id ||
      "Not recorded"
    );
  }

  function formatDate(
    value: string | null,
  ) {
    if (!value) {
      return "Not recorded";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not recorded";
    }

    return date.toLocaleString(
      "en-ZA",
      {
        timeZone:
          "Africa/Johannesburg",

        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",
      },
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <p style={styles.label}>
            CareScriber AI
          </p>

          <h1 style={styles.title}>
            Virtual Consult Inbox
          </h1>

          <p style={styles.subtitle}>
            Paid requests are displayed from the
            oldest payment to the most recent
            payment.
          </p>
        </div>

        <div style={styles.headerButtons}>
          <button
            type="button"
            style={styles.refreshButton}
            onClick={() =>
              void loadInbox()
            }
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "Refresh inbox"}
          </button>

          <button
            type="button"
            style={styles.dashboardButton}
            onClick={() =>
              router.push("/dashboard")
            }
          >
            Dashboard
          </button>
        </div>
      </section>

      {message && (
        <div
          style={{
            ...styles.message,
            ...(isError
              ? styles.errorMessage
              : {}),
          }}
        >
          {message}
        </div>
      )}

      <section style={styles.archiveToolbar}>
        <div style={styles.archiveTabs}>
          {(["active", "review", "archive"] as const).map(tab => (
            <button key={tab} type="button"
              style={{ ...styles.archiveTab, ...(view === tab ? styles.archiveTabSelected : {}) }}
              onClick={() => setView(tab)}>
              {tab === "active" ? `Active (${activeReferrals.length})` :
                tab === "review" ? `30-day review (${reviewReferrals.length})` :
                `Archive (${archivedReferrals.length})`}
            </button>
          ))}
        </div>
        <input aria-label="Search referrals" style={styles.archiveSearch}
          placeholder="Search patient, referral or doctor"
          value={search} onChange={event => setSearch(event.target.value)} />
        <p style={styles.archiveHelp}>
          {view === "review"
            ? "Older than 30 days. Review clinical status and outstanding follow-up before archiving."
            : view === "archive"
              ? "Archived referrals remain in the database and can be restored."
              : "Current paid consultations. Older referrals are shown in 30-day review."}
        </p>
      </section>

      {loading ? (
        <section style={styles.emptyCard}>
          <h2 style={styles.emptyTitle}>
            Loading inbox...
          </h2>
        </section>
      ) : selectedReferrals.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={styles.emptyTitle}>
            No referrals in this view
          </h2>

          <p style={styles.emptyText}>
            Use the tabs above to view active, older or archived consultations.
          </p>

          <button
            type="button"
            style={styles.refreshButton}
            onClick={() =>
              void loadInbox()
            }
          >
            Check again
          </button>
        </section>
      ) : (
        <section style={styles.queue}>
          {selectedReferrals.map(
            (referral, index) => {
              const isWaiting =
                referral.queue_status ===
                "waiting";

              const acceptedByCurrentDoctor =
                referral.queue_status ===
                  "accepted" &&
                referral.assigned_doctor_id ===
                  currentDoctorId;

              const acceptedByAnotherDoctor =
                referral.queue_status ===
                  "accepted" &&
                referral.assigned_doctor_id !==
                  currentDoctorId;

              return (
                <article
                  key={referral.id}
                  style={styles.referralCard}
                >
                  <div
                    style={styles.queueNumber}
                  >
                    Queue #{index + 1}
                  </div>

                  <div style={styles.cardHeader}>
                    <div>
                      <h2
                        style={styles.patientName}
                      >
                        {patientName(referral)}
                      </h2>

                      <div
                        style={
                          styles.referralCode
                        }
                      >
                        Referral:{" "}
                        {referral.referral_code}
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
                      {isWaiting
                        ? "Waiting"
                        : "Accepted"}
                    </span>
                  </div>

                  <div
                    style={styles.detailsGrid}
                  >
                    <div style={styles.detailBox}>
                      <span
                        style={
                          styles.detailLabel
                        }
                      >
                        Reason
                      </span>

                      <span
                        style={
                          styles.detailValue
                        }
                      >
                        {referral
                          .consultation_reason ||
                          "No consultation reason recorded"}
                      </span>
                    </div>

                    <div style={styles.detailBox}>
                      <span
                        style={
                          styles.detailLabel
                        }
                      >
                        Patient ID
                      </span>

                      <span
                        style={
                          styles.detailValue
                        }
                      >
                        {patientIdentifier(
                          referral,
                        )}
                      </span>
                    </div>

                    <div style={styles.detailBox}>
                      <span
                        style={
                          styles.detailLabel
                        }
                      >
                        Paid
                      </span>

                      <span
                        style={
                          styles.detailValue
                        }
                      >
                        {formatDate(
                          referral.paid_at ||
                            referral.created_at,
                        )}
                      </span>
                    </div>

                    <div style={styles.detailBox}>
                      <span
                        style={
                          styles.detailLabel
                        }
                      >
                        Payment
                      </span>

                      <span
                        style={
                          styles.detailValue
                        }
                      >
                        Paid
                      </span>
                    </div>

                    <div style={styles.detailBox}>
                      <span
                        style={
                          styles.detailLabel
                        }
                      >
                        Assigned doctor
                      </span>

                      <span
                        style={
                          styles.detailValue
                        }
                      >
                        {referral
                          .assigned_doctor_name ||
                          "Not yet assigned"}
                      </span>
                    </div>
                  </div>

                  {acceptedByAnotherDoctor && (
                    <div
                      style={
                        styles.assignedNotice
                      }
                    >
                      This request has already been
                      accepted by{" "}
                      <strong>
                        {referral
                          .assigned_doctor_name ||
                          "another doctor"}
                      </strong>
                      .
                    </div>
                  )}

                  <div style={styles.buttonRow}>
                    {view !== "archive" && isWaiting && (
                      <button
                        type="button"
                        style={
                          styles.acceptButton
                        }
                        disabled={
                          workingId ===
                          referral.id
                        }
                        onClick={() =>
                          void updateReferral(
                            "accept",
                            referral.id,
                          )
                        }
                      >
                        {workingId ===
                        referral.id
                          ? "Accepting..."
                          : "Accept request"}
                      </button>
                    )}

                    {view !== "archive" && acceptedByCurrentDoctor && (
                      <>
                        <button
                          type="button"
                          style={
                            styles.openButton
                          }
                          onClick={() =>
                            openReferral(
                              referral,
                            )
                          }
                        >
                          Open consultation
                        </button>

                        <button
                          type="button"
                          style={
                            styles.completeButton
                          }
                          disabled={
                            workingId ===
                            referral.id
                          }
                          onClick={() =>
                            void updateReferral(
                              "complete",
                              referral.id,
                            )
                          }
                        >
                          {workingId ===
                          referral.id
                            ? "Updating..."
                            : "Mark completed"}
                        </button>
                      </>
                    )}
                  </div>
                                   {view === "review" && (
                     <div style={styles.reviewPanel}>
                       <strong>Clinical review required</strong>
                       <p>Verify clinical documentation, patient safety and outstanding follow-up.
                         Do not archive an unresolved or urgent referral.</p>
                       <label style={styles.reviewLabel}>
                         <input type="checkbox"
                           checked={!!reviewConfirmed[referral.id]}
                           onChange={event => setReviewConfirmed(prev => ({
                             ...prev, [referral.id]: event.target.checked,
                           }))} />
                         I have reviewed this consultation and confirmed it is safe to archive.
                       </label>
                       <input style={styles.archiveSearch}
                         aria-label="Reason for archiving"
                         placeholder="Archive reason (required)"
                         value={archiveReason[referral.id] || ""}
                         onChange={event => setArchiveReason(prev => ({
                           ...prev, [referral.id]: event.target.value,
                         }))} />
                       <button type="button" style={styles.completeButton}
                         disabled={workingId !== null || !reviewConfirmed[referral.id] ||
                           !archiveReason[referral.id]?.trim()}
                         onClick={() => void changeArchive("archive", referral)}>
                         {workingId === referral.id ? "Archiving..." : "Archive after review"}
                       </button>
                     </div>
                   )}
                   {view === "archive" && (
                     <div style={styles.reviewPanel}>
                       <p>Archived: {formatDate(referral.archived_at || null)}</p>
                       <p>Reason: {referral.archive_reason || "Not recorded"}</p>
                       <button type="button" style={styles.refreshButton}
                         disabled={workingId !== null}
                         onClick={() => void changeArchive("restore", referral)}>
                         {workingId === referral.id ? "Restoring..." : "Restore referral"}
                       </button>
                     </div>
                   )}
                 </article>
              );
            },
          )}
        </section>
      )}
    </main>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  archiveToolbar: {
    maxWidth: "1100px", margin: "0 auto 20px", background: "#ffffff",
    padding: "20px", borderRadius: "18px", display: "grid", gap: "14px",
  },
  archiveTabs: { display: "flex", gap: "10px", flexWrap: "wrap" },
  archiveTab: {
    padding: "12px 16px", borderRadius: "12px", border: "1px solid #cbd5e1",
    background: "#f8fafc", color: "#334155", cursor: "pointer", fontWeight: 700,
  },
  archiveTabSelected: { background: "#1d4ed8", color: "#ffffff" },
  archiveSearch: {
    width: "100%", boxSizing: "border-box", padding: "12px",
    border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "15px",
  },
  archiveHelp: { margin: 0, color: "#475569", fontSize: "14px" },
  reviewPanel: {
    marginTop: "20px", padding: "18px", borderRadius: "14px",
    background: "#f8fafc", display: "grid", gap: "12px",
  },
  reviewLabel: { display: "flex", gap: "10px", alignItems: "flex-start" },
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
    boxShadow:
      "0 12px 30px rgba(15, 23, 42, 0.08)",
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

  errorMessage: {
    background: "#fef2f2",
    color: "#991b1b",
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
    boxShadow:
      "0 10px 25px rgba(15, 23, 42, 0.08)",
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
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
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
    boxShadow:
      "0 10px 25px rgba(15, 23, 42, 0.08)",
  },

  emptyTitle: {
    margin: "0 0 12px",
    fontSize: "25px",
  },

  emptyText: {
    color: "#64748b",
    fontSize: "17px",
  },
};
