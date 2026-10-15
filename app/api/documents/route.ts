import { getRuntime, type SqlDatabase } from "@/app/lib/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const categories = new Set([
  "CV",
  "ACADEMIC_QUALIFICATION",
  "PROFESSIONAL_CERTIFICATE",
  "LICENSE",
  "PROJECT_EVIDENCE",
  "TRAINING_EVIDENCE",
  "PUBLICATION",
  "ORGANIZATION_DOCUMENT",
  "PROJECT_DELIVERABLE",
  "OTHER",
]);
const confidentialityLevels = new Set([
  "PUBLIC",
  "MEMBERS_ONLY",
  "PLATFORM_ONLY",
  "PRIVATE",
]);
const membershipCodes = new Set([
  "expert",
  "trainer",
  "consultant",
  "researcher",
  "center",
  "client",
]);
const allowedMediaTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const maxFileSize = 10 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function runtime() {
  const workers = getRuntime();
  return { db: workers.env.DB, bucket: workers.env.BUCKET };
}

async function context(db: SqlDatabase) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  return db
    .prepare(
      `SELECT a.account_id, a.email, l.party_id, l.relationship_code
         FROM accounts a
         JOIN account_party_links l ON l.account_id = a.account_id
        WHERE a.email = ?1 AND l.status = 'ACTIVE'
        ORDER BY l.is_primary DESC, l.created_at
        LIMIT 1`,
    )
    .bind(email)
    .first<{
      account_id: string;
      email: string;
      party_id: string;
      relationship_code: string;
    }>();
}

function cleanFileName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

