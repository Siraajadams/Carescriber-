import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";

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

    console.log("PATIENT LOOKUP:", patientId);

    const { data: patients, error } = await supabase
      .from("patients")
      .select(`
        id,
        patient_id,
        first_name,
        surname,
        date_of_birth,
        gender,
        mobile,
        email
      `);

    if (error) {
      console.error("Patient lookup error:", error);

      return NextResponse.json(
        {
          found: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    const patient =
      patients?.find(
        (p) => normalizePatientId(p.patient_id) === patientId
      ) || null;

    if (!patient) {
      return NextResponse.json({
        found: false,
        patient: null,
        message:
          "No existing patient found. Continue with registration.",
      });
    }

    return NextResponse.json({
      found: true,
      patient: {
        id: patient.id,
        patientId: patient.patient_id,
        firstName: patient.first_name,
        surname: patient.surname,
        dateOfBirth: patient.date_of_birth,
        gender: patient.gender,
        mobile: patient.mobile,
        email: patient.email,
      },
      message: "Existing patient found.",
    });
  } catch (err) {
    console.error("PATIENT LOOKUP ERROR:", err);

    return NextResponse.json(
      {
        found: false,
        error:
          err instanceof Error
            ? err.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
