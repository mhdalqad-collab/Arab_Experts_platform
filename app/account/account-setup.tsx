"use client";

import { useEffect, useMemo, useState } from "react";

type Identity = {
  displayName: string;
  email: string;
  fullName: string | null;
};

type Membership = {
  code: string;
  label: string;
  description: string;
  target: number;
  administrative?: boolean;
};

type DashboardProfile = {
  profile_id: string;
  membership_code: string;
  current_step: number;
  lifecycle_status: string;
  revision: number;
  updated_at: string;
};

type DashboardNotification = {
  notification_id: string;
  profile_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
};

type DashboardTransition = {
  transition_id: string;
  membership_code: string;
  from_status: string;
  to_status: string;
  action_code: string;
  reason: string | null;
  occurred_at: string;
};

type PartyProfile = {
  party_id?: string;
  party_type: "PERSON" | "ORGANIZATION";
  relationship_code?: string;
  is_primary?: number;
  display_name_ar: string;
  display_name_en: string;
  legal_entity_type: string;
  registration_number: string;
  website_url: string;
};

type OrganizationAccess = {
  organizations: Array<{
    party_id: string;
    display_name_ar: string;
    relationship_code: string;
  }>;
  invitations: Array<{
    invitation_id: string;
    organization_party_id: string;
    display_name_ar: string;
    invited_email: string;
    role_code: string;
    status: string;
    expires_at: string;
  }>;
  representatives: Array<{
    organization_party_id: string;
    account_id: string;
    email: string;
    display_name: string | null;
    relationship_code: string;
    status: string;
  }>;
};

type ProfessionalDocument = {
  document_id: string;
  membership_code: string | null;
  category_code: string;
  title: string;
  confidentiality: string;
  verification_status: string;
  original_file_name: string;
  media_type: string;
  size_bytes: number;
  scan_status: string;
  updated_at: string;
};

type AccountApiPayload = {
  memberships?: Array<{
    party_id?: string;
    is_active?: number;
    membership_code: string;
  }>;
  account?: { clientType?: string };
  documents?: ProfessionalDocument[];
  uploaded?: unknown[];
  rejected?: unknown[];
  organizations?: OrganizationAccess["organizations"];
  invitations?: OrganizationAccess["invitations"];
  representatives?: OrganizationAccess["representatives"];
  error?: string;
  parties?: PartyProfile[];
  privacy?: Array<{ party_id: string; field_key: string; visibility: string }>;
  profiles?: DashboardProfile[];
  notifications?: DashboardNotification[];
  transitions?: DashboardTransition[];
  unreadCount?: number;
  partyId?: string;
};

const memberships: Membership[] = [
  {
    code: "expert",
    label: "خبير",
    description: "عرض الخبرة المهنية والأدلة والخدمات.",
    target: 33,
  },
  {
    code: "trainer",
    label: "مدرب",
    description: "تقديم الدورات والفعاليات التدريبية.",
    target: 46,
  },
  {
    code: "consultant",
    label: "مستشار",
    description: "تقديم الاستشارات والمشاركة في المشاريع.",
    target: 47,
  },
  {
    code: "researcher",
    label: "باحث / أكاديمي",
    description: "البحث والنشر والتعاون وإدارة المعرفة.",
    target: 48,
  },
  {
    code: "center",
    label: "مركز تدريب",
    description: "إدارة المركز والدورات والمدربين والطروحات.",
    target: 45,
  },
  {
    code: "client",
    label: "العميل",
    description: "طلب الخبراء أو التدريب أو الاستشارات والمشاريع.",
    target: 49,
  },
  {
    code: "operator",
    label: "مدير / مشغل المنصة",
    description: "دور إداري حساس يُمنح بالتعيين والموافقة فقط.",
    target: 52,
    administrative: true,
  },
];

const clientTypes = [
  "فردي مستقل",
  "مؤسسة أو شركة خاصة",
  "قطاع أكاديمي",
  "قطاع مشترك",
  "منظمات حكومية",
  "منظمات إقليمية",
  "منظمات دولية",
];

const legalEntityTypes = [
  "شركة ذات مسؤولية محدودة (ذ.م.م)",
  "مؤسسة فردية",
  "شركة شخص واحد",
  "شركة مساهمة خاصة",
  "مؤسسة غير ربحية / جمعية نفع عام",
  "فرع لشركة أو مؤسسة أجنبية",
  "وحدة أو مركز تابع لجهة رسمية قائمة",
];

const visibilityOptions = [
  ["PUBLIC", "عام"],
  ["MEMBERS_ONLY", "للأعضاء"],
  ["PLATFORM_ONLY", "لإدارة المنصة"],
  ["PRIVATE", "خاص"],
] as const;

const organizationRoles = [
  ["ORG_ADMIN", "مدير المنظمة"],
  ["MEMBERSHIP_MANAGER", "مسؤول العضويات"],
  ["BILLING_MANAGER", "مسؤول الفوترة"],
  ["VIEWER", "مستخدم للعرض"],
] as const;

