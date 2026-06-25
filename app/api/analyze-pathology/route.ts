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
    const base64Image = Buffer.from(bytes).toString("base64");
    const mimeType = image.type || "image/jpeg";

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `
You are a clinical pathology interpretation assistant.

You analyse pathology/laboratory report images for clinician review only.

Rules:
- Do not provide a final diagnosis.
- Do not prescribe as a doctor.
- Identify visible values accurately.
- Highlight abnormal results.
- Suggest possible clinical significance.
- Suggest reasonable next investigations.
- Suggest a possible treatment/management plan for clinician review.
- Always state that the responsible clinician must confirm the findings.
          `,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `
Analyse this pathology report image.

Return the answer in this exact format:

PATHOLOGY SUMMARY
Briefly summarise the report.

KEY RESULTS IDENTIFIED
List the visible test names, values, units and reference ranges if visible.

ABNORMAL OR CONCERNING RESULTS
List abnormal values and explain why they may be important.

POSSIBLE CLINICAL SIGNIFICANCE
Explain what the results may suggest clinically.

POSSIBLE DIFFERENTIAL DIAGNOSES
List possible conditions to consider.

SUGGESTED TREATMENT / MANAGEMENT PLAN
Provide general clinician-review management suggestions only.

RECOMMENDED FURTHER INVESTIGATIONS
Suggest repeat tests, confirmatory tests or referrals.

RED FLAGS / URGENT ACTIONS
Mention anything that may need urgent clinical review.

CLINICIAN CONFIRMATION
State that this AI analysis must be reviewed and confirmed by the responsible clinician.
              `,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    const analysis =
      response.choices?.[0]?.message?.content ||
      "No pathology analysis returned.";

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    console.error("Pathology analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to analyse pathology image.",
      },
      { status: 500 }
    );
  }
}
