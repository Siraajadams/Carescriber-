import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/flac", "audio/m4a", "video/mp4"]);

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "No audio file uploaded." }, { status: 400 });
    if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Audio file exceeds 20 MB." }, { status: 413 });
    if (audio.type && !ALLOWED_TYPES.has(audio.type)) return NextResponse.json({ error: "Unsupported audio format." }, { status: 415 });

    const vocabulary = String(form.get("vocabulary") ?? "").slice(0, 1200);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await client.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-transcribe",
      language: "en",
      prompt: [
        "South African English clinical consultation. Transcribe faithfully, including patient and clinician speech.",
        "Preserve drug names, strengths, units, route, frequency, duration, diagnoses, negations, and corrections exactly as spoken.",
        "Do not infer missing words, findings or dosages. Do not generate SOAP notes. Keep clinically meaningful repetition.",
        vocabulary ? `Relevant vocabulary (hints, not facts): ${vocabulary}` : "",
      ].filter(Boolean).join("\n"),
    });
    const transcript = result.text.trim();
    if (!transcript) return NextResponse.json({ error: "No speech could be transcribed." }, { status: 422 });
    return NextResponse.json({ transcript });
  } catch (error: unknown) {
    console.error("Transcription failed", error);
    return NextResponse.json({ error: "Transcription failed. Please retry or enter a manual transcript." }, { status: 500 });
  }
}