const organizationRoleLabels: Record<string, string> = {
  OWNER: "مالك المنظمة",
  ORG_ADMIN: "مدير المنظمة",
  MEMBERSHIP_MANAGER: "مسؤول العضويات",
  BILLING_MANAGER: "مسؤول الفوترة",
  VIEWER: "مستخدم للعرض",
};

const documentCategories = [
  ["CV", "السيرة الذاتية"],
  ["ACADEMIC_QUALIFICATION", "مؤهل علمي"],
  ["PROFESSIONAL_CERTIFICATE", "شهادة مهنية"],
  ["LICENSE", "ترخيص أو اعتماد"],
  ["PROJECT_EVIDENCE", "دليل مشروع أو خبرة"],
  ["TRAINING_EVIDENCE", "دليل تدريب"],
  ["PUBLICATION", "منشور أو بحث"],
  ["ORGANIZATION_DOCUMENT", "وثيقة منظمة"],
  ["OTHER", "وثيقة أخرى"],
] as const;

const documentConfidentiality = [
  ["PRIVATE", "خاص بصاحب الحساب"],
  ["PLATFORM_ONLY", "متاح لإدارة المنصة فقط"],
  ["MEMBERS_ONLY", "متاح للأعضاء"],
  ["PUBLIC", "قابل للعرض العام بعد الاعتماد"],
] as const;

const labelByCode = new Map(
  memberships.map((membership) => [membership.code, membership.label]),
);

const targetByCode = new Map(
  memberships.map((membership) => [membership.code, membership.target]),
);

const statusLabels: Record<string, string> = {
  not_started: "لم يبدأ",
  draft: "مسودة",
  data_complete: "مكتملة البيانات",
  submitted: "مرسلة للمراجعة",
  under_review: "قيد المراجعة",
  needs_changes: "تحتاج استكمالًا",
  approved: "معتمدة",
  rejected: "غير معتمدة",
  suspended: "معلقة",
  renewal_due: "تحتاج تجديدًا",
  expired: "منتهية",
};

const totalSteps: Record<string, number> = {
  expert: 8,
  trainer: 8,
  consultant: 8,
  researcher: 8,
  center: 7,
  client: 7,
};

