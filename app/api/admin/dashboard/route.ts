import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function normaliseGender(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const month =
      req.nextUrl.searchParams.get("month") ||
      new Date().toISOString().slice(0, 7);

    const { start, end } = getMonthRange(month);

    const { count: doctorCount, error: doctorError } = await supabase
      .from("profiles")
      .select("id", {
        count: "exact",
        head: true,
      })
      .or("profession.ilike.%doctor%,role.ilike.%doctor%");

    if (doctorError) {
      console.error("Doctor count error:", doctorError);
    }

    const { data: patients, error: patientError } = await supabase
      .from("patients")
      .select("id, gender, created_at");

    if (patientError) {
      console.error("Patient error:", patientError);
    }

    const patientRows = patients || [];

    const newPatients = patientRows.filter(
      (patient: any) =>
        patient.created_at >= start &&
        patient.created_at < end
    );

    const { data: consultations, error: consultationError } =
      await supabase
        .from("consultations")
        .select(`
          id,
          created_at,
          patient_id,
          doctor_id,
          icd10_code,
          icd10_description
        `)
        .gte("created_at", start)
        .lt("created_at", end);

    if (consultationError) {
      console.error("Consultation error:", consultationError);
    }

    const consultationRows = consultations || [];

    const activeDoctorIds = new Set(
      consultationRows
        .map((row: any) => row.doctor_id)
        .filter(Boolean)
    );

    const { data: prescriptions, error: prescriptionError } =
      await supabase
        .from("prescriptions")
        .select(
          "id, patient_id, doctor_id, medication_name, created_at"
        )
        .gte("created_at", start)
        .lt("created_at", end);

    if (prescriptionError) {
      console.error("Prescription error:", prescriptionError);
    }

    const prescriptionRows = prescriptions || [];

    const { count: sickNoteCount, error: sickNoteError } =
      await supabase
        .from("sick_notes")
        .select("id", {
          count: "exact",
          head: true,
        })
        .gte("created_at", start)
        .lt("created_at", end);

    if (sickNoteError) {
      console.error("Sick note error:", sickNoteError);
    }

    const { count: referralCount, error: referralError } =
      await supabase
        .from("symptomai_referrals")
        .select("id", {
          count: "exact",
          head: true,
        })
        .gte("created_at", start)
        .lt("created_at", end);

    if (referralError) {
      console.error("Referral error:", referralError);
    }

    let male = 0;
    let female = 0;
    let other = 0;

    patientRows.forEach((patient: any) => {
      const gender = normaliseGender(patient.gender);

      if (gender === "female" || gender === "f") {
        female++;
      } else if (gender === "male" || gender === "m") {
        male++;
      } else {
        other++;
      }
    });

    const icdMap = new Map<
      string,
      {
        code: string;
        description: string;
        count: number;
      }
    >();

    consultationRows.forEach((consultation: any) => {
      const code = String(
        consultation.icd10_code || ""
      ).trim();

      if (!code) return;

      const description = String(
        consultation.icd10_description ||
          "Description not recorded"
      ).trim();

      const key = `${code}|${description}`;

      const existing = icdMap.get(key);

      if (existing) {
        existing.count++;
      } else {
        icdMap.set(key, {
          code,
          description,
          count: 1,
        });
      }
    });

    const icd10 = Array.from(icdMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const medicationMap = new Map<
      string,
      {
        medication: string;
        count: number;
        patientIds: Set<string>;
      }
    >();

    prescriptionRows.forEach((prescription: any) => {
      const medication = String(
        prescription.medication_name || ""
      ).trim();

      if (!medication) return;

      const key = medication.toLowerCase();

      if (!medicationMap.has(key)) {
        medicationMap.set(key, {
          medication,
          count: 0,
          patientIds: new Set<string>(),
        });
      }

      const item = medicationMap.get(key)!;

      item.count++;

      if (prescription.patient_id) {
        item.patientIds.add(prescription.patient_id);
      }
    });

    const medications = Array.from(medicationMap.values())
      .map((item) => ({
        medication: item.medication,
        count: item.count,
        patients: item.patientIds.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return NextResponse.json({
      month,
      doctors: doctorCount || 0,
      activeDoctors: activeDoctorIds.size,
      patients: patientRows.length,
      newPatients: newPatients.length,
      consultations: consultationRows.length,
      prescriptions: prescriptionRows.length,
      sickNotes: sickNoteCount || 0,
      referrals: referralCount || 0,

      gender: {
        male,
        female,
        other,
      },

      icd10,
      medications,
      doctorUsage: [],
    });
  } catch (error: any) {
    console.error("Admin dashboard error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to generate dashboard",
      },
      {
        status: 500,
      }
    );
  }
}
