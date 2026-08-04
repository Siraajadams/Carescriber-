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

type ReferralRecord = {
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
  updated_at?: string | null;
  paid_at: string | null;

  [key: string]: unknown;
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

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

async function loadPaidInboxReferrals(): Promise<
  ReferralRecord[]
> {
  const supabase = getSupabaseAdmin();

  /*
   * Do not require referral_status here.
   *
   * Older Stripe payments may already have:
   * payment_status = paid
   * queue_status = waiting
   *
   * but referral_status may be null because they were
   * processed before the new webhook was deployed.
   */
  const { data, error } = await supabase
    .from(REFERRAL_TABLE)
    .select(`
      id,
      referral_code,
      consent_token,
      consultation_reason,
      patient_first_name,
      patient_surname,
      patient_name,
      patient_id,
      national_id,
      email,
      mobile,
      payment_status,
      queue_status,
      referral_status,
      assigned_doctor_id,
      assigned_doctor_name,
      accepted_at,
      completed_at,
      created_at,
      updated_at,
      paid_at
    `)
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

  return (data || []) as ReferralRecord[];
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

  /*
   * Only one doctor can accept a waiting referral.
   * The queue_status condition provides the concurrency
   * protection.
   */
  const { data, error } = await supabase
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
    .select(`
      id,
      referral_code,
      payment_status,
      queue_status,
      referral_status,
      assigned_doctor_id,
      assigned_doctor_name,
      accepted_at
    `)
    .maybeSingle();

  if (error) {
    /*
     * Some older databases may not yet contain
     * referral_status or updated_at.
     */
    console.warn(
      "Complete accept update failed. Trying compatible fields:",
      error.message,
    );

    const fallbackResult = await supabase
      .from(REFERRAL_TABLE)
      .update({
        queue_status: "accepted",
        assigned_doctor_id: doctorId,
        assigned_doctor_name:
          doctorName || "Doctor",
        accepted_at: now,
      })
      .eq("id", referralId)
      .eq("payment_status", "paid")
      .eq("queue_status", "waiting")
      .select(`
        id,
        referral_code,
        payment_status,
        queue_status,
        assigned_doctor_id,
        assigned_doctor_name,
        accepted_at
      `)
      .maybeSingle();

    if (fallbackResult.error) {
      throw new Error(
        fallbackResult.error.message,
      );
    }

    if (!fallbackResult.data) {
      return null;
    }

    return fallbackResult.data;
  }

  return data;
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

  const { data, error } = await supabase
    .from(REFERRAL_TABLE)
    .update({
      queue_status: "completed",
      referral_status: "completed",
      completed_at: now,
      updated_at: now,
    })
    .eq("id", referralId)
    .eq("payment_status", "paid")
    .eq("assigned_doctor_id", doctorId)
    .eq("queue_status", "accepted")
    .select(`
      id,
      referral_code,
      queue_status,
      referral_status,
      assigned_doctor_id,
      completed_at
    `)
    .maybeSingle();

  if (error) {
    /*
     * Fallback for older schemas that do not yet contain
     * referral_status or updated_at.
     */
    console.warn(
      "Complete referral update failed. Trying compatible fields:",
      error.message,
    );

    const fallbackResult = await supabase
      .from(REFERRAL_TABLE)
      .update({
        queue_status: "completed",
        completed_at: now,
      })
      .eq("id", referralId)
      .eq("payment_status", "paid")
      .eq("assigned_doctor_id", doctorId)
      .eq("queue_status", "accepted")
      .select(`
        id,
        referral_code,
        queue_status,
        assigned_doctor_id,
        completed_at
      `)
      .maybeSingle();

    if (fallbackResult.error) {
      throw new Error(
        fallbackResult.error.message,
      );
    }

    return fallbackResult.data;
  }

  return data;
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
            id: referral.id,
            referralCode:
              referral.referral_code,
            paymentStatus:
              referral.payment_status,
            queueStatus:
              referral.queue_status,
            referralStatus:
              referral.referral_status,
            assignedDoctorId:
              referral.assigned_doctor_id,
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
            "Not required for inbox compatibility",
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

    const action = body.action;

    const referralId = cleanString(
      body.referralId,
      100,
    );

    const doctorId = cleanString(
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

    if (action === "accept") {
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

      console.log(
        "Virtual consultation accepted:",
        {
          referralId,
          doctorId,
          doctorName,
        },
      );

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
            "Only the assigned doctor can complete an accepted referral.",
        },
        {
          status: 403,
          headers: noStoreHeaders(),
        },
      );
    }

    console.log(
      "Virtual consultation completed:",
      {
        referralId,
        doctorId,
      },
    );

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
