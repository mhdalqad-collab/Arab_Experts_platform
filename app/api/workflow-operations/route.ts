import { getRuntime, type SqlDatabase } from "@/app/lib/runtime";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function platformAdminContext(db: SqlDatabase) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  const account = await db
    .prepare("SELECT account_id, email FROM accounts WHERE email = ?1")
    .bind(email)
    .first<{ account_id: string; email: string }>();
  if (!account) return null;

  const runtime = getRuntime();
  const bootstrap = String(runtime.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (bootstrap.includes(email)) {
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO account_roles (
           account_role_id, account_id, role_code, granted_by, granted_at, is_active
         ) VALUES (?1, ?2, 'PLATFORM_ADMIN', 'SYSTEM_BOOTSTRAP', ?3, 1)
         ON CONFLICT(account_id, role_code) DO UPDATE SET is_active = 1`,
      )
      .bind(`${account.account_id}:PLATFORM_ADMIN`, account.account_id, now)
      .run();
  }

  const role = await db
    .prepare(
      `SELECT role_code FROM account_roles
        WHERE account_id = ?1 AND role_code = 'PLATFORM_ADMIN'
          AND is_active = 1 LIMIT 1`,
    )
    .bind(account.account_id)
    .first<{ role_code: string }>();
  return role ? { account, user, role: role.role_code } : null;
}

export async function GET() {
  const runtime = getRuntime();
  const db = runtime.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const auth = await platformAdminContext(db);
  if (!auth) return json({ error: "PLATFORM_ADMIN_REQUIRED" }, 403);

  const environment = runtime.env as unknown as Record<string, unknown>;
  const adapterUrl = String(
    environment.POSTGRES_OPERATIONS_API_URL ?? "",
  ).trim();
  const adapterToken = String(
    environment.POSTGRES_OPERATIONS_API_TOKEN ?? "",
  ).trim();

  if (!adapterUrl) {
    return json({
      connection: {
        status: "NOT_CONFIGURED",
        label: "اتصال PostgreSQL التشغيلي غير مهيأ",
      },
      capabilities: {
        read: false,
        actions: false,
        stepUpReady: false,
      },
      baseline: {
        schemaVersion: "V110",
        migrations: 60,
        tables: 463,
        defaultEnforcementMode: "MONITOR_ONLY",
      },
      message:
        "اللوحة جاهزة، لكن بيانات التشغيل الحية لا تعرض قبل تهيئة محول PostgreSQL الآمن.",
      generatedAt: new Date().toISOString(),
    });
  }

  try {
    const response = await fetch(
      `${adapterUrl.replace(/\/$/, "")}/v1/workflow-operations/summary`,
      {
        headers: adapterToken
          ? { Authorization: `Bearer ${adapterToken}` }
          : {},
      },
    );
    if (!response.ok) {
      return json(
        {
          connection: {
            status: "DEGRADED",
            label: "المحول متاح لكن الاستجابة غير سليمة",
          },
          capabilities: { read: false, actions: false, stepUpReady: false },
          upstreamStatus: response.status,
          generatedAt: new Date().toISOString(),
        },
        503,
      );
    }
    const payload = await response.json();
    const adapterCapabilities =
      payload && typeof payload === "object" && "capabilities" in payload
        ? (payload.capabilities as Record<string, unknown>)
        : {};
    const actionsEnabled =
      String(environment.POSTGRES_OPERATIONS_ACTIONS_ENABLED ?? "").toLowerCase() === "true" &&
      adapterCapabilities.actions === true;
    const stepUpReady =
      String(environment.POSTGRES_OPERATIONS_STEP_UP_READY ?? "").toLowerCase() === "true" &&
      adapterCapabilities.stepUpReady === true;
    return json({
      connection: { status: "CONNECTED", label: "متصل ببيئة التشغيل" },
      capabilities: {
        read: true,
        actions: actionsEnabled && stepUpReady,
        stepUpReady,
      },
      data: payload,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return json(
      {
        connection: {
          status: "UNREACHABLE",
          label: "تعذر الوصول إلى محول PostgreSQL",
        },
        capabilities: { read: false, actions: false, stepUpReady: false },
        generatedAt: new Date().toISOString(),
      },
      503,
    );
  }
}

const allowedCommands = new Set([
  "EVALUATE_WINDOW", "PAUSE_ROLLOUT", "EMERGENCY_STOP", "REQUEST_PROMOTION",
  "APPROVE_OPERATION", "REJECT_OPERATION",
]);

export async function POST(request: Request) {
  const runtime = getRuntime();
  const db = runtime.env.DB;
  if (!db) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  const auth = await platformAdminContext(db);
  if (!auth) return json({ error: "PLATFORM_ADMIN_REQUIRED" }, 403);
  const env = runtime.env as unknown as Record<string, unknown>;
  const adapterUrl = String(env.POSTGRES_OPERATIONS_API_URL ?? "").trim();
  const adapterToken = String(env.POSTGRES_OPERATIONS_API_TOKEN ?? "").trim();
  if (!adapterUrl || !adapterToken) return json({ error: "OPERATIONS_ADAPTER_NOT_CONFIGURED" }, 503);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const command = String(body?.command ?? "");
  const reason = String(body?.reason ?? "").trim();
  const idempotencyKey = String(body?.idempotencyKey ?? "").trim();
  if (!allowedCommands.has(command) || reason.length < 8 || !idempotencyKey || idempotencyKey.length > 120) {
    return json({ error: "INVALID_OPERATION_COMMAND" }, 400);
  }
  const actionsEnabled = String(env.POSTGRES_OPERATIONS_ACTIONS_ENABLED ?? "").toLowerCase() === "true";
  const stepUpReady = String(env.POSTGRES_OPERATIONS_STEP_UP_READY ?? "").toLowerCase() === "true";
  if (!actionsEnabled || !stepUpReady) {
    return json({ error: "GOVERNED_ACTIONS_NOT_READY" }, 409);
  }
  const response = await fetch(`${adapterUrl.replace(/\/$/, "")}/v1/workflow-operations/commands`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adapterToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, command, reason, idempotencyKey, operatorEmail: auth.account.email }),
  });
  const payload = await response.json().catch(() => ({ error: "INVALID_ADAPTER_RESPONSE" }));
  return json(payload, response.status);
}
