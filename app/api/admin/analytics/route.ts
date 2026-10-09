import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Period = "week" | "month" | "last_month" | "quarter" | "last_quarter" | "ytd" | "last_year";
const validPeriods: Period[] = ["week", "month", "last_month", "quarter", "last_quarter", "ytd", "last_year"];

function reply(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}
function saToday() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value || 0);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}
function addDays(d: Date, days: number) { const copy = new Date(d); copy.setUTCDate(copy.getUTCDate() + days); return copy; }
function utcDate(y: number, m: number, d = 1) { return new Date(Date.UTC(y, m, d)); }
function dateLabel(d: Date) { return d.toISOString().slice(0, 10); }
function rangeFor(period: Period) {
  const today = saToday(), y = today.getUTCFullYear(), m = today.getUTCMonth();
  const tomorrow = addDays(today, 1);
  let start: Date, end: Date;
  switch (period) {
    case "week": { const weekday = (today.getUTCDay() + 6) % 7; start = addDays(today, -weekday); end = tomorrow; break; }
    case "month": start = utcDate(y, m); end = tomorrow; break;
    case "last_month": start = utcDate(y, m - 1); end = utcDate(y, m); break;
    case "quarter": start = utcDate(y, Math.floor(m / 3) * 3); end = tomorrow; break;
    case "last_quarter": start = utcDate(y, Math.floor(m / 3) * 3 - 3); end = utcDate(y, Math.floor(m / 3) * 3); break;
    case "ytd": start = utcDate(y, 0); end = tomorrow; break;
    case "last_year": start = utcDate(y - 1, 0); end = utcDate(y, 0); break;
  }
  // Calendar boundaries are South Africa time (UTC+02:00), not UTC midnight.
  const asSA = (d: Date) => `${dateLabel(d)}T00:00:00+02:00`;
  return { start: asSA(start), endExclusive: asSA(end), startDay: dateLabel(start), endDay: dateLabel(addDays(end, -1)) };
}
function medicationName(value: unknown, fallback: unknown) {
  let obj: unknown = value;
  if (typeof obj === "string") {
    try {
  obj = JSON.parse(obj);
} catch {
  return String(obj ?? "").trim() || String(fallback ?? "").trim();
}
  }
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const m = obj as Record<string, unknown>;
    return String(m.brand || m.name || m.generic || m.description || fallback || "").trim();
  }
  return String(fallback || "").trim();
}

export async function GET(req: NextRequest) {
  const periodParam = new URL(req.url).searchParams.get("period") || "month";
  if (!validPeriods.includes(periodParam as Period)) return reply(400, "Invalid reporting period");
  const period = periodParam as Period;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowed = (process.env.CARESCRIBER_ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!url || !anon || !service || !allowed.length) return reply(503, "Analytics configuration missing");
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply(401, "Please sign in");
  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return reply(401, "Session expired. Sign in again.");
  if (!user.email || !allowed.includes(user.email.toLowerCase())) return reply(403, "Administrator access required");

  const db = createClient(url, service, { auth: { persistSession: false } });
  const dates = rangeFor(period);
  const filtered = (table: "consultations" | "prescriptions") => db.from(table).select("*", { count: "exact", head: true }).gte("created_at", dates.start).lt("created_at", dates.endExclusive);
  const [consultations, prescriptions] = await Promise.all([filtered("consultations"), filtered("prescriptions")]);
  if (consultations.error || prescriptions.error) {
    console.error("Analytics count error", consultations.error, prescriptions.error);
    return reply(500, "Unable to count records. Confirm both tables have a created_at timestamp.");
  }
  const diagnoses = new Map<string, { code: string; description: string; count: number }>();
  const medications = new Map<string, { name: string; count: number }>();
  const daily = new Map<string, { day: string; consultations: number; prescriptions: number }>();
  const saDay = (timestamp: string) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp));
    const get = (type: string) => parts.find(p => p.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  };
  function bump(timestamp: string, type: "consultations" | "prescriptions") {
    const day = saDay(timestamp);
    const row = daily.get(day) || { day, consultations: 0, prescriptions: 0 };
    row[type]++;
    daily.set(day, row);
  }
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from("consultations").select("created_at").gte("created_at", dates.start).lt("created_at", dates.endExclusive).order("created_at", { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) { console.error(error); return reply(500, "Unable to retrieve consultation timeline"); }
    for (const row of data || []) if (row.created_at) bump(row.created_at, "consultations");
    if (!data || data.length < pageSize) break;
  }
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from("prescriptions").select("created_at,items").gte("created_at", dates.start).lt("created_at", dates.endExclusive).order("created_at", { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) { console.error(error); return reply(500, "Unable to retrieve prescription analytics"); }
    for (const row of data || []) {
      if (row.created_at) bump(row.created_at, "prescriptions");
      for (const raw of Array.isArray(row.items) ? row.items : []) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const item = raw as Record<string, unknown>;
        const code = String(item.icdCode || "").trim().toUpperCase();
        const description = String(item.icdDescription || "").trim();
        if (code) {
          const prev = diagnoses.get(code);
          diagnoses.set(code, { code, description: prev?.description || description, count: (prev?.count || 0) + 1 });
        }
        const name = medicationName(item.medicine, item.medicineQuery);
        if (name) {
          const key = name.toLowerCase();
          const prev = medications.get(key);
          medications.set(key, { name: prev?.name || name, count: (prev?.count || 0) + 1 });
        }
      }
    }
    if (!data || data.length < pageSize) break;
  }
  return NextResponse.json({
    period, range: { start: dates.startDay, end: dates.endDay },
    consultations: consultations.count ?? 0, prescriptions: prescriptions.count ?? 0,
    topDiagnoses: [...diagnoses.values()].sort((a, b) => b.count - a.count).slice(0, 20),
    topMedications: [...medications.values()].sort((a, b) => b.count - a.count).slice(0, 20),
    timeline: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
    note: "Diagnosis and medication counts are prescription-item occurrences, not unique patients. Dates use Africa/Johannesburg time.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
