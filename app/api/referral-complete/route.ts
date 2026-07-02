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
    const { referralId, consultationId } = await req.json();

    if (!referralId) {
      return NextResponse.json({ error: "Referral ID is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("symptomai_referrals")
      .update({
        status: "Completed",
        completed_at: new Date().toISOString(),
        consultation_id: consultationId || null,
      })
      .eq("id", referralId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      referral: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Referral complete failed." },
      { status: 500 }
    );
  }
}