async function sha256(buffer: ArrayBuffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET() {
  const { db } = await runtime();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const owner = await context(db);
  if (!owner) return json({ error: "PARTY_CONTEXT_REQUIRED" }, 404);
  const documents = await db
    .prepare(
      `SELECT d.document_id, d.membership_code, d.category_code, d.title,
              d.confidentiality, d.verification_status, d.current_version,
              d.status, d.created_at, d.updated_at,
              v.original_file_name, v.media_type, v.size_bytes,
              v.sha256_hash, v.scan_status
         FROM professional_documents d
         JOIN professional_document_versions v
           ON v.document_id = d.document_id
          AND v.version_number = d.current_version
        WHERE d.party_id = ?1 AND d.status = 'ACTIVE'
        ORDER BY d.updated_at DESC`,
    )
    .bind(owner.party_id)
    .all();
  return json({ partyId: owner.party_id, documents: documents.results });
}

export async function POST(request: Request) {
  const { db, bucket } = await runtime();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  if (!bucket) return json({ error: "OBJECT_STORAGE_UNAVAILABLE" }, 503);
  const owner = await context(db);
  if (!owner) return json({ error: "PARTY_CONTEXT_REQUIRED" }, 404);

  const form = await request.formData();
  const category = String(form.get("category") ?? "");
  const confidentiality = String(form.get("confidentiality") ?? "");
  const membershipCode = String(form.get("membershipCode") ?? "");
  const projectId = String(form.get("projectId") ?? "").slice(0, 80);
  const deliverableId = String(form.get("deliverableId") ?? "").slice(0, 80);
  if (!categories.has(category)) return json({ error: "INVALID_CATEGORY" }, 422);
  if (!confidentialityLevels.has(confidentiality)) {
    return json({ error: "INVALID_CONFIDENTIALITY" }, 422);
  }
  if (membershipCode && !membershipCodes.has(membershipCode)) {
    return json({ error: "INVALID_MEMBERSHIP_CODE" }, 422);
  }
  if (membershipCode) {
    const membership = await db
      .prepare(
        `SELECT 1 FROM party_memberships
          WHERE party_id = ?1 AND membership_code = ?2 AND is_active = 1`,
      )
      .bind(owner.party_id, membershipCode)
      .first();
    if (!membership) return json({ error: "PARTY_MEMBERSHIP_REQUIRED" }, 403);
  }
  let deliverable: { deliverable_id: string; revision: number } | null = null;
  if (projectId || deliverableId) {
    if (!projectId || !deliverableId || category !== "PROJECT_DELIVERABLE") {
      return json({ error: "PROJECT_DELIVERABLE_CONTEXT_INVALID" }, 422);
    }
    deliverable = await db.prepare(
      `SELECT pd.deliverable_id, pd.revision
         FROM project_deliverables pd
         JOIN service_projects sp ON sp.project_id = pd.project_id
        WHERE pd.deliverable_id = ?1 AND pd.project_id = ?2
          AND sp.status = 'ACTIVE' AND pd.status IN ('PLANNED','REJECTED')
          AND sp.provider_party_id = ?3
          AND EXISTS (
            SELECT 1 FROM account_party_links l
             WHERE l.account_id = ?4 AND l.party_id = sp.provider_party_id
               AND l.status = 'ACTIVE'
          )`,
    ).bind(deliverableId, projectId, owner.party_id, owner.account_id)
      .first<{ deliverable_id: string; revision: number }>() ?? null;
    if (!deliverable) return json({ error: "DELIVERABLE_UPLOAD_NOT_ALLOWED" }, 403);
  }

  const files = form
    .getAll("files")
    .filter((item): item is File => item instanceof File)
    .slice(0, 5);
  if (!files.length) return json({ error: "FILE_REQUIRED" }, 422);

  const uploaded: Array<Record<string, unknown>> = [];
  const rejected: Array<Record<string, unknown>> = [];
  for (const file of files) {
    if (!allowedMediaTypes.has(file.type)) {
      rejected.push({ fileName: file.name, error: "UNSUPPORTED_MEDIA_TYPE" });
      continue;
    }
    if (file.size <= 0 || file.size > maxFileSize) {
      rejected.push({ fileName: file.name, error: "INVALID_FILE_SIZE" });
      continue;
    }
    const bytes = await file.arrayBuffer();
    const hash = await sha256(bytes);
    const duplicate = await db
      .prepare(
        `SELECT d.document_id
           FROM professional_documents d
           JOIN professional_document_versions v ON v.document_id = d.document_id
          WHERE d.party_id = ?1 AND v.sha256_hash = ?2 AND d.status = 'ACTIVE'
          LIMIT 1`,
      )
      .bind(owner.party_id, hash)
      .first<{ document_id: string }>();
    if (duplicate) {
      rejected.push({
        fileName: file.name,
        error: "DUPLICATE_DOCUMENT",
        existingDocumentId: duplicate.document_id,
      });
      continue;
    }

    const documentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const safeName = cleanFileName(file.name) || "document";
    const storageKey = `parties/${owner.party_id}/documents/${documentId}/v1/${safeName}`;
    const now = new Date().toISOString();
    await bucket.put(storageKey, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        documentId,
        partyId: owner.party_id,
        sha256: hash,
      },
    });
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO professional_documents (
               document_id, party_id, membership_code, category_code, title,
               confidentiality, verification_status, current_version, status,
               created_by_account_id, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'NOT_SUBMITTED',
                       1, 'ACTIVE', ?7, ?8, ?8)`,
          )
          .bind(
            documentId,
            owner.party_id,
            membershipCode || null,
            category,
            safeName,
            confidentiality,
            owner.account_id,
            now,
          ),
        ...(deliverable ? [db.prepare(
          `INSERT INTO project_deliverable_documents (
             deliverable_document_id, project_id, deliverable_id, document_id,
             submission_revision, linked_by_account_id, linked_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        ).bind(
          crypto.randomUUID(), projectId, deliverableId, documentId,
          deliverable.revision, owner.account_id, now,
        )] : []),
        db
          .prepare(
            `INSERT INTO professional_document_versions (
               document_version_id, document_id, version_number,
               storage_object_key, original_file_name, media_type, size_bytes,
               sha256_hash, scan_status, uploaded_by_account_id, created_at
             ) VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6, ?7,
                       'PENDING', ?8, ?9)`,
          )
          .bind(
            versionId,
            documentId,
            storageKey,
            safeName,
            file.type,
            file.size,
            hash,
            owner.account_id,
            now,
          ),
        db
          .prepare(
            `INSERT INTO account_audit_events (
               event_id, account_id, event_type, actor_email,
               payload_json, occurred_at
             ) VALUES (?1, ?2, 'PROFESSIONAL_DOCUMENT_UPLOADED', ?3, ?4, ?5)`,
          )
          .bind(
            crypto.randomUUID(),
            owner.account_id,
            owner.email,
            JSON.stringify({
              documentId,
              partyId: owner.party_id,
              membershipCode: membershipCode || null,
              category,
              confidentiality,
              sizeBytes: file.size,
              sha256: hash,
              projectId: projectId || null,
              deliverableId: deliverableId || null,
            }),
            now,
          ),
      ]);
      uploaded.push({
        documentId, fileName: safeName, hash, sizeBytes: file.size,
        projectId: projectId || null, deliverableId: deliverableId || null,
      });
    } catch {
      await bucket.delete(storageKey);
      rejected.push({ fileName: file.name, error: "METADATA_SAVE_FAILED" });
    }
  }
  return json({ uploaded, rejected }, uploaded.length ? 201 : 422);
}

