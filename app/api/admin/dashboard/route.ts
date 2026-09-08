"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardData = {
  doctors: number;
  activeDoctors: number;
  patients: number;
  newPatients: number;
  consultations: number;
  prescriptions: number;
  sickNotes: number;
  referrals: number;

  gender: {
    male: number;
    female: number;
    other: number;
  };

  icd10: {
    code: string;
    description: string;
    count: number;
  }[];

  medications: {
    medication: string;
    count: number;
    patients: number;
  }[];

  doctorUsage: {
    doctor: string;
    consultations: number;
    patients: number;
    prescriptions: number;
  }[];
};

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 22,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#64748b",
          marginBottom: 10,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 34,
          fontWeight: 800,
          color: "#0f172a",
        }}
      >
        {value}
      </div>

      {subtitle && (
        <div
          style={{
            fontSize: 13,
            color: "#94a3b8",
            marginTop: 6,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  });

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/admin/dashboard?month=${encodeURIComponent(month)}`,
          {
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || "Could not load dashboard");
        }

        setData(result);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Could not load dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [month]);

  const totalGender = useMemo(() => {
    if (!data) return 0;

    return (
      data.gender.male +
      data.gender.female +
      data.gender.other
    );
  }, [data]);

  const femalePercent =
    totalGender > 0
      ? Math.round((data!.gender.female / totalGender) * 100)
      : 0;

  const malePercent =
    totalGender > 0
      ? Math.round((data!.gender.male / totalGender) * 100)
      : 0;

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: 40,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h2>Loading CareScriber Analytics...</h2>
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: 40,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h2>Dashboard Error</h2>
        <p style={{ color: "#dc2626" }}>{error}</p>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          padding: "24px 34px",
        }}
      >
        <div
          style={{
            maxWidth: 1500,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#0284c7",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              VIDEOMED CLINICAL ASSISTANT
            </div>

            <h1
              style={{
                fontSize: 30,
                margin: "5px 0",
              }}
            >
              CareScriber Analytics
            </h1>

            <div style={{ color: "#64748b" }}>
              Clinical activity and platform utilisation
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                display: "block",
                marginBottom: 5,
                color: "#64748b",
              }}
            >
              REPORTING MONTH
            </label>

            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 15,
                background: "white",
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          padding: 34,
        }}
      >
        {/* KPI CARDS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 18,
          }}
        >
          <StatCard
            title="Registered Doctors"
            value={data.doctors}
          />

          <StatCard
            title="Active Doctors"
            value={data.activeDoctors}
            subtitle="Used CareScriber this month"
          />

          <StatCard
            title="Patients"
            value={data.patients}
          />

          <StatCard
            title="New Patients"
            value={data.newPatients}
            subtitle="Registered this month"
          />

          <StatCard
            title="Consultations"
            value={data.consultations}
          />

          <StatCard
            title="Prescriptions"
            value={data.prescriptions}
          />

          <StatCard
            title="Sick Notes"
            value={data.sickNotes}
          />

          <StatCard
            title="Referrals"
            value={data.referrals}
          />
        </div>

        {/* GENDER */}

        <section style={sectionStyle}>
          <h2 style={headingStyle}>
            Patient Gender
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(200px,1fr))",
              gap: 16,
            }}
          >
            <GenderCard
              label="Female"
              count={data.gender.female}
              percent={femalePercent}
            />

            <GenderCard
              label="Male"
              count={data.gender.male}
              percent={malePercent}
            />

            <GenderCard
              label="Other / Not Specified"
              count={data.gender.other}
              percent={
                totalGender
                  ? Math.round(
                      (data.gender.other / totalGender) * 100
                    )
                  : 0
              }
            />
          </div>
        </section>

        {/* ICD10 */}

        <section style={sectionStyle}>
          <h2 style={headingStyle}>
            Top ICD-10 Diagnoses
          </h2>

          <p style={descriptionStyle}>
            Ranked by number of diagnoses during the selected month.
          </p>

          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Rank</th>
                  <th style={thStyle}>ICD-10</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Cases</th>
                </tr>
              </thead>

              <tbody>
                {data.icd10.slice(0, 20).map((item, index) => (
                  <tr key={`${item.code}-${index}`}>
                    <td style={tdStyle}>
                      <strong>{index + 1}</strong>
                    </td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          fontWeight: 800,
                          color: "#0369a1",
                        }}
                      >
                        {item.code}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      {item.description}
                    </td>

                    <td style={tdStyle}>
                      <strong>{item.count}</strong>
                    </td>
                  </tr>
                ))}

                {data.icd10.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        ...tdStyle,
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      No ICD-10 activity for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* MEDICATION */}

        <section style={sectionStyle}>
          <h2 style={headingStyle}>
            Top 20 Medications
          </h2>

          <p style={descriptionStyle}>
            Most frequently prescribed medications during the
            selected month.
          </p>

          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Rank</th>
                  <th style={thStyle}>Medication</th>
                  <th style={thStyle}>Prescriptions</th>
                  <th style={thStyle}>Patients</th>
                </tr>
              </thead>

              <tbody>
                {data.medications
                  .slice(0, 20)
                  .map((item, index) => (
                    <tr key={`${item.medication}-${index}`}>
                      <td style={tdStyle}>
                        <strong>{index + 1}</strong>
                      </td>

                      <td style={tdStyle}>
                        {item.medication}
                      </td>

                      <td style={tdStyle}>
                        <strong>{item.count}</strong>
                      </td>

                      <td style={tdStyle}>
                        {item.patients}
                      </td>
                    </tr>
                  ))}

                {data.medications.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        ...tdStyle,
                        textAlign: "center",
                      }}
                    >
                      No medication data for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* DOCTOR UTILISATION */}

        <section style={sectionStyle}>
          <h2 style={headingStyle}>
            Doctor Platform Utilisation
          </h2>

          <p style={descriptionStyle}>
            Doctors ranked by CareScriber usage during the selected
            month.
          </p>

          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Rank</th>
                  <th style={thStyle}>Doctor</th>
                  <th style={thStyle}>Consultations</th>
                  <th style={thStyle}>Patients</th>
                  <th style={thStyle}>Prescriptions</th>
                </tr>
              </thead>

              <tbody>
                {data.doctorUsage.map((doctor, index) => (
                  <tr key={`${doctor.doctor}-${index}`}>
                    <td style={tdStyle}>
                      {index + 1}
                    </td>

                    <td style={tdStyle}>
                      <strong>{doctor.doctor}</strong>
                    </td>

                    <td style={tdStyle}>
                      {doctor.consultations}
                    </td>

                    <td style={tdStyle}>
                      {doctor.patients}
                    </td>

                    <td style={tdStyle}>
                      {doctor.prescriptions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function GenderCard({
  label,
  count,
  percent,
}: {
  label: string;
  count: number;
  percent: number;
}) {
  return (
    <div
      style={{
        padding: 20,
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: "#64748b",
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginTop: 8,
        }}
      >
        <strong style={{ fontSize: 30 }}>
          {count}
        </strong>

        <span
          style={{
            color: "#0284c7",
            fontWeight: 800,
          }}
        >
          {percent}%
        </span>
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 25,
  marginTop: 24,
  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
};

const headingStyle: React.CSSProperties = {
  fontSize: 21,
  margin: 0,
  color: "#0f172a",
};

const descriptionStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 7,
  marginBottom: 20,
};

const tableWrapperStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 650,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  background: "#f1f5f9",
  padding: "13px 15px",
  fontSize: 13,
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 15px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 14,
};
