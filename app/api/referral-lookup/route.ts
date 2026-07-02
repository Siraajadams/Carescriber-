import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { referralCode, consentToken } = await req.json();

    if (!referralCode || !consentToken) {
      return NextResponse.json(
        { error: "Referral code and consent token are required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("symptomai_referrals")
      .select("*")
      .eq("referral_code", referralCode.trim())
      .eq("consent_token", consentToken.trim())
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Referral not found or consent token incorrect." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      referral: data[0],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Referral lookup failed." },
      { status: 500 }
    );
  }
}
