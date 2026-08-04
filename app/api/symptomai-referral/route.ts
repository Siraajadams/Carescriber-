import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const careScriberApiSecret =
  process.env.CARESCRIBER_API_SECRET;

const REFERRAL_TABLE = "symptomai_referrals";

type SymptomAIReferralBody = {
  referralCode?: string;
  referral_code?: string;

  consentToken?: string;
  consent_token?: string;

  patientFirstName?: string;
  patient_first_name?: string;

  patientSurname?: string;
  patient_surname?: string;

  patientName?: string;
  patient_name?: string;

  patientId?: string;
  patient_id?: string;

  nationalId?: string;
  national_id?: string;

  dateOfBirth?: string;
  date_of_birth?: string;
  dob?: string;

  gender?: string;

  patientEmail?: string;
  patient_email?: string;
  email?: string;

  patientMobile?: string;
  patient_mobile?: string;
  mobile?: string;
  phone?: string;

  consultationReason?: string;
  consultation_reason?: string;

  paymentStatus?: string;
  payment_status?: string;

  queueStatus?: string;
  queue_status?: string;

  referralStatus?: string;
  referral_status?: string;

  consultationFee?: number | string;
  consultation_fee?: number | string;

  currency?: string;

  stripeSessionId?: string;
  stripe_session_id?: string;

  stripePaymentIntentId?: string;
  stripe_payment_intent_id?: string;

  paidAt?: string;
  paid_at?: string;

  source?: string;

  [key: string]: unknown;
};

type ReferralRecord = {
  id?: string;
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

  consultation_fee?: number | null;
  currency?: string | null;

  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;

  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  source?: string | null;

  [key: string]: unknown;
};

type ReleaseResult = {
  referral: ReferralRecord;
  created: boolean;
  updateMode: "complete" | "compatible";
};

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "CareScriber Supabase server environment variables are missing.",
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function cleanString(
  value: unknown,
  maxLength = 500,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.substring(0, maxLength);
}

