import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 24 * 1024 * 1024;
const TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/flac", "audio/m4a", "video/mp4"]);

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Transcription service not configured", code: "CONFIG_ERROR", requestId }, { status: 503 });
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "Missing audio file", code: "NO_AUDIO", requestId }, { status: 400 });
    if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Recording exceeds 24 MB. Upload shorter segments.", code: "FILE_TOO_LARGE", requestId }, { status: 413 });
    if (audio.type && !TYPES.has(audio.type.split(";")[0])) return NextResponse.json({ error: "Unsupported audio format", code: "UNSUPPORTED_AUDIO", requestId }, { status: 415 });
    const sessionId = String(form.get("recordingSessionId") || "").slice(0, 100);
    const vocabulary = String(form.get("vocabulary") || "").slice(0, 1000);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120000, maxRetries: 1 });
    const result = await client.audio.transcriptions.create({
      file: audio,
      model: process.env.TRANSCRIPTION_MODEL || "gpt-4o-transcribe",
      language: "en",
      prompt: `South African English medical consultation. Transcribe only what is audible. Preserve medical terms, medicine names, dosages, units, negation, pregnancy terminology, and corrections exactly as spoken. Do not invent clinical facts, repeat phrases artificially, or generate SOAP notes. ${vocabulary ? `Vocabulary hints (not facts): ${vocabulary}` : ""}`,
    });
    const transcript = result.text?.trim() || "";
    if (!transcript) return NextResponse.json({ error: "No intelligible speech detected", code: "EMPTY_TRANSCRIPT", requestId }, { status: 422 });
    // Deliberately do not delete repeated clinical statements: segment duplication must be fixed in the recording UI.
    return NextResponse.json({ success: true, transcript, text: transcript, recordingSessionId: sessionId || null, requestId });
  } catch (err: unknown) {
    const status = typeof err === "object" && err !== null && "status" in err ? Number((err as {status?: unknown}).status) : 0;
    const code = status === 429 ? "RATE_LIMIT" : status === 401 ? "AUTH_ERROR" : status === 408 ? "TIMEOUT" : "TRANSCRIPTION_ERROR";
    console.error("transcription_failure", { requestId, code, status });
    return NextResponse.json({ error: "Audio transcription failed. Retry or enter notes manually.", code, requestId }, { status: status === 429 ? 429 : 502 });
  }
}