export async function PATCH(request: Request) {
  const { db } = await runtime();
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const owner = await context(db);
  if (!owner) return json({ error: "PARTY_CONTEXT_REQUIRED" }, 404);
  let body: {
    documentId?: unknown;
    action?: unknown;
    confidentiality?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  const documentId =
    typeof body.documentId === "string" ? body.documentId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!documentId) return json({ error: "DOCUMENT_ID_REQUIRED" }, 422);
  const document = await db
    .prepare(
      `SELECT document_id, verification_status
         FROM professional_documents
        WHERE document_id = ?1 AND party_id = ?2 AND status = 'ACTIVE'`,
    )
    .bind(documentId, owner.party_id)
    .first<{ document_id: string; verification_status: string }>();
  if (!document) return json({ error: "DOCUMENT_NOT_FOUND" }, 404);
  const now = new Date().toISOString();

  if (action === "UPDATE_CONFIDENTIALITY") {
    const confidentiality =
      typeof body.confidentiality === "string" &&
      confidentialityLevels.has(body.confidentiality)
        ? body.confidentiality
        : null;
    if (!confidentiality) return json({ error: "INVALID_CONFIDENTIALITY" }, 422);
    await db
      .prepare(
        `UPDATE professional_documents
            SET confidentiality = ?2, updated_at = ?3
          WHERE document_id = ?1`,
      )
      .bind(documentId, confidentiality, now)
      .run();
    return json({ updated: true, confidentiality });
  }

  if (action === "SUBMIT_VERIFICATION") {
    if (document.verification_status === "PENDING") {
      return json({ error: "VERIFICATION_ALREADY_PENDING" }, 409);
    }
    const verificationId = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `UPDATE professional_documents
              SET verification_status = 'PENDING', updated_at = ?2
            WHERE document_id = ?1`,
        )
        .bind(documentId, now),
      db
        .prepare(
          `INSERT INTO document_verifications (
             verification_id, document_id, status,
             submitted_by_account_id, submitted_at
           ) VALUES (?1, ?2, 'PENDING', ?3, ?4)`,
        )
        .bind(verificationId, documentId, owner.account_id, now),
    ]);
    return json({ verificationId, status: "PENDING" });
  }

  if (action === "ARCHIVE") {
    await db
      .prepare(
        `UPDATE professional_documents
            SET status = 'ARCHIVED', archived_at = ?2, updated_at = ?2
          WHERE document_id = ?1`,
      )
      .bind(documentId, now)
      .run();
    return json({ archived: true });
  }
  return json({ error: "UNSUPPORTED_ACTION" }, 422);
}