export default function AccountSetup({ identity }: { identity: Identity }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [clientType, setClientType] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [syncState, setSyncState] = useState<
    "loading" | "saved" | "saving" | "error"
  >("loading");
  const [party, setParty] = useState<PartyProfile>({
    party_type: "PERSON",
    display_name_ar: identity.fullName ?? identity.displayName,
    display_name_en: "",
    legal_entity_type: "",
    registration_number: "",
    website_url: "",
  });
  const [availableParties, setAvailableParties] = useState<PartyProfile[]>([]);
  const [partyPrivacy, setPartyPrivacy] = useState<Record<string, string>>({
    display_name_ar: "PUBLIC",
    display_name_en: "PUBLIC",
    legal_entity_type: "MEMBERS_ONLY",
    registration_number: "PLATFORM_ONLY",
    website_url: "PUBLIC",
  });
  const [partySaveState, setPartySaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [organizationAccess, setOrganizationAccess] =
    useState<OrganizationAccess>({
      organizations: [],
      invitations: [],
      representatives: [],
    });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBERSHIP_MANAGER");
  const [organizationMessage, setOrganizationMessage] = useState("");
  const [documents, setDocuments] = useState<ProfessionalDocument[]>([]);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentCategory, setDocumentCategory] = useState("CV");
  const [documentMembership, setDocumentMembership] = useState("");
  const [documentVisibility, setDocumentVisibility] = useState("PRIVATE");
  const [documentMessage, setDocumentMessage] = useState("");
  const [dashboard, setDashboard] = useState<{
    profiles: DashboardProfile[];
    notifications: DashboardNotification[];
    transitions: DashboardTransition[];
    unreadCount: number;
  }>({ profiles: [], notifications: [], transitions: [], unreadCount: 0 });

  useEffect(() => {
    async function loadAccount() {
      let localCodes: string[] = [];
      let localClientType = "";
      try {
      const stored = JSON.parse(localStorage.getItem("eim5") ?? "{}");
        localCodes = memberships
        .filter((membership) =>
          (stored.memberships ?? []).includes(membership.label),
        )
        .map((membership) => membership.code);
        localClientType = stored.clientType ?? "";
      } catch {
        localCodes = [];
      }

      try {
        const response = await fetch("/api/account", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("account load failed");
        const remote = (await response.json()) as AccountApiPayload;
        const remoteCodes = (remote.memberships ?? [])
          .filter((membership: { is_active?: number }) => membership.is_active)
          .map(
            (membership: { membership_code: string }) =>
              membership.membership_code,
          )
          .filter((code: string) => labelByCode.has(code));
        setSelected(remoteCodes.length ? remoteCodes : localCodes);
        setClientType(remote.account?.clientType ?? localClientType);
        setSyncState("saved");
      } catch {
        setSelected(localCodes);
        setClientType(localClientType);
        setSyncState("error");
      } finally {
        setReady(true);
      }
    }
    void loadAccount();
  }, []);

  useEffect(() => {
    void loadDashboard();
    void loadPartyProfile();
    void loadOrganizationAccess();
    void loadDocuments();
    // Initial hydration is intentionally performed once; loaders update local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDocuments() {
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      if (!response.ok) return;
      const result = (await response.json()) as AccountApiPayload;
      setDocuments(result.documents ?? []);
    } catch {
      // Upload controls remain visible and can be retried.
    }
  }

  async function uploadDocuments() {
    if (!documentFiles.length) {
      setDocumentMessage("اختر ملفًا واحدًا على الأقل.");
      return;
    }
    setDocumentMessage("جارٍ رفع الملفات وحفظ بياناتها…");
    const form = new FormData();
    documentFiles.forEach((file) => form.append("files", file));
    form.append("category", documentCategory);
    form.append("membershipCode", documentMembership);
    form.append("confidentiality", documentVisibility);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as AccountApiPayload;
      const uploadedCount = result.uploaded?.length ?? 0;
      const rejectedCount = result.rejected?.length ?? 0;
      if (!response.ok && !uploadedCount) throw new Error("upload failed");
      setDocumentFiles([]);
      setDocumentMessage(
        `تم رفع ${uploadedCount} ملف${rejectedCount ? `، وتعذر رفع ${rejectedCount}` : ""}.`,
      );
      await loadDocuments();
    } catch {
      setDocumentMessage("تعذر رفع الملفات. تحقق من النوع والحجم ثم أعد المحاولة.");
    }
  }

  async function documentAction(
    documentId: string,
    action: string,
    confidentiality?: string,
  ) {
    const response = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, action, confidentiality }),
    });
    if (!response.ok) {
      setDocumentMessage("تعذر تنفيذ الإجراء المطلوب على الوثيقة.");
      return;
    }
    setDocumentMessage("تم تحديث الوثيقة.");
    await loadDocuments();
  }

  async function loadOrganizationAccess() {
    try {
      const response = await fetch("/api/organization-access", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = (await response.json()) as AccountApiPayload;
      setOrganizationAccess({
        organizations: result.organizations ?? [],
        invitations: result.invitations ?? [],
        representatives: result.representatives ?? [],
      });
    } catch {
      // The individual membership flow remains available without this panel.
    }
  }

  async function organizationAction(payload: Record<string, unknown>) {
    const response = await fetch("/api/organization-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as AccountApiPayload;
    if (!response.ok) throw new Error(result.error ?? "ORGANIZATION_ACTION_FAILED");
    await loadOrganizationAccess();
    return result;
  }

  async function inviteRepresentative() {
    if (!party.party_id || !inviteEmail.trim()) return;
    setOrganizationMessage("جارٍ إنشاء الدعوة…");
    try {
      await organizationAction({
        action: "CREATE_INVITATION",
        organizationPartyId: party.party_id,
        email: inviteEmail,
        roleCode: inviteRole,
      });
      setInviteEmail("");
      setOrganizationMessage("تم إنشاء الدعوة، وتبقى صالحة لمدة سبعة أيام.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setOrganizationMessage(
        code === "INVITATION_ALREADY_PENDING"
          ? "توجد دعوة فعالة لهذا البريد بالفعل."
          : code === "REPRESENTATIVE_ALREADY_ACTIVE"
            ? "هذا المستخدم ممثل فعّال للمنظمة بالفعل."
            : "تعذر إنشاء الدعوة. تحقق من البريد والصلاحية.",
      );
    }
  }

  async function loadPartyProfile() {
    try {
      const response = await fetch("/api/party-profile", { cache: "no-store" });
      if (!response.ok) return;
      const result = (await response.json()) as AccountApiPayload;
      setAvailableParties(result.parties ?? []);
      const primary = (result.parties ?? []).find(
        (item: { is_primary?: number }) => item.is_primary,
      );
      if (primary) {
        setParty({
          party_id: primary.party_id,
          party_type: primary.party_type,
          display_name_ar: primary.display_name_ar ?? "",
          display_name_en: primary.display_name_en ?? "",
          legal_entity_type: primary.legal_entity_type ?? "",
          registration_number: primary.registration_number ?? "",
          website_url: primary.website_url ?? "",
        });
        const privacy = { ...partyPrivacy };
        for (const rule of result.privacy ?? []) {
          if (rule.party_id === primary.party_id) {
            privacy[rule.field_key] = rule.visibility;
          }
        }
        setPartyPrivacy(privacy);
        const activeCodes = (result.memberships ?? [])
          .filter(
            (membership) =>
              membership.party_id === primary.party_id && membership.is_active,
          )
          .map(
            (membership: { membership_code: string }) =>
              membership.membership_code,
          )
          .filter((code: string) => labelByCode.has(code));
        if (activeCodes.length) setSelected(activeCodes);
        setPartySaveState("saved");
      }
    } catch {
      setPartySaveState("error");
    }
  }

  async function activateParty(nextParty: PartyProfile) {
    if (!nextParty.party_id || nextParty.party_id === party.party_id) return;
    setPartySaveState("saving");
    try {
      const response = await fetch("/api/party-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId: nextParty.party_id }),
      });
      if (!response.ok) throw new Error("party switch failed");
      setParty(nextParty);
      const state = JSON.parse(localStorage.getItem("eim5") ?? "{}");
      localStorage.setItem(
        "eim5",
        JSON.stringify({
          ...state,
          activePartyId: nextParty.party_id,
          partySwitchPending: true,
        }),
      );
      await Promise.all([
        loadPartyProfile(),
        loadDashboard(),
        loadOrganizationAccess(),
        loadDocuments(),
      ]);
      setMessage("تم تبديل صاحب العضوية واسترجاع ملفه المستقل.");
      setPartySaveState("saved");
    } catch {
      setMessage("تعذر تبديل صاحب العضوية. لم تتغير البيانات الحالية.");
      setPartySaveState("error");
    }
  }

  function startNewParty(partyType: "PERSON" | "ORGANIZATION") {
    setParty({
      party_type: partyType,
      display_name_ar: partyType === "PERSON" ? identity.displayName : "",
      display_name_en: "",
      legal_entity_type: "",
      registration_number: "",
      website_url: "",
    });
    setSelected([]);
    setPartySaveState("idle");
    setMessage("سجل جديد؛ لن يؤثر في السجلات السابقة عند حفظه.");
  }

  async function loadDashboard() {
    try {
      const response = await fetch("/api/account-dashboard", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = (await response.json()) as AccountApiPayload;
      setDashboard({
        profiles: result.profiles ?? [],
        notifications: result.notifications ?? [],
        transitions: result.transitions ?? [],
        unreadCount: result.unreadCount ?? 0,
      });
    } catch {
      // Membership selection remains usable if the dashboard is unavailable.
    }
  }

  function profileCompletion(profile: DashboardProfile) {
    if (
      ["data_complete", "submitted", "under_review", "approved"].includes(
        profile.lifecycle_status,
      )
    )
      return 100;
    const total = totalSteps[profile.membership_code] ?? 8;
    return Math.min(95, Math.round(((profile.current_step + 1) / total) * 100));
  }

  function openProfile(code: string) {
    const target = targetByCode.get(code);
    if (target) window.location.assign(`/eim/index.html#/${target}`);
  }

  async function markNotificationsRead() {
    await fetch("/api/account-dashboard", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    await loadDashboard();
  }

  const selectedLabels = useMemo(
    () =>
      selected
        .map((code) => labelByCode.get(code))
        .filter((label): label is string => Boolean(label)),
    [selected],
  );

  function toggleMembership(membership: Membership) {
    if (membership.administrative) {
      setMessage(
        "عضوية مدير أو مشغل المنصة لا تُفعّل ذاتيًا. يمكن طلبها من إدارة الشبكة بعد التحقق.",
      );
      return;
    }
    setMessage("");
    setSelected((current) =>
      current.includes(membership.code)
        ? current.filter((code) => code !== membership.code)
        : [...current, membership.code],
    );
  }

  async function continueSetup() {
    if (!party.display_name_ar.trim()) {
      setMessage("أدخل اسم صاحب العضوية باللغة العربية.");
      return;
    }
    if (!selected.length) {
      setMessage("اختر نوع عضوية واحدًا على الأقل للمتابعة.");
      return;
    }
    if (selected.includes("client") && !clientType) {
      setMessage("حدد نوع حساب العميل قبل المتابعة.");
      return;
    }

    const first = memberships.find(
      (membership) => selected[0] === membership.code,
    );
    if (!first) return;

    let state: Record<string, unknown> = {};
    try {
      state = JSON.parse(localStorage.getItem("eim5") ?? "{}");
    } catch {
      state = {};
    }

    const existingMemberships = Array.isArray(state.memberships)
      ? (state.memberships as string[])
      : [];
    const completed = Array.isArray(state.completed)
      ? (state.completed as string[])
      : [];

    const lifecycle =
      state.membershipLifecycle &&
      typeof state.membershipLifecycle === "object"
        ? (state.membershipLifecycle as Record<string, unknown>)
        : {};

    selectedLabels.forEach((label) => {
      if (!lifecycle[label]) {
        lifecycle[label] = {
          state: completed.includes(label) ? "data_complete" : "draft",
          dirty: false,
          history: [
            {
              state: completed.includes(label) ? "data_complete" : "draft",
              at: Date.now(),
              actor: identity.email,
              note: "اختيار العضوية من بوابة الحساب الآمنة",
            },
          ],
        };
      }
    });

    const nextState = {
      ...state,
      accountEmail: identity.email,
      user: identity.fullName ?? identity.displayName,
      memberships: Array.from(
        new Set([...existingMemberships, ...selectedLabels]),
      ),
      activeMembership: first.label,
      membershipLifecycle: lifecycle,
      clientType: selected.includes("client") ? clientType : state.clientType,
      lastSave: Date.now(),
    };

    localStorage.setItem("eim5", JSON.stringify(nextState));
    setSyncState("saving");
    setPartySaveState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberships: selected,
          clientType: selected.includes("client") ? clientType : null,
        }),
      });
      if (!response.ok) throw new Error("account save failed");
      const partyResponse = await fetch("/api/party-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: party.party_id,
          partyType: party.party_type,
          displayNameAr: party.display_name_ar,
          displayNameEn: party.display_name_en,
          legalEntityType:
            party.party_type === "ORGANIZATION"
              ? party.legal_entity_type
              : null,
          registrationNumber:
            party.party_type === "ORGANIZATION"
              ? party.registration_number
              : null,
          websiteUrl:
            party.party_type === "ORGANIZATION" ? party.website_url : null,
          privacy: partyPrivacy,
        }),
      });
      if (!partyResponse.ok) {
        setPartySaveState("error");
        throw new Error("party profile save failed");
      }
      const savedParty = (await partyResponse.json()) as AccountApiPayload;
      setParty((current) => ({ ...current, party_id: savedParty.partyId }));
      setPartySaveState("saved");
      setSyncState("saved");
      window.location.assign(`/eim/index.html#/${first.target}`);
    } catch {
      setSyncState("error");
      setMessage(
        "حُفظت المسودة على هذا الجهاز، لكن تعذرت مزامنتها مع الحساب. أعد المحاولة قبل المتابعة.",
      );
    }
  }

  if (!ready) {
    return <section className="account-loading">جارٍ تحميل بيانات الحساب…</section>;
  }

  return (
    <section className="account-content">
      <div className="account-intro">
        <span className="account-kicker">الخطوة 1 من إعداد الحساب</span>
        <h1>اختر أنواع العضوية</h1>
        <p>
          يمكنك اختيار أكثر من عضوية. بعد إكمال العضوية الأولى ينتقل النظام إلى
          العضوية التالية مع الاحتفاظ بجميع البيانات المدخلة.
        </p>
      </div>

      <div className="identity-card">
        <span className="identity-check" aria-hidden="true">
          ✓
        </span>
        <div>
          <strong>تم التحقق من هوية الدخول</strong>
          <small>{identity.email}</small>
        </div>
        <span className={`identity-status ${syncState}`}>
          {syncState === "loading"
            ? "جارٍ الاسترجاع…"
            : syncState === "saving"
              ? "جارٍ الحفظ…"
              : syncState === "error"
                ? "محفوظ محليًا فقط"
                : "متزامن مع الحساب"}
        </span>
      </div>

      <section className="party-registry">
        <div className="party-registry-head">
          <div>
            <span className="account-kicker">السجل الموحد للهوية</span>
            <h2>صاحب العضوية</h2>
            <p>
              الحساب وسيلة الدخول، أما هذا السجل فيمثل الشخص أو المنظمة التي
              ستملك العضويات والملفات المهنية.
            </p>
          </div>
          <span className={`party-save-state ${partySaveState}`}>
            {partySaveState === "saved"
              ? "محفوظ في السجل الموحد"
              : partySaveState === "saving"
                ? "جارٍ الحفظ…"
                : partySaveState === "error"
                  ? "يحتاج إعادة الحفظ"
                  : "سجل جديد"}
          </span>
        </div>

        {availableParties.length > 0 && (
          <div className="party-switcher">
            <div>
              <strong>السجلات التي تديرها</strong>
              <small>اختر الشخص أو المنظمة قبل فتح بيانات العضويات.</small>
            </div>
            <div className="party-switcher-list">
              {availableParties.map((item) => (
                <button
                  className={item.party_id === party.party_id ? "active" : ""}
                  type="button"
                  key={item.party_id}
                  onClick={() => void activateParty(item)}
                >
                  <span>{item.party_type === "PERSON" ? "فرد" : "منظمة"}</span>
                  <strong>{item.display_name_ar}</strong>
                  <small>
                    {organizationRoleLabels[item.relationship_code ?? "OWNER"] ??
                      "صاحب السجل"}
                  </small>
                </button>
              ))}
              <button
                className="new-party"
                type="button"
                onClick={() => startNewParty("PERSON")}
              >
                <span>＋</span>
                <strong>إضافة فرد</strong>
                <small>سجل مستقل جديد</small>
              </button>
              <button
                className="new-party"
                type="button"
                onClick={() => startNewParty("ORGANIZATION")}
              >
                <span>＋</span>
                <strong>إضافة منظمة</strong>
                <small>سجل مؤسسي جديد</small>
              </button>
            </div>
          </div>
        )}

        <div className="party-type-switch" role="group" aria-label="نوع صاحب العضوية">
          <button
            className={party.party_type === "PERSON" ? "active" : ""}
            type="button"
            onClick={() =>
              setParty((current) => ({ ...current, party_type: "PERSON" }))
            }
          >
            فرد
          </button>
          <button
            className={party.party_type === "ORGANIZATION" ? "active" : ""}
            type="button"
            onClick={() =>
              setParty((current) => ({
                ...current,
                party_type: "ORGANIZATION",
              }))
            }
          >
            منظمة / مؤسسة
          </button>
        </div>

        <div className="party-fields">
          <label>
            <span>
              {party.party_type === "PERSON"
                ? "الاسم الكامل بالعربية"
                : "الاسم القانوني بالعربية"}{" "}
              <em>*</em>
            </span>
            <input
              required
              value={party.display_name_ar}
              onChange={(event) =>
                setParty((current) => ({
                  ...current,
                  display_name_ar: event.target.value,
                }))
              }
            />
            <select
              aria-label="خصوصية الاسم العربي"
              value={partyPrivacy.display_name_ar}
              onChange={(event) =>
                setPartyPrivacy((current) => ({
                  ...current,
                  display_name_ar: event.target.value,
                }))
              }
            >
              {visibilityOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  ظهور: {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              {party.party_type === "PERSON"
                ? "الاسم الكامل بالإنجليزية"
                : "الاسم القانوني بالإنجليزية"}
            </span>
            <input
              dir="ltr"
              value={party.display_name_en}
              onChange={(event) =>
                setParty((current) => ({
                  ...current,
                  display_name_en: event.target.value,
                }))
              }
            />
            <select
              aria-label="خصوصية الاسم الإنجليزي"
              value={partyPrivacy.display_name_en}
              onChange={(event) =>
                setPartyPrivacy((current) => ({
                  ...current,
                  display_name_en: event.target.value,
                }))
              }
            >
              {visibilityOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  ظهور: {label}
                </option>
              ))}
            </select>
          </label>

          {party.party_type === "ORGANIZATION" && (
            <>
              <label>
                <span>نوع الكيان القانوني</span>
                <select
                  value={party.legal_entity_type}
                  onChange={(event) =>
                    setParty((current) => ({
                      ...current,
                      legal_entity_type: event.target.value,
                    }))
                  }
                >
                  <option value="">اختر نوع الكيان…</option>
                  {legalEntityTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <select
                  aria-label="خصوصية نوع الكيان"
                  value={partyPrivacy.legal_entity_type}
                  onChange={(event) =>
                    setPartyPrivacy((current) => ({
                      ...current,
                      legal_entity_type: event.target.value,
                    }))
                  }
                >
                  {visibilityOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      ظهور: {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>رقم التسجيل</span>
                <input
                  value={party.registration_number}
                  onChange={(event) =>
                    setParty((current) => ({
                      ...current,
                      registration_number: event.target.value,
                    }))
                  }
                />
                <select
                  aria-label="خصوصية رقم التسجيل"
                  value={partyPrivacy.registration_number}
                  onChange={(event) =>
                    setPartyPrivacy((current) => ({
                      ...current,
                      registration_number: event.target.value,
                    }))
                  }
                >
                  {visibilityOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      ظهور: {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide">
                <span>الموقع الإلكتروني</span>
                <input
                  dir="ltr"
                  type="url"
                  placeholder="https://example.org"
                  value={party.website_url}
                  onChange={(event) =>
                    setParty((current) => ({
                      ...current,
                      website_url: event.target.value,
                    }))
                  }
                />
                <select
                  aria-label="خصوصية الموقع الإلكتروني"
                  value={partyPrivacy.website_url}
                  onChange={(event) =>
                    setPartyPrivacy((current) => ({
                      ...current,
                      website_url: event.target.value,
                    }))
                  }
                >
                  {visibilityOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      ظهور: {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      </section>

      {(party.party_type === "ORGANIZATION" ||
        organizationAccess.invitations.some(
          (invitation) =>
            invitation.invited_email === identity.email &&
            invitation.status === "PENDING",
        )) && (
        <section className="organization-access">
          <div className="party-registry-head">
            <div>
              <span className="account-kicker">إدارة مؤسسية محكومة</span>
              <h2>الممثلون والصلاحيات</h2>
              <p>
                يمكن لمالك المنظمة دعوة ممثلين وتحديد دور كل منهم. لا يستطيع أي
                ممثل منح صلاحية أعلى من صلاحياته، ولا يمكن حذف آخر مالك للمنظمة.
              </p>
            </div>
          </div>

          {organizationAccess.invitations
            .filter(
              (invitation) =>
                invitation.invited_email === identity.email &&
                invitation.status === "PENDING",
            )
            .map((invitation) => (
              <article className="incoming-invitation" key={invitation.invitation_id}>
                <div>
                  <strong>دعوة من {invitation.display_name_ar}</strong>
                  <small>
                    الدور المقترح:{" "}
                    {organizationRoleLabels[invitation.role_code] ??
                      invitation.role_code}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void organizationAction({
                      action: "ACCEPT_INVITATION",
                      invitationId: invitation.invitation_id,
                    })
                  }
                >
                  قبول الدعوة
                </button>
              </article>
            ))}

          {party.party_type === "ORGANIZATION" && party.party_id && (
            <>
              <div className="representative-invite">
                <label>
                  <span>البريد الإلكتروني للممثل</span>
                  <input
                    dir="ltr"
                    type="email"
                    placeholder="name@example.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                </label>
                <label>
                  <span>الدور المؤسسي</span>
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value)}
                  >
                    {organizationRoles.map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => void inviteRepresentative()}>
                  إنشاء دعوة
                </button>
              </div>

              {organizationMessage && (
                <p className="organization-message">{organizationMessage}</p>
              )}

              <div className="representatives-table-wrap">
                <table className="representatives-table">
                  <thead>
                    <tr>
                      <th>الممثل</th>
                      <th>البريد الإلكتروني</th>
                      <th>الدور</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizationAccess.representatives
                      .filter(
                        (representative) =>
                          representative.organization_party_id === party.party_id,
                      )
                      .map((representative) => (
                        <tr key={representative.account_id}>
                          <td>{representative.display_name ?? "مستخدم مسجل"}</td>
                          <td dir="ltr">{representative.email}</td>
                          <td>
                            {organizationRoleLabels[
                              representative.relationship_code
                            ] ?? representative.relationship_code}
                          </td>
                          <td>{representative.status === "ACTIVE" ? "فعّال" : "موقوف"}</td>
                        </tr>
                      ))}
                    {organizationAccess.invitations
                      .filter(
                        (invitation) =>
                          invitation.organization_party_id === party.party_id &&
                          invitation.status === "PENDING",
                      )
                      .map((invitation) => (
                        <tr key={invitation.invitation_id}>
                          <td>دعوة لم تُقبل بعد</td>
                          <td dir="ltr">{invitation.invited_email}</td>
                          <td>
                            {organizationRoleLabels[invitation.role_code] ??
                              invitation.role_code}
                          </td>
                          <td>بانتظار القبول</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {party.party_id && (
        <section className="document-repository">
          <div className="party-registry-head">
            <div>
              <span className="account-kicker">مستودع الأدلة الآمن</span>
              <h2>الوثائق والأدلة المهنية</h2>
              <p>
                ارفع عدة ملفات واربطها بالعضوية المناسبة. مستوى السرية يطبق على
                كل وثيقة بصورة مستقلة، ولا تصبح الوثيقة عامة قبل اعتمادها.
              </p>
            </div>
            <div className="document-summary-actions">
              <a
                className="public-profile-link"
                href={`/public-profile/${party.party_id}`}
                target="_blank"
                rel="noreferrer"
              >
                معاينة الملف العام
              </a>
              <span className="document-count">{documents.length} وثيقة</span>
            </div>
          </div>

          <div className="document-upload">
            <label className="document-file-picker">
              <span>اختيار الملفات</span>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.png,.jpg,.jpeg"
                onChange={(event) =>
                  setDocumentFiles(Array.from(event.target.files ?? []))
                }
              />
              <small>
                حتى 5 ملفات في العملية، وبحد أقصى 10 ميغابايت للملف.
              </small>
            </label>
            <label>
              <span>تصنيف الوثيقة</span>
              <select
                value={documentCategory}
                onChange={(event) => setDocumentCategory(event.target.value)}
              >
                {documentCategories.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>العضوية المرتبطة</span>
              <select
                value={documentMembership}
                onChange={(event) => setDocumentMembership(event.target.value)}
              >
                <option value="">وثيقة عامة لصاحب السجل</option>
                {selected.map((code) => (
                  <option value={code} key={code}>
                    {labelByCode.get(code) ?? code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>مستوى السرية</span>
              <select
                value={documentVisibility}
                onChange={(event) => setDocumentVisibility(event.target.value)}
              >
                {documentConfidentiality.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void uploadDocuments()}>
              رفع وحفظ الملفات
            </button>
          </div>

          {documentFiles.length > 0 && (
            <p className="selected-files">
              الملفات المختارة: {documentFiles.map((file) => file.name).join("، ")}
            </p>
          )}
          {documentMessage && (
            <p className="organization-message">{documentMessage}</p>
          )}

          {documents.length > 0 && (
            <div className="documents-list">
              {documents.map((document) => (
                <article key={document.document_id}>
                  <div className="document-icon" aria-hidden="true">
                    ▣
                  </div>
                  <div className="document-info">
                    <strong>{document.title}</strong>
                    <small>
                      {documentCategories.find(
                        ([value]) => value === document.category_code,
                      )?.[1] ?? document.category_code}
                      {" · "}
                      {(document.size_bytes / 1024 / 1024).toFixed(2)} MB
                    </small>
                    <span>
                      {document.verification_status === "PENDING"
                        ? "قيد التحقق"
                        : document.verification_status === "VERIFIED"
                          ? "تم التحقق"
                          : "لم ترسل للتحقق"}
                    </span>
                  </div>
                  <select
                    aria-label="مستوى سرية الوثيقة"
                    value={document.confidentiality}
                    onChange={(event) =>
                      void documentAction(
                        document.document_id,
                        "UPDATE_CONFIDENTIALITY",
                        event.target.value,
                      )
                    }
                  >
                    {documentConfidentiality.map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <div className="document-actions">
                    <a href={`/api/documents/${document.document_id}`}>تنزيل</a>
                    <button
                      type="button"
                      disabled={document.verification_status === "PENDING"}
                      onClick={() =>
                        void documentAction(
                          document.document_id,
                          "SUBMIT_VERIFICATION",
                        )
                      }
                    >
                      إرسال للتحقق
                    </button>
                    <button
                      className="archive"
                      type="button"
                      onClick={() =>
                        void documentAction(document.document_id, "ARCHIVE")
                      }
                    >
                      أرشفة
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {dashboard.profiles.length > 0 && (
        <section className="account-dashboard">
          <div className="dashboard-title">
            <div>
              <span className="account-kicker">مركز الحساب</span>
              <h2>عضوياتي وحالاتها</h2>
            </div>
            {dashboard.unreadCount > 0 && (
              <button type="button" onClick={() => void markNotificationsRead()}>
                {dashboard.unreadCount} إشعار جديد · تعليم كمقروء
              </button>
            )}
          </div>
          <div className="profile-status-grid">
            {dashboard.profiles.map((profile) => {
              const completion = profileCompletion(profile);
              const latestDecision = dashboard.transitions.find(
                (transition) =>
                  transition.membership_code === profile.membership_code,
              );
              return (
                <article key={profile.profile_id}>
                  <div className="profile-status-head">
                    <strong>
                      {labelByCode.get(profile.membership_code) ??
                        profile.membership_code}
                    </strong>
                    <span className={`server-status ${profile.lifecycle_status}`}>
                      {statusLabels[profile.lifecycle_status] ??
                        profile.lifecycle_status}
                    </span>
                  </div>
                  <div className="completion-bar">
                    <i style={{ width: `${completion}%` }} />
                  </div>
                  <small>
                    اكتمال {completion}% · الإصدار {profile.revision}
                  </small>
                  {latestDecision?.reason && (
                    <p className="decision-reason">
                      الملاحظة: {latestDecision.reason}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => openProfile(profile.membership_code)}
                  >
                    {profile.lifecycle_status === "needs_changes"
                      ? "استكمال المطلوب"
                      : "فتح بيانات العضوية"}
                  </button>
                </article>
              );
            })}
          </div>
          {dashboard.notifications.length > 0 && (
            <div className="notification-list">
              <h3>آخر الإشعارات</h3>
              {dashboard.notifications.slice(0, 5).map((notification) => (
                <div
                  className={notification.is_read ? "" : "unread"}
                  key={notification.notification_id}
                >
                  <span>{notification.is_read ? "✓" : "●"}</span>
                  <p>
                    <strong>{notification.title}</strong>
                    <small>{notification.message}</small>
                  </p>
                  <time>
                    {new Date(notification.created_at).toLocaleDateString("ar")}
                  </time>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="membership-grid">
        {memberships.map((membership) => {
          const checked = selected.includes(membership.code);
          return (
            <button
              className={`membership-card ${checked ? "selected" : ""} ${
                membership.administrative ? "administrative" : ""
              }`}
              key={membership.code}
              type="button"
              aria-pressed={checked}
              onClick={() => toggleMembership(membership)}
            >
              <span className="membership-check">
                {membership.administrative ? "🔒" : checked ? "✓" : ""}
              </span>
              <strong>{membership.label}</strong>
              <small>{membership.description}</small>
              <span className="membership-state">
                {membership.administrative
                  ? "يتطلب تعيينًا إداريًا"
                  : checked
                    ? "تم الاختيار"
                    : "متاح للاختيار"}
              </span>
            </button>
          );
        })}
      </div>

      {selected.includes("client") && (
        <label className="client-type">
          <span>
            نوع حساب العميل <em>*</em>
          </span>
          <select
            value={clientType}
            onChange={(event) => setClientType(event.target.value)}
          >
            <option value="">اختر نوع العميل…</option>
            {clientTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      )}

      {message && (
        <div className="account-message" role="alert">
          {message}
        </div>
      )}

      <footer className="account-actions">
        <a href="/eim/index.html#/60">العودة إلى الموقع العام</a>
        <div>
          <span>{selected.length} عضوية محددة</span>
          <button
            type="button"
            disabled={syncState === "saving"}
            onClick={() => void continueSetup()}
          >
            {syncState === "saving"
              ? "جارٍ الحفظ…"
              : "حفظ وبدء إدخال البيانات"}
          </button>
        </div>
      </footer>
    </section>
  );
}
