"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type PublicProfile = {
  partyId: string;
  partyType: string;
  displayNameAr: string;
  displayNameEn: string | null;
  updatedAt: string;
  memberships: Array<{
    code: string;
    label: string;
    fields: Record<string, unknown>;
  }>;
  contacts: Array<{ type: string; value: string }>;
  trust: { verifiedEvidenceCount: number; confidenceScore: number | null };
  reputation: null | {
    score: number;
    rating: number;
    confidence: number;
    sampleCount: number;
    dimensions: Record<string, unknown>;
    methodologyVersion: string;
    generatedAt: string;
  };
  evidence: Array<{
    id: string;
    title: string;
    categoryLabel: string;
    confidenceScore: number | null;
    verifiedAt: string | null;
  }>;
};

type PublicProfileApiPayload = {
  profile?: PublicProfile;
  error?: string;
};

const contactLabels: Record<string, string> = {
  EMAIL: "البريد الإلكتروني",
  PHONE: "الهاتف",
  WEBSITE: "الموقع الإلكتروني",
  LINKEDIN: "LinkedIn",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function visibleValues(fields: Record<string, unknown>) {
  return Object.entries(fields)
    .filter(([, value]) => ["string", "number"].includes(typeof value))
    .slice(0, 8);
}

export default function PublicProfileClient({ partyId }: { partyId: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public-profiles/${encodeURIComponent(partyId)}`, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as PublicProfileApiPayload;
        if (!response.ok) throw new Error(body.error ?? "PROFILE_UNAVAILABLE");
        if (!body.profile) throw new Error("PROFILE_UNAVAILABLE");
        return body.profile;
      })
      .then(setProfile)
      .catch(() => setError("هذا الملف غير منشور أو لا يحتوي عضوية معتمدة."));
  }, [partyId]);

  if (error) {
    return (
      <main className="public-profile-shell">
        <section className="public-empty">
          <span>الملف العام</span>
          <h1>الملف غير متاح</h1>
          <p>{error}</p>
          <a href="/eim/index.html">العودة إلى شبكة الخبراء العرب</a>
        </section>
      </main>
    );
  }
  if (!profile) {
    return (
      <main className="public-profile-shell">
        <section className="public-empty" aria-live="polite">
          <span>جارٍ التحميل</span>
          <h1>نستخرج البيانات المسموح بعرضها…</h1>
        </section>
      </main>
    );
  }

  const confidence = profile.trust.confidenceScore;
  const reputationLabels: Record<string, string> = {
    quality: "جودة المخرجات",
    timeliness: "الالتزام الزمني",
    communication: "التواصل",
    professionalism: "المهنية",
    value: "القيمة المحققة",
  };
  return (
    <main className="public-profile-shell">
      <nav className="public-profile-nav">
        <a className="public-brand" href="/eim/index.html">
          <Image src="/favicon.svg" alt="" width={32} height={32} priority />
          <span><strong>شبكة الخبراء العرب</strong><small>ملف مهني عام موثّق</small></span>
        </a>
        <a href="/eim/index.html">البحث في الشبكة</a>
      </nav>

      <header className="public-profile-hero">
        <div className="profile-avatar" aria-hidden="true">
          {profile.displayNameAr.trim().charAt(0)}
        </div>
        <div className="profile-heading">
          <span className="profile-eyebrow">
            {profile.partyType === "ORGANIZATION" ? "ملف مؤسسة" : "ملف مهني"}
          </span>
          <h1>{profile.displayNameAr}</h1>
          {profile.displayNameEn && <p lang="en">{profile.displayNameEn}</p>}
          <div className="membership-badges">
            {profile.memberships.map((membership) => (
              <span key={membership.code}>✓ {membership.label} معتمد</span>
            ))}
          </div>
        </div>
        <aside className="trust-score" aria-label="ملخص الثقة">
          <small>درجة اليقين</small>
          <strong>{confidence === null ? "—" : `${confidence}%`}</strong>
          <span>{profile.trust.verifiedEvidenceCount} دليل عام متحقق</span>
        </aside>
      </header>

      <div className="public-profile-grid">
        <section className="profile-main">
          <div className="public-card">
            <div className="section-title">
              <div><span>الهوية المهنية</span><h2>المعلومات المسموح بعرضها</h2></div>
              <small>آخر تحديث {formatDate(profile.updatedAt)}</small>
            </div>
            {profile.memberships.map((membership) => {
              const values = visibleValues(membership.fields);
              return (
                <article className="membership-section" key={membership.code}>
                  <h3>{membership.label}</h3>
                  {values.length ? (
                    <dl>{values.map(([key, value]) => (
                      <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>
                    ))}</dl>
                  ) : <p>لا توجد بيانات تفصيلية مصرح بعرضها لهذه العضوية.</p>}
                </article>
              );
            })}
          </div>

          <div className="public-card">
            <div className="section-title">
              <div><span>السمعة المهنية</span><h2>نتائج أعمال موثقة وليست ادعاءً ذاتيًا</h2></div>
              <small>{profile.reputation ? `${profile.reputation.sampleCount} مشروع مقيّم` : "العينة قيد التكوين"}</small>
            </div>
            {profile.reputation ? (
              <article className="membership-section">
                <h3>{profile.reputation.rating}/5 · درجة السمعة {profile.reputation.score}/100</h3>
                <p>ثقة المؤشر {profile.reputation.confidence}% — كلما زاد عدد المشاريع المكتملة ارتفعت دلالة الدرجة.</p>
                <dl>{Object.entries(profile.reputation.dimensions).map(([key, value]) => (
                  <div key={key}><dt>{reputationLabels[key] ?? key}</dt><dd>{String(value)}/100</dd></div>
                ))}</dl>
              </article>
            ) : <p className="muted-copy">لا توجد عينة كافية من مشاريع مغلقة ومقيّمة بعد؛ لا تعرض المنصة تقديرًا افتراضيًا.</p>}
          </div>

          <div className="public-card">
            <div className="section-title">
              <div><span>الأدلة المهنية</span><h2>أدلة عامة تحققت منها الشبكة</h2></div>
              <small>لا تُعرض الملفات الأصلية للعامة</small>
            </div>
            <div className="evidence-grid">
              {profile.evidence.length ? profile.evidence.map((item) => (
                <article className="evidence-card" key={item.id}>
                  <span className="verified-mark">✓ متحقق</span>
                  <h3>{item.title}</h3>
                  <p>{item.categoryLabel}</p>
                  <div>
                    <strong>{item.confidenceScore === null ? "درجة غير منشورة" : `يقين ${item.confidenceScore}%`}</strong>
                    <small>{formatDate(item.verifiedAt)}</small>
                  </div>
                </article>
              )) : <p className="muted-copy">لا توجد أدلة عامة متحققة منشورة حاليًا.</p>}
            </div>
          </div>
        </section>

        <aside className="profile-aside">
          <div className="public-card">
            <span className="aside-kicker">منهجية الثقة</span>
            <h2>درجة شفافة وليست حكمًا مطلقًا</h2>
            <p>الدرجة متوسط يقين الأدلة العامة المتحققة فقط، وقد تختلف أهلية العضو حسب نوع المهمة وسياقها.</p>
          </div>
          {profile.contacts.length > 0 && (
            <div className="public-card">
              <span className="aside-kicker">التواصل المصرح</span>
              <h2>قنوات الاتصال العامة</h2>
              <dl className="contact-list">{profile.contacts.map((contact) => (
                <div key={`${contact.type}:${contact.value}`}>
                  <dt>{contactLabels[contact.type] ?? contact.type}</dt><dd>{contact.value}</dd>
                </div>
              ))}</dl>
            </div>
          )}
          <a className="service-request" href="/eim/index.html">طلب خدمة عبر الشبكة</a>
        </aside>
      </div>
    </main>
  );
}