function normaliseReferralCode(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function firstString(
  body: SymptomAIReferralBody,
  keys: Array<keyof SymptomAIReferralBody>,
  maxLength = 500,
): string | null {
  for (const key of keys) {
    const value = cleanString(body[key], maxLength);

    if (value) {
      return value;
    }
  }

  return null;
}

function normalisePaymentStatus(
  value: string | null,
): string {
  const status = String(value || "")
    .trim()
    .toLowerCase();

  if (
    status === "paid" ||
    status === "complete" ||
    status === "completed" ||
    status === "succeeded" ||
    status === "success"
  ) {
    return "paid";
  }

  return status;
}

function parseAmount(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 250;
}

function isValidDate(value: string | null): boolean {
  if (!value) {
    return true;
  }

  return !Number.isNaN(Date.parse(value));
}

function isValidEmail(value: string | null): boolean {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getApiSecretFromRequest(
  req: NextRequest,
): string | null {
  const authorization =
    req.headers.get("authorization");

  if (
    authorization
      ?.toLowerCase()
      .startsWith("bearer ")
  ) {
    return authorization.slice(7).trim();
  }

  return (
    req.headers.get("x-api-key") ||
    req.headers.get("x-carescriber-secret")
  );
}

function safeEqual(
  supplied: string,
  expected: string,
): boolean {
  if (supplied.length !== expected.length) {
    return false;
  }

  let difference = 0;

  for (
    let index = 0;
    index < supplied.length;
    index += 1
  ) {
    difference |=
      supplied.charCodeAt(index) ^
      expected.charCodeAt(index);
  }

  return difference === 0;
}

function validateApiSecret(
  req: NextRequest,
): {
  valid: boolean;
  status: number;
  error?: string;
} {
  if (!careScriberApiSecret) {
    return {
      valid: false,
      status: 500,
      error:
        "CARESCRIBER_API_SECRET is not configured in CareScriber.",
    };
  }

  const suppliedSecret =
    getApiSecretFromRequest(req);

  if (!suppliedSecret) {
    return {
      valid: false,
      status: 401,
      error:
        "Missing CareScriber API authentication.",
    };
  }

  if (
    !safeEqual(
      suppliedSecret,
      careScriberApiSecret,
    )
  ) {
    return {
      valid: false,
      status: 401,
      error:
        "Invalid CareScriber API authentication.",
    };
  }

  return {
    valid: true,
    status: 200,
  };
}

function buildReferralPayload(
  body: SymptomAIReferralBody,
): ReferralRecord {
  const now = new Date().toISOString();

  const referralCode =
    normaliseReferralCode(
      body.referralCode ||
        body.referral_code,
    );

  const patientFirstName =
    firstString(
      body,
      [
        "patientFirstName",
        "patient_first_name",
      ],
      100,
    );

  const patientSurname =
    firstString(
      body,
      [
        "patientSurname",
        "patient_surname",
      ],
      100,
    );

  const suppliedPatientName =
    firstString(
      body,
      [
        "patientName",
        "patient_name",
      ],
      200,
    );

  const combinedPatientName =
    [patientFirstName, patientSurname]
      .filter(Boolean)
      .join(" ") || null;

  const patientName =
    suppliedPatientName ||
    combinedPatientName ||
    "SymptomAI Patient";

  const patientId =
    firstString(
      body,
      [
        "patientId",
        "patient_id",
        "nationalId",
        "national_id",
      ],
      200,
    );

  const nationalId =
    firstString(
      body,
      [
        "nationalId",
        "national_id",
        "patientId",
        "patient_id",
      ],
      200,
    );

  const patientEmail =
    firstString(
      body,
      [
        "patientEmail",
        "patient_email",
        "email",
      ],
      200,
    );

  const patientMobile =
    firstString(
      body,
      [
        "patientMobile",
        "patient_mobile",
        "mobile",
        "phone",
      ],
      50,
    );

  const dateOfBirth =
    firstString(
      body,
      [
        "dateOfBirth",
        "date_of_birth",
        "dob",
      ],
      30,
    );

  const suppliedPaidAt =
    firstString(
      body,
      [
        "paidAt",
        "paid_at",
      ],
      50,
    );

  return {
    referral_code: referralCode,

    consent_token:
      firstString(
        body,
        [
          "consentToken",
          "consent_token",
        ],
        100,
      ),

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

    gender:
      firstString(
        body,
        ["gender"],
        50,
      ),

    email:
      patientEmail,

    mobile:
      patientMobile,

    consultation_reason:
      firstString(
        body,
        [
          "consultationReason",
          "consultation_reason",
        ],
        1000,
      ),

    /*
     * These exact values must match the inbox query.
     */
    payment_status: "paid",
    queue_status: "waiting",
    referral_status: "ready_for_doctor",

    consultation_fee:
      parseAmount(
        body.consultationFee ??
          body.consultation_fee,
      ),

    currency:
      (
        firstString(
          body,
          ["currency"],
          10,
        ) || "ZAR"
      ).toUpperCase(),

    stripe_checkout_session_id:
      firstString(
        body,
        [
          "stripeSessionId",
          "stripe_session_id",
        ],
        255,
      ),

    stripe_payment_intent_id:
      firstString(
        body,
        [
          "stripePaymentIntentId",
          "stripe_payment_intent_id",
        ],
        255,
      ),

    paid_at:
      suppliedPaidAt || now,

    source:
      firstString(
        body,
        ["source"],
        100,
      ) || "symptomai",

    updated_at: now,
  };
}

function validateReferralPayload(
  payload: ReferralRecord,
): string | null {
  if (!payload.referral_code) {
    return "Referral code is required.";
  }

  if (!payload.consent_token) {
    return "Consent token is required.";
  }

  if (!payload.consultation_reason) {
    return (
      "Reason for consultation or prescription " +
      "request is required."
    );
  }

  if (!isValidEmail(payload.email || null)) {
    return "The patient email address is invalid.";
  }

  if (
    !isValidDate(
      payload.date_of_birth || null,
    )
  ) {
    return "The patient date of birth is invalid.";
  }

  if (!isValidDate(payload.paid_at || null)) {
    return "The Stripe payment date is invalid.";
  }

  return null;
}

async function findExistingReferral(
  referralCode: string,
): Promise<ReferralRecord | null> {
  const supabase = getSupabaseAdmin();

  /*
   * Limit avoids maybeSingle failing if old duplicate
   * referral rows already exist.
   */
  const { data, error } = await supabase
    .from(REFERRAL_TABLE)
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
      `CareScriber referral lookup failed: ${error.message}`,
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as ReferralRecord;
}

function removeUndefinedValues(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([, value]) => value !== undefined,
    ),
  );
}

