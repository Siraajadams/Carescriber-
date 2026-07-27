import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type GenerateClinicalNoteRequest = {
  transcript?: string;
  patientName?: string;
  patientAge?: number | string | null;
  patientGender?: string | null;
  allergies?: string | null;
  currentMedicines?: string | null;
  imageAnalysis?: string | null;
};

type ClinicalNoteResponse = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10Suggestions: Array<{
    code: string;
    description: string;
    priority: "primary" | "secondary" | "differential";
    reason: string;
  }>;
  referralRecommendation: string;
  redFlags: string;
  patientSummary: string;
  clinicalDisclaimer: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function removeCodeFence(value: string): string {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function fallbackClinicalNote(): ClinicalNoteResponse {
  return {
    subjective: "Unable to generate a structured subjective history.",
    objective:
      "Objective examination findings must be completed and confirmed by the clinician.",
    assessment:
      "Clinical impression could not be generated. Clinician assessment is required.",
    plan:
      "Review the consultation record, complete the examination and document the final management plan.",
    icd10Suggestions: [],
    referralRecommendation:
      "Referral requirement must be determined by the treating clinician.",
    redFlags:
      "Assess for clinical deterioration, severe symptoms and other red flags.",
    patientSummary:
      "A clinician must review and complete the consultation note.",
    clinicalDisclaimer:
      "AI-generated draft only. The clinician must verify all findings, diagnoses, ICD-10 codes and management decisions before use.",
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "OPENAI_API_KEY is not configured.",
        },
        { status: 500 },
      );
    }

    const body = (await req.json()) as GenerateClinicalNoteRequest;

    const transcript = cleanText(body.transcript);
    const patientName = cleanText(body.patientName) || "Not provided";
    const patientAge =
      body.patientAge !== null && body.patientAge !== undefined
        ? String(body.patientAge)
        : "Not provided";
    const patientGender = cleanText(body.patientGender) || "Not provided";
    const allergies = cleanText(body.allergies) || "Not captured";
    const currentMedicines =
      cleanText(body.currentMedicines) || "Not captured";
    const imageAnalysis =
      cleanText(body.imageAnalysis) || "No clinical image analysis captured.";

    if (!transcript) {
      return NextResponse.json(
        {
          error: "Transcript is required.",
        },
        { status: 400 },
      );
    }

    if (transcript.length > 30_000) {
      return NextResponse.json(
        {
          error: "Transcript is too long.",
        },
        { status: 413 },
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content: `
You are CareScriber, a clinical documentation assistant for licensed healthcare professionals.

Your task is to transform the consultation transcript into a concise, clinically relevant draft SOAP note.

STRICT RULES:

1. Do not repeat the transcript verbatim.
2. Do not copy the same clinical information into multiple SOAP sections.
3. Subjective must contain only patient-reported history, symptoms, duration, relevant medical history, medicines and allergies.
4. Objective must contain only examination findings, observations, vital signs and image findings explicitly documented in the input.
5. Never invent vital signs, examination findings, diagnoses, test results or treatment.
6. Assessment must contain a useful provisional clinical impression based only on the available history and examination.
7. Do not use generic phrases such as:
   - "Clinical impression pending clinician confirmation"
   - "Differential diagnosis to be confirmed by clinician"
   unless there is genuinely insufficient information.
8. The most likely diagnosis must appear first in Assessment.
9. ICD-10 suggestions must be directly related to the presenting complaint and documented findings.
10. Return no more than 3 ICD-10 suggestions.
11. Do not produce a general list of unrelated ICD-10 codes.
12. Do not suggest headache, migraine, UTI, abdominal pain, dental disease, conjunctivitis or other unrelated conditions unless supported by the transcript.
13. If one diagnosis is clearly supported, return only that diagnosis and its ICD-10 code.
14. Use symptom codes only when a definitive or provisional diagnosis is not sufficiently supported.
15. The treatment plan must relate specifically to the documented problem.
16. Any medication recommendation must remain a draft for clinician verification and must not include unsupported dosing.
17. Referral must only be recommended when clinically indicated.
18. Red flags must be brief and relevant to the presenting complaint.
19. Do not repeat clinician disclaimers throughout the note.
20. Include one short disclaimer only in the clinicalDisclaimer field.
21. Use South African clinical terminology and spelling.
22. Return valid JSON only. Do not use markdown or code fences.

Return exactly this JSON structure:

{
  "subjective": "string",
  "objective": "string",
  "assessment": "string",
  "plan": "string",
  "icd10Suggestions": [
    {
      "code": "string",
      "description": "string",
      "priority": "primary | secondary | differential",
      "reason": "string"
    }
  ],
  "referralRecommendation": "string",
  "redFlags": "string",
  "patientSummary": "string",
  "clinicalDisclaimer": "string"
}
          `.trim(),
        },
        {
          role: "user",
          content: `
PATIENT DETAILS

Name: ${patientName}
Age: ${patientAge}
Gender: ${patientGender}
Allergies: ${allergies}
Current medicines: ${currentMedicines}

CLINICAL IMAGE ANALYSIS

${imageAnalysis}

CONSULTATION TRANSCRIPT

${transcript}

Create a concise SOAP note from this consultation.

Important:
- Summarise the transcript rather than copying it.
- Do not duplicate Subjective content in Objective or Assessment.
- Use only findings documented in the transcript or image analysis.
- Produce a specific provisional Assessment.
- Suggest only directly relevant ICD-10 codes.
- Maximum 3 ICD-10 suggestions.
          `.trim(),
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content || "";

    if (!rawContent) {
      return NextResponse.json(
        {
          error: "The AI returned an empty clinical note.",
        },
        { status: 502 },
      );
    }

    let clinicalNote: ClinicalNoteResponse;

    try {
      clinicalNote = JSON.parse(
        removeCodeFence(rawContent),
      ) as ClinicalNoteResponse;
    } catch {
      console.error("Invalid clinical-note JSON:", rawContent);

      return NextResponse.json(
        {
          error: "The AI returned an invalid clinical note format.",
          clinicalNote: fallbackClinicalNote(),
        },
        { status: 502 },
      );
    }

    const safeNote: ClinicalNoteResponse = {
      subjective:
        cleanText(clinicalNote.subjective) ||
        "No subjective history generated.",
      objective:
        cleanText(clinicalNote.objective) ||
        "No objective findings documented.",
      assessment:
        cleanText(clinicalNote.assessment) ||
        "Clinician assessment required.",
      plan:
        cleanText(clinicalNote.plan) ||
        "Management plan must be completed by the clinician.",
      icd10Suggestions: Array.isArray(clinicalNote.icd10Suggestions)
        ? clinicalNote.icd10Suggestions
            .filter(
              (item) =>
                item &&
                cleanText(item.code) &&
                cleanText(item.description),
            )
            .slice(0, 3)
            .map((item) => ({
              code: cleanText(item.code),
              description: cleanText(item.description),
              priority:
                item.priority === "primary" ||
                item.priority === "secondary" ||
                item.priority === "differential"
                  ? item.priority
                  : "differential",
              reason: cleanText(item.reason),
            }))
        : [],
      referralRecommendation:
        cleanText(clinicalNote.referralRecommendation) ||
        "No referral recommendation generated.",
      redFlags:
        cleanText(clinicalNote.redFlags) ||
        "Monitor for worsening symptoms or clinical deterioration.",
      patientSummary:
        cleanText(clinicalNote.patientSummary) ||
        "Clinical summary not generated.",
      clinicalDisclaimer:
        cleanText(clinicalNote.clinicalDisclaimer) ||
        "AI-generated draft only. The clinician must verify the diagnosis, ICD-10 codes and management plan before use.",
    };

    const formattedClinicalNote = [
      "SOAP NOTE",
      "",
      "Subjective:",
      safeNote.subjective,
      "",
      "Objective:",
      safeNote.objective,
      "",
      "Assessment:",
      safeNote.assessment,
      "",
      "Plan:",
      safeNote.plan,
      "",
      "ICD-10 SUGGESTIONS",
      safeNote.icd10Suggestions.length
        ? safeNote.icd10Suggestions
            .map(
              (item) =>
                `- ${item.code} - ${item.description} (${item.priority})${
                  item.reason ? `: ${item.reason}` : ""
                }`,
            )
            .join("\n")
        : "- No sufficiently supported ICD-10 suggestion generated.",
      "",
      "REFERRAL RECOMMENDATION",
      safeNote.referralRecommendation,
      "",
      "RED FLAGS / SAFETY NETTING",
      safeNote.redFlags,
      "",
      "PATIENT SUMMARY",
      safeNote.patientSummary,
      "",
      "CLINICAL NOTE",
      safeNote.clinicalDisclaimer,
    ].join("\n");

    return NextResponse.json({
      success: true,

      // Retains compatibility with your current consultation page.
      clinicalNote: formattedClinicalNote,

      // Structured fields can be used later to display separate SOAP sections.
      structuredNote: safeNote,
    });
  } catch (error: unknown) {
    console.error("Clinical note generation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Clinical note generation failed.",
      },
      { status: 500 },
    );
  }
}
