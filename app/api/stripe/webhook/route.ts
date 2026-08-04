import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const careScriberApiUrl =
  process.env.CARESCRIBER_API_URL;

const careScriberApiSecret =
  process.env.CARESCRIBER_API_SECRET;

type ReferralRecord = {
  id: string;
  referral_code?: string | null;
  consent_token?: string | null;

  patient_first_name?: string | null;
  patient_surname?: string | null;
  patient_name?: string | null;

  patient_id?: string | null;
  national_id?: string | null;

  date_of_birth?: string | null;
  gender?: string | null;

  email?: string | null;
  mobile?: string | null;

  consultation_reason?: string | null;

  payment_status?: string | null;
  queue_status?: string | null;
  referral_status?: string | null;

  paid_at?: string | null;

  [key: string]: unknown;
};

function getStripe() {
  if (!stripeSecretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is missing.",
    );
  }

  return new Stripe(stripeSecretKey);
}

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase server credentials are missing.",
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function cleanValue(
  value: string | null | undefined,
): string | null {
  const cleaned =
    typeof value === "string"
      ? value.trim()
      : "";

  return cleaned || null;
}

function normaliseReferralCode(
  value: string | null | undefined,
): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getMetadataValue(
  metadata: Stripe.Metadata | null,
  ...keys: string[]
): string | null {
  if (!metadata) {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function getReferralCode(
  session: Stripe.Checkout.Session,
): string {
  const metadata = session.metadata || {};

  return normaliseReferralCode(
    metadata.referralCode ||
      metadata.referral_code ||
      metadata.symptomaiReferralCode ||
      metadata.symptomai_referral_code ||
      session.client_reference_id,
  );
}

function getPaymentIntentId(
  session: Stripe.Checkout.Session,
): string | null {
  if (
    typeof session.payment_intent ===
    "string"
  ) {
    return session.payment_intent;
  }

  return session.payment_intent?.id || null;
}

function buildCareScriberEndpoint(): string {
  if (!careScriberApiUrl) {
    throw new Error(
      "CARESCRIBER_API_URL is missing.",
    );
  }

  const cleanUrl =
    careScriberApiUrl.replace(/\/+$/, "");

  if (
    cleanUrl.endsWith(
      "/api/symptomai-referral",
    )
  ) {
    return cleanUrl;
  }

  return `${cleanUrl}/api/symptomai-referral`;
}

async function findReferral(
  referralCode: string,
): Promise<ReferralRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("symptomai_referrals")
    .select("*")
    .ilike(
      "referral_code",
      referralCode,
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    )
    .limit(1);

  if (error) {
    throw new Error(
      `Referral lookup failed: ${error.message}`,
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as ReferralRecord;
}

async function updateReferralAsPaid({
  referral,
  session,
  referralCode,
}: {
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
  referralCode: string;
}): Promise<ReferralRecord> {
  const supabase = getSupabaseAdmin();
  const metadata = session.metadata || {};

  const paidAt =
    new Date().toISOString();

  const patientFirstName =
    getMetadataValue(
      metadata,
      "patientFirstName",
      "patient_first_name",
      "firstName",
      "first_name",
    ) ||
    referral.patient_first_name ||
    null;

  const patientSurname =
    getMetadataValue(
      metadata,
      "patientSurname",
      "patient_surname",
      "surname",
      "lastName",
      "last_name",
    ) ||
    referral.patient_surname ||
    null;

  const combinedPatientName =
    [patientFirstName, patientSurname]
      .filter(Boolean)
      .join(" ") || null;

  const patientName =
    getMetadataValue(
      metadata,
      "patientName",
      "patient_name",
    ) ||
    combinedPatientName ||
    referral.patient_name ||
    null;

  const patientId =
    getMetadataValue(
      metadata,
      "patientId",
      "patient_id",
      "nationalId",
      "national_id",
    ) ||
    referral.patient_id ||
    referral.national_id ||
    null;

  const nationalId =
    getMetadataValue(
      metadata,
      "nationalId",
      "national_id",
      "patientId",
      "patient_id",
    ) ||
    referral.national_id ||
    referral.patient_id ||
    null;

  const patientEmail =
    getMetadataValue(
      metadata,
      "patientEmail",
      "patient_email",
      "email",
    ) ||
    session.customer_details?.email ||
    session.customer_email ||
    referral.email ||
    null;

  const patientMobile =
    getMetadataValue(
      metadata,
      "patientMobile",
      "patient_mobile",
      "patientPhone",
      "patient_phone",
      "mobile",
      "phone",
    ) ||
    session.customer_details?.phone ||
    referral.mobile ||
    null;

  const consultationReason =
    getMetadataValue(
      metadata,
      "consultationReason",
      "consultation_reason",
      "reasonForConsultation",
      "reason_for_consultation",
    ) ||
    referral.consultation_reason ||
    null;

  const consentToken =
    getMetadataValue(
      metadata,
      "consentToken",
      "consent_token",
    ) ||
    referral.consent_token ||
    null;

  const dateOfBirth =
    getMetadataValue(
      metadata,
      "dateOfBirth",
      "date_of_birth",
      "dob",
    ) ||
    referral.date_of_birth ||
    null;

  const gender =
    getMetadataValue(
      metadata,
      "gender",
      "patientGender",
      "patient_gender",
    ) ||
    referral.gender ||
    null;

  const completeUpdate = {
    patient_first_name:
      patientFirstName,

    patient_surname:
      patientSurname,

    patient_name:
      patientName,

    patient_id:
      patientId,

    national_id:
      nationalId,

    date_of_birth:
      dateOfBirth,

    gender,

    email:
      patientEmail,

    mobile:
      patientMobile,

    consent_token:
      consentToken,

    consultation_reason:
      consultationReason,

    payment_status:
      "paid",

    queue_status:
      "waiting",

    referral_status:
      "ready_for_doctor",

    consultation_fee:
      250,

    currency:
      "ZAR",

    stripe_checkout_session_id:
      session.id,

    stripe_payment_intent_id:
      getPaymentIntentId(session),

    paid_at:
      paidAt,

    updated_at:
      paidAt,
  };

  const completeResult =
    await supabase
      .from("symptomai_referrals")
      .update(completeUpdate)
      .eq("id", referral.id)
      .select("*")
      .single();

  if (
    !completeResult.error &&
    completeResult.data
  ) {
    return completeResult.data as ReferralRecord;
  }

  console.warn(
    `Complete referral update failed for ${referralCode}. ` +
      "Trying essential inbox fields.",
    completeResult.error?.message,
  );

  /*
   * Fallback in case optional Stripe, patient or
   * tracking columns do not yet exist.
   */
  const essentialResult =
    await supabase
      .from("symptomai_referrals")
      .update({
        payment_status:
          "paid",

        queue_status:
          "waiting",

        referral_status:
          "ready_for_doctor",

        consultation_reason:
          consultationReason,

        paid_at:
          paidAt,

        updated_at:
          paidAt,
      })
      .eq("id", referral.id)
      .select("*")
      .single();

  if (
    essentialResult.error ||
    !essentialResult.data
  ) {
    throw new Error(
      `Could not update referral ${referralCode}: ${
        essentialResult.error?.message ||
        completeResult.error?.message ||
        "Unknown Supabase error."
      }`,
    );
  }

  return essentialResult.data as ReferralRecord;
}

function buildCareScriberPayload({
  referral,
  session,
  referralCode,
}: {
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
  referralCode: string;
}) {
  const metadata = session.metadata || {};

  const patientFirstName =
    getMetadataValue(
      metadata,
      "patientFirstName",
      "patient_first_name",
    ) ||
    referral.patient_first_name ||
    null;

  const patientSurname =
    getMetadataValue(
      metadata,
      "patientSurname",
      "patient_surname",
    ) ||
    referral.patient_surname ||
    null;

  const patientName =
    getMetadataValue(
      metadata,
      "patientName",
      "patient_name",
    ) ||
    referral.patient_name ||
    [patientFirstName, patientSurname]
      .filter(Boolean)
      .join(" ") ||
    null;

  const patientId =
    getMetadataValue(
      metadata,
      "patientId",
      "patient_id",
      "nationalId",
      "national_id",
    ) ||
    referral.patient_id ||
    referral.national_id ||
    null;

  const nationalId =
    getMetadataValue(
      metadata,
      "nationalId",
      "national_id",
      "patientId",
      "patient_id",
    ) ||
    referral.national_id ||
    referral.patient_id ||
    null;

  const patientEmail =
    getMetadataValue(
      metadata,
      "patientEmail",
      "patient_email",
      "email",
    ) ||
    session.customer_details?.email ||
    session.customer_email ||
    referral.email ||
    null;

  const patientMobile =
    getMetadataValue(
      metadata,
      "patientMobile",
      "patient_mobile",
      "mobile",
      "phone",
    ) ||
    session.customer_details?.phone ||
    referral.mobile ||
    null;

  const consentToken =
    getMetadataValue(
      metadata,
      "consentToken",
      "consent_token",
    ) ||
    referral.consent_token ||
    null;

  const consultationReason =
    getMetadataValue(
      metadata,
      "consultationReason",
      "consultation_reason",
    ) ||
    referral.consultation_reason ||
    null;

  const dateOfBirth =
    getMetadataValue(
      metadata,
      "dateOfBirth",
      "date_of_birth",
      "dob",
    ) ||
    referral.date_of_birth ||
    null;

  const gender =
    getMetadataValue(
      metadata,
      "gender",
      "patientGender",
      "patient_gender",
    ) ||
    referral.gender ||
    null;

  return {
    referralCode,
    referral_code:
      referralCode,

    consentToken,
    consent_token:
      consentToken,

    patientFirstName,
    patient_first_name:
      patientFirstName,

    patientSurname,
    patient_surname:
      patientSurname,

    patientName,
    patient_name:
      patientName,

    patientId,
    patient_id:
      patientId,

    nationalId,
    national_id:
      nationalId,

    dateOfBirth,
    date_of_birth:
      dateOfBirth,

    gender,

    patientEmail,
    patient_email:
      patientEmail,

    patientMobile,
    patient_mobile:
      patientMobile,

    consultationReason,
    consultation_reason:
      consultationReason,

    paymentStatus:
      "paid",

    payment_status:
      "paid",

    queueStatus:
      "waiting",

    queue_status:
      "waiting",

    referralStatus:
      "ready_for_doctor",

    referral_status:
      "ready_for_doctor",

    consultationFee:
      250,

    consultation_fee:
      250,

    currency:
      "ZAR",

    stripeSessionId:
      session.id,

    stripe_session_id:
      session.id,

    stripePaymentIntentId:
      getPaymentIntentId(session),

    stripe_payment_intent_id:
      getPaymentIntentId(session),

    paidAt:
      referral.paid_at ||
      new Date().toISOString(),

    paid_at:
      referral.paid_at ||
      new Date().toISOString(),

    source:
      "symptomai",
  };
}

async function sendToCareScriber({
  referral,
  session,
  referralCode,
}: {
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
  referralCode: string;
}) {
  if (!careScriberApiSecret) {
    throw new Error(
      "CARESCRIBER_API_SECRET is missing.",
    );
  }

  const endpoint =
    buildCareScriberEndpoint();

  const payload =
    buildCareScriberPayload({
      referral,
      session,
      referralCode,
    });

  console.log(
    `Sending referral ${referralCode} to CareScriber:`,
    endpoint,
  );

  const response = await fetch(
    endpoint,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Accept:
          "application/json",

        Authorization:
          `Bearer ${careScriberApiSecret}`,

        "x-api-key":
          careScriberApiSecret,
      },

      body:
        JSON.stringify(payload),

      cache:
        "no-store",
    },
  );

  const responseText =
    await response.text();

  let responseBody: unknown =
    responseText;

  if (responseText) {
    try {
      responseBody =
        JSON.parse(responseText);
    } catch {
      responseBody =
        responseText;
    }
  }

  if (!response.ok) {
    console.error(
      "CareScriber referral receiver failed:",
      {
        referralCode,
        status:
          response.status,
        response:
          responseBody,
      },
    );

    throw new Error(
      `CareScriber rejected referral ${referralCode}. ` +
        `HTTP ${response.status}: ${
          typeof responseBody === "string"
            ? responseBody
            : JSON.stringify(responseBody)
        }`,
    );
  }

  console.log(
    `Referral ${referralCode} successfully sent to CareScriber.`,
    {
      status:
        response.status,
      response:
        responseBody,
    },
  );

  return responseBody;
}

async function processCheckoutSession(
  session: Stripe.Checkout.Session,
) {
  if (
    session.payment_status !== "paid"
  ) {
    console.log(
      "Checkout session completed but payment is not paid:",
      {
        sessionId:
          session.id,
        paymentStatus:
          session.payment_status,
      },
    );

    return {
      processed: false,
      reason:
        "payment_not_paid",
    };
  }

  const referralCode =
    getReferralCode(session);

  if (!referralCode) {
    throw new Error(
      "Paid Stripe session has no referral code metadata.",
    );
  }

  const referral =
    await findReferral(
      referralCode,
    );

  if (!referral) {
    throw new Error(
      `No referral found for ${referralCode}.`,
    );
  }

  /*
   * Updating an already-paid referral is safe and keeps
   * webhook retries idempotent.
   */
  const updatedReferral =
    await updateReferralAsPaid({
      referral,
      session,
      referralCode,
    });

  const careScriberResponse =
    await sendToCareScriber({
      referral:
        updatedReferral,
      session,
      referralCode,
    });

  console.log(
    "Referral released to CareScriber inbox:",
    {
      referralCode,
      referralId:
        updatedReferral.id,
      stripeSessionId:
        session.id,
    },
  );

  return {
    processed: true,
    referralCode,
    referralId:
      updatedReferral.id,
    careScriberResponse,
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,

    service:
      "SymptomAI Stripe webhook",

    configured: {
      stripeSecretKey:
        Boolean(stripeSecretKey),

      webhookSecret:
        Boolean(webhookSecret),

      supabaseUrl:
        Boolean(supabaseUrl),

      serviceRoleKey:
        Boolean(serviceRoleKey),

      careScriberApiUrl:
        Boolean(careScriberApiUrl),

      careScriberApiSecret:
        Boolean(careScriberApiSecret),
    },

    supportedEvents: [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ],
  });
}

