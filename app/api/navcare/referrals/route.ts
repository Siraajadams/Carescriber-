import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const REFERRAL_TABLE = "symptomai_referrals";

type InboxAction = "accept" | "complete";

type InboxActionBody = {
  action?: InboxAction;
  referralId?: string;
  doctorId?: string;
  doctorName?: string;
};

type RawReferral = Record<string, unknown>;

type InboxReferral = {
  id: string;
  referral_code: string;
  consent_token: string | null;

  // Source
  source: string;
  external_referral_id: string | null;

  // Consultation
  consultation_reason: string | null;
  consultation_type: string | null;
  clinical_priority: string | null;

  // Patient
  patient_first_name: string | null;
  patient_surname: string | null;
  patient_name: string | null;

  patient_id: string | null;
  national_id: string | null;

  date_of_birth: string | null;
  gender: string | null;
  country: string | null;

  email: string | null;
  mobile: string | null;

  // NavCare / HIVClinTest
  hiv_test_type: string | null;
  hiv_test_result: string | null;
  interpretation_method: string | null;
  requires_confirmatory_testing: boolean | null;

  // Exposure / prevention assessment
  recent_exposure: boolean | null;
  exposure_timing: string | null;
  pep_urgent_review: boolean | null;
  prep_interest: boolean | null;

  risk_flags: unknown;
  symptoms: unknown;

  // Payment
  payment_status: string | null;
  payment_amount: number | null;
  payment_currency: string | null;
  stripe_session_id: string | null;

  // Queue
  queue_status: string | null;
  referral_status: string | null;

  assigned_doctor_id: string | null;
  assigned_doctor_name: string | null;

  accepted_at: string | null;
  completed_at: string | null;

  created_at: string;
  submitted_at: string | null;
  paid_at: string | null;

  // Existing SymptomAI data
  triage_summary: unknown;
  patient_snapshot: unknown;
  triage_snapshot: unknown;
};

/* ============================================================
   SUPABASE ADMIN
============================================================ */

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "CareScriber Supabase server credentials are missing."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/* ============================================================
   RESPONSE HEADERS
============================================================ */

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

/* ============================================================
   VALUE HELPERS
============================================================ */

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === "1" || value === 1) {
    return true;
  }

  if (value === "false" || value === "0" || value === 0) {
    return false;
  }

  return null;
}

