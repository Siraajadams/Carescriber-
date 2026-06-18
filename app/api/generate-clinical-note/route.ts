import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { transcript, patientName } = await req.json();

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required." },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a clinical documentation assistant. Generate draft clinical notes for a licensed doctor to review. Do not present advice as final diagnosis or treatment. Include safety-netting and doctor review reminders.",
        },
        {
          role: "user",
          content: `
Patient: ${patientName || "Not provided"}

Transcript:
${transcript}

Generate:
1. SOAP Note
2. Suggested ICD-10 Codes
3. Recommended Treatment Plan
4. Referral Recommendation if needed
5. Red Flags / Safety Netting
6. Patient Summary

Return in clear headings.
`,
        },
      ],
      temperature: 0.2,
    });

    return NextResponse.json({
      clinicalNote: completion.choices[0]?.message?.content || "",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Clinical note generation failed." },
      { status: 500 }
    );
  }
}
