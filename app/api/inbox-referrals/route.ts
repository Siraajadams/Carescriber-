import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type InboxActionBody = {
  action?: "accept" | "complete";
  referralId?: string;
  doctorId?: string;
  doctorName?: string;
};

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "CareScriber Supabase server credentials are missing.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("symptomai_referrals")
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
        paid_at
      `)
      .eq("payment_status", "paid")
      .eq("referral_status", "ready_for_doctor")
      .in("queue_status", ["waiting", "accepted"])
      .order("paid_at", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error("Inbox referral query failed:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        referrals: data || [],
        count: data?.length || 0,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load the virtual consult inbox.";

    console.error("Inbox API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body =
      (await req.json()) as InboxActionBody;

    const action = body.action;
    const referralId =
      typeof body.referralId === "string"
        ? body.referralId.trim()
        : "";

    const doctorId =
      typeof body.doctorId === "string"
        ? body.doctorId.trim()
        : "";

    const doctorName =
      typeof body.doctorName === "string"
        ? body.doctorName.trim()
        : "";

    if (!action || !["accept", "complete"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid inbox action is required.",
        },
        { status: 400 },
      );
    }

    if (!referralId) {
      return NextResponse.json(
        {
          success: false,
          error: "Referral ID is required.",
        },
        { status: 400 },
      );
    }

    if (!doctorId) {
      return NextResponse.json(
        {
          success: false,
          error: "Doctor ID is required.",
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    if (action === "accept") {
      const { data, error } = await supabase
        .from("symptomai_referrals")
        .update({
          queue_status: "accepted",
          assigned_doctor_id: doctorId,
          assigned_doctor_name:
            doctorName || "Doctor",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", referralId)
        .eq("payment_status", "paid")
        .eq("referral_status", "ready_for_doctor")
        .eq("queue_status", "waiting")
        .select(`
          id,
          referral_code,
          queue_status,
          assigned_doctor_id,
          assigned_doctor_name
        `)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 },
        );
      }

      if (!data) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This request may already have been accepted by another doctor.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        success: true,
        referral: data,
        message:
          "Virtual consultation request accepted.",
      });
    }

    const { data, error } = await supabase
      .from("symptomai_referrals")
      .update({
        queue_status: "completed",
        referral_status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", referralId)
      .eq("assigned_doctor_id", doctorId)
      .eq("queue_status", "accepted")
      .select("id, referral_code")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only the assigned doctor can complete this referral.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      referral: data,
      message: "Referral marked as completed.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update this referral.";

    console.error("Inbox update API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
