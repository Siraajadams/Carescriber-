import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get("image");

    if (!image || !(image instanceof File)) {
      return NextResponse.json(
        { error: "No pathology image uploaded." },
        { status: 400 }
      );
    }

    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = image.type || "image/jpeg";

    const result = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content:
            "You are a clinical assistant. Analyse pathology/lab report images for clinician review only. Do not make a final diagnosis. Always advise clinician confirmation.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
Analyse this pathology report image.

Return in this structure:

PATHOLOGY SUMMARY
- Brief clinical interpretation

ABNORMAL RESULTS
- List abnormal or concerning values
- Include reference ranges if visible

POSSIBLE CLINICAL SIGNIFICANCE
- Explain what the results may suggest

POSSIBLE DIFFERENTIALS
- Possible conditions to consider

SUGGESTED TREATMENT PLAN
- General management suggestions only
- Mention urgent actions if required

RECOMMENDED FOLLOW-UP
- Repeat tests
- Additional investigations
- Referral recommendations

RED FLAGS
- Urgent warning signs

CLINICIAN CONFIRMATION
- This AI analysis must be reviewed and confirmed by the responsible clinician.
              `,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
    });

    const analysis =
      result.choices?.[0]?.message?.content ||
      "No analysis returned from AI.";

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error("Pathology analysis error:", error);

    return NextResponse.json(
      { error: error.message || "Failed to analyse pathology image." },
      { status: 500 }
    );
  }
}
