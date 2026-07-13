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

function calculateAge(dateValue: unknown): number | null {
  if (!dateValue) return null;

  const rawDate = String(dateValue).trim();

  if (!rawDate) return null;

  const dateOfBirth = new Date(rawDate);

  if (Number.isNaN(dateOfBirth.getTime())) {
    return null;
  }

  const today = new Date();

  let age = today.getFullYear() - dateOfBirth.getFullYear();

  const monthDifference =
    today.getMonth() - dateOfBirth.getMonth();

  const birthdayHasNotOccurred =
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < dateOfBirth.getDate());

  if (birthdayHasNotOccurred) {
    age -= 1;
  }

  if (age < 0 || age > 130) {
    return null;
  }

  return age;
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
        gender,
        mobile,
        mobile_number,
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
        const possibleIds = [
          item.patient_id,
          item.id_number,
          item.national_id,
        ];

        return possibleIds.some(
          (value) =>
            normalizePatientId(value) === patientId
        );
      }) || null;

    if (!patient) {
      return NextResponse.json({
        found: false,
        patient: null,
        message:
          "No existing patient was found. Continue with patient registration.",
      });
    }

    const dateOfBirth =
      patient.date_of_birth ||
      patient.dob ||
      null;

    const age = calculateAge(dateOfBirth);

    return NextResponse.json({
      found: true,
      patient: {
        id: patient.id,

        patientId:
          patient.patient_id ||
          patient.id_number ||
          patient.national_id ||
          patientId,

        firstName:
          patient.first_name ||
          "",

        surname:
          patient.surname ||
          patient.last_name ||
          "",

        fullName: [
          patient.first_name,
          patient.surname || patient.last_name,
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),

        dateOfBirth,

        age,

        gender:
          patient.gender ||
          "",

        mobile:
          patient.mobile ||
          patient.mobile_number ||
          patient.phone ||
          "",

        email:
          patient.email ||
          "",

        medicalAid:
          patient.medical_aid ||
          "",

        allergies:
          patient.allergies ||
          "No known allergies",

        currentMedicines:
          patient.current_medicines ||
          "",
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
