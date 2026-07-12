import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LookupRequest = {
  patientId?: string;
};

function normalizePatientId(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .trim()
    .toUpperCase();
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

    const { data: patients, error } = await supabase
      .from("patients")
      .select(`
        id,
        patient_id,
        id_number,
        national_id,
        first_name,
        surname,
        last_name,
        date_of_birth,
        dob,
        age,
        gender,
        mobile,
        phone,
        email,
        medical_aid,
        allergies,
        current_medicines
      `)
      .limit(500);

    if (error) {
      console.error(
        "CARESCRIBER PATIENT LOOKUP DATABASE ERROR:",
        error
      );

      return NextResponse.json(
        {
          found: false,
          error: `Patient lookup failed: ${error.message}`,
        },
        { status: 500 }
      );
    }

    const patient =
      patients?.find((item) => {
        const storedPatientId = normalizePatientId(
          item.patient_id ||
            item.id_number ||
            item.national_id
        );

        return storedPatientId === patientId;
      }) || null;

    if (!patient) {
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
        id: patient.id,
        patientId:
          patient.patient_id ||
          patient.id_number ||
          patient.national_id ||
          "",
        firstName: patient.first_name || "",
        surname:
          patient.surname ||
          patient.last_name ||
          "",
        dateOfBirth:
          patient.date_of_birth ||
          patient.dob ||
          null,
        age: patient.age || null,
        gender: patient.gender || "",
        mobile:
          patient.mobile ||
          patient.phone ||
          "",
        email: patient.email || "",
        medicalAid: patient.medical_aid || "",
        allergies:
          patient.allergies ||
          "No known allergies",
        currentMedicines:
          patient.current_medicines || "",
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
