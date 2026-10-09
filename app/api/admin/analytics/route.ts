import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reject(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowed = (process.env.CARESCRIBER_ADMIN_EMAILS || "")
    .split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!url || !anon || !service || allowed.length === 0) {
    return reject(503, "Analytics not configured. Set server-side administrator emails and Supabase keys.");
  }
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reject(401, "Authentication required");
  const authClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return reject(401, "Invalid session");
  if (!user.email || !allowed.includes(user.email.toLowerCase())) return reject(403, "Administrator access required");

  const db = createClient(url, service, { auth: { persistSession: false } });
  const [consultations, prescriptions] = await Promise.all([
    db.from("consultations").select("*", { count: "exact", head: true }),
    db.from("prescriptions").select("*", { count: "exact", head: true }),
  ]);
  if (consultations.error || prescriptions.error) {
    console.error("Analytics count failure", consultations.error, prescriptions.error);
    return reject(500, "Unable to load analytics counts");
  }
  const diagnosis = new Map<string, { code: string; description: string; count: number }>();
  const medication = new Map<string, { name: string; count: number }>();
  // Supabase REST defaults to a 1000-row limit; paginate to include all prescriptions.
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from("prescriptions").select("items").range(offset, offset + pageSize - 1);
    if (error) {
      console.error("Analytics prescription query failure", error);
      return reject(500, "Unable to load prescription analytics");
    }
    for (const prescription of data || []) {
      const items = Array.isArray(prescription.items) ? prescription.items : [];
      for (const raw of items) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const item = raw as Record<string, unknown>;
        const code = String(item.icdCode || "").trim();
        const description = String(item.icdDescription || "").trim();
        if (code) {
          const key = code.toUpperCase();
          const old = diagnosis.get(key);
          diagnosis.set(key, { code, description: old?.description || description, count: (old?.count || 0) + 1 });
        }
        const value = item.medicine;
        let name = "";
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const obj = parsed as Record<string, unknown>;
              name = String(obj.brand || obj.name || obj.generic || obj.description || "").trim();
            } else name = value.trim();
          } catch { name = value.trim(); }
        } else if (value && typeof value === "object" && !Array.isArray(value)) {
          const obj = value as Record<string, unknown>;
          name = String(obj.brand || obj.name || obj.generic || obj.description || "").trim();
        }
        if (!name) name = String(item.medicineQuery || "").trim();
        if (name) {
          const key = name.toLowerCase();
          const old = medication.get(key);
          medication.set(key, { name: old?.name || name, count: (old?.count || 0) + 1 });
        }
      }
    }
    if (!data || data.length < pageSize) break;
  }
  return NextResponse.json({
    consultations: consultations.count ?? 0,
    prescriptions: prescriptions.count ?? 0,
    topDiagnoses: [...diagnosis.values()].sort((a,b) => b.count-a.count).slice(0,20),
    topMedications: [...medication.values()].sort((a,b) => b.count-a.count).slice(0,20),
    note: "Diagnosis counts are per prescription item, not unique patients or consultations.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
