import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";

type EmailRequestBody = {
  to?: string;
  cc?: string;
  patientName?: string;
  certificateNumber?: string;
  doctorName?: string;
  dateSeen?: string;
  unfitFrom?: string;
  unfitUntil?: string;
  returnDate?: string;
  filename?: string;
  pdfBase64?: string;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatDate(date: string): string {
  if (!date) return "Not captured";

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

export async function POST(request: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!resendApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "RESEND_API_KEY is not configured.",
        },
        { status: 500 },
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase environment variables are not configured.",
        },
        { status: 500 },
      );
    }

    const authorizationHeader = request.headers.get("authorization");

    const accessToken = authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice(7)
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

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

    const to = body.to?.trim() || "";
    const cc = body.cc?.trim() || "";
    const patientName = body.patientName?.trim() || "";
    const certificateNumber = body.certificateNumber?.trim() || "";
    const doctorName = body.doctorName?.trim() || "";
    const filename =
      body.filename?.trim() || `${certificateNumber || "sick-note"}.pdf`;
    const pdfBase64 = body.pdfBase64?.trim() || "";

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

    const resend = new Resend(resendApiKey);

    const fromEmail =
      process.env.SICK_NOTE_FROM_EMAIL ||
      "CareScriber Medical Certificates <prescriptions@carescriber.com>";

    const replyTo = process.env.SICK_NOTE_REPLY_TO;

    const safePatientName = escapeHtml(patientName);
    const safeCertificateNumber = escapeHtml(certificateNumber);
    const safeDoctorName = escapeHtml(doctorName);

    const { data, error } = await resend.emails.send({
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
              <strong>${safePatientName}</strong> attached to this email.
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

              <p style="margin: 4px 0;">
                <strong>Date seen:</strong>
                ${formatDate(body.dateSeen || "")}
              </p>

              <p style="margin: 4px 0;">
                <strong>Unfit from:</strong>
                ${formatDate(body.unfitFrom || "")}
              </p>

              <p style="margin: 4px 0;">
                <strong>Up to and including:</strong>
                ${formatDate(body.unfitUntil || "")}
              </p>

              <p style="margin: 4px 0;">
                <strong>Return date:</strong>
                ${formatDate(body.returnDate || "")}
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
              This message contains confidential medical information intended
              only for the named recipient. Please handle it securely.
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

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Resend could not send the email.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      id: data?.id || null,
      authenticatedUserId: user.id,
    });
  } catch (error) {
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
