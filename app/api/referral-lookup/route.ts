import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecordData = Record<string, unknown>;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeReferralCode(value: unknown): string {
  return stringValue(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeConsentToken(value: unknown): string {
  return stringValue(value).replace(/\s+/g, "");
}

function objectValue(value: unknown): RecordData {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as RecordData;
  }

  return {};
}

function firstValue(...values: unknown[]): string {
  for (const value of values) {
    const result = stringValue(value);
    if (result) return result;
  }
  return "";
}

function getSupabase(
  source: "hivclintest" | "symptomai"
): SupabaseClient {
  const url =
    source === "hivclintest"
      ? process.env.HIVCLINTEST_SUPABASE_URL?.trim()
      : (
          process.env.CARESCRIBER_SUPABASE_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL
        )?.trim();

  const key =
    source === "hivclintest"
      ? process.env.HIVCLINTEST_SUPABASE_SERVICE_ROLE_KEY?.trim()
      : (
          process.env.CARESCRIBER_SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )?.trim();

  if (!url || !key) {
    throw new Error(
      `${source} Supabase configuration is incomplete.`
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonError(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function getConsentStatus(
  referral: RecordData
): boolean | null {
  if (referral.consent_given === true) {
    return true;
  }

  if (referral.consent_given === false) {
    return false;
  }

  return null;
}

function getReferralStatus(
  referral: RecordData
): string {
  return firstValue(
    referral.referral_status,
    referral.status,
    referral.queue_status
  ).toLowerCase();
}

function checkReferral(
  referral: RecordData
): { error: string; status: number } | null {
  const consent = getConsentStatus(referral);

  if (consent !== true) {
    return {
      error:
        consent === false
          ? "Patient consent has not been recorded."
          : "Referral consent status is missing. Verify the original consent record before opening this referral.",
      status: 403,
    };
  }

  const expiresAt = firstValue(referral.expires_at);

  if (expiresAt) {
    const expiry = new Date(expiresAt).getTime();

    if (
      !Number.isNaN(expiry) &&
      expiry <= Date.now()
    ) {
      return {
        error: "This referral has expired.",
        status: 410,
      };
    }
  }

  const status = getReferralStatus(referral);

  if (
    ["completed", "cancelled", "expired"].includes(
      status
    )
  ) {
    return {
      error: `This referral is already ${status}.`,
      status: 409,
    };
  }

  return null;
}

function normalizePatient(
  referral: RecordData,
  patient: RecordData
) {
  const snapshot = objectValue(
    referral.patient_snapshot
  );

  return {
    id:
      patient.id ||
      referral.patient_id ||
      snapshot.id ||
      null,

    first_name: firstValue(
      patient.first_name,
      snapshot.first_name,
      snapshot.firstName
    ),

    surname: firstValue(
      patient.surname,
      patient.last_name,
      snapshot.surname,
      snapshot.last_name,
      snapshot.lastName
    ),

    patient_id: firstValue(
      patient.patient_id,
      patient.id_number,
      patient.national_id,
      snapshot.patient_id,
      snapshot.patientId,
      snapshot.identity_number,
      snapshot.id_number
    ),

    date_of_birth: firstValue(
      patient.date_of_birth,
      patient.dob,
      snapshot.date_of_birth,
      snapshot.dateOfBirth,
      snapshot.dob
    ),

    gender: firstValue(
      patient.gender,
      snapshot.gender
    ),

    mobile: firstValue(
      patient.mobile,
      patient.mobile_number,
      snapshot.mobile,
      snapshot.mobile_number,
      snapshot.phone
    ),

    email: firstValue(
      patient.email,
      snapshot.email
    ),
  };
}

async function findReferral(
  supabase: SupabaseClient,
  referralCode: string,
  consentToken: string
): Promise<RecordData | null> {
  // Retrieve the row using both credentials.
  // Do not reveal whether an individual code exists.
  const { data, error } = await supabase
    .from("symptomai_referrals")
    .select("*")
    .eq("referral_code", referralCode)
    .eq("consent_token", consentToken)
    .maybeSingle();

  if (error) {
    console.error(
      "Referral database lookup failed:",
      error.code,
      error.message
    );

    throw new Error(
      "Unable to retrieve referral from the database."
    );
  }

  return data as RecordData | null;
}

async function findPatient(
  supabase: SupabaseClient,
  referral: RecordData
): Promise<RecordData> {
  const patientId = referral.patient_id;

  if (!patientId) {
    return {};
  }

  // Patient identifiers may differ between projects.
  // Do not assume an ID number is a database UUID.
  const id = String(patientId);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    return {};
  }

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(
      "Patient lookup:",
      error.code,
      error.message
    );
    return {};
  }

  return objectValue(data);
}

export async function POST(
  req: NextRequest
) {
  try {
    const body = await req.json();

    const referralCode = normalizeReferralCode(
      body?.referralCode || body?.referral_code
    );

    const consentToken = normalizeConsentToken(
      body?.consentToken || body?.consent_token
    );

    if (
      !referralCode ||
      !/^\d{6}$/.test(consentToken)
    ) {
      return jsonError(
        "A referral code and valid six-digit consent token are required.",
        400
      );
    }

    // HCT referrals belong to HIVClinTest.
    // All other referrals retain the existing
    // CareScriber / SymptomAI connection.
    const source =
      referralCode.startsWith("HCT-")
        ? "hivclintest"
        : "symptomai";

    const supabase = getSupabase(source);

    const referral = await findReferral(
      supabase,
      referralCode,
      consentToken
    );

    if (!referral) {
      return jsonError(
        "Referral not found or consent token incorrect.",
        404
      );
    }

    const validation = checkReferral(referral);

    if (validation) {
      return jsonError(
        validation.error,
        validation.status
      );
    }

    const patientRecord = await findPatient(
      supabase,
      referral
    );

    const patient = normalizePatient(
      referral,
      patientRecord
    );

    return NextResponse.json(
      {
        success: true,
        source,

        referral: {
          id: referral.id || null,
          patient_id:
            referral.patient_id || null,
          referral_code:
            referral.referral_code,
          consent_given: true,
          status:
            getReferralStatus(referral),
          submitted_at:
            referral.submitted_at || null,
          expires_at:
            referral.expires_at || null,
          patient_snapshot:
            referral.patient_snapshot || null,
          triage_snapshot:
            referral.triage_snapshot || null,
          created_at:
            referral.created_at || null,
        },

        patient,

        triage:
          referral.triage_snapshot || null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error(
      "Referral lookup failed:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return jsonError(
      "Referral lookup could not be completed. Check the server configuration and logs.",
      500
    );
  }
}
