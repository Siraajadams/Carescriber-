import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url =
    process.env.CARESCRIBER_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  const key =
    process.env.CARESCRIBER_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new Error("CareScriber Supabase URL is missing.");
  }

  if (!key) {
    throw new Error("CareScriber Supabase service-role key is missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeReferralCode(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeConsentToken(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const referralCode = normalizeReferralCode(
      body?.referralCode || body?.referral_code,
    );

    const consentToken = normalizeConsentToken(
      body?.consentToken || body?.consent_token,
    );

    if (!referralCode || !consentToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Referral code and consent token are required.",
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: referral, error } = await supabase
      .from("symptomai_referrals")
      .select(`
        id,
        patient_id,
        referral_code,
        consent_token,
        consent_given,
        status,
        submitted_at,
        expires_at,
        patient_snapshot,
        triage_snapshot,
        created_at
      `)
      .eq("referral_code", referralCode)
      .eq("consent_token", consentToken)
      .maybeSingle();

    if (error) {
      console.error("Referral lookup database error:", error);

      return NextResponse.json(
        {
          success: false,
          error: `Referral lookup failed: ${error.message}`,
        },
        { status: 500 },
      );
    }

    if (!referral) {
      return NextResponse.json(
        {
          success: false,
          error: "Referral not found or consent token incorrect.",
        },
        { status: 404 },
      );
    }

    if (referral.consent_given !== true) {
      return NextResponse.json(
        {
          success: false,
          error: "Patient consent has not been recorded for this referral.",
        },
        { status: 403 },
      );
    }

    const now = new Date();
    const expiresAt = referral.expires_at
      ? new Date(referral.expires_at)
      : null;

    if (
      expiresAt &&
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt.getTime() <= now.getTime()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This referral has expired.",
        },
        { status: 410 },
      );
    }

    const normalizedStatus = String(referral.status || "")
      .trim()
      .toLowerCase();

    if (
      normalizedStatus === "completed" ||
      normalizedStatus === "cancelled" ||
      normalizedStatus === "expired"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `This referral is already ${normalizedStatus}.`,
        },
        { status: 409 },
      );
    }

    let patient = null;

    if (referral.patient_id) {
      const { data: patientRecord, error: patientError } = await supabase
        .from("patients")
        .select(`
          id,
          first_name,
          last_name,
          surname,
          patient_id,
          id_number,
          national_id,
          dob,
          date_of_birth,
          gender,
          mobile,
          mobile_number,
          email
        `)
        .eq("id", referral.patient_id)
        .maybeSingle();

      if (patientError) {
        console.error("Linked patient lookup error:", patientError);
      } else {
        patient = patientRecord;
      }
    }

    const snapshot =
      referral.patient_snapshot &&
      typeof referral.patient_snapshot === "object"
        ? referral.patient_snapshot
        : {};

    const patientData = {
      id: patient?.id || referral.patient_id || snapshot.id || null,

      first_name:
        patient?.first_name ||
        snapshot.first_name ||
        snapshot.firstName ||
        "",

      surname:
        patient?.surname ||
        patient?.last_name ||
        snapshot.surname ||
        snapshot.last_name ||
        snapshot.lastName ||
        "",

      patient_id:
        patient?.patient_id ||
        patient?.id_number ||
        patient?.national_id ||
        snapshot.patient_id ||
        snapshot.patientId ||
        snapshot.id_number ||
        snapshot.national_id ||
        snapshot.nationalId ||
        "",

      date_of_birth:
        patient?.date_of_birth ||
        patient?.dob ||
        snapshot.date_of_birth ||
        snapshot.dateOfBirth ||
        snapshot.dob ||
        "",

      gender:
        patient?.gender ||
        snapshot.gender ||
        "",

      mobile:
        patient?.mobile ||
        patient?.mobile_number ||
        snapshot.mobile ||
        snapshot.mobile_number ||
        snapshot.phone ||
        "",

      email:
        patient?.email ||
        snapshot.email ||
        "",
    };

    return NextResponse.json({
      success: true,

      referral: {
        id: referral.id,
        patient_id: referral.patient_id,
        referral_code: referral.referral_code,
        consent_token: referral.consent_token,
        consent_given: referral.consent_given,
        status: referral.status,
        submitted_at: referral.submitted_at,
        expires_at: referral.expires_at,
        patient_snapshot: referral.patient_snapshot,
        triage_snapshot: referral.triage_snapshot,
        created_at: referral.created_at,
      },

      patient: patientData,
      triage: referral.triage_snapshot || null,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Referral lookup failed.";

    console.error("Referral lookup route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
