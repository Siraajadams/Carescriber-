import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  const start = new Date(
    Date.UTC(year, monthNumber - 1, 1)
  ).toISOString();

  const end = new Date(
    Date.UTC(year, monthNumber, 1)
  ).toISOString();

  return { start, end };
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function getMedicationName(item: any) {
  if (!item) return "";

  if (typeof item === "string") {
    return item.trim();
  }

  return clean(
    item.medicine ||
      item.medication ||
      item.medication_name ||
      item.name ||
      item.drug ||
      item.drug_name ||
      item.product_name
  );
}

export async function GET(req: NextRequest) {
  try {
    const month =
      req.nextUrl.searchParams.get("month") ||
      new Date().toISOString().slice(0, 7);

    const { start, end } = getMonthRange(month);

    /*
    ==========================================================
    PATIENTS
    ==========================================================
    */

    const { data: allPatients, error: patientsError } =
      await supabase
        .from("patients")
        .select("*");

    if (patientsError) {
      console.error("Patients:", patientsError);
    }

    const patientRows = allPatients || [];

    const monthlyNewPatients = patientRows.filter((patient: any) => {
      const created = patient.created_at;

      return (
        created &&
        created >= start &&
        created < end
      );
    });

    /*
    ==========================================================
    MONTHLY CONSULTATIONS
    ==========================================================
    */

    const {
      data: consultations,
      error: consultationsError,
    } = await supabase
      .from("consultations")
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end);

    if (consultationsError) {
      console.error(
        "Consultations:",
        consultationsError
      );
    }

    const consultationRows =
      consultations || [];

    /*
    Unique patients seen in selected month
    */

    const monthlyPatientIds = new Set<string>();

    consultationRows.forEach((row: any) => {
      if (row.patient_id) {
        monthlyPatientIds.add(
          String(row.patient_id)
        );
      }
    });

    /*
    ==========================================================
    PRESCRIPTIONS
    ==========================================================
    */

    const {
      data: prescriptions,
      error: prescriptionsError,
    } = await supabase
      .from("prescriptions")
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end);

    if (prescriptionsError) {
      console.error(
        "Prescriptions:",
        prescriptionsError
      );
    }

    const prescriptionRows =
      prescriptions || [];

    /*
    Add patients appearing only in prescriptions
    */

    prescriptionRows.forEach((row: any) => {
      if (row.patient_id) {
        monthlyPatientIds.add(
          String(row.patient_id)
        );
      }
    });

    /*
    ==========================================================
    DOCTORS
    ==========================================================

    doctors table is currently empty.

    Therefore active doctors are calculated from:
    - consultations.provider_id
    - prescriptions.doctor_hpcsa
    - prescriptions.doctor_name
    */

    const activeDoctorKeys = new Set<string>();

    consultationRows.forEach((row: any) => {
      if (row.provider_id) {
        activeDoctorKeys.add(
          `provider:${row.provider_id}`
        );
      }
    });

    prescriptionRows.forEach((row: any) => {
      if (row.doctor_hpcsa) {
        activeDoctorKeys.add(
          `hpcsa:${lower(row.doctor_hpcsa)}`
        );
      } else if (row.doctor_name) {
        activeDoctorKeys.add(
          `name:${lower(row.doctor_name)}`
        );
      }
    });

    /*
    Registered doctors:
    use all prescription history plus profile data where possible.
    */

    const {
      data: allPrescriptions,
      error: allPrescriptionsError,
    } = await supabase
      .from("prescriptions")
      .select(
        "doctor_hpcsa, doctor_name"
      );

    if (allPrescriptionsError) {
      console.error(
        "All prescriptions:",
        allPrescriptionsError
      );
    }

    const registeredDoctorKeys =
      new Set<string>();

    (allPrescriptions || []).forEach(
      (row: any) => {
        if (row.doctor_hpcsa) {
          registeredDoctorKeys.add(
            `hpcsa:${lower(row.doctor_hpcsa)}`
          );
        } else if (row.doctor_name) {
          registeredDoctorKeys.add(
            `name:${lower(row.doctor_name)}`
          );
        }
      }
    );

    /*
    ==========================================================
    GENDER — PATIENTS SEEN THIS MONTH
    ==========================================================
    */

    let male = 0;
    let female = 0;
    let other = 0;

    const selectedPatients =
      monthlyPatientIds.size > 0
        ? patientRows.filter((patient: any) =>
            monthlyPatientIds.has(
              String(patient.id)
            )
          )
        : monthlyNewPatients;

    selectedPatients.forEach(
      (patient: any) => {
        const gender = lower(
          patient.gender
        );

        if (
          gender === "female" ||
          gender === "f"
        ) {
          female++;
        } else if (
          gender === "male" ||
          gender === "m"
        ) {
          male++;
        } else {
          other++;
        }
      }
    );

    /*
    ==========================================================
    ICD-10 ANALYTICS
    ==========================================================

    diagnoses table is empty.

    Current ICD-10 source:
    prescriptions.icd10_code
    prescriptions.icd10_description
    */

    const icdMap = new Map<
      string,
      {
        code: string;
        description: string;
        count: number;
      }
    >();

    prescriptionRows.forEach(
      (row: any) => {
        const code = clean(
          row.icd10_code
        );

        const description = clean(
          row.icd10_description
        );

        if (!code && !description) return;

        const key =
          `${code}|${description}`.toLowerCase();

        const existing =
          icdMap.get(key);

        if (existing) {
          existing.count++;
        } else {
          icdMap.set(key, {
            code:
              code ||
              "Not recorded",
            description:
              description ||
              "Description not recorded",
            count: 1,
          });
        }
      }
    );

    const icd10 = Array.from(
      icdMap.values()
    )
      .sort(
        (a, b) => b.count - a.count
      )
      .slice(0, 20);

    /*
    ==========================================================
    MEDICATION ANALYTICS
    ==========================================================
    */

    const medicationMap = new Map<
      string,
      {
        medication: string;
        count: number;
        patients: Set<string>;
      }
    >();

    prescriptionRows.forEach(
      (prescription: any) => {
        let items: any[] = [];

        if (
          Array.isArray(
            prescription.items
          )
        ) {
          items =
            prescription.items;
        } else if (
          prescription.items &&
          typeof prescription.items ===
            "object"
        ) {
          items = [
            prescription.items,
          ];
        }

        /*
        Older prescription rows may use medicine directly
        */

        if (
          items.length === 0 &&
          prescription.medicine
        ) {
          items = [
            {
              medicine:
                prescription.medicine,
            },
          ];
        }

        items.forEach((item: any) => {
          const medication =
            getMedicationName(item);

          if (!medication) return;

          const key =
            medication.toLowerCase();

          if (
            !medicationMap.has(key)
          ) {
            medicationMap.set(key, {
              medication,
              count: 0,
              patients:
                new Set<string>(),
            });
          }

          const record =
            medicationMap.get(key)!;

          record.count++;

          const patientKey =
            clean(
              prescription.patient_id
            ) ||
            lower(
              prescription.patient_name
            );

          if (patientKey) {
            record.patients.add(
              patientKey
            );
          }
        });
      }
    );

    const medications =
      Array.from(
        medicationMap.values()
      )
        .map((item) => ({
          medication:
            item.medication,
          count: item.count,
          patients:
            item.patients.size,
        }))
        .sort(
          (a, b) =>
            b.count - a.count
        )
        .slice(0, 20);

    /*
    ==========================================================
    SICK NOTES
    ==========================================================
    */

    const {
      count: sickNotes,
      error: sickNotesError,
    } = await supabase
      .from("sick_notes")
      .select("id", {
        count: "exact",
        head: true,
      })
      .gte("created_at", start)
      .lt("created_at", end);

    if (sickNotesError) {
      console.error(
        "Sick notes:",
        sickNotesError
      );
    }

    /*
    ==========================================================
    SYMPTOMAI REFERRALS
    ==========================================================
    */

    const {
      count: referrals,
      error: referralsError,
    } = await supabase
      .from(
        "symptomai_referrals"
      )
      .select("id", {
        count: "exact",
        head: true,
      })
      .gte("created_at", start)
      .lt("created_at", end);

    if (referralsError) {
      console.error(
        "Referrals:",
        referralsError
      );
    }

    /*
    ==========================================================
    DOCTOR UTILISATION
    ==========================================================
    */

    const doctorUsageMap =
      new Map<
        string,
        {
          doctor: string;
          consultations: number;
          prescriptions: number;
          patients: Set<string>;
        }
      >();

    /*
    Prescription activity gives us actual doctor names
    */

    prescriptionRows.forEach(
      (row: any) => {
        const doctorName =
          clean(row.doctor_name) ||
          clean(row.doctor_hpcsa) ||
          "Unknown doctor";

        const doctorKey =
          lower(
            row.doctor_hpcsa
          ) ||
          lower(
            row.doctor_name
          );

        if (!doctorKey) return;

        if (
          !doctorUsageMap.has(
            doctorKey
          )
        ) {
          doctorUsageMap.set(
            doctorKey,
            {
              doctor: doctorName,
              consultations: 0,
              prescriptions: 0,
              patients:
                new Set<string>(),
            }
          );
        }

        const doctor =
          doctorUsageMap.get(
            doctorKey
          )!;

        doctor.prescriptions++;

        const patientKey =
          clean(row.patient_id) ||
          lower(row.patient_name);

        if (patientKey) {
          doctor.patients.add(
            patientKey
          );
        }
      }
    );

    /*
    Consultation provider IDs may not map directly to doctor names,
    so they are counted separately when present.
    */

    consultationRows.forEach(
      (row: any) => {
        if (!row.provider_id) return;

        const key = `provider:${row.provider_id}`;

        if (
          !doctorUsageMap.has(key)
        ) {
          doctorUsageMap.set(key, {
            doctor:
              "CareScriber Provider",
            consultations: 0,
            prescriptions: 0,
            patients:
              new Set<string>(),
          });
        }

        const doctor =
          doctorUsageMap.get(key)!;

        doctor.consultations++;

        if (row.patient_id) {
          doctor.patients.add(
            String(row.patient_id)
          );
        }
      }
    );

    const doctorUsage =
      Array.from(
        doctorUsageMap.values()
      )
        .map((doctor) => ({
          doctor: doctor.doctor,
          consultations:
            doctor.consultations,
          patients:
            doctor.patients.size,
          prescriptions:
            doctor.prescriptions,
        }))
        .sort(
          (a, b) =>
            b.consultations +
              b.prescriptions -
            (a.consultations +
              a.prescriptions)
        );

    /*
    ==========================================================
    RESPONSE
    ==========================================================
    */

    return NextResponse.json({
      month,

      doctors:
        registeredDoctorKeys.size,

      activeDoctors:
        activeDoctorKeys.size,

      /*
      This is total CareScriber patient database
      */

      patients:
        patientRows.length,

      newPatients:
        monthlyNewPatients.length,

      consultations:
        consultationRows.length,

      prescriptions:
        prescriptionRows.length,

      sickNotes:
        sickNotes || 0,

      referrals:
        referrals || 0,

      gender: {
        male,
        female,
        other,
      },

      icd10,

      medications,

      doctorUsage,
    });
  } catch (error: any) {
    console.error(
      "Admin Dashboard:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load CareScriber analytics",
      },
      {
        status: 500,
      }
    );
  }
}