export async function POST(
  req: NextRequest,
) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error:
            "STRIPE_SECRET_KEY is missing.",
        },
        {
          status: 500,
        },
      );
    }

    if (!webhookSecret) {
      return NextResponse.json(
        {
          error:
            "STRIPE_WEBHOOK_SECRET is missing.",
        },
        {
          status: 500,
        },
      );
    }

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "Supabase server credentials are missing.",
        },
        {
          status: 500,
        },
      );
    }

    if (!careScriberApiUrl) {
      return NextResponse.json(
        {
          error:
            "CARESCRIBER_API_URL is missing.",
        },
        {
          status: 500,
        },
      );
    }

    if (!careScriberApiSecret) {
      return NextResponse.json(
        {
          error:
            "CARESCRIBER_API_SECRET is missing.",
        },
        {
          status: 500,
        },
      );
    }

    const signature =
      req.headers.get(
        "stripe-signature",
      );

    if (!signature) {
      return NextResponse.json(
        {
          error:
            "Stripe signature is missing.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Stripe signature verification requires the exact,
     * unparsed request body.
     */
    const rawBody =
      await req.text();

    const stripe =
      getStripe();

    let event:
      Stripe.Event;

    try {
      event =
        stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret,
        );
    } catch (error: unknown) {
      console.error(
        "Invalid Stripe webhook signature:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Invalid webhook signature.",
        },
        {
          status: 400,
        },
      );
    }

    console.log(
      "Stripe webhook received:",
      {
        eventId:
          event.id,
        eventType:
          event.type,
      },
    );

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session =
          event.data
            .object as Stripe.Checkout.Session;

        const result =
          await processCheckoutSession(
            session,
          );

        return NextResponse.json({
          received: true,
          eventId:
            event.id,
          eventType:
            event.type,
          ...result,
        });
      }

      default:
        console.log(
          "Stripe webhook event ignored:",
          event.type,
        );

        return NextResponse.json({
          received: true,
          ignored: true,
          eventId:
            event.id,
          eventType:
            event.type,
        });
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Webhook processing failed.";

    console.error(
      "Stripe webhook error:",
      error,
    );

    /*
     * Returning 500 makes Stripe retry the webhook.
     * This is important if Supabase or CareScriber is
     * temporarily unavailable.
     */
    return NextResponse.json(
      {
        received:
          false,
        error:
          message,
      },
      {
        status: 500,
      },
    );
  }
}
