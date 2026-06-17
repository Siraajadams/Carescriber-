import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing in Vercel environment variables." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio || !(audio instanceof File)) {
      return NextResponse.json(
        { error: "No audio file received." },
        { status: 400 }
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-mini-transcribe",
    });

    return NextResponse.json({
      text: transcription.text || "",
    });
  } catch (error: any) {
    console.error("Transcription error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Transcription failed. Please check OpenAI API key and audio format.",
      },
      { status: 500 }
    );
  }
}
