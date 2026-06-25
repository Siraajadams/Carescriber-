import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const file = form.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No pathology image uploaded." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();

    const base64 = Buffer.from(bytes).toString("base64");

    const mime = file.type || "image/jpeg";

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",

      messages: [
        {
          role: "system",
          content: `
You are an experienced physician.

Analyse pathology reports only.

Return:

1. Overall Clinical Summary

2. Important Abnormal Results

3. Possible Diagnoses

4. Recommended Further Investigations

5. Suggested Treatment Plan

6. Medication Considerations

7. Red Flags

8. Follow-up Recommendations

Always mention that recommendations require clinician review.
`
        },

        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyse this pathology report."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mime};base64,${base64}`
              }
            }
          ]
        }
      ],

      temperature: 0.2,

      max_tokens: 1800
    });

    return NextResponse.json({
      analysis: response.choices[0].message.content,
    });

  } catch (err: any) {

    console.error(err);

    return NextResponse.json(
      {
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}
