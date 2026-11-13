
import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFERRAL_TABLE = "symptomai_referrals";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const careScriberUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

const careScriberServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const careScriberAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

const hivClinTestUrl =
  process.env.HIVCLINTEST_SUPABASE_URL?.trim();

const hivClinTestServiceKey =
  process.env.HIVCLINTEST_SUPABASE_SERVICE_ROLE_KEY?.trim();

type DatabaseSource = "carescriber" | "hivclintest";

type InboxAction =
  | "accept"
  | "complete"
  | "archive"
  | "restore";

type InboxActionBody = {
  action?: InboxAction;
  referralId?: string;
  doctorId?: string;
  doctorName?: string;
  databaseSource?: DatabaseSource;
  reviewConfirmed?: boolean;
  archiveReason?: string;
};

type RawReferral = Record<string, unknown>;

type InboxReferral = {
  id: string;
  referral_code: string;
  consent_token: string | null;
  source: string;
  database_source: DatabaseSource;
  external_referral_id: string | null;

  consultation_reason: string | null;
  consultation_type: string | null;
  clinical_priority: string | null;

  patient_first_name: string | null;
  patient_surname: string | null;
  patient_name: string | null;
  patient_id: string | null;
  national_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  country: string | null;
  email: string | null;
  mobile: string | null;

  hiv_test_type: string | null;
  hiv_test_result: string | null;
  interpretation_method: string | null;
  requires_confirmatory_testing: boolean | null;
  recent_exposure: boolean | null;
  exposure_timing: string | null;
  pep_urgent_review: boolean | null;
  prep_interest: boolean | null;

  risk_flags: unknown;
  symptoms: unknown;

  payment_status: string | null;
  payment_amount: number | null;
  payment_currency: string | null;
  stripe_session_id: string | null;

  queue_status: string | null;
  referral_status: string | null;

  assigned_doctor_id: string | null;
  assigned_doctor_name: string | null;

  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  submitted_at: string | null;
  paid_at: string | null;

  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;

  triage_summary: unknown;
  patient_snapshot: unknown;
  triage_snapshot: unknown;
};

// ======================================================
// SUPABASE CLIENTS
// ======================================================

function createAdminClient(
  url: string,
  key: string
): SupabaseClient {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getCareScriberSupabase(): SupabaseClient {
  if (!careScriberUrl || !careScriberServiceKey) {
    throw new Error(
      "CareScriber Supabase credentials are missing."
    );
  }

  return createAdminClient(
    careScriberUrl,
    careScriberServiceKey
  );
}

function getHivClinTestSupabase(): SupabaseClient | null {
  if (!hivClinTestUrl || !hivClinTestServiceKey) {
    return null;
  }

  return createAdminClient(
    hivClinTestUrl,
    hivClinTestServiceKey
  );
}

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

// ======================================================
// AUTHENTICATION AND AUTHORISATION
// ======================================================

async function authenticateDoctor(
  req: NextRequest
): Promise<User> {
  const header = req.headers.get("authorization") || "";

  if (!header.startsWith("Bearer ")) {
    throw new Error("Authentication required.");
  }

  const token = header.slice(7).trim();

  if (!token) {
    throw new Error("Invalid authentication token.");
  }

  if (!careScriberUrl || !careScriberAnonKey) {
    throw new Error(
      "CareScriber authentication configuration missing."
    );
  }

  const authClient = createClient(
    careScriberUrl,
    careScriberAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data, error } =
    await authClient.auth.getUser(token);

  if (error || !data.user) {
    throw new Error(
      "Session expired or invalid. Please sign in again."
    );
  }

  // Roles must be assigned by a trusted server/admin,
  // never taken from user-editable metadata.
  const role = data.user.app_metadata?.role;

  if (role !== "doctor" && role !== "admin") {
    throw new Error(
      "Doctor access has not been authorised."
    );
  }

  return data.user;
}

// ======================================================
// VALUE HELPERS
// ======================================================

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function cleanString(
  value: unknown,
  maxLength = 250
): string {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  if (value === "true" || value === "1" || value === 1) {
    return true;
  }

  if (value === "false" || value === "0" || value === 0) {
    return false;
  }

  return null;
}

function objectValue(
  value: unknown
): Record<string, unknown> | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getNestedString(
  source: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!source) return null;

  for (const key of keys) {
    const value = stringValue(source[key]);
    if (value) return value;
  }

  return null;
}

