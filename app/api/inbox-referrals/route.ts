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

const REFERRAL_TABLE =
  "symptomai_referrals";

// ======================================================
// ENVIRONMENT
// ======================================================

// Existing CareScriber / SymptomAI database
const careScriberUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

const careScriberServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

// HIVClinTest database
const hivClinTestUrl =
  process.env.HIVCLINTEST_SUPABASE_URL?.trim();

const hivClinTestServiceKey =
  process.env
    .HIVCLINTEST_SUPABASE_SERVICE_ROLE_KEY
    ?.trim();

type DatabaseSource =
  | "carescriber"
  | "hivclintest";

type InboxAction =
  | "accept"
  | "complete";

type InboxActionBody = {
  action?: InboxAction;
  referralId?: string;
  doctorId?: string;
  doctorName?: string;
  databaseSource?: DatabaseSource;
};

type RawReferral =
  Record<string, unknown>;

type InboxReferral = {
  id: string;
  referral_code: string;
  consent_token: string | null;

  source: string;

  database_source:
    DatabaseSource;

  external_referral_id:
    string | null;

  consultation_reason:
    string | null;

  consultation_type:
    string | null;

  clinical_priority:
    string | null;

  patient_first_name:
    string | null;

  patient_surname:
    string | null;

  patient_name:
    string | null;

  patient_id:
    string | null;

  national_id:
    string | null;

  date_of_birth:
    string | null;

  gender:
    string | null;

  country:
    string | null;

  email:
    string | null;

  mobile:
    string | null;

  hiv_test_type:
    string | null;

  hiv_test_result:
    string | null;

  interpretation_method:
    string | null;

  requires_confirmatory_testing:
    boolean | null;

  recent_exposure:
    boolean | null;

  exposure_timing:
    string | null;

  pep_urgent_review:
    boolean | null;

  prep_interest:
    boolean | null;

  risk_flags: unknown;
  symptoms: unknown;

  payment_status:
    string | null;

  payment_amount:
    number | null;

  payment_currency:
    string | null;

  stripe_session_id:
    string | null;

  queue_status:
    string | null;

  referral_status:
    string | null;

  assigned_doctor_id:
    string | null;

  assigned_doctor_name:
    string | null;

  accepted_at:
    string | null;

  completed_at:
    string | null;

  created_at:
    string;

  submitted_at:
    string | null;

  paid_at:
    string | null;

  triage_summary:
    unknown;

  patient_snapshot:
    unknown;

  triage_snapshot:
    unknown;
};

// ======================================================
// SUPABASE CLIENTS
// ======================================================

function createAdminClient(
  url: string,
  key: string,
) {
  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function getCareScriberSupabase() {
  if (
    !careScriberUrl ||
    !careScriberServiceKey
  ) {
    throw new Error(
      "CareScriber Supabase credentials are missing.",
    );
  }

  return createAdminClient(
    careScriberUrl,
    careScriberServiceKey,
  );
}

function getHivClinTestSupabase():
  SupabaseClient | null {

  if (
    !hivClinTestUrl ||
    !hivClinTestServiceKey
  ) {
    return null;
  }

  return createAdminClient(
    hivClinTestUrl,
    hivClinTestServiceKey,
  );
}

// ======================================================
// HEADERS
// ======================================================

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",

    Pragma:
      "no-cache",

    Expires:
      "0",
  };
}

// ======================================================
// VALUE HELPERS
// ======================================================

function stringValue(
  value: unknown,
): string | null {

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned || null;
}

function numberValue(
  value: unknown,
): number | null {

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const parsed =
      Number(value);

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return null;
}

function booleanValue(
  value: unknown,
): boolean | null {

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  if (
    value === "true" ||
    value === "1" ||
    value === 1
  ) {
    return true;
  }

  if (
    value === "false" ||
    value === "0" ||
    value === 0
  ) {
    return false;
  }

  return null;
}

