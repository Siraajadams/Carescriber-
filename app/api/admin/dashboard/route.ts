import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
==========================================================
SUPABASE
==========================================================
*/

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/*
==========================================================
HELPERS
==========================================================
*/

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  if (!year || !monthNumber) {
    throw new Error("Invalid month");
  }

  const start = new Date(
    Date.UTC(year, monthNumber - 1, 1)
  ).toISOString();

  const end = new Date(
    Date.UTC(year, monthNumber, 1)
  ).toISOString();

  return {
    start,
    end,
  };
}

function clean(value: any) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

/*
==========================================================
MEDICATION PARSER
==========================================================
*/

function getMedicationName(
  value: any,
  depth = 0
): string {
  if (
    depth > 8 ||
    value === null ||
    value === undefined
  ) {
    return "";
  }

  /*
  Normal string
  */

  if (typeof value === "string") {
    const text = value.trim();

    if (!text) return "";

    if (
      text
        .toLowerCase()
        .includes("[object object]") ||
      text.toLowerCase() === "object"
    ) {
      return "";
    }

    return text;
  }

  /*
  Ignore numbers and booleans
  */

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return "";
  }

  /*
  Array
  */

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = getMedicationName(
        item,
        depth + 1
      );

      if (result) {
        return result;
      }
    }

    return "";
  }

  /*
  Must be object from here
  */

  if (typeof value !== "object") {
    return "";
  }

  /*
  Most likely medication keys
  */

  const preferredKeys = [
    "medicineName",
    "medicine_name",
    "medicationName",
    "medication_name",
    "productName",
    "product_name",
    "genericName",
    "generic_name",
    "brandName",
    "brand_name",
    "drugName",
    "drug_name",

    "medicine",
    "medication",
    "product",
    "drug",

    "label",
    "display",
    "title",
    "name",
    "value",
  ];

  for (const key of preferredKeys) {
    if (!(key in value)) continue;

    const result = getMedicationName(
      value[key],
      depth + 1
    );

    if (result) {
      return result;
    }
  }

  /*
  Search nested objects
  */

  for (const child of Object.values(value)) {
    if (
      child &&
      typeof child === "object"
    ) {
      const result = getMedicationName(
        child,
        depth + 1
      );

      if (result) {
        return result;
      }
    }
  }

  return "";
}

/*
==========================================================
MAIN GET
==========================================================
*/

