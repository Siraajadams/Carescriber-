import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  consultation_reason: string | null;

  patient_first_name: string | null;
  patient_surname: string | null;
  patient_name: string | null;

  patient_id: string | null;
  national_id: string | null;

  payment_status: string | null;
  queue_status: string | null;
  referral_status: string | null;

  assigned_doctor_id: string | null;
  assigned_doctor_name: string | null;

  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  submitted_at: string | null;
  paid_at: string | null;

  triage_summary: unknown;
  patient_snapshot: unknown;
  triage_snapshot: unknown;
};

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "CareScriber Supabase server credentials are missing.",
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function stringValue(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function objectValue(
  value: unknown,
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

function normaliseReferral(
  record: RawReferral,
): InboxReferral {
  const patientSnapshot =
    objectValue(record.patient_snapshot);

  const triageSnapshot =
    objectValue(record.triage_snapshot);

  const firstName =
    stringValue(record.patient_first_name) ||
    getNestedString(
      patientSnapshot,
      "firstName",
      "first_name",
      "patientFirstName",
      "patient_first_name",
    );

  const surname =
    stringValue(record.patient_surname) ||
    getNestedString(
      patientSnapshot,
      "surname",
      "lastName",
      "last_name",
      "patientSurname",
      "patient_surname",
    );

  const patientName =
    stringValue(record.patient_name) ||
    getNestedString(
      patientSnapshot,
      "patientName",
      "patient_name",
      "name",
      "fullName",
      "full_name",
    ) ||
    [firstName, surname].filter(Boolean).join(" ") ||
    null;

  const patientId =
    stringValue(record.patient_id) ||
    getNestedString(
      patientSnapshot,
      "patientId",
      "patient_id",
      "nationalId",
      "national_id",
      "idNumber",
      "id_number",
    );

  const consultationReason =
    stringValue(record.consultation_reason) ||
    stringValue(record.triage_summary) ||
    getNestedString(
      triageSnapshot,
      "consultationReason",
      "consultation_reason",
      "reason",
      "summary",
      "notes",
    );

  return {
    id:
      stringValue(record.id) || "",

    referral_code:
      stringValue(record.referral_code) || "",

    consent_token:
      stringValue(record.consent_token),

    consultation_reason:
      consultationReason,

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

    payment_status:
      stringValue(record.payment_status),

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

    triage_summary:
      record.triage_summary ?? null,

    patient_snapshot:
      record.patient_snapshot ?? null,

    triage_snapshot:
      record.triage_snapshot ?? null,
  };
}

function cleanString(
  value: unknown,
  maxLength = 250,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .substring(0, maxLength);
}

function isValidAction(
  value: unknown,
): value is InboxAction {
  return (
    value === "accept" ||
    value === "complete"
  );
}

async function loadPaidInboxReferrals(): Promise<
  InboxReferral[]
> {
  const supabase = getSupabaseAdmin();

  /*
   * select("*") prevents failures when optional columns,
   * such as email or mobile, do not exist.
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
      `Inbox referral query failed: ${error.message}`,
    );
  }

  return (data || [])
    .map((record) =>
      normaliseReferral(
        record as RawReferral,
      ),
    )
    .filter(
      (referral) =>
        referral.id &&
        referral.referral_code,
    );
}

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

  const completeResult = await supabase
    .from(REFERRAL_TABLE)
    .update({
      queue_status: "accepted",
      referral_status: "accepted",
      assigned_doctor_id: doctorId,
      assigned_doctor_name:
        doctorName || "Doctor",
      accepted_at: now,
      updated_at: now,
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
      completeResult.data as RawReferral,
    );
  }

  console.warn(
    "Complete accept update failed. Trying compatible fields:",
    completeResult.error?.message,
  );

  /*
   * Fallback for schemas without referral_status,
   * assigned doctor fields or updated_at.
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
      fallbackResult.error.message,
    );
  }

  return fallbackResult.data
    ? normaliseReferral(
        fallbackResult.data as RawReferral,
      )
    : null;
}

async function completeReferral({
  referralId,
  doctorId,
}: {
  referralId: string;
  doctorId: string;
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

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
      completeResult.data as RawReferral,
    );
  }

  console.warn(
    "Complete referral update failed. Trying compatible fields:",
    completeResult.error?.message,
  );

  /*
   * Compatible fallback where assigned_doctor_id or
   * referral_status may not exist.
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
      fallbackResult.error.message,
    );
  }

  return fallbackResult.data
    ? normaliseReferral(
        fallbackResult.data as RawReferral,
      )
    : null;
}

export async function GET() {
  try {
    const referrals =
      await loadPaidInboxReferrals();

    console.log(
      "CareScriber inbox loaded:",
      {
        count: referrals.length,

        referrals: referrals.map(
          (referral) => ({
            referralCode:
              referral.referral_code,

            paymentStatus:
              referral.payment_status,

            queueStatus:
              referral.queue_status,

            referralStatus:
              referral.referral_status,
          }),
        ),
      },
    );

    return NextResponse.json(
      {
        success: true,
        count: referrals.length,
        referrals,

        filters: {
          paymentStatus: "paid",
          queueStatuses: [
            "waiting",
            "accepted",
          ],
          referralStatus:
            "Not required",
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
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load the virtual consult inbox.";

    console.error(
      "Inbox API GET error:",
      error,
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
      },
    );
  }
}

export async function PATCH(
  req: NextRequest,
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
        },
      );
    }

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
        },
      );
    }

    const referralId =
      cleanString(
        body.referralId,
        100,
      );

    const doctorId =
      cleanString(
        body.doctorId,
        100,
      );

    const doctorName =
      cleanString(
        body.doctorName,
        200,
      ) || "Doctor";

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
        },
      );
    }

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
        },
      );
    }

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
          },
        );
      }

      return NextResponse.json(
        {
          success: true,
          action: "accept",
          referral,
          message:
            "Virtual consultation request accepted.",
        },
        {
          status: 200,
          headers: noStoreHeaders(),
        },
      );
    }

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
            "The referral could not be completed.",
        },
        {
          status: 403,
          headers: noStoreHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        action: "complete",
        referral,
        message:
          "Referral marked as completed.",
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update this referral.";

    console.error(
      "Inbox API PATCH error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      },
    );
  }
}
