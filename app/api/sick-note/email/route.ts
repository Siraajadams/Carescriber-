import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailRequestBody = {
  to?: string;
  cc?: string;

  patientId?: string;
  referralId?: string;
  referralCode?: string;
  consultationId?: string;

  patientName?: string;
  patientFirstName?: string;
  patientSurname?: string;
  patientIdentifier?: string;
  patientDateOfBirth?: string;
  patientMobile?: string;
  patientEmail?: string;

  certificateNumber?: string;

  doctorId?: string;
  doctorName?: string;
  doctorRegistrationNumber?: string;
  practiceName?: string;
  practiceAddress?: string;

  dateSeen?: string;
  unfitFrom?: string;
  unfitUntil?: string;
  returnDate?: string;

  diagnosis?: string;
  clinicalNotes?: string;
  status?: string;

  filename?: string;
  pdfBase64?: string;
};

function getSupabaseConfiguration() {
  const supabaseUrl =
    process.env.CARESCRIBER_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  const anonKey =
    process.env.CARESCRIBER_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const serviceRoleKey =
    process.env.CARESCRIBER_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("CareScriber Supabase URL is not configured.");
  }

  if (!anonKey) {
    throw new Error("CareScriber Supabase anonymous key is not configured.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "CareScriber Supabase service-role key is not configured.",
    );
  }

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  };
}

function createAuthClient(url: string, anonKey: string) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function nullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text || null;
}

function nullableUuid(value: unknown): string | null {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidPattern.test(text) ? text : null;
}

