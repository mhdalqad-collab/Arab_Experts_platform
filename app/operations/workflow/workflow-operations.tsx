"use client";

import { useCallback, useEffect, useState } from "react";

type Summary = {
  connection?: { status?: string; label?: string };
  capabilities?: { read?: boolean; actions?: boolean; stepUpReady?: boolean };
  baseline?: {
    schemaVersion?: string;
    migrations?: number;
    tables?: number;
    defaultEnforcementMode?: string;
  };
  data?: {
    readiness?: {
      code?: string;
      attempts?: number;
      warningRate?: number;
      assessedAt?: string;
    };
    rollout?: {
      planId?: string;
      planCode?: string;
      status?: string;
      percentage?: number;
      emergencyStopActive?: boolean;
    };
    window?: {
      number?: number;
      attempts?: number;
      blockRate?: number;
      errorRate?: number;
      p95LatencyMs?: number;
    };
    recommendation?: { code?: string; reasons?: string[] };
    outbox?: { unpublished?: number; deadLetters?: number };
    pendingApprovals?: Array<{ approvalRequestId?: string; action?: string; risk?: string; expiresAt?: string }>;
    incidents?: Array<{ incidentId?: string; code?: string; severity?: string; status?: string; title?: string; acknowledgementOverdue?: boolean }>;
    reliability?: { availability?: number; successRate?: number; p95LatencyMs?: number; mttaMinutes?: number; mttrHours?: number; budgetStatus?: string };
  };
  message?: string;
  generatedAt?: string;
  error?: string;
};

const labels: Record<string, string> = {
  NOT_CONFIGURED: "غير مهيأ",
  CONNECTED: "متصل",
  DEGRADED: "استجابة متدهورة",
  UNREACHABLE: "غير متاح",
  MONITOR_ONLY: "المراقبة فقط",
  READY_FOR_REVIEW: "جاهز للمراجعة",
  INSUFFICIENT_DATA: "بيانات غير كافية",
  NOT_READY: "غير جاهز",
  CONTINUE_MONITORING: "استمرار المراقبة",
  PROMOTE_REVIEW: "مراجعة الترقية",
  PAUSE_REQUIRED: "إيقاف مطلوب",
  ROLLBACK_REVIEW: "مراجعة الرجوع",
};

function display(value: unknown, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  return `${value}${suffix}`;
}

function percent(value: unknown) {
  return typeof value === "number" ? `${(value * 100).toFixed(2)}%` : "—";
}

