import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const audio = formData.get("audio");

    if (!audio || !(audio instanceof File)) {
      return NextResponse.json(
        { error: "No audio file uploaded." },
        { status: 400 }
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-transcribe",
      language: "en",
      prompt: `
You are a clinical medical transcription assistant.

Rules:
- Produce a clean clinical transcript.
- NEVER repeat words or sentences.
- Correct medical terminology.
- Preserve medicine names.
- Preserve diagnoses.
- Remove filler words like "uh", "erm", "okay".
- Return ONLY the transcript.
`,
    });

    const cleaned = transcription.text
      .replace(/\b(uh|um|erm|ah)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    return NextResponse.json({
      transcript: cleaned,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