function buildCompatiblePayload(
  payload: ReferralRecord,
): Record<string, unknown> {
  /*
   * These are the fields required by the doctor inbox.
   * This fallback is used if newer optional columns have
   * not yet been created in Supabase.
   */
  return removeUndefinedValues({
    referral_code:
      payload.referral_code,

    consent_token:
      payload.consent_token,

    patient_name:
      payload.patient_name,

    patient_id:
      payload.patient_id,

    email:
      payload.email,

    mobile:
      payload.mobile,

    consultation_reason:
      payload.consultation_reason,

    payment_status:
      "paid",

    queue_status:
      "waiting",

    referral_status:
      "ready_for_doctor",

    updated_at:
      payload.updated_at,
  });
}

async function updateExistingReferral(
  existingReferral: ReferralRecord,
  payload: ReferralRecord,
): Promise<{
  referral: ReferralRecord;
  updateMode: "complete" | "compatible";
}> {
  const supabase = getSupabaseAdmin();

  if (!existingReferral.id) {
    throw new Error(
      "Existing referral has no Supabase ID.",
    );
  }

  const completePayload:
    Record<string, unknown> = {
      ...payload,
    };

  delete completePayload.id;
  delete completePayload.created_at;

  const completeResult = await supabase
    .from(REFERRAL_TABLE)
    .update(
      removeUndefinedValues(
        completePayload,
      ),
    )
    .eq(
      "id",
      existingReferral.id,
    )
    .select("*")
    .single();

  if (
    !completeResult.error &&
    completeResult.data
  ) {
    return {
      referral:
        completeResult.data as ReferralRecord,
      updateMode: "complete",
    };
  }

  console.warn(
    `Complete update failed for ${payload.referral_code}. ` +
      "Trying compatible inbox fields.",
    completeResult.error?.message,
  );

  const compatibleResult =
    await supabase
      .from(REFERRAL_TABLE)
      .update(
        buildCompatiblePayload(payload),
      )
      .eq(
        "id",
        existingReferral.id,
      )
      .select("*")
      .single();

  if (
    compatibleResult.error ||
    !compatibleResult.data
  ) {
    throw new Error(
      `CareScriber referral update failed: ${
        compatibleResult.error?.message ||
        completeResult.error?.message ||
        "Unknown Supabase error."
      }`,
    );
  }

  return {
    referral:
      compatibleResult.data as ReferralRecord,
    updateMode: "compatible",
  };
}

async function insertNewReferral(
  payload: ReferralRecord,
): Promise<{
  referral: ReferralRecord;
  updateMode: "complete" | "compatible";
}> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const completePayload =
    removeUndefinedValues({
      ...payload,
      created_at: now,
    });

  const completeResult =
    await supabase
      .from(REFERRAL_TABLE)
      .insert(completePayload)
      .select("*")
      .single();

  if (
    !completeResult.error &&
    completeResult.data
  ) {
    return {
      referral:
        completeResult.data as ReferralRecord,
      updateMode: "complete",
    };
  }

  console.warn(
    `Complete insert failed for ${payload.referral_code}. ` +
      "Trying compatible inbox fields.",
    completeResult.error?.message,
  );

  const compatiblePayload =
    buildCompatiblePayload(payload);

  compatiblePayload.created_at =
    now;

  const compatibleResult =
    await supabase
      .from(REFERRAL_TABLE)
      .insert(compatiblePayload)
      .select("*")
      .single();

  if (
    compatibleResult.error ||
    !compatibleResult.data
  ) {
    throw new Error(
      `CareScriber referral insert failed: ${
        compatibleResult.error?.message ||
        completeResult.error?.message ||
        "Unknown Supabase error."
      }`,
    );
  }

  return {
    referral:
      compatibleResult.data as ReferralRecord,
    updateMode: "compatible",
  };
}

