import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanEnv(value?: string) {
  return (value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\r/g, "")
    .replace(/\n/g, "");
}

export async function GET() {
  try {
    const supabaseUrl = cleanEnv(
      process.env.HIVCLINTEST_SUPABASE_URL
    );

    const supabaseKey = cleanEnv(
      process.env.HIVCLINTEST_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.HIVCLINTEST_SUPABASE_SECRET_KEY
    );

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          success: false,
          stage: "environment",
          error:
            "HIVCLINTEST_SUPABASE_URL is missing.",
        },
        { status: 500 }
      );
    }

    if (!supabaseKey) {
      return NextResponse.json(
        {
          success: false,
          stage: "environment",
          error:
            "HIVCLINTEST Supabase server key is missing.",
        },
        { status: 500 }
      );
    }

    const url =
      `${supabaseUrl}/rest/v1/symptomai_referrals` +
      `?select=*` +
      `&order=created_at.desc` +
      `&limit=20`;

    const response = await fetch(url, {
      method: "GET",

      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
      },

      cache: "no-store",
    });

    const raw = await response.text();

    let data: unknown;

    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          stage: "supabase_query",
          supabase_status: response.status,
          supabase_response: data,
        },
        { status: 500 }
      );
    }

    const rows = Array.isArray(data)
      ? data
      : [];

    const paidRows = rows.filter(
      (row: any) =>
        String(row?.payment_status || "")
          .toLowerCase()
          .trim() === "paid"
    );

    const targetReferral = rows.find(
      (row: any) =>
        String(row?.referral_code || "")
          .toUpperCase()
          .trim() === "HCT-56Y75W"
    );

    return NextResponse.json({
      success: true,

      connection:
        "HIVClinTest Supabase",

      table:
        "symptomai_referrals",

      total_recent_rows:
        rows.length,

      paid_count:
        paidRows.length,

      target_referral: targetReferral
        ? {
            found: true,
            referral_code:
              targetReferral.referral_code,
            payment_status:
              targetReferral.payment_status,
            queue_status:
              targetReferral.queue_status,
            referral_status:
              targetReferral.referral_status,
            stripe_session_id:
              targetReferral.stripe_session_id,
            created_at:
              targetReferral.created_at,
          }
        : {
            found: false,
            searched_for:
              "HCT-56Y75W",
          },

      recent_referrals: rows.map(
        (row: any) => ({
          referral_code:
            row?.referral_code ?? null,

          first_name:
            row?.first_name ?? null,

          surname:
            row?.surname ?? null,

          payment_status:
            row?.payment_status ?? null,

          queue_status:
            row?.queue_status ?? null,

          referral_status:
            row?.referral_status ?? null,

          stripe_session_id:
            row?.stripe_session_id ?? null,

          created_at:
            row?.created_at ?? null,
        })
      ),
    });
  } catch (error) {
    console.error(
      "HIVClinTest diagnostic error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        stage: "unexpected_error",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
