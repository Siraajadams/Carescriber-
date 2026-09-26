
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
  SupabaseClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Data = Record<string, unknown>;
type Source = "hivclintest" | "symptomai";

function str(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function first(...values: unknown[]): string {
  for (const value of values) {
    const result = str(value);
    if (result) return result;
  }
  return "";
}

function obj(value: unknown): Data {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Data;
  }
  return {};
}

function normalizeCode(value: unknown): string {
  return str(value)
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeToken(value: unknown): string {
  return str(value).replace(/\s+/g, "");
}

function isUUID(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str(value)
  );
}

function getSupabase(source: Source): SupabaseClient {
  const url =
    source === "hivclintest"
      ? process.env.HIVCLINTEST_SUPABASE_URL
      : process.env.CARESCRIBER_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    source === "hivclintest"
      ? process.env.HIVCLINTEST_SUPABASE_SERVICE_ROLE_KEY
      : process.env
          .CARESCRIBER_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      `${source} Supabase configuration missing`
    );
  }

  return createClient(url.trim(), key.trim(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function responseError(
  error: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function referralStatus(referral: Data): string {
  return first(
    referral.referral_status,
    referral.status,
    referral.queue_status
  ).toLowerCase();
}

async function findReferral(
  db: SupabaseClient,
  code: string,
  token: string
): Promise<Data | null> {
  const { data, error } = await db
    .from("symptomai_referrals")
    .select("*")
    .eq("referral_code", code)
    .eq("consent_token", token)
    .maybeSingle();

  if (error) {
    console.error(
      "Referral query failed:",
      error.code,
      error.message
    );

    throw new Error("DATABASE_LOOKUP_FAILED");
  }

  return data ? obj(data) : null;
}

async function findLinkedPatient(
  db: SupabaseClient,
  referral: Data
): Promise<Data> {
  if (!isUUID(referral.patient_id)) {
    return {};
  }

  const { data, error } = await db
    .from("patients")
    .select("*")
    .eq("id", str(referral.patient_id))
    .maybeSingle();

  if (error) {
    console.error(
      "Optional patient lookup:",
      error.code,
      error.message
    );
    return {};
  }

  return obj(data);
}

function normalizePatient(
  source: Source,
  referral: Data,
  linked: Data
) {
  const snapshot = obj(
    referral.patient_snapshot
  );

  // HIVClinTest stores patient information
  // directly in its referral table.
  const direct =
    source === "hivclintest"
      ? referral
      : {};

  const identity = first(
    linked.patient_id,
    linked.identity_number,
    linked.id_number,
    linked.national_id,
    direct.identity_number,
    direct.patient_id,
    snapshot.identity_number,
    snapshot.patient_id,
    snapshot.patientId,
    snapshot.id_number
  );

  // The internal patient UUID is separate
  // from a national ID or passport number.
  const internalId = first(
    linked.id,
    isUUID(referral.patient_id)
      ? referral.patient_id
      : "",
    isUUID(snapshot.id)
      ? snapshot.id
      : ""
  );

  return {
    id: internalId || null,

    first_name: first(
      linked.first_name,
      direct.first_name,
      snapshot.first_name,
      snapshot.firstName
    ),

    surname: first(
      linked.surname,
      linked.last_name,
      direct.surname,
      direct.last_name,
      snapshot.surname,
      snapshot.last_name,
      snapshot.lastName
    ),

    patient_id: identity,

    identity_number: identity,

    date_of_birth: first(
      linked.date_of_birth,
      linked.dob,
      direct.date_of_birth,
      direct.dob,
      snapshot.date_of_birth,
      snapshot.dateOfBirth,
      snapshot.dob
    ),

    gender: first(
      linked.gender,
      direct.gender,
      snapshot.gender
    ),

    mobile: first(
      linked.mobile,
      linked.mobile_number,
      direct.mobile,
      direct.mobile_number,
      snapshot.mobile,
      snapshot.mobile_number,
      snapshot.phone
    ),

    email: first(
      linked.email,
      direct.email,
      snapshot.email
    ),
  };
}

export async function POST(req: NextRequest) {
  try {
    /*
     * SECURITY:
     * This route handles confidential medical
     * information and uses service-role access.
     *
     * Before production, enforce authenticated
     * clinician authorisation and rate limiting
     * using your existing CareScriber system.
     *
     * A referral code and consent token alone
     * are not sufficient clinician authorisation.
     */

    const body = await req.json();

    const code = normalizeCode(
      body?.referralCode ??
        body?.referral_code
    );

    const token = normalizeToken(
      body?.consentToken ??
        body?.consent_token
    );

    if (
      !code ||
      !/^[0-9]{6}$/.test(token)
    ) {
      return responseError(
        "A referral code and valid six-digit consent token are required.",
        400
      );
    }

    const source: Source =
      code.startsWith("HCT-")
        ? "hivclintest"
        : "symptomai";

    const db = getSupabase(source);

    const referral = await findReferral(
      db,
      code,
      token
    );

    if (!referral) {
      return responseError(
        "Referral not found or consent token incorrect.",
        404
      );
    }

    if (referral.consent_given !== true) {
      return responseError(
        "Patient consent has not been recorded.",
        403
      );
    }

    const expiry = first(
      referral.expires_at
    );

    if (expiry) {
      const timestamp = Date.parse(expiry);

      if (
        !Number.isNaN(timestamp) &&
        timestamp <= Date.now()
      ) {
        return responseError(
          "This referral has expired.",
          410
        );
      }
    }

    const status = referralStatus(referral);

    if (
      [
        "completed",
        "cancelled",
        "expired",
      ].includes(status)
    ) {
      return responseError(
        `This referral is already ${status}.`,
        409
      );
    }

    const linked = await findLinkedPatient(
      db,
      referral
    );

    const patient = normalizePatient(
      source,
      referral,
      linked
    );

    const triage =
      referral.triage_snapshot ?? null;

    return NextResponse.json(
      {
        success: true,
        source,

        referral: {
          id: referral.id ?? null,

          patient_id:
            referral.patient_id ?? null,

          referral_code:
            referral.referral_code,

          consent_given: true,

          status,

          referral_status:
            referral.referral_status ??
            status,

          queue_status:
            referral.queue_status ?? null,

          payment_status:
            referral.payment_status ?? null,

          submitted_at:
            referral.submitted_at ?? null,

          expires_at:
            referral.expires_at ?? null,

          created_at:
            referral.created_at ?? null,

          patient_snapshot:
            referral.patient_snapshot ??
            (source === "hivclintest"
              ? patient
              : null),

          triage_snapshot: triage,
        },

        patient,
        triage,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error(
      "Referral lookup error:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return responseError(
      "Referral lookup could not be completed.",
      500
    );
  }
}