export default function WorkflowOperations({
  operatorEmail,
}: {
  operatorEmail: string;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("جارٍ تحميل حالة التشغيل…");
  const [command, setCommand] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [targetPercentage, setTargetPercentage] = useState("100");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/workflow-operations", {
        cache: "no-store",
      });
      const result = (await response.json()) as Summary;
      setSummary(result);
      if (response.status === 403) {
        setNotice("هذه اللوحة مخصصة لمدير المنصة.");
      } else if (!response.ok && result.connection?.status !== "NOT_CONFIGURED") {
        setNotice("تعذر تحميل بيانات التشغيل الحية.");
      } else {
        setNotice(result.message ?? "");
      }
    } catch {
      setNotice("تعذر الاتصال بخدمة لوحة التشغيل.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const data = summary?.data;
  const baseline = summary?.baseline;
  const connected = summary?.connection?.status === "CONNECTED";
  const actionsReady = connected && summary?.capabilities?.actions === true && summary?.capabilities?.stepUpReady === true;
  const status = summary?.connection?.status ?? "UNREACHABLE";

  const runCommand = async () => {
    if (!command || !actionsReady || !data?.rollout?.planId || reason.trim().length < 8) return;
    setBusy(true);
    setNotice("جارٍ إرسال الأمر المحكوم…");
    try {
      const response = await fetch("/api/workflow-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          rolloutPlanId: data.rollout.planId,
          reason: reason.trim(),
          targetPercentage: command === "REQUEST_PROMOTION" ? Number(targetPercentage) : undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "COMMAND_FAILED");
      setNotice(result.status === "PENDING_REVIEW" ? "أُرسل طلب الترقية للمراجعة البشرية." : "نُفذ الأمر وسُجل في سجل التدقيق.");
      setCommand(null);
      setReason("");
      await load();
    } catch {
      setNotice("تعذر تنفيذ الأمر. لم تتغير حالة التشغيل.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ops-content">
      <div className="ops-toolbar">
        <div>
          <small>المشغل الحالي</small>
          <strong>{operatorEmail}</strong>
        </div>
        <span className={`connection ${status.toLowerCase()}`}>
          <i aria-hidden="true" />
          {summary?.connection?.label ?? labels[status]}
        </span>
        <button type="button" onClick={() => void load()} disabled={busy}>
          {busy ? "جارٍ التحديث…" : "تحديث البيانات"}
        </button>
      </div>

      {notice && <div className="ops-notice">{notice}</div>}

      <div className="ops-kpis" aria-label="مؤشرات التشغيل">
        <article>
          <span>جاهزية الإنفاذ</span>
          <b>{labels[data?.readiness?.code ?? ""] ?? display(data?.readiness?.code)}</b>
          <small>{display(data?.readiness?.attempts)} محاولة مقاسة</small>
        </article>
        <article>
          <span>خطة التفعيل</span>
          <b>{labels[data?.rollout?.status ?? ""] ?? display(data?.rollout?.status)}</b>
          <small>{display(data?.rollout?.percentage, "%")} من القضايا</small>
        </article>
        <article>
          <span>توصية النافذة</span>
          <b>{labels[data?.recommendation?.code ?? ""] ?? display(data?.recommendation?.code)}</b>
          <small>غير ملزمة · القرار بشري</small>
        </article>
        <article>
          <span>سلامة Outbox</span>
          <b>{display(data?.outbox?.deadLetters)}</b>
          <small>Dead Letter · {display(data?.outbox?.unpublished)} غير منشور</small>
        </article>
      </div>

      <div className="ops-grid">
        <article className="ops-panel">
          <header>
            <div>
              <span>نافذة Canary الحالية</span>
              <h2>{data?.rollout?.planCode ?? "لا توجد خطة تشغيلية معروضة"}</h2>
            </div>
            <span className="window-number">
              نافذة {display(data?.window?.number)}
            </span>
          </header>
          <div className="metric-grid">
            <div><small>حجم العينة</small><b>{display(data?.window?.attempts)}</b></div>
            <div><small>معدل المنع</small><b>{percent(data?.window?.blockRate)}</b></div>
            <div><small>معدل الأخطاء</small><b>{percent(data?.window?.errorRate)}</b></div>
            <div><small>P95</small><b>{display(data?.window?.p95LatencyMs, " ms")}</b></div>
          </div>
          <div className="ops-progress" aria-label="نسبة التفعيل">
            <span style={{ width: `${Math.min(100, data?.rollout?.percentage ?? 0)}%` }} />
          </div>
          <p>
            مفتاح الإيقاف:{" "}
            <strong>
              {data?.rollout?.emergencyStopActive === true
                ? "فعال"
                : data?.rollout
                  ? "غير فعال"
                  : "—"}
            </strong>
          </p>
        </article>

        <article className="ops-panel">
          <header>
            <div>
              <span>قرار التشغيل</span>
              <h2>إجراءات محكومة</h2>
            </div>
          </header>
          <div className="ops-actions">
            <button disabled={!actionsReady} onClick={() => setCommand("REQUEST_PROMOTION")} title={!actionsReady ? "يتطلب اتصال PostgreSQL وتحققًا إضافيًا" : undefined}>
              مراجعة الترقية
            </button>
            <button disabled={!actionsReady} onClick={() => setCommand("PAUSE_ROLLOUT")} title={!actionsReady ? "يتطلب اتصال PostgreSQL وتحققًا إضافيًا" : undefined}>
              إيقاف مؤقت
            </button>
            <button className="danger" disabled={!actionsReady} onClick={() => setCommand("EMERGENCY_STOP")} title={!actionsReady ? "يتطلب تحققًا إضافيًا وسببًا" : undefined}>
              تفعيل الإيقاف الطارئ
            </button>
            <button disabled={!actionsReady} onClick={() => setCommand("EVALUATE_WINDOW")} title={!actionsReady ? "يتطلب اتصال PostgreSQL وتحققًا إضافيًا" : undefined}>
              تقييم النافذة الآن
            </button>
          </div>
          <p className="action-note">
            {actionsReady
              ? "الإجراءات متاحة ضمن تحقق إضافي، وسبب إلزامي، وسجل تدقيق مانع للتكرار."
              : connected
              ? "القراءة متصلة. تبقى الإجراءات معطلة إلى أن يعلن المحول جاهزية التحقق الإضافي وفصل المهام."
              : "لن تتاح الإجراءات قبل تهيئة المحول الآمن والتحقق الإضافي وفصل المهام."}
          </p>
        </article>

        <article className="ops-panel full">
          <header>
            <div>
              <span>خط الأساس المثبت</span>
              <h2>حالة البنية الإنتاجية</h2>
            </div>
          </header>
          <div className="baseline-row">
            <div><small>الإصدار المنطقي</small><b>{baseline?.schemaVersion ?? "V110"}</b></div>
            <div><small>الترحيلات</small><b>{baseline?.migrations ?? 60}</b></div>
            <div><small>الجداول</small><b>{baseline?.tables ?? 463}</b></div>
            <div>
              <small>الوضع الافتراضي</small>
              <b>{labels[baseline?.defaultEnforcementMode ?? "MONITOR_ONLY"]}</b>
            </div>
          </div>
          <p>
            لا تستخدم اللوحة أرقامًا تجريبية بدل بيانات التشغيل؛ لذلك تظهر
            المؤشرات الحية بشرطة إلى حين اتصال PostgreSQL.
          </p>
        </article>
      </div>

      <article className="ops-panel full ops-approvals">
        <header><div><span>فصل الواجبات</span><h2>طلبات القرار بانتظار مدير ثانٍ</h2></div><b>{data?.pendingApprovals?.length ?? 0}</b></header>
        {data?.pendingApprovals?.length ? data.pendingApprovals.map((approval) => (
          <div className="approval-row" key={approval.approvalRequestId}>
            <div><strong>{approval.action ?? "إجراء تشغيلي"}</strong><small>المخاطر: {approval.risk ?? "—"} · ينتهي: {approval.expiresAt ? new Date(approval.expiresAt).toLocaleString("ar") : "—"}</small></div>
            <span>يتطلب مديرًا مستقلًا</span>
          </div>
        )) : <p>لا توجد طلبات تشغيلية معلقة حاليًا.</p>}
      </article>

      <article className="ops-panel full ops-incidents">
        <header><div><span>الاستجابة التشغيلية</span><h2>الحوادث والتنبيهات النشطة</h2></div><b>{data?.incidents?.length ?? 0}</b></header>
        {data?.incidents?.length ? data.incidents.map((incident) => (
          <div className="incident-row" key={incident.incidentId}>
            <span className={`severity ${String(incident.severity ?? "SEV4").toLowerCase()}`}>{incident.severity ?? "—"}</span>
            <div><strong>{incident.title ?? "حادث تشغيلي"}</strong><small>{incident.code ?? "—"} · {incident.status ?? "—"}</small></div>
            <em>{incident.acknowledgementOverdue ? "متجاوز لمهلة الإقرار" : "ضمن المهلة"}</em>
          </div>
        )) : <p>لا توجد حوادث تشغيلية نشطة.</p>}
      </article>

      <article className="ops-panel full ops-reliability">
        <header><div><span>SLA / SLO</span><h2>الاعتمادية وميزانية الخطأ</h2></div><b>{data?.reliability?.budgetStatus ?? "—"}</b></header>
        <div className="baseline-row">
          <div><small>التوافر</small><b>{display(data?.reliability?.availability,"%")}</b></div>
          <div><small>معدل النجاح</small><b>{display(data?.reliability?.successRate,"%")}</b></div>
          <div><small>MTTA</small><b>{display(data?.reliability?.mttaMinutes," دقيقة")}</b></div>
          <div><small>MTTR</small><b>{display(data?.reliability?.mttrHours," ساعة")}</b></div>
        </div>
      </article>

      {command && (
        <div className="ops-dialog-backdrop" role="presentation" onMouseDown={() => !busy && setCommand(null)}>
          <section className="ops-dialog" role="dialog" aria-modal="true" aria-labelledby="ops-command-title" onMouseDown={(event) => event.stopPropagation()}>
            <span>إجراء تشغيلي عالي الحساسية</span>
            <h2 id="ops-command-title">{labels[command] ?? ({ REQUEST_PROMOTION: "طلب مراجعة الترقية", PAUSE_ROLLOUT: "إيقاف التفعيل مؤقتًا", EMERGENCY_STOP: "الإيقاف الطارئ", EVALUATE_WINDOW: "تقييم نافذة Canary" }[command] ?? command)}</h2>
            <p>لن يُقبل الأمر دون سبب واضح. يحتفظ النظام بهوية المشغل والوقت والنتيجة، ويمنع التنفيذ المكرر.</p>
            {command === "REQUEST_PROMOTION" && <label>النسبة المقترحة<input type="number" min="1" max="100" value={targetPercentage} onChange={(event) => setTargetPercentage(event.target.value)} /><small>%</small></label>}
            <label>سبب الإجراء<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} maxLength={500} placeholder="اكتب سببًا تشغيليًا واضحًا (8 أحرف على الأقل)" /></label>
            <div className="ops-dialog-actions">
              <button type="button" onClick={() => setCommand(null)} disabled={busy}>إلغاء</button>
              <button type="button" className={command === "EMERGENCY_STOP" ? "danger" : "primary"} onClick={() => void runCommand()} disabled={busy || reason.trim().length < 8}>{busy ? "جارٍ التنفيذ…" : "تأكيد وإرسال"}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
