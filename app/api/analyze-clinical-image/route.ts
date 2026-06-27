import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No image uploaded." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a clinical documentation assistant. Analyze images for clinical documentation support only. Do not make a final diagnosis. Mention that a clinician must verify all findings.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyze this clinical image. Extract visible medicine name, strength, dosage instructions, warning labels, expiry date if visible, and any clinical documentation points. Provide a structured summary for the clinician.",
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

    return NextResponse.json({
      analysis: response.choices[0]?.message?.content || "No analysis returned.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Image analysis failed." },
      { status: 500 }
    );
  }
}
