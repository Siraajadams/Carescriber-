import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PillSquadPayload = {
  order_id?: string;

  first_name?: string;
  surname?: string;

  email?: string;
  mobile_number?: string;
  date_of_birth?: string;

  medication_ordered?: string;

  address?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postal_code?: string;

  wants_pregnancy?: string;
  last_menstrual_period?: string;
  hours_since_unprotected_sex?: string;
  sexually_assaulted?: string;

  external_email_message_id?: string;

  raw_email_subject?: string;
  raw_email_body?: string;

  [key: string]: unknown;
};

function clean(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalisePhone(value: string): string {
  let phone = value.replace(/[^\d+]/g, "");

  // South African local number:
  // 0821234567 -> 27821234567
  if (/^0\d{9}$/.test(phone)) {
    phone = `27${phone.substring(1)}`;
  }

  // +27821234567 -> 27821234567
  if (phone.startsWith("+")) {
    phone = phone.substring(1);
  }

  return phone;
}

function normaliseDate(value: string): string | null {
  if (!value) {
    return null;
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // DD/MM/YYYY
  const slashMatch = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];

    return `${year}-${month}-${day}`;
  }

  return null;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function supabaseRequest(
  path: string,
  options: RequestInit = {}
) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    }
  );

  const responseText = await response.text();

  const data = responseText
    ? safeJsonParse(responseText) ?? responseText
    : null;

  if (!response.ok) {
    throw new Error(
      `Supabase request failed (${response.status}): ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  return data;
}

async function findExistingReferral(
  orderId: string
) {
  const encodedSource =
    encodeURIComponent("pillsquad");

  const encodedOrderId =
    encodeURIComponent(orderId);

  const path =
    `symptomai_referrals` +
    `?source=eq.${encodedSource}` +
    `&external_order_id=eq.${encodedOrderId}` +
    `&select=*` +
    `&limit=1`;

  const data = await supabaseRequest(path, {
    method: "GET",
  });

  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }

  return null;
}

export async function GET() {
  return NextResponse.json({
    success: true,
    service: "pillsquad-email-referral",
    message:
      "PillSquad email referral endpoint is online.",
  });
}

export async function POST(
  request: NextRequest
) {
  try {
    // --------------------------------------------------------
    // 1. Authenticate the email automation
    // --------------------------------------------------------

    const configuredSecret =
      process.env.PILLSQUAD_EMAIL_WEBHOOK_SECRET;

    if (!configuredSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PILLSQUAD_EMAIL_WEBHOOK_SECRET is not configured.",
        },
        { status: 500 }
      );
    }

    const suppliedSecret =
      request.headers.get("x-pillsquad-secret");

    if (
      !suppliedSecret ||
      suppliedSecret !== configuredSecret
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------------
    // 2. Read payload
    // --------------------------------------------------------

    const body =
      (await request.json()) as PillSquadPayload;

    const orderId = clean(body.order_id);

    const firstName = clean(body.first_name);
    const surname = clean(body.surname);

    const email = clean(body.email).toLowerCase();

    const mobileNumber = normalisePhone(
      clean(body.mobile_number)
    );

    const dateOfBirth = normaliseDate(
      clean(body.date_of_birth)
    );

    const medicationOrdered = clean(
      body.medication_ordered
    );

    const externalEmailMessageId = clean(
      body.external_email_message_id
    );

    // --------------------------------------------------------
    // 3. Required fields
    // --------------------------------------------------------

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: "order_id is required.",
        },
        { status: 400 }
      );
    }

    if (!firstName) {
      return NextResponse.json(
        {
          success: false,
          error: "first_name is required.",
        },
        { status: 400 }
      );
    }

    if (!mobileNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "mobile_number is required.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // 4. Safety filter:
    // Only create this CareScriber pathway for
    // emergency contraception orders.
    // --------------------------------------------------------

    const medicationLower =
      medicationOrdered.toLowerCase();

    const isEmergencyContraception =
      medicationLower.includes("emergency") ||
      medicationLower.includes("morning after") ||
      medicationLower.includes("morning-after");

    if (!isEmergencyContraception) {
      return NextResponse.json({
        success: true,
        ignored: true,
        reason:
          "Order is not an emergency contraception referral.",
        order_id: orderId,
      });
    }

    // --------------------------------------------------------
    // 5. DUPLICATE CHECK
    // --------------------------------------------------------

    const existing =
      await findExistingReferral(orderId);

    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message:
          "PillSquad referral already exists.",
        referral: existing,
      });
    }

    // --------------------------------------------------------
    // 6. Build patient snapshot
    // --------------------------------------------------------

    const patientSnapshot = {
      first_name: firstName,
      surname,
      email,
      mobile_number: mobileNumber,
      date_of_birth: dateOfBirth,

      address: clean(body.address),
      suburb: clean(body.suburb),
      city: clean(body.city),
      province: clean(body.province),
      postal_code: clean(body.postal_code),

      pillsquad_order_id: orderId,
      medication_ordered: medicationOrdered,
    };

    // --------------------------------------------------------
    // 7. Build triage snapshot
    // --------------------------------------------------------

    const triageSnapshot = {
      wants_pregnancy:
        clean(body.wants_pregnancy),

      last_menstrual_period:
        normaliseDate(
          clean(body.last_menstrual_period)
        ) ||
        clean(body.last_menstrual_period),

      hours_since_unprotected_sex:
        clean(
          body.hours_since_unprotected_sex
        ),

      sexually_assaulted:
        clean(body.sexually_assaulted),

      source:
        "pillsquad_purchase_confirmation",
    };

    // --------------------------------------------------------
    // 8. Create referral
    // --------------------------------------------------------

    const referral = {
      source: "pillsquad",

      service_type:
        "emergency_contraception",

      external_order_id:
        orderId,

      external_email_message_id:
        externalEmailMessageId || null,

      first_name:
        firstName,

      surname:
        surname || null,

      email:
        email || null,

      mobile_number:
        mobileNumber,

      date_of_birth:
        dateOfBirth,

      patient_snapshot:
        patientSnapshot,

      triage_snapshot:
        triageSnapshot,

      assessment_status:
        "whatsapp_pending",

      whatsapp_number:
        mobileNumber,

      whatsapp_status:
        "pending",

      payment_status:
        "unpaid",

      queue_status:
        "assessment_pending",

      referral_status:
        "new",

      updated_at:
        new Date().toISOString(),
    };

    const created =
      await supabaseRequest(
        "symptomai_referrals",
        {
          method: "POST",

          headers: {
            Prefer:
              "return=representation",
          },

          body: JSON.stringify(referral),
        }
      );

    const createdReferral =
      Array.isArray(created)
        ? created[0]
        : created;

    // --------------------------------------------------------
    // IMPORTANT:
    //
    // We deliberately DO NOT send WhatsApp here yet.
    //
    // First prove:
    // Email -> API -> Supabase
    //
    // Then we add WhatsApp as the next isolated step.
    // --------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        duplicate: false,

        message:
          "PillSquad referral created successfully.",

        referral:
          createdReferral,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "PillSquad email referral error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