function isValidAction(
  value: unknown
): value is InboxAction {
  return (
    value === "accept" ||
    value === "complete" ||
    value === "archive" ||
    value === "restore"
  );
}

function isDatabaseSource(
  value: unknown
): value is DatabaseSource {
  return value === "carescriber" ||
    value === "hivclintest";
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

// ======================================================
// NORMALISE REFERRAL
// ======================================================

function normaliseReferral(
  record: RawReferral,
  databaseSource: DatabaseSource
): InboxReferral {
  const patientSnapshot = objectValue(
    record.patient_snapshot
  );

  const triageSnapshot = objectValue(
    record.triage_snapshot
  );

  const firstName =
    stringValue(record.patient_first_name) ||
    stringValue(record.first_name) ||
    getNestedString(
      patientSnapshot,
      "firstName",
      "first_name",
      "patientFirstName",
      "patient_first_name"
    );

  const surname =
    stringValue(record.patient_surname) ||
    stringValue(record.surname) ||
    getNestedString(
      patientSnapshot,
      "surname",
      "lastName",
      "last_name",
      "patientSurname",
      "patient_surname"
    );

  const patientName =
    stringValue(record.patient_name) ||
    getNestedString(
      patientSnapshot,
      "patientName",
      "patient_name",
      "name",
      "fullName",
      "full_name"
    ) ||
    [firstName, surname].filter(Boolean).join(" ") ||
    null;

  const patientId =
    stringValue(record.patient_id) ||
    stringValue(record.identity_number) ||
    stringValue(record.national_id) ||
    getNestedString(
      patientSnapshot,
      "patientId",
      "patient_id",
      "nationalId",
      "national_id",
      "idNumber",
      "id_number",
      "identityNumber",
      "identity_number"
    );

  const consultationReason =
    stringValue(record.consultation_reason) ||
    stringValue(record.triage_summary) ||
    getNestedString(
      triageSnapshot,
      "consultationReason",
      "consultation_reason",
      "reason",
      "summary",
      "notes"
    );

  const source =
    stringValue(record.source) ||
    (databaseSource === "hivclintest"
      ? "HIVClinTest"
      : "symptomai");

  let queueStatus = stringValue(record.queue_status);

  const paymentStatus = stringValue(
    record.payment_status
  );

  if (
    paymentStatus === "paid" &&
    !["accepted", "completed"].includes(
      queueStatus || ""
    ) &&
    !["accepted", "completed"].includes(
      stringValue(record.referral_status) || ""
    ) &&
    !record.assigned_doctor_id &&
    (
      !queueStatus ||
      ["pending", "new", "submitted", "awaiting_payment"]
        .includes(queueStatus)
    )
  ) {
    queueStatus = "waiting";
  }

  return {
    id: stringValue(record.id) || "",
    referral_code:
      stringValue(record.referral_code) || "",
    consent_token: stringValue(record.consent_token),

    source,
    database_source: databaseSource,
    external_referral_id:
      stringValue(record.external_referral_id),

    consultation_reason: consultationReason,
    consultation_type:
      stringValue(record.consultation_type),
    clinical_priority:
      stringValue(record.clinical_priority),

    patient_first_name: firstName,
    patient_surname: surname,
    patient_name: patientName,
    patient_id: patientId,

    national_id:
      stringValue(record.national_id) ||
      stringValue(record.identity_number) ||
      patientId,

    date_of_birth:
      stringValue(record.date_of_birth) ||
      getNestedString(
        patientSnapshot,
        "dateOfBirth",
        "date_of_birth",
        "dob"
      ),

    gender:
      stringValue(record.gender) ||
      getNestedString(patientSnapshot, "gender"),

    country:
      stringValue(record.country) ||
      getNestedString(patientSnapshot, "country"),

    email:
      stringValue(record.email) ||
      getNestedString(patientSnapshot, "email"),

    mobile:
      stringValue(record.mobile) ||
      stringValue(record.mobile_number) ||
      getNestedString(
        patientSnapshot,
        "mobile",
        "mobile_number",
        "phone"
      ),

    hiv_test_type: stringValue(record.hiv_test_type),
    hiv_test_result:
      stringValue(record.hiv_test_result),
    interpretation_method:
      stringValue(record.interpretation_method),

    requires_confirmatory_testing:
      booleanValue(record.requires_confirmatory_testing),

    recent_exposure:
      booleanValue(record.recent_exposure),

    exposure_timing:
      stringValue(record.exposure_timing),

    pep_urgent_review:
      booleanValue(record.pep_urgent_review),

    prep_interest:
      booleanValue(record.prep_interest),

    risk_flags: record.risk_flags ?? null,
    symptoms: record.symptoms ?? null,

    payment_status: paymentStatus,
    payment_amount:
      numberValue(record.payment_amount),
    payment_currency:
      stringValue(record.payment_currency),
    stripe_session_id:
      stringValue(record.stripe_session_id),

    queue_status: queueStatus,
    referral_status:
      stringValue(record.referral_status),

    assigned_doctor_id:
      stringValue(record.assigned_doctor_id),
    assigned_doctor_name:
      stringValue(record.assigned_doctor_name),

    accepted_at:
      stringValue(record.accepted_at),
    completed_at:
      stringValue(record.completed_at),

    created_at:
      stringValue(record.created_at) ||
      stringValue(record.submitted_at) ||
      new Date().toISOString(),

    submitted_at:
      stringValue(record.submitted_at),
    paid_at: stringValue(record.paid_at),

    archived_at:
      stringValue(record.archived_at),
    archived_by:
      stringValue(record.archived_by),
    archive_reason:
      stringValue(record.archive_reason),

    triage_summary:
      record.triage_summary ?? null,
    patient_snapshot:
      record.patient_snapshot ?? null,
    triage_snapshot:
      record.triage_snapshot ?? null,
  };
}

// ======================================================
// LOAD DATABASE
// ======================================================

async function loadFromDatabase(
  supabase: SupabaseClient,
  databaseSource: DatabaseSource
): Promise<InboxReferral[]> {
  const referrals: InboxReferral[] = [];

  // Pagination avoids the default Supabase 1,000-row limit.
  const PAGE_SIZE = 500;

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(REFERRAL_TABLE)
      .select("*")
      .eq("payment_status", "paid")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `${databaseSource} inbox query failed: ${error.message}`
      );
    }

    for (const record of data || []) {
      const referral = normaliseReferral(
        record as RawReferral,
        databaseSource
      );

      if (referral.id && referral.referral_code) {
        referrals.push(referral);
      }
    }

    if (!data || data.length < PAGE_SIZE) break;
  }

  return referrals;
}

