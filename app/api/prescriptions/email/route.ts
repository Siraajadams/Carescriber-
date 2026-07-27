import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PrescriptionEmailRequest = {
  to?: string;
  subject?: string;
  body?: string;
  filename?: string;
  pdfBase64?: string;
};

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as PrescriptionEmailRequest;

    const to = String(payload.to || "").trim();
    const subject = String(payload.subject || "").trim();
    const body = String(payload.body || "").trim();
    const filename = String(
      payload.filename || "prescription.pdf"
    ).trim();
    const pdfBase64 = String(payload.pdfBase64 || "").trim();

    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { error: "A valid recipient email address is required." },
        { status: 400 }
      );
    }

    if (!pdfBase64) {
      return NextResponse.json(
        { error: "The prescription PDF attachment is missing." },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    const fromEmail =
      process.env.PRESCRIPTION_FROM_EMAIL ||
      "CareScriber ePrescription <prescriptions@carescriber.com>";

    if (!resendApiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject:
        subject || "Electronic Prescription from CareScriber",
      text:
        body ||
        "Please find the electronic prescription attached.",
      attachments: [
        {
          filename: filename.endsWith(".pdf")
            ? filename
            : `${filename}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (error) {
      console.error("Resend email error:", error);

      return NextResponse.json(
        {
          error:
            error.message ||
            "The prescription email could not be sent.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailId: data?.id || null,
    });
  } catch (error) {
    console.error("Prescription email route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected email error occurred.",
      },
      { status: 500 }
    );
  }
}