function objectValue(
  value: unknown,
):
  Record<string, unknown> | null {

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  if (
    typeof value === "string"
  ) {
    try {
      const parsed =
        JSON.parse(value);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<
          string,
          unknown
        >;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getNestedString(
  source:
    Record<string, unknown> | null,

  ...keys: string[]
): string | null {

  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value =
      stringValue(
        source[key],
      );

    if (value) {
      return value;
    }
  }

  return null;
}

function cleanString(
  value: unknown,
  maxLength = 250,
): string {

  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .substring(
      0,
      maxLength,
    );
}

function isValidAction(
  value: unknown,
): value is InboxAction {

  return (
    value === "accept" ||
    value === "complete"
  );
}

// ======================================================
// NORMALISE REFERRAL
// ======================================================

function normaliseReferral(
  record: RawReferral,
  databaseSource:
    DatabaseSource,
): InboxReferral {

  const patientSnapshot =
    objectValue(
      record.patient_snapshot,
    );

  const triageSnapshot =
    objectValue(
      record.triage_snapshot,
    );

  // Supports BOTH:
  // SymptomAI patient_first_name
  // HIVClinTest first_name

  const firstName =
    stringValue(
      record.patient_first_name,
    ) ||
    stringValue(
      record.first_name,
    ) ||
    getNestedString(
      patientSnapshot,
      "firstName",
      "first_name",
      "patientFirstName",
      "patient_first_name",
    );

  const surname =
    stringValue(
      record.patient_surname,
    ) ||
    stringValue(
      record.surname,
    ) ||
    getNestedString(
      patientSnapshot,
      "surname",
      "lastName",
      "last_name",
      "patientSurname",
      "patient_surname",
    );

  const patientName =
    stringValue(
      record.patient_name,
    ) ||
    getNestedString(
      patientSnapshot,
      "patientName",
      "patient_name",
      "name",
      "fullName",
      "full_name",
    ) ||
    [
      firstName,
      surname,
    ]
      .filter(Boolean)
      .join(" ") ||
    null;

  const patientId =
    stringValue(
      record.patient_id,
    ) ||
    stringValue(
      record.identity_number,
    ) ||
    stringValue(
      record.national_id,
    ) ||
    getNestedString(
      patientSnapshot,
      "patientId",
      "patient_id",
      "nationalId",
      "national_id",
      "idNumber",
      "id_number",
      "identityNumber",
      "identity_number",
    );

  const consultationReason =
    stringValue(
      record.consultation_reason,
    ) ||
    stringValue(
      record.triage_summary,
    ) ||
    getNestedString(
      triageSnapshot,
      "consultationReason",
      "consultation_reason",
      "reason",
      "summary",
      "notes",
    );

  const source =
    stringValue(
      record.source,
    ) ||
    (
      databaseSource ===
      "hivclintest"
        ? "HIVClinTest"
        : "symptomai"
    );

  let queueStatus =
    stringValue(
      record.queue_status,
    );

  const paymentStatus =
    stringValue(
      record.payment_status,
    );

  if (
    paymentStatus === "paid" &&
    !["accepted", "completed"].includes(queueStatus || "") &&
    !["accepted", "completed"].includes(stringValue(record.referral_status) || "") &&
    !record.assigned_doctor_id &&
    (
      !queueStatus ||
      queueStatus === "pending" ||
      queueStatus === "new" ||
      queueStatus === "submitted" ||
      queueStatus ===
        "awaiting_payment"
    )
  ) {
    queueStatus =
      "waiting";
  }

  return {
    id:
      stringValue(
        record.id,
      ) || "",

    referral_code:
      stringValue(
        record.referral_code,
      ) || "",

    consent_token:
      stringValue(
        record.consent_token,
      ),

    source,

    database_source:
      databaseSource,

    external_referral_id:
      stringValue(
        record.external_referral_id,
      ),

    consultation_reason:
      consultationReason,

    consultation_type:
      stringValue(
        record.consultation_type,
      ),

    clinical_priority:
      stringValue(
        record.clinical_priority,
      ),

    patient_first_name:
      firstName,

    patient_surname:
      surname,

    patient_name:
      patientName,

    patient_id:
      patientId,

    national_id:
      stringValue(
        record.national_id,
      ) ||
      stringValue(
        record.identity_number,
      ) ||
      patientId,

    date_of_birth:
      stringValue(
        record.date_of_birth,
      ) ||
      getNestedString(
        patientSnapshot,
        "dateOfBirth",
        "date_of_birth",
        "dob",
      ),

    gender:
      stringValue(
        record.gender,
      ) ||
      getNestedString(
        patientSnapshot,
        "gender",
      ),

    country:
      stringValue(
        record.country,
      ) ||
      getNestedString(
        patientSnapshot,
        "country",
      ),

    email:
      stringValue(
        record.email,
      ) ||
      getNestedString(
        patientSnapshot,
        "email",
      ),

    mobile:
      stringValue(
        record.mobile,
      ) ||
      stringValue(
        record.mobile_number,
      ) ||
      getNestedString(
        patientSnapshot,
        "mobile",
        "mobile_number",
        "phone",
      ),

    hiv_test_type:
      stringValue(
        record.hiv_test_type,
      ),

    hiv_test_result:
      stringValue(
        record.hiv_test_result,
      ),

    interpretation_method:
      stringValue(
        record.interpretation_method,
      ),

    requires_confirmatory_testing:
      booleanValue(
        record.requires_confirmatory_testing,
      ),

    recent_exposure:
      booleanValue(
        record.recent_exposure,
      ),

    exposure_timing:
      stringValue(
        record.exposure_timing,
      ),

    pep_urgent_review:
      booleanValue(
        record.pep_urgent_review,
      ),

    prep_interest:
      booleanValue(
        record.prep_interest,
      ),

    risk_flags:
      record.risk_flags ??
      null,

    symptoms:
      record.symptoms ??
      null,

    payment_status:
      paymentStatus,

    payment_amount:
      numberValue(
        record.payment_amount,
      ),

    payment_currency:
      stringValue(
        record.payment_currency,
      ),

    stripe_session_id:
      stringValue(
        record.stripe_session_id,
      ),

    queue_status:
      queueStatus,

    referral_status:
      stringValue(
        record.referral_status,
      ),

    assigned_doctor_id:
      stringValue(
        record.assigned_doctor_id,
      ),

    assigned_doctor_name:
      stringValue(
        record.assigned_doctor_name,
      ),

    accepted_at:
      stringValue(
        record.accepted_at,
      ),

    completed_at:
      stringValue(
        record.completed_at,
      ),

    created_at:
      stringValue(
        record.created_at,
      ) ||
      stringValue(
        record.submitted_at,
      ) ||
      new Date()
        .toISOString(),

    submitted_at:
      stringValue(
        record.submitted_at,
      ),

    paid_at:
      stringValue(
        record.paid_at,
      ),

    triage_summary:
      record.triage_summary ??
      null,

    patient_snapshot:
      record.patient_snapshot ??
      null,

    triage_snapshot:
      record.triage_snapshot ??
      null,
  };
}

// ======================================================
// LOAD ONE DATABASE
// ======================================================

async function loadFromDatabase(
  supabase: SupabaseClient,
  databaseSource:
    DatabaseSource,
): Promise<InboxReferral[]> {

  const {
    data,
    error,
  } =
    await supabase
      .from(
        REFERRAL_TABLE,
      )
      .select("*")
      .eq(
        "payment_status",
        "paid",
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );

  if (error) {
    throw new Error(
      `${databaseSource} inbox query failed: ${error.message}`,
    );
  }

  return (
    data || []
  )
    .map(
      (record) =>
        normaliseReferral(
          record as RawReferral,
          databaseSource,
        ),
    )
    .filter(
      (referral) =>
        Boolean(
          referral.id &&
          referral.referral_code
        ) &&
        referral.queue_status !==
          "completed" &&
        referral.referral_status !==
          "completed",
    );
}

// ======================================================
// LOAD COMBINED INBOX
// ======================================================

async function loadPaidInboxReferrals():
  Promise<InboxReferral[]> {

  const careScriber =
    getCareScriberSupabase();

  const hivClinTest =
    getHivClinTestSupabase();

  const carePromise =
    loadFromDatabase(
      careScriber,
      "carescriber",
    );

  const hivPromise =
    hivClinTest
      ? loadFromDatabase(
          hivClinTest,
          "hivclintest",
        )
      : Promise.resolve(
          [] as InboxReferral[],
        );

  const results =
    await Promise.allSettled([
      carePromise,
      hivPromise,
    ]);

  const referrals:
    InboxReferral[] = [];

  if (results[0].status === "rejected" ||
      (hivClinTest && results[1].status === "rejected")) {
    throw new Error("One or more configured referral databases failed to load. Check server logs.");
  }

  for (
    const result of results
  ) {
    if (
      result.status ===
      "fulfilled"
    ) {
      referrals.push(
        ...result.value,
      );
    } else {
      console.error(
        "Inbox source failed:",
        result.reason,
      );
    }
  }

  // Oldest waiting request first
  referrals.sort(
    (a, b) =>
      new Date(
        a.created_at,
      ).getTime() -
      new Date(
        b.created_at,
      ).getTime(),
  );

  return referrals;
}

// ======================================================
// FIND DATABASE FOR REFERRAL
// ======================================================

async function findReferralDatabase(
  referralId: string,
  requestedSource?:
    DatabaseSource,
): Promise<{
  supabase: SupabaseClient;
  source: DatabaseSource;
  record: RawReferral;
} | null> {

  const sources: Array<{
    source: DatabaseSource;
    client:
      SupabaseClient | null;
  }> = [
    {
      source:
        "carescriber",
      client:
        getCareScriberSupabase(),
    },
    {
      source:
        "hivclintest",
      client:
        getHivClinTestSupabase(),
    },
  ];

  const candidates = requestedSource
    ? sources.filter((item) => item.source === requestedSource)
    : sources;
  if (requestedSource && !candidates[0]?.client) {
    throw new Error(`Database ${requestedSource} is not configured.`);
  }

  const matches: Array<{
    supabase: SupabaseClient;
    source: DatabaseSource;
    record: RawReferral;
  }> = [];
  for (const item of candidates) {
    if (!item.client) continue;
    const result = await item.client
      .from(REFERRAL_TABLE)
      .select("*")
      .eq("id", referralId)
      .maybeSingle();
    if (result.error) {
      throw new Error(`${item.source} referral lookup failed: ${result.error.message}`);
    }
    if (result.data) {
      matches.push({
        supabase: item.client,
        source: item.source,
        record: result.data as RawReferral,
      });
    }
  }
  if (matches.length > 1) {
    throw new Error("Referral ID exists in both databases. Send databaseSource with the request.");
  }
  if (matches.length === 1) return matches[0];

  return null;
}

// Atomic database functions are installed by the accompanying SQL migration.
// Do not replace these with a read-then-update: that creates a race condition.
async function changeReferral({
  action, referralId, doctorId, doctorName, databaseSource,
}: {
  action: InboxAction;
  referralId: string;
  doctorId: string;
  doctorName: string;
  databaseSource?: DatabaseSource;
}): Promise<InboxReferral | null> {
  const found = await findReferralDatabase(referralId, databaseSource);
  if (!found) return null;

  const { data, error } = await found.supabase.rpc("carescriber_change_referral", {
    p_referral_id: referralId,
    p_action: action,
    p_doctor_id: doctorId,
    p_doctor_name: doctorName,
  });
  if (error) throw new Error(`${found.source} referral update failed: ${error.message}`);
  if (!data) return null;
  return normaliseReferral(data as RawReferral, found.source);
}

export async function GET() {
  try {
    const referrals = await loadPaidInboxReferrals();
    const sources = referrals.reduce((acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return NextResponse.json({
      success: true, count: referrals.length, referrals, sources,
      configured: {
        carescriber: Boolean(careScriberUrl && careScriberServiceKey),
        hivclintest: Boolean(hivClinTestUrl && hivClinTestServiceKey),
      },
    }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Inbox GET error:", error);
    return NextResponse.json({ success: false, referrals: [], count: 0,
      error: error instanceof Error ? error.message : "Inbox load failed",
    }, { status: 500, headers: noStoreHeaders() });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    let body: InboxActionBody;
    try {
      body = await req.json() as InboxActionBody;
    } catch {
      return NextResponse.json({ success: false, error: "Valid JSON required." }, { status: 400 });
    }
    if (!isValidAction(body.action)) {
      return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
    }
    const referralId = cleanString(body.referralId, 100);
    const doctorId = cleanString(body.doctorId, 100);
    const doctorName = cleanString(body.doctorName, 200) || "Doctor";
    if (!referralId || !doctorId) {
      return NextResponse.json({ success: false, error: "Referral ID and doctor ID required." }, { status: 400 });
    }
    if (body.databaseSource && !["carescriber", "hivclintest"].includes(body.databaseSource)) {
      return NextResponse.json({ success: false, error: "Invalid database source." }, { status: 400 });
    }
    const referral = await changeReferral({ action: body.action, referralId,
      doctorId, doctorName, databaseSource: body.databaseSource });
    if (!referral) {
      return NextResponse.json({ success: false,
        error: body.action === "accept"
          ? "Already accepted, completed, unpaid, or awaiting assignment reconciliation. Refresh the inbox."
          : "Only the assigned doctor can complete an accepted referral.",
      }, { status: 409, headers: noStoreHeaders() });
    }
    return NextResponse.json({ success: true, action: body.action, referral,
      message: body.action === "accept" ? "Consultation accepted." : "Referral completed.",
    }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("Inbox PATCH error:", error);
    return NextResponse.json({ success: false,
      error: error instanceof Error ? error.message : "Could not update referral.",
    }, { status: 500, headers: noStoreHeaders() });
  }
}