// ======================================================
// COMBINED INBOX
// ======================================================

async function loadPaidInboxReferrals():
  Promise<InboxReferral[]> {
  const careScriber = getCareScriberSupabase();
  const hivClinTest = getHivClinTestSupabase();

  const results = await Promise.allSettled([
    loadFromDatabase(careScriber, "carescriber"),
    hivClinTest
      ? loadFromDatabase(hivClinTest, "hivclintest")
      : Promise.resolve([] as InboxReferral[]),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Inbox database error:", result.reason);
      throw new Error(
        "One or more configured referral databases failed to load."
      );
    }
  }

  const referrals = results.flatMap(
    result =>
      result.status === "fulfilled"
        ? result.value
        : []
  );

  referrals.sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime()
  );

  return referrals;
}

// ======================================================
// FIND REFERRAL DATABASE
// ======================================================

async function findReferralDatabase(
  referralId: string,
  requestedSource?: DatabaseSource
): Promise<{
  supabase: SupabaseClient;
  source: DatabaseSource;
  record: RawReferral;
} | null> {
  const sources: Array<{
    source: DatabaseSource;
    client: SupabaseClient | null;
  }> = [
    {
      source: "carescriber",
      client: getCareScriberSupabase(),
    },
    {
      source: "hivclintest",
      client: getHivClinTestSupabase(),
    },
  ];

  const candidates = requestedSource
    ? sources.filter(
        item => item.source === requestedSource
      )
    : sources;

  if (requestedSource && !candidates[0]?.client) {
    throw new Error(
      `Database ${requestedSource} is not configured.`
    );
  }

  const matches: Array<{
    supabase: SupabaseClient;
    source: DatabaseSource;
    record: RawReferral;
  }> = [];

  for (const item of candidates) {
    if (!item.client) continue;

    const { data, error } = await item.client
      .from(REFERRAL_TABLE)
      .select("*")
      .eq("id", referralId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `${item.source} lookup failed: ${error.message}`
      );
    }

    if (data) {
      matches.push({
        supabase: item.client,
        source: item.source,
        record: data as RawReferral,
      });
    }
  }

  if (matches.length > 1) {
    throw new Error(
      "Referral exists in both databases. Specify databaseSource."
    );
  }

  return matches[0] || null;
}

