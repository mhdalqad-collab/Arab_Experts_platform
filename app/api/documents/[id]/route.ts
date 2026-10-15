import { getChatGPTUser } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: "AUTHENTICATION_REQUIRED" }, 401);
  const workers = await import("cloudflare:workers");
  const db = workers.env.DB;
  const bucket = workers.env.BUCKET;
  if (!db || !bucket) return json({ error: "STORAGE_UNAVAILABLE" }, 503);
  const params = await context.params;
  const documentId = params.id;
  const account = await db
    .prepare("SELECT account_id FROM accounts WHERE email = ?1")
    .bind(user.email.trim().toLowerCase())
    .first<{ account_id: string }>();
  if (!account) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);
  const row = await db
    .prepare(
      `SELECT d.party_id, v.storage_object_key,
              v.original_file_name, v.media_type
         FROM professional_documents d
         JOIN professional_document_versions v
           ON v.document_id = d.document_id
          AND v.version_number = d.current_version
        WHERE d.document_id = ?1 AND d.status = 'ACTIVE'`,
    )
    .bind(documentId)
    .first<{
      party_id: string;
      storage_object_key: string;
      original_file_name: string;
      media_type: string;
    }>();
  if (!row) return json({ error: "DOCUMENT_NOT_FOUND" }, 404);
  const access = await db
    .prepare(
      `SELECT 1
         WHERE EXISTS (
           SELECT 1 FROM account_party_links
            WHERE account_id = ?1 AND party_id = ?2 AND status = 'ACTIVE'
         ) OR EXISTS (
           SELECT 1 FROM account_roles
            WHERE account_id = ?1 AND is_active = 1
              AND role_code IN ('EVIDENCE_REVIEWER', 'PLATFORM_ADMIN')
         ) OR EXISTS (
           SELECT 1
             FROM project_deliverable_documents pdd
             JOIN service_projects sp ON sp.project_id = pdd.project_id
             JOIN account_party_links apl ON apl.account_id = ?1
              AND apl.status = 'ACTIVE'
              AND apl.party_id IN (sp.client_party_id, sp.provider_party_id)
            WHERE pdd.document_id = ?3
         )`,
    )
    .bind(account.account_id, row.party_id, documentId)
    .first();
  if (!access) return json({ error: "DOCUMENT_ACCESS_REQUIRED" }, 403);
  const object = await bucket.get(row.storage_object_key);
  if (!object) return json({ error: "DOCUMENT_BYTES_NOT_FOUND" }, 404);
  const encodedName = encodeURIComponent(row.original_file_name);
  return new Response(object.body, {
    headers: {
      "Content-Type": row.media_type,
      "Content-Length": String(object.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