export async function GET(req: NextRequest) {
  try {
    const month =
      req.nextUrl.searchParams.get("month") ||
      new Date().toISOString().slice(0, 7);

    const { start, end } =
      getMonthRange(month);

    /*
    ======================================================
    PATIENTS
    ======================================================
    */

    const {
      data: allPatients,
      error: patientsError,
    } = await supabase
      .from("patients")
      .select("*");

    if (patientsError) {
      console.error(
        "Patients error:",
        patientsError
      );
    }

    const patientRows =
      allPatients || [];

    const monthlyNewPatients =
      patientRows.filter(
        (patient: any) => {
          const created =
            patient.created_at;

          return (
            created &&
            created >= start &&
            created < end
          );
        }
      );

    /*
    ======================================================
    CONSULTATIONS
    ======================================================
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
        "Consultations error:",
        consultationsError
      );
    }

    const consultationRows =
      consultations || [];

    /*
    ======================================================
    PRESCRIPTIONS
    ======================================================
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
        "Prescriptions error:",
        prescriptionsError
      );
    }

    const prescriptionRows =
      prescriptions || [];

    /*
    ======================================================
    PATIENTS SEEN THIS MONTH
    ======================================================
    */

    const monthlyPatientIds =
      new Set<string>();

    consultationRows.forEach(
      (row: any) => {
        if (row.patient_id) {
          monthlyPatientIds.add(
            String(row.patient_id)
          );
        }
      }
    );

    prescriptionRows.forEach(
      (row: any) => {
        if (row.patient_id) {
          monthlyPatientIds.add(
            String(row.patient_id)
          );
        }
      }
    );

    /*
    ======================================================
    REGISTERED DOCTORS
    ======================================================
    */

    const {
      data: allPrescriptions,
      error: allPrescriptionsError,
    } = await supabase
      .from("prescriptions")
      .select(
        "doctor_id, doctor_hpcsa, doctor_name"
      );

    if (allPrescriptionsError) {
      console.error(
        "Doctor history error:",
        allPrescriptionsError
      );
    }

    const registeredDoctorKeys =
      new Set<string>();

    (allPrescriptions || []).forEach(
      (row: any) => {
        if (row.doctor_id) {
          registeredDoctorKeys.add(
            `doctor:${row.doctor_id}`
          );
        } else if (
          row.doctor_hpcsa
        ) {
          registeredDoctorKeys.add(
            `hpcsa:${lower(
              row.doctor_hpcsa
            )}`
          );
        } else if (
          row.doctor_name
        ) {
          registeredDoctorKeys.add(
            `name:${lower(
              row.doctor_name
            )}`
          );
        }
      }
    );

    /*
    ======================================================
    ACTIVE DOCTORS
    ======================================================
    */

    const activeDoctorKeys =
      new Set<string>();

    /*
    Consultation providers
    */

    consultationRows.forEach(
      (row: any) => {
        if (row.provider_id) {
          activeDoctorKeys.add(
            `doctor:${row.provider_id}`
          );
        }
      }
    );

    /*
    Prescription doctors
    */

    prescriptionRows.forEach(
      (row: any) => {
        if (row.doctor_id) {
          activeDoctorKeys.add(
            `doctor:${row.doctor_id}`
          );
        } else if (
          row.doctor_hpcsa
        ) {
          activeDoctorKeys.add(
            `hpcsa:${lower(
              row.doctor_hpcsa
            )}`
          );
        } else if (
          row.doctor_name
        ) {
          activeDoctorKeys.add(
            `name:${lower(
              row.doctor_name
            )}`
          );
        }
      }
    );

    /*
    ======================================================
    PATIENT GENDER
    ======================================================
    */

    let male = 0;
    let female = 0;
    let other = 0;

    let selectedPatients: any[] = [];

    if (monthlyPatientIds.size > 0) {
      selectedPatients =
        patientRows.filter(
          (patient: any) =>
            monthlyPatientIds.has(
              String(patient.id)
            )
        );
    } else {
      selectedPatients =
        monthlyNewPatients;
    }

    selectedPatients.forEach(
      (patient: any) => {
        const gender =
          lower(patient.gender);

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
    ======================================================
    ICD-10 ANALYTICS
    ======================================================
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
        const code =
          clean(row.icd10_code);

        const description =
          clean(
            row.icd10_description
          );

        if (!code && !description) {
          return;
        }

        const key =
          `${code}|${description}`
            .toLowerCase();

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

    const icd10 =
      Array.from(
        icdMap.values()
      )
        .sort(
          (a, b) =>
            b.count - a.count
        )
        .slice(0, 20);

    /*
    ======================================================
    MEDICATION ANALYTICS
    ======================================================
    */

    const medicationMap =
      new Map<
        string,
        {
          medication: string;
          count: number;
          patients: Set<string>;
        }
      >();

    for (const prescription of prescriptionRows) {
      let items: any[] = [];

      /*
      JSONB array
      */

      if (
        Array.isArray(
          prescription.items
        )
      ) {
        items =
          prescription.items;
      }

      /*
      JSONB object
      */

      else if (
        prescription.items &&
        typeof prescription.items ===
          "object"
      ) {
        items = [
          prescription.items,
        ];
      }

      /*
      JSON text
      */

      else if (
        typeof prescription.items ===
          "string" &&
        prescription.items.trim()
      ) {
        try {
          const parsed =
            JSON.parse(
              prescription.items
            );

          items =
            Array.isArray(parsed)
              ? parsed
              : [parsed];
        } catch {
          items = [
            prescription.items,
          ];
        }
      }

      /*
      Older format
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

      for (const item of items) {
        let medication =
          getMedicationName(item);

        medication =
          medication
            .replace(
              /\[object Object\]/gi,
              ""
            )
            .trim();

        if (!medication) {
          continue;
        }

        const invalidValues = [
          "null",
          "undefined",
          "object",
          "true",
          "false",
        ];

        if (
          invalidValues.includes(
            medication.toLowerCase()
          )
        ) {
          continue;
        }

        const medicationKey =
          medication.toLowerCase();

        if (
          !medicationMap.has(
            medicationKey
          )
        ) {
          medicationMap.set(
            medicationKey,
            {
              medication,
              count: 0,
              patients:
                new Set<string>(),
            }
          );
        }

        const record =
          medicationMap.get(
            medicationKey
          )!;

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
      }
    }

    const medications =
      Array.from(
        medicationMap.values()
      )
        .map((item) => ({
          medication:
            item.medication,

          count:
            item.count,

          patients:
            item.patients.size,
        }))
        .sort(
          (a, b) =>
            b.count - a.count
        )
        .slice(0, 20);

    /*
    ======================================================
    SICK NOTES
    ======================================================
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
        "Sick notes error:",
        sickNotesError
      );
    }

    /*
    ======================================================
    REFERRALS
    ======================================================
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
        "Referral error:",
        referralsError
      );
    }

    /*
    ======================================================
    DOCTOR UTILISATION
    ======================================================
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
    First add prescription activity
    */

    prescriptionRows.forEach(
      (row: any) => {
        let doctorKey = "";

        if (row.doctor_id) {
          doctorKey =
            `doctor:${row.doctor_id}`;
        } else if (
          row.doctor_hpcsa
        ) {
          doctorKey =
            `hpcsa:${lower(
              row.doctor_hpcsa
            )}`;
        } else if (
          row.doctor_name
        ) {
          doctorKey =
            `name:${lower(
              row.doctor_name
            )}`;
        }

        if (!doctorKey) return;

        const doctorName =
          clean(row.doctor_name) ||
          clean(row.doctor_hpcsa) ||
          "CareScriber Doctor";

        if (
          !doctorUsageMap.has(
            doctorKey
          )
        ) {
          doctorUsageMap.set(
            doctorKey,
            {
              doctor:
                doctorName,

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
    Add consultation activity.

    provider_id now maps to the same doctor key
    when it matches prescriptions.doctor_id.
    */

    consultationRows.forEach(
      (row: any) => {
        if (!row.provider_id) {
          return;
        }

        const doctorKey =
          `doctor:${row.provider_id}`;

        if (
          !doctorUsageMap.has(
            doctorKey
          )
        ) {
          doctorUsageMap.set(
            doctorKey,
            {
              doctor:
                "CareScriber Provider",

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

        doctor.consultations++;

        if (row.patient_id) {
          doctor.patients.add(
            String(row.patient_id)
          );
        }
      }
    );

    /*
    ======================================================
    MAP DOCTOR IDs TO PROFILE NAMES
    ======================================================
    */

    const doctorIds =
      Array.from(
        doctorUsageMap.keys()
      )
        .filter((key) =>
          key.startsWith(
            "doctor:"
          )
        )
        .map((key) =>
          key.replace(
            "doctor:",
            ""
          )
        );

    if (doctorIds.length > 0) {
      const {
        data: profiles,
        error: profilesError,
      } = await supabase
        .from("profiles")
        .select(
          "id, first_name, surname"
        )
        .in("id", doctorIds);

      if (profilesError) {
        console.error(
          "Profiles error:",
          profilesError
        );
      }

      (profiles || []).forEach(
        (profile: any) => {
          const key =
            `doctor:${profile.id}`;

          const entry =
            doctorUsageMap.get(key);

          if (!entry) return;

          const fullName = [
            profile.first_name,
            profile.surname,
          ]
            .filter(Boolean)
            .join(" ")
            .trim();

          if (fullName) {
            entry.doctor =
              fullName
                .toLowerCase()
                .startsWith("dr ")
                ? fullName
                : `Dr ${fullName}`;
          }
        }
      );
    }

    const doctorUsage =
      Array.from(
        doctorUsageMap.values()
      )
        .map((doctor) => ({
          doctor:
            doctor.doctor,

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
    ======================================================
    FINAL RESPONSE
    ======================================================
    */

    return NextResponse.json({
      month,

      doctors:
        registeredDoctorKeys.size,

      activeDoctors:
        activeDoctorKeys.size,

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
      "CareScriber Admin Dashboard Error:",
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
