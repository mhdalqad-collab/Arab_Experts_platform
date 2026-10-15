"use client";

import { useEffect, useState } from "react";

type QueueItem = {
  profile_id: string;
  membership_code: string;
  lifecycle_status: string;
  revision: number;
  updated_at: string;
  display_name: string | null;
  email: string;
  review_id: string | null;
};

type ReviewApiPayload = {
  queue?: QueueItem[];
  role?: string;
  error?: string;
};

const labels: Record<string, string> = {
  expert: "خبير",
  trainer: "مدرب",
  consultant: "مستشار",
  researcher: "باحث / أكاديمي",
  center: "مركز تدريب",
  client: "العميل",
};

export default function ReviewQueue({
  reviewerEmail,
}: {
  reviewerEmail: string;
}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("جارٍ تحميل قائمة المراجعة…");
  const [busy, setBusy] = useState("");

  async function loadQueue() {
    try {
      const response = await fetch("/api/membership-lifecycle", {
        cache: "no-store",
      });
      if (response.status === 403) {
        setMessage("لا تملك صلاحية مراجع العضويات.");
        return;
      }
      if (!response.ok) throw new Error("load failed");
      const result = (await response.json()) as ReviewApiPayload;
      setQueue(result.queue ?? []);
      setRole(result.role ?? "");
      setMessage(
        result.queue?.length
          ? ""
          : "لا توجد عضويات بانتظار المراجعة حاليًا.",
      );
    } catch {
      setMessage("تعذر تحميل قائمة المراجعة. أعد المحاولة.");
    }
  }

  useEffect(() => {
    const task = window.setTimeout(() => void loadQueue(), 0);
    return () => window.clearTimeout(task);
  }, []);

  async function transition(
    item: QueueItem,
    action: "START_REVIEW" | "REQUEST_CHANGES" | "APPROVE" | "REJECT",
  ) {
    let reason = "";
    if (action === "REQUEST_CHANGES" || action === "REJECT") {
      reason = window.prompt("اكتب سبب القرار بوضوح:")?.trim() ?? "";
      if (!reason) {
        setMessage("السبب إلزامي لهذا القرار.");
        return;
      }
    }
    setBusy(item.profile_id);
    setMessage("");
    try {
      const response = await fetch("/api/membership-lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          profileId: item.profile_id,
          action,
          reason,
        }),
      });
      const result = (await response.json()) as ReviewApiPayload;
      if (!response.ok) {
        setMessage(
          result.error === "INVALID_TRANSITION"
            ? "تغيرت حالة العضوية؛ تم تحديث القائمة."
            : "تعذر تنفيذ القرار.",
        );
      } else {
        setMessage("تم تسجيل الإجراء في سجل التدقيق.");
      }
      await loadQueue();
    } catch {
      setMessage("تعذر الاتصال بالخادم.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="review-content">
      <div className="review-meta">
        <span>المراجع: {reviewerEmail}</span>
        {role && <strong>{role}</strong>}
        <button type="button" onClick={() => void loadQueue()}>
          تحديث القائمة
        </button>
      </div>
      {message && <div className="review-message">{message}</div>}
      <div className="review-list">
        {queue.map((item) => (
          <article key={item.profile_id}>
            <div>
              <span className="review-type">
                {labels[item.membership_code] ?? item.membership_code}
              </span>
              <h2>{item.display_name || item.email}</h2>
              <small>
                الإصدار {item.revision} · آخر تحديث{" "}
                {new Date(item.updated_at).toLocaleString("ar")}
              </small>
            </div>
            <span className={`review-status ${item.lifecycle_status}`}>
              {item.lifecycle_status === "submitted"
                ? "بانتظار بدء المراجعة"
                : "قيد المراجعة"}
            </span>
            <div className="review-actions">
              {item.lifecycle_status === "submitted" ? (
                <button
                  disabled={busy === item.profile_id}
                  onClick={() => void transition(item, "START_REVIEW")}
                >
                  بدء المراجعة
                </button>
              ) : (
                <>
                  <button
                    className="approve"
                    disabled={busy === item.profile_id}
                    onClick={() => void transition(item, "APPROVE")}
                  >
                    اعتماد
                  </button>
                  <button
                    className="changes"
                    disabled={busy === item.profile_id}
                    onClick={() => void transition(item, "REQUEST_CHANGES")}
                  >
                    طلب استكمال
                  </button>
                  <button
                    className="reject"
                    disabled={busy === item.profile_id}
                    onClick={() => void transition(item, "REJECT")}
                  >
                    رفض
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
