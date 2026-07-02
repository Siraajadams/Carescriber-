import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { referralId } = await req.json();

    if (!referralId) {
      return NextResponse.json({ error: "Referral ID is required." }, { status: 400 });
    }

    const { data: referralData, error: referralError } = await supabase
      .from("symptomai_referrals")
      .select("*")
      .eq("id", referralId)
      .limit(1);

    if (referralError) {
      return NextResponse.json({ error: referralError.message }, { status: 500 });
    }

    if (!referralData || referralData.length === 0) {
      return NextResponse.json({ error: "Referral not found." }, { status: 404 });
    }

    const referral = referralData[0];

    const { data: patientData } = await supabase
      .from("patients")
      .select("*")
      .eq("id", referral.patient_id)
      .limit(1);

    await supabase
      .from("symptomai_referrals")
      .update({
        status: "Opened",
        viewed_at: new Date().toISOString(),
      })
      .eq("id", referralId);

    return NextResponse.json({
      referral,
      patient: patientData?.[0] || null,
      triage: referral.triage_snapshot || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Referral open failed." },
      { status: 500 }
    );
  }
}
