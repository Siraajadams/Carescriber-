import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is not configured." },
        { status: 500 },
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    const body = await req.json();

    const {
      referralCode,
      consentToken,
      consultationReason,
      patientId,
      patientName,
      patientFirstName,
      patientSurname,
      patientEmail,
    } = body;

    if (!referralCode) {
      return NextResponse.json(
        { error: "Referral code is required." },
        { status: 400 },
      );
    }

    if (!consentToken) {
      return NextResponse.json(
        { error: "Consent token is required." },
        { status: 400 },
      );
    }

    if (!consultationReason?.trim()) {
      return NextResponse.json(
        { error: "Reason for consultation is required." },
        { status: 400 },
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "https://symptomai.digital";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      payment_method_types: ["card"],

      line_items: [
        {
          price_data: {
            currency: "zar",

            product_data: {
              name: "Virtual GP Consultation",
              description: `SymptomAI referral ${referralCode}`,
            },

            unit_amount: 25000,
          },

          quantity: 1,
        },
      ],

      metadata: {
        referralCode: String(referralCode || ""),
        consentToken: String(consentToken || ""),
        consultationReason: String(consultationReason || ""),
        patientId: String(patientId || ""),
        patientName: String(patientName || ""),
        patientFirstName: String(patientFirstName || ""),
        patientSurname: String(patientSurname || ""),
      },

      customer_email: patientEmail?.trim()
        ? String(patientEmail).trim()
        : undefined,

      success_url:
        `${appUrl}/?payment=success` +
        `&session_id={CHECKOUT_SESSION_ID}` +
        `&referral_code=${encodeURIComponent(referralCode)}`,

      cancel_url:
        `${appUrl}/?payment=cancelled` +
        `&referral_code=${encodeURIComponent(referralCode)}`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    console.error("Virtual consultation payment error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not create the Stripe payment session.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
