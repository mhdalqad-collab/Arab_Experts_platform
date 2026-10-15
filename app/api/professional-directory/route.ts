import { getRuntime } from "@/app/lib/runtime";
export const dynamic = "force-dynamic";

const kindByMembership: Record<string, string> = {
  expert: "expert",
  trainer: "trainer",
  consultant: "consultant",
  researcher: "researcher",
  center: "center",
};
const fieldMap: Record<string, Record<string, string[]>> = {
  expert: {
    title: ["expertise", "lastTitle"],
    main: ["domain"],
    sub: ["specialty", "subspecialty"],
    country: ["country"],
    city: ["city"],
    languages: ["languages", "languageRecords"],
  },
  trainer: {
    title: ["tlastTitle"],
    main: ["trainerDomain", "academy"],
    sub: ["trainerSpecialty"],
    country: ["tcountry"],
    city: ["tcity"],
    languages: ["tlangs"],
  },
  consultant: {
    title: ["clastTitle"],
    main: ["consultantDomain", "cdomain"],
    sub: ["consultantSpecialty"],
    country: ["ccountry"],
    city: ["ccity"],
    languages: ["clanguages"],
  },
  researcher: {
    title: ["rlastTitle", "rinst"],
    main: ["researchDomain"],
    sub: ["researchSpecialty"],
    country: ["rcountry"],
    city: ["rcity"],
    languages: ["rlanguages"],
  },
  center: {
    title: ["tradeName", "entityType"],
    main: ["centerDomain"],
    sub: ["centerSpecialty"],
    country: ["regCountry"],
    city: ["hq"],
    languages: ["centerLanguages"],
  },
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function parse(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}
function allowed(privacy: Record<string, unknown>, key: string) {
  return privacy[key] !== true && privacy[key] !== "private" &&
    privacy[key] !== "PRIVATE" && privacy[key] !== "مخفي";
}
function first(
  payload: Record<string, unknown>,
  privacy: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    if (!allowed(privacy, key)) continue;
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
function list(
  payload: Record<string, unknown>,
  privacy: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    if (!allowed(privacy, key)) continue;
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.map((item) =>
        typeof item === "string" ? item :
        item && typeof item === "object" && "language" in item
          ? String((item as { language?: unknown }).language ?? "") : "",
      ).filter(Boolean).slice(0, 7);
    }
  }
  return [];
}
function specialization(
  records: Record<string, unknown>,
  membershipCode: string,
) {
  const keys = {
    expert: ["specializationRecords"],
    trainer: ["trainerSpecializations"],
    consultant: ["consultantSpecializations"],
    researcher: ["researchSpecializations"],
    center: ["centerCourses"],
  }[membershipCode] ?? [];
  for (const key of keys) {
    const rows = records[key];
    if (!Array.isArray(rows) || !rows.length) continue;
    const row = rows[0] as Record<string, unknown>;
    const values = Object.entries(row);
    const main = values.find(([name]) => /Domain|domain/.test(name))?.[1];
    const sub = values.find(([name]) => /Specialty|specialty/.test(name))?.[1];
    return {
      main: typeof main === "string" ? main : "",
      sub: typeof sub === "string" ? sub : "",
    };
  }
  return { main: "", sub: "" };
}

export async function GET(request: Request) {
  const workers = getRuntime();
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const rows = await db.prepare(
    `SELECT p.party_id, p.party_type, p.display_name_ar, p.display_name_en,
            mp.membership_code, mp.payload_json, mp.privacy_json,
            mp.records_json, mp.updated_at,
            rs.composite_score AS reputation_score,
            rs.confidence_score AS reputation_confidence,
            rs.sample_count AS reputation_sample_count,
            (SELECT COUNT(*) FROM professional_documents d
              WHERE d.party_id = p.party_id AND d.status = 'ACTIVE'
                AND d.confidentiality = 'PUBLIC'
                AND d.verification_status = 'VERIFIED') evidence_count,
            (SELECT ROUND(AVG(v.confidence_score))
               FROM document_verifications v
               JOIN professional_documents d ON d.document_id = v.document_id
              WHERE d.party_id = p.party_id AND d.status = 'ACTIVE'
                AND d.confidentiality = 'PUBLIC' AND v.status = 'VERIFIED')
              confidence_score
       FROM membership_profiles mp
       JOIN parties p ON p.party_id = mp.party_id
       LEFT JOIN reputation_snapshots rs ON rs.party_id = p.party_id
      WHERE mp.lifecycle_status = 'approved'
        AND p.status = 'ACTIVE'
        AND mp.membership_code IN ('expert','trainer','consultant','researcher','center')
      ORDER BY p.display_name_ar
      LIMIT 250`,
  ).all<{
    party_id: string; party_type: string; display_name_ar: string;
    display_name_en: string | null; membership_code: string;
    payload_json: string; privacy_json: string; records_json: string;
    updated_at: string; evidence_count: number; confidence_score: number | null;
    reputation_score: number | null; reputation_confidence: number | null;
    reputation_sample_count: number | null;
  }>();

  const candidates = rows.results.map((row) => {
    const payload = parse(row.payload_json);
    const privacy = parse(row.privacy_json);
    const records = parse(row.records_json);
    const map = fieldMap[row.membership_code];
    const spec = specialization(records, row.membership_code);
    return {
      ref: `party:${row.party_id}:${kindByMembership[row.membership_code]}`,
      partyId: row.party_id,
      kind: kindByMembership[row.membership_code],
      name: row.display_name_ar,
      nameEn: row.display_name_en,
      title: first(payload, privacy, map.title),
      main: first(payload, privacy, map.main) || spec.main,
      sub: first(payload, privacy, map.sub) || spec.sub,
      country: first(payload, privacy, map.country),
      city: first(payload, privacy, map.city),
      langs: list(payload, privacy, map.languages),
      verified: true,
      evidenceCount: Number(row.evidence_count) || 0,
      confidenceScore: row.confidence_score,
      reputationScore: row.reputation_score,
      reputationConfidence: Number(row.reputation_confidence) || 0,
      reputationSampleCount: Number(row.reputation_sample_count) || 0,
      rating: row.reputation_score === null || !row.reputation_sample_count
        ? 0 : Math.round(row.reputation_score / 20 * 10) / 10,
      extra: `${Number(row.evidence_count) || 0} دليل عام متحقق`,
      updatedAt: row.updated_at,
    };
  }).filter((candidate) =>
    (!kind || candidate.kind === kind) &&
    (!q || [
      candidate.name, candidate.nameEn, candidate.title,
      candidate.main, candidate.sub, candidate.country,
    ].filter(Boolean).join(" ").toLowerCase().includes(q)),
  );
  return json({ candidates, total: candidates.length });
}