function objectValue(
  value: unknown
): Record<string, unknown> | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getNestedString(
  source: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = stringValue(source[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

/* ============================================================
   NORMALISE REFERRAL
============================================================ */

function normaliseReferral(
  record: RawReferral
): InboxReferral {
  const patientSnapshot = objectValue(
    record.patient_snapshot
  );

  const triageSnapshot = objectValue(
    record.triage_snapshot
  );

  /* ----------------------------------------------------------
     Patient
  ---------------------------------------------------------- */

  const firstName =
    stringValue(record.patient_first_name) ||
    getNestedString(
      patientSnapshot,
      "firstName",
      "first_name",
      "patientFirstName",
      "patient_first_name"
    );

  const surname =
    stringValue(record.patient_surname) ||
    getNestedString(
      patientSnapshot,
      "surname",
      "lastName",
      "last_name",
      "patientSurname",
      "patient_surname"
    );

  const patientName =
    stringValue(record.patient_name) ||
    getNestedString(
      patientSnapshot,
      "patientName",
      "patient_name",
      "name",
      "fullName",
      "full_name"
    ) ||
    [firstName, surname].filter(Boolean).join(" ") ||
    null;

  const patientId =
    stringValue(record.patient_id) ||
    stringValue(record.national_id) ||
    getNestedString(
      patientSnapshot,
      "patientId",
      "patient_id",
      "nationalId",
      "national_id",
      "idNumber",
      "id_number",
      "identityNumber",
      "identity_number"
    );

  /* ----------------------------------------------------------
     Consultation reason
  ---------------------------------------------------------- */

  const consultationReason =
    stringValue(record.consultation_reason) ||
    stringValue(record.triage_summary) ||
    getNestedString(
      triageSnapshot,
      "consultationReason",
      "consultation_reason",
      "reason",
      "summary",
      "notes"
    );

  /* ----------------------------------------------------------
     Source

     Existing referrals without a source are treated as
     SymptomAI referrals for backwards compatibility.
  ---------------------------------------------------------- */

  const source =
    stringValue(record.source) ||
    getNestedString(triageSnapshot, "source") ||
    "symptomai";

  return {
    id: stringValue(record.id) || "",

    referral_code:
      stringValue(record.referral_code) || "",

    consent_token:
      stringValue(record.consent_token),

    source,

    external_referral_id:
      stringValue(record.external_referral_id),

    /* Consultation */

    consultation_reason:
      consultationReason,

    consultation_type:
      stringValue(record.consultation_type),

    clinical_priority:
      stringValue(record.clinical_priority),

    /* Patient */

    patient_first_name:
      firstName,

    patient_surname:
      surname,

    patient_name:
      patientName,

    patient_id:
      patientId,

    national_id:
      stringValue(record.national_id) ||
      patientId,

    date_of_birth:
      stringValue(record.date_of_birth) ||
      getNestedString(
        patientSnapshot,
        "dateOfBirth",
        "date_of_birth",
        "dob"
      ),

    gender:
      stringValue(record.gender) ||
      getNestedString(
        patientSnapshot,
        "gender"
      ),

    country:
      stringValue(record.country) ||
      getNestedString(
        patientSnapshot,
        "country"
      ),

    email:
      stringValue(record.email) ||
      getNestedString(
        patientSnapshot,
        "email"
      ),

    mobile:
      stringValue(record.mobile) ||
      getNestedString(
        patientSnapshot,
        "mobile",
        "mobile_number",
        "phone"
      ),

    /* NavCare / HIVClinTest */

    hiv_test_type:
      stringValue(record.hiv_test_type),

    hiv_test_result:
      stringValue(record.hiv_test_result),

    interpretation_method:
      stringValue(record.interpretation_method),

    requires_confirmatory_testing:
      booleanValue(
        record.requires_confirmatory_testing
      ),

    /* Exposure assessment */

    recent_exposure:
      booleanValue(record.recent_exposure),

    exposure_timing:
      stringValue(record.exposure_timing),

    pep_urgent_review:
      booleanValue(record.pep_urgent_review),

    prep_interest:
      booleanValue(record.prep_interest),

    risk_flags:
      record.risk_flags ?? null,

    symptoms:
      record.symptoms ?? null,

    /* Payment */

    payment_status:
      stringValue(record.payment_status),

    payment_amount:
      numberValue(record.payment_amount),

    payment_currency:
      stringValue(record.payment_currency),

    stripe_session_id:
      stringValue(record.stripe_session_id),

    /* Queue */

    queue_status:
      stringValue(record.queue_status),

    referral_status:
      stringValue(record.referral_status),

    assigned_doctor_id:
      stringValue(record.assigned_doctor_id),

    assigned_doctor_name:
      stringValue(record.assigned_doctor_name),

    accepted_at:
      stringValue(record.accepted_at),

    completed_at:
      stringValue(record.completed_at),

    created_at:
      stringValue(record.created_at) ||
      stringValue(record.submitted_at) ||
      new Date().toISOString(),

    submitted_at:
      stringValue(record.submitted_at),

    paid_at:
      stringValue(record.paid_at),

    /* Existing SymptomAI snapshots */

    triage_summary:
      record.triage_summary ?? null,

    patient_snapshot:
      record.patient_snapshot ?? null,

    triage_snapshot:
      record.triage_snapshot ?? null,
  };
}

/* ============================================================
   REQUEST HELPERS
============================================================ */

function cleanString(
  value: unknown,
  maxLength = 250
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .substring(0, maxLength);
}

function isValidAction(
  value: unknown
): value is InboxAction {
  return (
    value === "accept" ||
    value === "complete"
  );
}

/* ============================================================
   LOAD PAID INBOX
============================================================ */

async function loadPaidInboxReferrals(): Promise<
  InboxReferral[]
> {
  const supabase = getSupabaseAdmin();

  /*
   * Keep select("*").
   *
   * This supports both existing SymptomAI referrals
   * and the additional NavCare fields.
   */

  const { data, error } = await supabase
    .from(REFERRAL_TABLE)
    .select("*")
    .eq("payment_status", "paid")
    .in("queue_status", [
      "waiting",
      "accepted",
    ])
    .order("paid_at", {
      ascending: true,
      nullsFirst: false,
    })
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Inbox referral query failed: ${error.message}`
    );
  }

  return (data || [])
    .map((record) =>
      normaliseReferral(record as RawReferral)
    )
    .filter(
      (referral) =>
        referral.id &&
        referral.referral_code
    );
}

/* ============================================================
   ACCEPT REFERRAL
============================================================ */

async function acceptReferral({
  referralId,
  doctorId,
  doctorName,
}: {
  referralId: string;
  doctorId: string;
  doctorName: string;
}) {
  const supabase = getSupabaseAdmin();

  const now = new Date().toISOString();

  /*
   * Primary update.
   *
   * queue_status must still be "waiting".
   * This helps prevent two clinicians from accepting
   * the same request at the same time.
   */

  const completeResult = await supabase
    .from(REFERRAL_TABLE)
    .update({
      queue_status: "accepted",
      referral_status: "accepted",

      assigned_doctor_id:
        doctorId,

      assigned_doctor_name:
        doctorName || "Doctor",

      accepted_at:
        now,

      updated_at:
        now,
    })
    .eq("id", referralId)
    .eq("payment_status", "paid")
    .eq("queue_status", "waiting")
    .select("*")
    .maybeSingle();

  if (
    !completeResult.error &&
    completeResult.data
  ) {
    return normaliseReferral(
      completeResult.data as RawReferral
    );
  }

  /*
   * If there was no matching row because another
   * doctor already accepted it, don't run a fallback
   * update that could overwrite the assignment.
   */

  if (
    !completeResult.error &&
    !completeResult.data
  ) {
    return null;
  }

  console.warn(
    "Complete accept update failed. Trying compatible fields:",
    completeResult.error?.message
  );

  /*
   * Compatibility fallback for an older schema.
   */

  const fallbackResult = await supabase
    .from(REFERRAL_TABLE)
    .update({
      queue_status: "accepted",
      accepted_at: now,
    })
    .eq("id", referralId)
    .eq("payment_status", "paid")
    .eq("queue_status", "waiting")
    .select("*")
    .maybeSingle();

  if (fallbackResult.error) {
    throw new Error(
      fallbackResult.error.message
    );
  }

  return fallbackResult.data
    ? normaliseReferral(
        fallbackResult.data as RawReferral
      )
    : null;
}

/* ============================================================
   COMPLETE REFERRAL
============================================================ */

async function completeReferral({
  referralId,
  doctorId,
}: {
  referralId: string;
  doctorId: string;
}) {
  const supabase = getSupabaseAdmin();

  const now = new Date().toISOString();

  /*
   * Only the clinician assigned to the referral
   * should normally be able to complete it.
   */

  const completeResult = await supabase
    .from(REFERRAL_TABLE)
    .update({
      queue_status: "completed",
      referral_status: "completed",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", referralId)
    .eq("assigned_doctor_id", doctorId)
    .eq("queue_status", "accepted")
    .select("*")
    .maybeSingle();

  if (
    !completeResult.error &&
    completeResult.data
  ) {
    return normaliseReferral(
      completeResult.data as RawReferral
    );
  }

  if (
    !completeResult.error &&
    !completeResult.data
  ) {
    return null;
  }

  console.warn(
    "Complete referral update failed. Trying compatible fields:",
    completeResult.error?.message
  );

  /*
   * Compatibility fallback for an older schema.
   */

  const fallbackResult = await supabase
    .from(REFERRAL_TABLE)
    .update({
      queue_status: "completed",
      completed_at: now,
    })
    .eq("id", referralId)
    .eq("queue_status", "accepted")
    .select("*")
    .maybeSingle();

  if (fallbackResult.error) {
    throw new Error(
      fallbackResult.error.message
    );
  }

  return fallbackResult.data
    ? normaliseReferral(
        fallbackResult.data as RawReferral
      )
    : null;
}

/* ============================================================
   GET
   Load Virtual Consult Inbox
============================================================ */

export async function GET() {
  try {
    const referrals =
      await loadPaidInboxReferrals();

    /*
     * Useful for confirming that both sources are
     * reaching the CareScriber inbox.
     */

    const sourceCounts =
      referrals.reduce(
        (
          accumulator,
          referral
        ) => {
          const source =
            referral.source ||
            "symptomai";

          accumulator[source] =
            (accumulator[source] || 0) + 1;

          return accumulator;
        },
        {} as Record<string, number>
      );

    console.log(
      "CareScriber inbox loaded:",
      {
        count:
          referrals.length,

        sourceCounts,

        referrals:
          referrals.map(
            (referral) => ({
              referralCode:
                referral.referral_code,

              source:
                referral.source,

              paymentStatus:
                referral.payment_status,

              queueStatus:
                referral.queue_status,

              referralStatus:
                referral.referral_status,

              hivTestResult:
                referral.hiv_test_result,

              requiresConfirmatoryTesting:
                referral.requires_confirmatory_testing,
            })
          ),
      }
    );

    return NextResponse.json(
      {
        success: true,

        count:
          referrals.length,

        referrals,

        sources:
          sourceCounts,

        filters: {
          paymentStatus:
            "paid",

          queueStatuses: [
            "waiting",
            "accepted",
          ],
        },

        configured: {
          supabaseUrl:
            Boolean(supabaseUrl),

          serviceRoleKey:
            Boolean(serviceRoleKey),
        },
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load the virtual consult inbox.";

    console.error(
      "Inbox API GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        count: 0,
        referrals: [],
        error: message,
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }
}

/* ============================================================
   PATCH
   Accept / Complete Referral
============================================================ */

export async function PATCH(
  req: NextRequest
) {
  try {
    let body: InboxActionBody;

    try {
      body =
        (await req.json()) as InboxActionBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid JSON request body is required.",
        },
        {
          status: 400,
          headers: noStoreHeaders(),
        }
      );
    }

    /* --------------------------------------------------------
       Validate action
    -------------------------------------------------------- */

    if (!isValidAction(body.action)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Action must be either accept or complete.",
        },
        {
          status: 400,
          headers: noStoreHeaders(),
        }
      );
    }

    const referralId =
      cleanString(
        body.referralId,
        100
      );

    const doctorId =
      cleanString(
        body.doctorId,
        100
      );

    const doctorName =
      cleanString(
        body.doctorName,
        200
      ) || "Doctor";

    /* --------------------------------------------------------
       Validate referral
    -------------------------------------------------------- */

    if (!referralId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Referral ID is required.",
        },
        {
          status: 400,
          headers: noStoreHeaders(),
        }
      );
    }

    /* --------------------------------------------------------
       Validate doctor
    -------------------------------------------------------- */

    if (!doctorId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Doctor ID is required.",
        },
        {
          status: 400,
          headers: noStoreHeaders(),
        }
      );
    }

    /* ========================================================
       ACCEPT
    ======================================================== */

    if (body.action === "accept") {
      const referral =
        await acceptReferral({
          referralId,
          doctorId,
          doctorName,
        });

      if (!referral) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This request has already been accepted or is no longer waiting.",
          },
          {
            status: 409,
            headers: noStoreHeaders(),
          }
        );
      }

      return NextResponse.json(
        {
          success: true,

          action: "accept",

          referral,

          message:
            referral.source === "navcare"
              ? "NavCare clinical consultation accepted."
              : "Virtual consultation request accepted.",
        },
        {
          status: 200,
          headers: noStoreHeaders(),
        }
      );
    }

    /* ========================================================
       COMPLETE
    ======================================================== */

    const referral =
      await completeReferral({
        referralId,
        doctorId,
      });

    if (!referral) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The referral could not be completed. Confirm that this referral is assigned to the logged-in clinician.",
        },
        {
          status: 403,
          headers: noStoreHeaders(),
        }
      );
    }

    return NextResponse.json(
      {
        success: true,

        action: "complete",

        referral,

        message:
          referral.source === "navcare"
            ? "NavCare clinical consultation marked as completed."
            : "Referral marked as completed.",
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update this referral.";

    console.error(
      "Inbox API PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }
}
