
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Data = Record<string, unknown>;
type Source = "hivclintest" | "symptomai";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function first(...values: unknown[]): string {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return "";
}

function object(value: unknown): Data {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Data)
    : {};
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
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
      : process.env.CARESCRIBER_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing ${source} Supabase environment variables.`
    );
  }

  return createClient(url.trim(), key.trim(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getStatus(referral: Data): string {
  return first(
    referral.referral_status,
    referral.queue_status,
    referral.status
  ).toLowerCase();
}

function normalizePatient(referral: Data): Data {
  const snapshot = object(referral.patient_snapshot);

  return {
    id: first(referral.patient_id, snapshot.id) || null,

    first_name: first(
      referral.first_name,
      snapshot.first_name,
      snapshot.firstName
    ),

    surname: first(
      referral.surname,
      snapshot.surname,
      snapshot.last_name
    ),

    patient_id: first(
      referral.identity_number,
      referral.patient_identity_number,
      snapshot.identity_number,
      snapshot.patient_id,
      snapshot.id_number
    ),

    date_of_birth: first(
      referral.date_of_birth,
      snapshot.date_of_birth,
      snapshot.dob
    ),

    gender: first(
      referral.gender,
      snapshot.gender
    ),

    mobile: first(
      referral.mobile_number,
      referral.mobile,
      snapshot.mobile_number,
      snapshot.mobile,
      snapshot.phone
    ),

    email: first(
      referral.email,
      snapshot.email
    ),
  };
}

async function authenticateClinician(
  req: NextRequest
): Promise<boolean> {
  const authorization = req.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return false;
  }

  const token = authorization.slice(7).trim();

  if (!token) return false;

  const supabase = getSupabase("symptomai");

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return false;
  }

  // Access must be granted by the server-side
  // CareScriber profiles table.
  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

  if (profileError || !profile) {
    return false;
  }

  const role = text(profile.role).toLowerCase();

  return ["doctor", "clinician", "admin"].includes(role);
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate before accessing sensitive records.
    const authorized = await authenticateClinician(req);

    if (!authorized) {
      return errorResponse(
        "Clinician authentication or authorization failed.",
        401
      );
    }

    let body: Data;

    try {
      body = object(await req.json());
    } catch {
      return errorResponse("Invalid request body.", 400);
    }

    const referralId = text(body.referralId || body.referral_id);

    const referralCode = text(
      body.referralCode || body.referral_code
    )
      .replace(/\s+/g, "")
      .toUpperCase();

    const consentToken = text(
      body.consentToken || body.consent_token
    ).replace(/\s+/g, "");

    if (!referralCode || !/^\d{6}$/.test(consentToken)) {
      return errorResponse(
        "Referral code and six-digit consent token are required.",
        400
      );
    }

    const source: Source = referralCode.startsWith("HCT-")
      ? "hivclintest"
      : "symptomai";

    const supabase = getSupabase(source);

    // Match both credentials to prevent opening
    // a referral using its ID alone.
    let query = supabase
      .from("symptomai_referrals")
      .select("*")
      .eq("referral_code", referralCode)
      .eq("consent_token", consentToken);

    if (referralId) {
      // Only apply the ID filter if it is a UUID.
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          referralId
        )
      ) {
        return errorResponse(
          "Invalid referral database ID.",
          400
        );
      }

      query = query.eq("id", referralId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Referral open database error:", error.message);

      return errorResponse(
        "Unable to retrieve the referral.",
        500
      );
    }

    if (!data) {
      return errorResponse(
        "Referral not found or credentials incorrect.",
        404
      );
    }

    const referral = data as Data;

    if (referral.consent_given !== true) {
      return errorResponse(
        "Patient consent has not been recorded.",
        403
      );
    }

    const expiresAt = text(referral.expires_at);

    if (expiresAt) {
      const expiry = new Date(expiresAt).getTime();

      if (Number.isNaN(expiry)) {
        return errorResponse(
          "Referral expiry could not be verified.",
          403
        );
      }

      if (expiry <= Date.now()) {
        return errorResponse(
          "This referral has expired.",
          410
        );
      }
    }

    const status = getStatus(referral);

    if (["cancelled", "expired", "completed"].includes(status)) {
      return errorResponse(
        `This referral is already ${status}.`,
        409
      );
    }

    // Accepted referrals remain accepted.
    // Do not change their queue or assignment here.

    let patient = normalizePatient(referral);

    // Look up linked patient records only when the
    // database ID is a UUID. National ID numbers
    // must never be used as Supabase row UUIDs.
    const patientId = text(referral.patient_id);

    if (
      patientId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        patientId
      )
    ) {
      const { data: linkedPatient, error: patientError } =
        await supabase
          .from("patients")
          .select("*")
          .eq("id", patientId)
          .maybeSingle();

      if (patientError) {
        console.error(
          "Linked patient lookup:",
          patientError.message
        );
      }

      if (linkedPatient) {
        const p = linkedPatient as Data;

        patient = {
          ...patient,

          id: p.id,

          first_name: first(
            p.first_name,
            patient.first_name
          ),

          surname: first(
            p.surname,
            p.last_name,
            patient.surname
          ),

          patient_id: first(
            p.identity_number,
            p.patient_id,
            p.id_number,
            patient.patient_id
          ),

          date_of_birth: first(
            p.date_of_birth,
            p.dob,
            patient.date_of_birth
          ),

          gender: first(p.gender, patient.gender),

          mobile: first(
            p.mobile,
            p.mobile_number,
            patient.mobile
          ),

          email: first(p.email, patient.email),
        };
      }
    }

    // Do not return the consent token or raw
    // referral record to the browser.
    return NextResponse.json(
      {
        success: true,
        source,

        referral: {
          id: referral.id,
          referral_code: referral.referral_code,
          patient_id: referral.patient_id || null,
          consent_given: true,
          status,
          queue_status: referral.queue_status || null,
          referral_status: referral.referral_status || null,
          submitted_at: referral.submitted_at || null,
          created_at: referral.created_at || null,
        },

        patient,

        triage: referral.triage_snapshot || null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: unknown) {
    console.error(
      "Referral open failed:",
      err instanceof Error ? err.message : "Unknown error"
    );

    return errorResponse(
      "Referral open failed. Check server configuration and logs.",
      500
    );
  }
}
