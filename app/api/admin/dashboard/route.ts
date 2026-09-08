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

function clean(value: any): string {
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

function lower(value: any): string {
  return clean(value).toLowerCase();
}

function normalizeItems(raw: any): any[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw === "object") {
    return [raw];
  }

  if (
    typeof raw === "string" &&
    raw.trim()
  ) {
    try {
      const parsed = JSON.parse(raw);

      return Array.isArray(parsed)
        ? parsed
        : [parsed];
    } catch {
      return [raw];
    }
  }

  return [];
}

/*
==========================================================
GENERIC NESTED VALUE SEARCH
==========================================================
*/

function findFirstStringByKeys(
  value: any,
  keys: string[],
  depth = 0
): string {
  if (
    depth > 10 ||
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (typeof value === "string") {
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstStringByKeys(
        item,
        keys,
        depth + 1
      );

      if (found) return found;
    }

    return "";
  }

  if (typeof value !== "object") {
    return "";
  }

  /*
  Search preferred keys first
  */

  for (const key of keys) {
    if (!(key in value)) continue;

    const candidate = value[key];

    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }

    if (
      candidate &&
      typeof candidate === "object"
    ) {
      const nested = findFirstStringByKeys(
        candidate,
        keys,
        depth + 1
      );

      if (nested) return nested;
    }
  }

  /*
  Then search deeper
  */

  for (const child of Object.values(value)) {
    if (
      child &&
      typeof child === "object"
    ) {
      const nested = findFirstStringByKeys(
        child,
        keys,
        depth + 1
      );

      if (nested) return nested;
    }
  }

  return "";
}

/*
==========================================================
MEDICATION PARSER
==========================================================
*/

function getMedicationName(item: any): string {
  if (!item) return "";

  const keys = [
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
  ];

  const result = findFirstStringByKeys(
    item,
    keys
  );

  if (!result) return "";

  const cleaned = result
    .replace(/\[object Object\]/gi, "")
    .trim();

  if (!cleaned) return "";

  const invalidValues = [
    "null",
    "undefined",
    "object",
    "true",
    "false",
  ];

  if (
    invalidValues.includes(
      cleaned.toLowerCase()
    )
  ) {
    return "";
  }

  return cleaned;
}

/*
==========================================================
ICD-10 PARSER
==========================================================
*/

function getIcd10FromItem(item: any) {
  const codeKeys = [
    "icd10",
    "icd10_code",
    "icd10Code",
    "icd_code",
    "diagnosis_code",
    "diagnosisCode",
    "code",
  ];

  const descriptionKeys = [
    "icd10_description",
    "icd10Description",
    "diagnosis_description",
    "diagnosisDescription",
    "diagnosis",
    "description",
  ];

  let code = findFirstStringByKeys(
    item,
    codeKeys
  );

  let description =
    findFirstStringByKeys(
      item,
      descriptionKeys
    );

  /*
  Defensive cleanup:
  don't allow obvious medicine-related fields to
  masquerade as ICD descriptions.
  */

  if (
    code &&
    !/^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$/i.test(
      code
    )
  ) {
    /*
    Accept shorter codes like F51 too.
    */
    if (
      !/^[A-Z][0-9]{2}$/i.test(code)
    ) {
      code = "";
    }
  }

  return {
    code: clean(code).toUpperCase(),
    description: clean(description),
  };
}

/*
==========================================================
MAIN GET
==========================================================
*/

export async function GET(
  req: NextRequest
) {
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

    consultationRows.forEach(
      (row: any) => {
        if (row.provider_id) {
          activeDoctorKeys.add(
            `doctor:${row.provider_id}`
          );
        }
      }
    );

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

    const selectedPatients =
      monthlyPatientIds.size > 0
        ? patientRows.filter(
            (patient: any) =>
              monthlyPatientIds.has(
                String(patient.id)
              )
          )
        : monthlyNewPatients;

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

    Read from:
    1. top-level prescription fields
    2. prescription.items JSON
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
      (prescription: any) => {
        let foundAny = false;

        /*
        TOP-LEVEL ICD
        */

        const topCode =
          clean(
            prescription.icd10_code
          ).toUpperCase();

        const topDescription =
          clean(
            prescription.icd10_description
          );

        if (
          topCode ||
          topDescription
        ) {
          const key =
            `${topCode}|${topDescription}`
              .toLowerCase();

          const existing =
            icdMap.get(key);

          if (existing) {
            existing.count++;
          } else {
            icdMap.set(key, {
              code:
                topCode ||
                "Not recorded",

              description:
                topDescription ||
                "Description not recorded",

              count: 1,
            });
          }

          foundAny = true;
        }

        /*
        ITEM-LEVEL ICD
        */

        const items =
          normalizeItems(
            prescription.items
          );

        for (const item of items) {
          const {
            code,
            description,
          } = getIcd10FromItem(
            item
          );

          if (
            !code &&
            !description
          ) {
            continue;
          }

          const key =
            `${code}|${description}`
              .toLowerCase();

          const existing =
            icdMap.get(key);

          if (existing) {
            /*
            Avoid double counting the exact same ICD
            if it is already top-level.
            */
            if (!foundAny) {
              existing.count++;
            }
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

    prescriptionRows.forEach(
      (prescription: any) => {
        let items =
          normalizeItems(
            prescription.items
          );

        /*
        Fallback for old records
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
          const medication =
            getMedicationName(item);

          if (!medication) {
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
    );

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
    Prescription activity first
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
    Consultation activity
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
    MAP PROFILE NAMES
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
    RESPONSE
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