// ======================================================
// ACCEPT / COMPLETE
// ======================================================

async function changeReferral({
  action,
  referralId,
  doctorId,
  doctorName,
  databaseSource,
}: {
  action: "accept" | "complete";
  referralId: string;
  doctorId: string;
  doctorName: string;
  databaseSource?: DatabaseSource;
}): Promise<InboxReferral | null> {
  const found = await findReferralDatabase(
    referralId,
    databaseSource
  );

  if (!found) return null;

  const { data, error } = await found.supabase.rpc(
    "carescriber_change_referral",
    {
      p_referral_id: referralId,
      p_action: action,
      p_doctor_id: doctorId,
      p_doctor_name: doctorName,
    }
  );

  if (error) {
    throw new Error(
      `${found.source} referral update failed: ${error.message}`
    );
  }

  if (!data) return null;

  return normaliseReferral(
    data as RawReferral,
    found.source
  );
}

// ======================================================
// CLINICAL ARCHIVE SAFEGUARDS
// ======================================================

function hasRiskFlags(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();

    return Boolean(
      trimmed &&
      !["[]", "{}", "null", "none", "false"].includes(
        trimmed
      )
    );
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return value === true;
}

function checkArchiveEligibility(
  record: RawReferral,
  doctorId: string
) {
  if (
    stringValue(record.assigned_doctor_id) !== doctorId
  ) {
    throw new Error(
      "Only the assigned doctor can archive this consultation."
    );
  }

  if (
    record.queue_status !== "completed" ||
    record.referral_status !== "completed" ||
    !record.completed_at
  ) {
    throw new Error(
      "Only completed consultations may be archived."
    );
  }

  const completedAt = new Date(
    String(record.completed_at)
  ).getTime();

  if (
    !Number.isFinite(completedAt) ||
    completedAt > Date.now() - THIRTY_DAYS
  ) {
    throw new Error(
      "Consultation must have been completed at least 30 days ago."
    );
  }

  if (
    booleanValue(record.pep_urgent_review) === true ||
    booleanValue(
      record.requires_confirmatory_testing
    ) === true ||
    hasRiskFlags(record.risk_flags) ||
    ["urgent", "emergency", "critical", "high"]
      .includes(
        (
          stringValue(record.clinical_priority) || ""
        ).toLowerCase()
      )
  ) {
    throw new Error(
      "Clinical risk or urgent follow-up is recorded. Additional documented clinical clearance is required."
    );
  }

  if (record.archived_at) {
    throw new Error(
      "This consultation is already archived."
    );
  }
}

