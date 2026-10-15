import { getRuntime } from "@/app/lib/runtime";
export const dynamic = "force-dynamic";

const approvedStates = new Set(["approved", "active", "verified"]);
const membershipLabels: Record<string, string> = {
  expert: "خبير",
  trainer: "مدرب",
  consultant: "مستشار",
  researcher: "باحث / أكاديمي",
  center: "مركز تدريب",
  client: "عميل",
};
const evidenceLabels: Record<string, string> = {
  CV: "سيرة مهنية",
  ACADEMIC_QUALIFICATION: "مؤهل علمي",
  PROFESSIONAL_CERTIFICATE: "شهادة مهنية",
  LICENSE: "ترخيص",
  PROJECT_EVIDENCE: "دليل مشروع",
  TRAINING_EVIDENCE: "دليل تدريبي",
  PUBLICATION: "منشور",
  ORGANIZATION_DOCUMENT: "وثيقة مؤسسية",
  OTHER: "دليل آخر",
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": status === 200 ? "public, max-age=60, s-maxage=300" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function parseObject(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isPublic(value: unknown) {
  return (
    value === true ||
    value === "public" ||
    value === "PUBLIC" ||
    value === "ظاهر" ||
    value === "نعم"
  );
}

function publicPayload(
  payload: Record<string, unknown>,
  privacy: Record<string, unknown>,
) {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (isPublic(privacy[key]) && value !== "" && value !== null) output[key] = value;
  }
  return output;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ partyId: string }> },
) {
  const { partyId } = await context.params;
  if (!/^[0-9a-z-]{8,80}$/i.test(partyId)) {
    return json({ error: "INVALID_PARTY_ID" }, 400);
  }
  const workers = getRuntime();
  const db = workers.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);

  const party = await db
    .prepare(
      `SELECT party_id, party_type, display_name_ar, display_name_en, updated_at
         FROM parties
        WHERE party_id = ?1 AND status = 'ACTIVE'`,
    )
    .bind(partyId)
    .first<{
      party_id: string;
      party_type: string;
      display_name_ar: string;
      display_name_en: string | null;
      updated_at: string;
    }>();
  if (!party) return json({ error: "PUBLIC_PROFILE_NOT_FOUND" }, 404);

  const profileRows = await db
    .prepare(
      `SELECT pm.membership_code, pm.lifecycle_status,
              mp.payload_json, mp.privacy_json, mp.updated_at
         FROM party_memberships pm
         LEFT JOIN membership_profiles mp
           ON mp.party_id = pm.party_id
          AND mp.membership_code = pm.membership_code
        WHERE pm.party_id = ?1 AND pm.is_active = 1`,
    )
    .bind(partyId)
    .all<{
      membership_code: string;
      lifecycle_status: string;
      payload_json: string | null;
      privacy_json: string | null;
      updated_at: string | null;
    }>();

  const memberships = profileRows.results
    .filter((row) => approvedStates.has(row.lifecycle_status.toLowerCase()))
    .map((row) => {
      const payload = parseObject(row.payload_json);
      const privacy = parseObject(row.privacy_json);
      return {
        code: row.membership_code,
        label: membershipLabels[row.membership_code] ?? row.membership_code,
        fields: publicPayload(payload, privacy),
        updatedAt: row.updated_at,
      };
    });
  if (!memberships.length) {
    return json({ error: "PUBLIC_PROFILE_NOT_PUBLISHED" }, 404);
  }

  const approvedCodes = new Set(memberships.map((item) => item.code));
  const evidenceRows = await db
    .prepare(
      `SELECT d.document_id, d.membership_code, d.category_code, d.title,
              d.updated_at, v.confidence_score, v.decided_at
         FROM professional_documents d
         JOIN document_verifications v
           ON v.verification_id = (
             SELECT v2.verification_id
               FROM document_verifications v2
              WHERE v2.document_id = d.document_id
                AND v2.status = 'VERIFIED'
              ORDER BY v2.decided_at DESC
              LIMIT 1
           )
        WHERE d.party_id = ?1
          AND d.status = 'ACTIVE'
          AND d.confidentiality = 'PUBLIC'
          AND d.verification_status = 'VERIFIED'
        ORDER BY v.confidence_score DESC, v.decided_at DESC`,
    )
    .bind(partyId)
    .all<{
      document_id: string;
      membership_code: string | null;
      category_code: string;
      title: string;
      updated_at: string;
      confidence_score: number | null;
      decided_at: string | null;
    }>();

  const evidence = evidenceRows.results
    .filter(
      (item) => !item.membership_code || approvedCodes.has(item.membership_code),
    )
    .map((item) => ({
      id: item.document_id,
      title: item.title,
      category: item.category_code,
      categoryLabel: evidenceLabels[item.category_code] ?? "دليل مهني",
      membershipCode: item.membership_code,
      verificationStatus: "VERIFIED",
      confidenceScore: item.confidence_score,
      verifiedAt: item.decided_at,
      updatedAt: item.updated_at,
    }));

  const contacts = await db
    .prepare(
      `SELECT c.contact_type, c.contact_value
         FROM party_contacts c
         JOIN party_privacy_rules r
           ON r.party_id = c.party_id
          AND r.field_key = 'contact:' || c.contact_type
        WHERE c.party_id = ?1
          AND c.visibility = 'PUBLIC'
          AND r.visibility = 'PUBLIC'
          AND r.consent_granted = 1
        ORDER BY c.is_primary DESC, c.contact_type`,
    )
    .bind(partyId)
    .all<{ contact_type: string; contact_value: string }>();

  const scored = evidence
    .map((item) => item.confidenceScore)
    .filter((score): score is number => Number.isInteger(score));
  const confidence =
    scored.length > 0
      ? Math.round(scored.reduce((total, score) => total + score, 0) / scored.length)
      : null;
  const reputation = await db.prepare(
    `SELECT composite_score, confidence_score, sample_count,
            dimensions_json, methodology_version, generated_at
       FROM reputation_snapshots WHERE party_id = ?1`,
  ).bind(partyId).first<{
    composite_score: number; confidence_score: number; sample_count: number;
    dimensions_json: string; methodology_version: string; generated_at: string;
  }>();

  return json({
    profile: {
      partyId: party.party_id,
      partyType: party.party_type,
      displayNameAr: party.display_name_ar,
      displayNameEn: party.display_name_en,
      updatedAt: party.updated_at,
      memberships,
      contacts: contacts.results.map((item) => ({
        type: item.contact_type,
        value: item.contact_value,
      })),
      trust: {
        verifiedEvidenceCount: evidence.length,
        confidenceScore: confidence,
        calculation: "AVERAGE_VERIFIED_PUBLIC_EVIDENCE",
      },
      reputation: reputation ? {
        score: reputation.composite_score,
        rating: Math.round(reputation.composite_score / 2) / 10,
        confidence: reputation.confidence_score,
        sampleCount: reputation.sample_count,
        dimensions: parseObject(reputation.dimensions_json),
        methodologyVersion: reputation.methodology_version,
        generatedAt: reputation.generated_at,
      } : null,
      evidence,
    },
  });
}
