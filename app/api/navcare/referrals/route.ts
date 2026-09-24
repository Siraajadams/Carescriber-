import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateReferralCode() {
  return `CS-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function generateConsentToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    // -----------------------------------------
    // 1. Authenticate NavCare
    // -----------------------------------------

    const apiKey =
      request.headers.get("x-navcare-api-key");

    if (
      !apiKey ||
      apiKey !== process.env.NAVCARE_API_KEY
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // -----------------------------------------
    // 2. Read payload
    // -----------------------------------------

    const body = await request.json();

    const {
      external_referral_id,
      patient,
      self_test,
      assessment,
      consultation,
      payment,
    } = body;

    if (!external_referral_id) {
      return NextResponse.json(
        {
          success: false,
          error: "external_referral_id is required",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 3. Require verified payment
    // -----------------------------------------

    if (payment?.status !== "paid") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Referral cannot be submitted until payment is verified.",
        },
        { status: 402 }
      );
    }

    // -----------------------------------------
    // 4. Prevent duplicate referral
    // -----------------------------------------

    const { data: existing } = await supabase
      .from("symptomai_referrals")
      .select(
        "id, referral_code, referral_status, queue_status"
      )
      .eq(
        "external_referral_id",
        external_referral_id
      )
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        referral_id: existing.id,
        referral_code: existing.referral_code,
        referral_status:
          existing.referral_status,
        queue_status: existing.queue_status,
      });
    }

    // -----------------------------------------
    // 5. Generate CareScriber referral
    // -----------------------------------------

    const referralCode =
      generateReferralCode();

    const consentToken =
      generateConsentToken();

    // -----------------------------------------
    // 6. Insert referral
    // -----------------------------------------

    const { data, error } = await supabase
      .from("symptomai_referrals")
      .insert({
        source: "navcare",

        external_referral_id,

        referral_code: referralCode,
        consent_token: consentToken,

        consultation_reason:
          consultation?.reason ||
          "HIV clinical review",

        consultation_type:
          consultation?.type ||
          "virtual",

        clinical_priority:
          consultation?.priority ||
          "routine",

        patient_first_name:
          patient?.first_name || null,

        patient_surname:
          patient?.surname || null,

        patient_name:
          `${patient?.first_name || ""} ${
            patient?.surname || ""
          }`.trim() || null,

        patient_id:
          patient?.identity_number || null,

        national_id:
          patient?.identity_number || null,

        date_of_birth:
          patient?.date_of_birth || null,

        gender:
          patient?.gender || null,

        country:
          patient?.country || null,

        email:
          patient?.email || null,

        mobile:
          patient?.mobile_number || null,

        // HIV self-test
        hiv_test_type:
          self_test?.test_type || null,

        hiv_test_result:
          self_test?.result || null,

        interpretation_method:
          self_test?.interpretation_method ||
          null,

        requires_confirmatory_testing:
          self_test?.requires_confirmatory_testing ??
          false,

        // Assessment
        recent_exposure:
          assessment?.recent_exposure ??
          null,

        exposure_timing:
          assessment?.exposure_timing ||
          null,

        pep_urgent_review:
          assessment?.pep_urgent_review ??
          false,

        prep_interest:
          assessment?.prep_interest ??
          null,

        risk_flags:
          assessment?.risk_flags || [],

        symptoms:
          assessment?.symptoms || [],

        // Payment
        payment_status: "paid",

        payment_amount:
          payment?.amount || 0,

        payment_currency:
          payment?.currency || "ZAR",

        stripe_session_id:
          payment?.stripe_session_id ||
          null,

        paid_at:
          new Date().toISOString(),

        // CareScriber queue
        queue_status: "waiting",
        referral_status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error(
        "NavCare referral insert error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    // -----------------------------------------
    // 7. Return CareScriber reference
    // -----------------------------------------

    return NextResponse.json(
      {
        success: true,

        referral_id: data.id,

        referral_code:
          data.referral_code,

        consent_token:
          data.consent_token,

        queue_status:
          data.queue_status,

        referral_status:
          data.referral_status,

        message:
          "NavCare referral successfully sent to the CareScriber Virtual Consult Inbox.",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error(
      "NavCare referral API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      { status: 500 }
    );
  }
}