// ======================================================
// ARCHIVE / RESTORE
// ======================================================

async function changeArchiveStatus({
  action,
  referralId,
  doctorId,
  archiveReason,
  reviewConfirmed,
  databaseSource,
}: {
  action: "archive" | "restore";
  referralId: string;
  doctorId: string;
  archiveReason?: string;
  reviewConfirmed?: boolean;
  databaseSource?: DatabaseSource;
}): Promise<InboxReferral> {
  const found = await findReferralDatabase(
    referralId,
    databaseSource
  );

  if (!found) {
    throw new Error("Referral not found.");
  }

  const { supabase, source, record } = found;

  if (
    stringValue(record.assigned_doctor_id) !== doctorId
  ) {
    throw new Error(
      "Only the assigned doctor can change archive status."
    );
  }

  if (action === "archive") {
    if (reviewConfirmed !== true) {
      throw new Error(
        "Clinical review confirmation is required."
      );
    }

    const reason = cleanString(
      archiveReason,
      500
    );

    if (!reason) {
      throw new Error(
        "Archive reason is required."
      );
    }

    checkArchiveEligibility(record, doctorId);

    const cutoff = new Date(
      Date.now() - THIRTY_DAYS
    ).toISOString();

    // Conditional update prevents stale status changes.
    // A database-level transaction/RPC is still recommended
    // for enforcing every clinical condition atomically.
    let query = supabase
      .from(REFERRAL_TABLE)
      .update({
        archived_at: new Date().toISOString(),
        archived_by: doctorId,
        archive_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", referralId)
      .eq("assigned_doctor_id", doctorId)
      .eq("payment_status", "paid")
      .eq("queue_status", "completed")
      .eq("referral_status", "completed")
      .lte("completed_at", cutoff)
      .is("archived_at", null)
      .select("*");

    // Recheck recorded flags at update time.
    // Null or false flags are allowed.
    if (
      record.pep_urgent_review === false ||
      record.pep_urgent_review === null
    ) {
      query = query.or(
        "pep_urgent_review.is.null,pep_urgent_review.eq.false"
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Archive database error: ${error.message}`
      );
    }

    if (!data || data.length !== 1) {
      throw new Error(
        "Archive was not saved. The referral may have changed. Refresh and review again."
      );
    }

    const updated = data[0] as RawReferral;

    if (!updated.archived_at) {
      throw new Error(
        "Archive update was not confirmed."
      );
    }

    return normaliseReferral(updated, source);
  }

  // RESTORE
  if (!record.archived_at) {
    throw new Error(
      "This consultation is not archived."
    );
  }

  const archivedAt = String(record.archived_at);

  const { data, error } = await supabase
    .from(REFERRAL_TABLE)
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", referralId)
    .eq("assigned_doctor_id", doctorId)
    .eq("archived_at", archivedAt)
    .select("*");

  if (error) {
    throw new Error(
      `Restore database error: ${error.message}`
    );
  }

  if (!data || data.length !== 1) {
    throw new Error(
      "Restore was not confirmed. Refresh the inbox."
    );
  }

  const restored = data[0] as RawReferral;

  if (restored.archived_at) {
    throw new Error(
      "Database still shows the referral as archived."
    );
  }

  return normaliseReferral(restored, source);
}

// ======================================================
// GET — ACTIVE, REVIEW AND ARCHIVE DATA
// ======================================================

export async function GET(req: NextRequest) {
  try {
    await authenticateDoctor(req);

    const referrals = await loadPaidInboxReferrals();

    const sources = referrals.reduce(
      (acc, referral) => {
        acc[referral.database_source] =
          (acc[referral.database_source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return json({
      success: true,
      count: referrals.length,
      referrals,
      sources,
      configured: {
        carescriber: Boolean(
          careScriberUrl && careScriberServiceKey
        ),
        hivclintest: Boolean(
          hivClinTestUrl && hivClinTestServiceKey
        ),
      },
    });
  } catch (error) {
    console.error("Inbox GET error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Inbox load failed.";

    const authError =
      /authentication|session|sign in/i.test(message);

    const accessError =
      /authorised|doctor access/i.test(message);

    return json(
      {
        success: false,
        referrals: [],
        count: 0,
        error: message,
      },
      authError ? 401 : accessError ? 403 : 500
    );
  }
}

// ======================================================
// PATCH — ACCEPT, COMPLETE, ARCHIVE, RESTORE
// ======================================================

export async function PATCH(req: NextRequest) {
  try {
    const user = await authenticateDoctor(req);

    let body: InboxActionBody;

    try {
      body = await req.json() as InboxActionBody;
    } catch {
      return json(
        {
          success: false,
          error: "Valid JSON required.",
        },
        400
      );
    }

    if (!isValidAction(body.action)) {
      return json(
        {
          success: false,
          error: "Invalid action.",
        },
        400
      );
    }

    const referralId = cleanString(
      body.referralId,
      100
    );

    if (!referralId || !validUuid(referralId)) {
      return json(
        {
          success: false,
          error: "Valid referral UUID required.",
        },
        400
      );
    }

    if (
      body.databaseSource !== undefined &&
      !isDatabaseSource(body.databaseSource)
    ) {
      return json(
        {
          success: false,
          error: "Invalid database source.",
        },
        400
      );
    }

    // Never trust a doctor ID supplied by the browser.
    const doctorId = user.id;

    const firstName = cleanString(
      user.user_metadata?.first_name,
      100
    );

    const surname = cleanString(
      user.user_metadata?.surname ||
      user.user_metadata?.last_name,
      100
    );

    const doctorName =
      `${firstName} ${surname}`.trim() ||
      user.email ||
      "Doctor";

    if (
      body.action === "accept" ||
      body.action === "complete"
    ) {
      const referral = await changeReferral({
        action: body.action,
        referralId,
        doctorId,
        doctorName,
        databaseSource: body.databaseSource,
      });

      if (!referral) {
        return json(
          {
            success: false,
            error:
              body.action === "accept"
                ? "Already accepted, completed, unpaid, or unavailable. Refresh the inbox."
                : "Only the assigned doctor can complete an accepted referral.",
          },
          409
        );
      }

      return json({
        success: true,
        action: body.action,
        referral,
        message:
          body.action === "accept"
            ? "Consultation accepted."
            : "Referral completed.",
      });
    }

    const referral = await changeArchiveStatus({
      action: body.action,
      referralId,
      doctorId,
      archiveReason: body.archiveReason,
      reviewConfirmed: body.reviewConfirmed,
      databaseSource: body.databaseSource,
    });

    return json({
      success: true,
      action: body.action,
      referral,
      message:
        body.action === "archive"
          ? "Consultation archived successfully. Patient and clinical data retained."
          : "Consultation restored successfully.",
    });
  } catch (error) {
    console.error("Inbox PATCH error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not update referral.";

    const authError =
      /authentication|session|sign in/i.test(message);

    const accessError =
      /authorised|doctor access|assigned doctor/i.test(
        message
      );

    const conflictError =
      /already|not saved|not confirmed|completed|30 days|clinical risk|urgent|follow-up/i.test(
        message
      );

    return json(
      {
        success: false,
        error: message,
      },
      authError
        ? 401
        : accessError
          ? 403
          : conflictError
            ? 409
            : 500
    );
  }
}
