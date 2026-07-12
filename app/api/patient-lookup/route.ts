import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LookupRequest = {
  patientId?: string;
};

function normalizePatientId(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LookupRequest;

    const patientId = normalizePatientId(body.patientId);

    if (!patientId) {
      return NextResponse.json(
        {
          found: false,
          error: "Patient ID is required.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    /*
     * Change patient_id below only if your real database column
     * has a different name.
     */
    const { data: exactPatient, error: exactError } =
      await supabase
        .from("patients")
        .select(
          `
            id,
            patient_id,
            first_name,
            surname,
            date_of_birth,
            gender,
            mobile,
            email
          `
        )
        .eq("patient_id", patientId)
        .maybeSingle();

    if (exactError) {
      console.error(
        "CARESCRIBER PATIENT LOOKUP DATABASE ERROR:",
        exactError
      );

      return NextResponse.json(
        {
          found: false,
          error: `Patient lookup failed: ${exactError.message}`,
        },
        { status: 500 }
      );
    }

    if (!exactPatient) {
      return NextResponse.json({
        found: false,
        patient: null,
        message:
          "No existing patient was found. Continue with patient registration.",
      });
    }

    return NextResponse.json({
      found: true,
      patient: {
        id: exactPatient.id,
        patientId: exactPatient.patient_id,
        firstName: exactPatient.first_name,
        surname: exactPatient.surname,
        dateOfBirth: exactPatient.date_of_birth,
        gender: exactPatient.gender,
        mobile: exactPatient.mobile,
        email: exactPatient.email,
      },
      message: "Existing patient found.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected patient lookup error.";

    console.error(
      "CARESCRIBER PATIENT LOOKUP ERROR:",
      error
    );

    return NextResponse.json(
      {
        found: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
