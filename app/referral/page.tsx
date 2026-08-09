import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AttachmentInput = {
  fileName?: string;
  signedUrl?: string | null;
};

type SendReferralBody = {
  to?: string;
  recipientName?: string;
  patientName?: string;
  referralNumber?: string;
  subject?: string;
  html?: string;
  pdfBase64?: string;
  pdfFileName?: string;
  attachments?: AttachmentInput[];
};

function isValidEmail(value: string) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
}

function cleanBase64(value: string) {
  return value.replace(/^data:[^;]+;base64,/, "").trim();
}

function safeFileName(value: string) {
  return value.replace(/[^\\w.\\-() ]+/g, "_").slice(0, 180);
}

async function fetchAttachmentAsBase64(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not download attachment. HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      route: "/api/referral-email",
      status: "ready",
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      fromEmailConfigured: Boolean(
        process.env.CARESCRIBER_FROM_EMAIL ||
          process.env.RESEND_FROM_EMAIL ||
          process.env.PRESCRIPTION_FROM_EMAIL,
      ),
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(req: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return NextResponse.json(
        { success: false, error: "RESEND_API_KEY is not configured in Vercel." },
        { status: 500 },
      );
    }

    let body: SendReferralBody;

    try {
      body = (await req.json()) as SendReferralBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    const to = (body.to || "").trim();

    if (!to) {
      return NextResponse.json(
        { success: false, error: "Receiving clinician email address is required." },
        { status: 400 },
      );
    }

    if (!isValidEmail(to)) {
      return NextResponse.json(
        { success: false, error: "Receiving clinician email address is invalid." },
        { status: 400 },
      );
    }

    if (!body.html?.trim()) {
      return NextResponse.json(
        { success: false, error: "Referral content is missing." },
        { status: 400 },
      );
    }

    const emailAttachments: { filename: string; content: string }[] = [];

    if (body.pdfBase64?.trim()) {
      emailAttachments.push({
        filename: safeFileName(
          body.pdfFileName ||
            `CareScriber-Referral-${body.referralNumber || "Referral"}.pdf`,
        ),
        content: cleanBase64(body.pdfBase64),
      });
    }

    for (const attachment of body.attachments || []) {
      if (!attachment.fileName || !attachment.signedUrl) continue;

      try {
        const content = await fetchAttachmentAsBase64(attachment.signedUrl);

        emailAttachments.push({
          filename: safeFileName(attachment.fileName),
          content,
        });
      } catch (attachmentError) {
        console.error(
          `Could not attach file: ${attachment.fileName}`,
          attachmentError,
        );
      }
    }

    const fromEmail =
      process.env.CARESCRIBER_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      process.env.PRESCRIPTION_FROM_EMAIL ||
      "";

    if (!fromEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CARESCRIBER_FROM_EMAIL, RESEND_FROM_EMAIL or PRESCRIPTION_FROM_EMAIL is not configured in Vercel.",
        },
        { status: 500 },
      );
    }

    const patientName = body.patientName?.trim() || "Patient";
    const referralNumber =
      body.referralNumber?.trim() || "Medical Referral";

    const subject =
      body.subject?.trim() ||
      `Medical Referral - ${patientName} - ${referralNumber}`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html: body.html,
        attachments:
          emailAttachments.length > 0 ? emailAttachments : undefined,
      }),
    });

    const rawResendResponse = await resendResponse.text();

    let resendData: Record<string, any> = {};

    try {
      resendData = rawResendResponse ? JSON.parse(rawResendResponse) : {};
    } catch {
      resendData = { message: rawResendResponse };
    }

    if (!resendResponse.ok) {
      console.error("Resend referral email error:", {
        status: resendResponse.status,
        response: resendData,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            resendData?.message ||
            resendData?.error ||
            `Resend rejected the referral email. HTTP ${resendResponse.status}.`,
          details: resendData,
        },
        {
          status:
            resendResponse.status >= 400 && resendResponse.status <= 599
              ? resendResponse.status
              : 500,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Referral sent successfully.",
        emailId: resendData?.id || null,
        referralNumber,
        recipient: to,
        attachmentsSent: emailAttachments.length,
        pdfAttached: Boolean(body.pdfBase64),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Referral email API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Could not send referral.",
      },
      { status: 500 },
    );
  }
}
