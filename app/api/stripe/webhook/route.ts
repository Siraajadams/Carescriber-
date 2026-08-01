import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is missing." },
        { status: 500 },
      );
    }

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "STRIPE_WEBHOOK_SECRET is missing." },
        { status: 500 },
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase server credentials are missing." },
        { status: 500 },
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Stripe signature is missing." },
        { status: 400 },
      );
    }

    const rawBody = await req.text();

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (error: unknown) {
      console.error("Invalid Stripe webhook signature:", error);

      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 400 },
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true });
      }

      const metadata = session.metadata || {};

      const referralCode = metadata.referralCode;
      const consultationReason = metadata.consultationReason || null;
      const patientFirstName = metadata.patientFirstName || null;
      const patientSurname = metadata.patientSurname || null;

      if (!referralCode) {
        console.error("Paid Stripe session has no referralCode metadata.");

        return NextResponse.json(
          { error: "Referral code metadata is missing." },
          { status: 400 },
        );
      }

      const supabaseAdmin = createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

      const { data, error } = await supabaseAdmin
        .from("symptomai_referrals")
        .update({
          payment_status: "paid",
          queue_status: "waiting",
          consultation_reason: consultationReason,
          patient_first_name: patientFirstName,
          patient_surname: patientSurname,
          paid_at: new Date().toISOString(),
        })
        .eq("referral_code", referralCode)
        .select("id, referral_code")
        .maybeSingle();

      if (error) {
        console.error("Referral queue update failed:", error);

        return NextResponse.json(
          { error: "Could not update the referral queue." },
          { status: 500 },
        );
      }

      if (!data) {
        console.error("No referral found for:", referralCode);

        return NextResponse.json(
          { error: `No referral found for ${referralCode}.` },
          { status: 404 },
        );
      }

      console.log("Referral released to inbox:", data.referral_code);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("Stripe webhook error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}
