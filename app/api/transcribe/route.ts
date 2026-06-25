import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const language = String(formData.get("language") || "en");
    const prompt = String(
      formData.get("prompt") ||
        "Clinical consultation. Preserve medical terminology, medicine names, doses and abbreviations. Do not duplicate phrases.",
    );

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No audio file received." },
        { status: 400 },
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file,
      language,
      prompt,
      response_format: "json",
      temperature: 0,
    });

    return NextResponse.json({ text: transcription.text || "" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Transcription failed." },
      { status: 500 },
    );
  }
}
