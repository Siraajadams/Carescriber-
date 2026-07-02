import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { referralId } = await req.json();

    if (!referralId) {
      return NextResponse.json(
        { error: "Referral ID is required." },
        { status: 400 }
      );
    }

    const { data: referral, error } = await supabase
      .from("symptomai_referrals")
      .select("*")
      .eq("id", referralId)
      .limit(1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!referral || referral.length === 0) {
      return NextResponse.json({ error: "Referral not found." }, { status: 404 });
    }

    const r = referral[0];

    const { data: patient } = await supabase
      .from("patients")
      .select("*")
      .eq("id", r.patient_id)
      .limit(1);

    await supabase
      .from("symptomai_referrals")
      .update({
        status: "Opened",
        viewed_at: new Date().toISOString(),
      })
      .eq("id", referralId);

    return NextResponse.json({
      referral: r,
      patient: patient?.[0] || null,
      triage: r.triage_snapshot || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Referral open failed." },
      { status: 500 }
    );
  }
}