async function releaseReferral(
  payload: ReferralRecord,
): Promise<ReleaseResult> {
  const referralCode =
    normaliseReferralCode(
      payload.referral_code,
    );

  const existingReferral =
    await findExistingReferral(
      referralCode,
    );

  if (existingReferral) {
    const result =
      await updateExistingReferral(
        existingReferral,
        payload,
      );

    return {
      referral: result.referral,
      created: false,
      updateMode: result.updateMode,
    };
  }

  const result =
    await insertNewReferral(payload);

  return {
    referral: result.referral,
    created: true,
    updateMode: result.updateMode,
  };
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,

      service:
        "CareScriber SymptomAI referral receiver",

      configured: {
        supabaseUrl:
          Boolean(supabaseUrl),

        supabaseServiceRoleKey:
          Boolean(
            supabaseServiceRoleKey,
          ),

        careScriberApiSecret:
          Boolean(
            careScriberApiSecret,
          ),
      },

      table:
        REFERRAL_TABLE,

      endpoint:
        "/api/symptomai-referral",

      acceptedMethod:
        "POST",

      requiredStatuses: {
        paymentStatus:
          "paid",

        queueStatus:
          "waiting",

        referralStatus:
          "ready_for_doctor",
      },
    },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export async function POST(
  req: NextRequest,
) {
  try {
    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          success: false,
          received: false,
          released: false,

          error:
            "CareScriber Supabase server environment variables are missing.",
        },
        {
          status: 500,
        },
      );
    }

    const authentication =
      validateApiSecret(req);

    if (!authentication.valid) {
      return NextResponse.json(
        {
          success: false,
          received: false,
          released: false,

          error:
            authentication.error,
        },
        {
          status:
            authentication.status,
        },
      );
    }

    let body: SymptomAIReferralBody;

    try {
      body =
        (await req.json()) as SymptomAIReferralBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          received: false,
          released: false,

          error:
            "A valid JSON request body is required.",
        },
        {
          status: 400,
        },
      );
    }

    const referralCode =
      normaliseReferralCode(
        body.referralCode ||
          body.referral_code,
      );

    if (!referralCode) {
      return NextResponse.json(
        {
          success: false,
          received: false,
          released: false,

          error:
            "Referral code is required.",
        },
        {
          status: 400,
        },
      );
    }

    const suppliedPaymentStatus =
      normalisePaymentStatus(
        firstString(
          body,
          [
            "paymentStatus",
            "payment_status",
          ],
          50,
        ),
      );

    if (
      suppliedPaymentStatus !== "paid"
    ) {
      return NextResponse.json(
        {
          success: false,
          received: true,
          released: false,

          error:
            "Only paid SymptomAI referrals may be released to the doctor inbox.",

          referralCode,

          paymentStatus:
            suppliedPaymentStatus ||
            "missing",
        },
        {
          status: 400,
        },
      );
    }

    const payload =
      buildReferralPayload(body);

    const validationError =
      validateReferralPayload(
        payload,
      );

    if (validationError) {
      return NextResponse.json(
        {
          success: false,
          received: true,
          released: false,

          referralCode,
          error:
            validationError,
        },
        {
          status: 400,
        },
      );
    }

    console.log(
      "CareScriber received paid SymptomAI referral:",
      {
        referralCode:
          payload.referral_code,

        patientName:
          payload.patient_name,

        paymentStatus:
          payload.payment_status,

        queueStatus:
          payload.queue_status,

        referralStatus:
          payload.referral_status,

        stripeSessionId:
          payload.stripe_checkout_session_id,
      },
    );

    const result =
      await releaseReferral(
        payload,
      );

    console.log(
      result.created
        ? `CareScriber created referral ${referralCode}.`
        : `CareScriber updated referral ${referralCode}.`,
      {
        updateMode:
          result.updateMode,

        referralId:
          result.referral.id,
      },
    );

    return NextResponse.json(
      {
        success: true,
        received: true,
        released: true,

        created:
          result.created,

        updateMode:
          result.updateMode,

        referralCode:
          result.referral.referral_code ||
          referralCode,

        referralId:
          result.referral.id ||
          null,

        paymentStatus:
          result.referral.payment_status ||
          "paid",

        queueStatus:
          result.referral.queue_status ||
          "waiting",

        referralStatus:
          result.referral.referral_status ||
          "ready_for_doctor",

        message:
          result.created
            ? "Paid SymptomAI referral created and released to the CareScriber doctor inbox."
            : "Paid SymptomAI referral updated and released to the CareScriber doctor inbox.",
      },
      {
        status:
          result.created ? 201 : 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "CareScriber could not receive the SymptomAI referral.";

    console.error(
      "CareScriber SymptomAI referral error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        received: false,
        released: false,
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