function normalizeReferralCode(value: unknown): string | null {
  const code = cleanText(value)
    .replace(/\s+/g, "")
    .toUpperCase();

  return code || null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatDate(date: string): string {
  if (!date) {
    return "Not captured";
  }

  const parsed = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripBase64Prefix(value: string): string {
  return value.replace(
    /^data:application\/pdf;base64,/i,
    "",
  );
}

export async function POST(request: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();

    if (!resendApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "RESEND_API_KEY is not configured.",
        },
        { status: 500 },
      );
    }

    const {
      supabaseUrl,
      anonKey,
      serviceRoleKey,
    } = getSupabaseConfiguration();

    const authorizationHeader =
      request.headers.get("authorization");

    const accessToken = authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication is required.",
        },
        { status: 401 },
      );
    }

    const authClient = createAuthClient(
      supabaseUrl,
      anonKey,
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "The login session is invalid or expired.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as EmailRequestBody;

    const to = cleanText(body.to);
    const cc = cleanText(body.cc);

    const patientId = nullableUuid(body.patientId);
    const referralId = nullableUuid(body.referralId);
    const consultationId = nullableUuid(body.consultationId);
    const requestedDoctorId = nullableUuid(body.doctorId);
    const referralCode = normalizeReferralCode(
      body.referralCode,
    );

    const patientFirstName = cleanText(
      body.patientFirstName,
    );

    const patientSurname = cleanText(
      body.patientSurname,
    );

    const patientName =
      cleanText(body.patientName) ||
      `${patientFirstName} ${patientSurname}`.trim();

    const patientIdentifier = cleanText(
      body.patientIdentifier,
    );

    const patientDateOfBirth = cleanText(
      body.patientDateOfBirth,
    );

    const patientMobile = cleanText(
      body.patientMobile,
    );

    const patientEmail =
      cleanText(body.patientEmail) || cc;

    const certificateNumber = cleanText(
      body.certificateNumber,
    );

    const doctorName = cleanText(body.doctorName);

    const doctorRegistrationNumber = cleanText(
      body.doctorRegistrationNumber,
    );

    const practiceName = cleanText(body.practiceName);
    const practiceAddress = cleanText(body.practiceAddress);

    const dateSeen = cleanText(body.dateSeen);
    const unfitFrom = cleanText(body.unfitFrom);
    const unfitUntil = cleanText(body.unfitUntil);
    const returnDate = cleanText(body.returnDate);

    const diagnosis = cleanText(body.diagnosis);
    const clinicalNotes = cleanText(body.clinicalNotes);
    const status = cleanText(body.status) || "Issued";

    const filename =
      cleanText(body.filename) ||
      `${certificateNumber || "sick-note"}.pdf`;

    const pdfBase64 = stripBase64Prefix(
      cleanText(body.pdfBase64),
    );

    if (!isValidEmail(to)) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid employer email is required.",
        },
        { status: 400 },
      );
    }

    if (cc && !isValidEmail(cc)) {
      return NextResponse.json(
        {
          success: false,
          error: "The patient CC email is invalid.",
        },
        { status: 400 },
      );
    }

    if (!patientId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No CareScriber patient is linked. Unlock the referral or select a patient before sending the sick note.",
        },
        { status: 400 },
      );
    }

    if (!patientName) {
      return NextResponse.json(
        {
          success: false,
          error: "Patient name is required.",
        },
        { status: 400 },
      );
    }

    if (!certificateNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Certificate number is required.",
        },
        { status: 400 },
      );
    }

    if (!doctorName) {
      return NextResponse.json(
        {
          success: false,
          error: "Doctor name is required.",
        },
        { status: 400 },
      );
    }

    if (!dateSeen) {
      return NextResponse.json(
        {
          success: false,
          error: "Date seen is required.",
        },
        { status: 400 },
      );
    }

    if (!unfitFrom || !unfitUntil) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The unfit-from and unfit-until dates are required.",
        },
        { status: 400 },
      );
    }

    if (!pdfBase64) {
      return NextResponse.json(
        {
          success: false,
          error: "The PDF attachment is missing.",
        },
        { status: 400 },
      );
    }

    if (pdfBase64.length > 10_000_000) {
      return NextResponse.json(
        {
          success: false,
          error: "The PDF attachment is too large.",
        },
        { status: 413 },
      );
    }

    const adminClient = createAdminClient(
      supabaseUrl,
      serviceRoleKey,
    );

    /*
     * Confirm that the patient exists and retrieve canonical details.
     */
    const { data: linkedPatient, error: patientError } =
      await adminClient
        .from("patients")
        .select(`
          id,
          first_name,
          last_name,
          surname,
          patient_id,
          id_number,
          national_id,
          dob,
          date_of_birth,
          mobile,
          mobile_number,
          email
        `)
        .eq("id", patientId)
        .maybeSingle();

    if (patientError) {
      console.error(
        "Sick-note patient lookup error:",
        patientError,
      );

      return NextResponse.json(
        {
          success: false,
          error: `Could not verify the linked patient: ${patientError.message}`,
        },
        { status: 500 },
      );
    }

    if (!linkedPatient) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The linked CareScriber patient record was not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Confirm the referral belongs to the selected patient.
     */
    let verifiedReferralId = referralId;
    let verifiedReferralCode = referralCode;

    if (referralId || referralCode) {
      let referralQuery = adminClient
        .from("symptomai_referrals")
        .select(`
          id,
          patient_id,
          referral_code,
          consent_token,
          status,
          expires_at
        `)
        .eq("patient_id", patientId);

      if (referralId) {
        referralQuery = referralQuery.eq("id", referralId);
      } else if (referralCode) {
        referralQuery = referralQuery.eq(
          "referral_code",
          referralCode,
        );
      }

      const {
        data: linkedReferral,
        error: referralLookupError,
      } = await referralQuery.maybeSingle();

      if (referralLookupError) {
        console.error(
          "Sick-note referral lookup error:",
          referralLookupError,
        );

        return NextResponse.json(
          {
            success: false,
            error: `Could not verify the linked referral: ${referralLookupError.message}`,
          },
          { status: 500 },
        );
      }

      if (!linkedReferral) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The referral code is not linked to the selected patient.",
          },
          { status: 400 },
        );
      }

      verifiedReferralId = linkedReferral.id;
      verifiedReferralCode =
        linkedReferral.referral_code;
    }

    const resolvedFirstName =
      patientFirstName ||
      linkedPatient.first_name ||
      "";

    const resolvedSurname =
      patientSurname ||
      linkedPatient.surname ||
      linkedPatient.last_name ||
      "";

    const resolvedIdentifier =
      patientIdentifier ||
      linkedPatient.patient_id ||
      linkedPatient.id_number ||
      linkedPatient.national_id ||
      "";

    const resolvedDateOfBirth =
      patientDateOfBirth ||
      linkedPatient.date_of_birth ||
      linkedPatient.dob ||
      null;

    const resolvedMobile =
      patientMobile ||
      linkedPatient.mobile ||
      linkedPatient.mobile_number ||
      "";

    const resolvedEmail =
      patientEmail ||
      linkedPatient.email ||
      "";

    /*
     * Prefer the logged-in user's UUID as doctor_id.
     * This avoids trusting a doctor ID supplied by the browser.
     */
    const doctorId =
      requestedDoctorId === user.id
        ? requestedDoctorId
        : user.id;

    const sickNotePayload = {
      patient_id: patientId,
      referral_id: verifiedReferralId,
      referral_code: verifiedReferralCode,
      doctor_id: doctorId,
      consultation_id: consultationId,

      patient_first_name:
        resolvedFirstName || null,

      patient_surname:
        resolvedSurname || null,

      patient_identifier:
        resolvedIdentifier || null,

      patient_date_of_birth:
        resolvedDateOfBirth || null,

      patient_mobile:
        resolvedMobile || null,

      patient_email:
        resolvedEmail || null,

      start_date: unfitFrom,
      end_date: unfitUntil,

      diagnosis: diagnosis || null,
      clinical_notes: clinicalNotes || null,

      doctor_name: doctorName,

      doctor_registration_number:
        doctorRegistrationNumber || null,

      practice_name: practiceName || null,
      practice_address: practiceAddress || null,

      status,
      updated_at: new Date().toISOString(),
    };

    const {
      data: savedSickNote,
      error: sickNoteSaveError,
    } = await adminClient
      .from("sick_notes")
      .insert(sickNotePayload)
      .select(`
        id,
        patient_id,
        referral_id,
        referral_code,
        doctor_id,
        consultation_id,
        patient_first_name,
        patient_surname,
        patient_identifier,
        patient_date_of_birth,
        start_date,
        end_date,
        status,
        created_at
      `)
      .single();

    if (sickNoteSaveError) {
      console.error(
        "Sick-note database save error:",
        sickNoteSaveError,
      );

      return NextResponse.json(
        {
          success: false,
          error: `Could not save the sick note: ${sickNoteSaveError.message}`,
        },
        { status: 500 },
      );
    }

    const resend = new Resend(resendApiKey);

    const fromEmail =
      process.env.SICK_NOTE_FROM_EMAIL?.trim() ||
      "CareScriber Medical Certificates <prescriptions@carescriber.com>";

    const replyTo =
      process.env.SICK_NOTE_REPLY_TO?.trim();

    const safePatientName = escapeHtml(patientName);
    const safeCertificateNumber = escapeHtml(
      certificateNumber,
    );
    const safeDoctorName = escapeHtml(doctorName);

    const safeReferralCode = verifiedReferralCode
      ? escapeHtml(verifiedReferralCode)
      : "";

    const { data: emailData, error: emailError } =
      await resend.emails.send({
        from: fromEmail,
        to: [to],
        cc: cc ? [cc] : undefined,
        replyTo: replyTo || undefined,
        subject: `Medical Certificate - ${patientName}`,
        html: `
          <div
            style="
              font-family: Arial, Helvetica, sans-serif;
              color: #0f172a;
              line-height: 1.6;
              max-width: 640px;
              margin: 0 auto;
            "
          >
            <div
              style="
                background: #2563eb;
                color: #ffffff;
                padding: 20px;
                border-radius: 12px 12px 0 0;
              "
            >
              <h2 style="margin: 0;">
                CareScriber Medical Certificate
              </h2>
            </div>

            <div
              style="
                border: 1px solid #dbe3ef;
                border-top: none;
                padding: 24px;
                border-radius: 0 0 12px 12px;
              "
            >
              <p>Good day,</p>

              <p>
                Please find the medical certificate for
                <strong>${safePatientName}</strong>
                attached to this email.
              </p>

              <div
                style="
                  background: #f8fafc;
                  border: 1px solid #e2e8f0;
                  padding: 16px;
                  border-radius: 10px;
                  margin: 20px 0;
                "
              >
                <p style="margin: 4px 0;">
                  <strong>Certificate number:</strong>
                  ${safeCertificateNumber}
                </p>

                ${
                  safeReferralCode
                    ? `
                      <p style="margin: 4px 0;">
                        <strong>SymptomAI referral:</strong>
                        ${safeReferralCode}
                      </p>
                    `
                    : ""
                }

                <p style="margin: 4px 0;">
                  <strong>Date seen:</strong>
                  ${formatDate(dateSeen)}
                </p>

                <p style="margin: 4px 0;">
                  <strong>Unfit from:</strong>
                  ${formatDate(unfitFrom)}
                </p>

                <p style="margin: 4px 0;">
                  <strong>Up to and including:</strong>
                  ${formatDate(unfitUntil)}
                </p>

                <p style="margin: 4px 0;">
                  <strong>Return date:</strong>
                  ${formatDate(returnDate)}
                </p>
              </div>

              <p>
                Issued by <strong>${safeDoctorName}</strong>.
              </p>

              <p>
                Kind regards,<br />
                CareScriber
              </p>

              <p
                style="
                  font-size: 12px;
                  color: #64748b;
                  margin-top: 28px;
                "
              >
                This message contains confidential medical information
                intended only for the named recipient. Please handle it
                securely.
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename,
            content: pdfBase64,
            contentType: "application/pdf",
          },
        ],
      });

    if (emailError) {
      console.error(
        "Sick-note email sending error:",
        emailError,
      );

      /*
       * The certificate remains saved, but mark the status
       * to show that email delivery failed.
       */
      await adminClient
        .from("sick_notes")
        .update({
          status: "Email failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", savedSickNote.id);

      return NextResponse.json(
        {
          success: false,
          saved: true,
          sickNoteId: savedSickNote.id,
          error:
            emailError.message ||
            "The sick note was saved, but Resend could not send the email.",
        },
        { status: 502 },
      );
    }

    await adminClient
      .from("sick_notes")
      .update({
        status: "Emailed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", savedSickNote.id);

    return NextResponse.json({
      success: true,
      sickNoteId: savedSickNote.id,
      emailId: emailData?.id || null,
      patientId,
      referralId: verifiedReferralId,
      referralCode: verifiedReferralCode,
      authenticatedUserId: user.id,
    });
  } catch (error: unknown) {
    console.error("Sick-note email error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error while sending the certificate.",
      },
      { status: 500 },
    );
  }
}
