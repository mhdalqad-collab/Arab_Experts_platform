import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../../chatgpt-auth";
import WorkflowOperations from "./workflow-operations";
import "./workflow-operations.css";

export const dynamic = "force-dynamic";

export default async function WorkflowOperationsPage() {
  const user = await requireChatGPTUser("/operations/workflow");
  return (
    <main className="ops-shell">
      <header className="ops-header">
        <div>
          <span>شبكة الخبراء العرب · مركز التشغيل</span>
          <h1>حوكمة سير عمل طلب الخدمة</h1>
          <p>الجاهزية، التفعيل التدريجي، حدود السلامة، والتسليم غير المتزامن.</p>
        </div>
        <nav aria-label="التنقل الإداري">
          <Link href="/reviews">مراجعات العضوية</Link>
          <Link href="/account">حسابي</Link>
          <Link href="/eim/index.html#/60">الموقع العام</Link>
          <a href={chatGPTSignOutPath()}>خروج</a>
        </nav>
      </header>
      <WorkflowOperations operatorEmail={user.email} />
    </main>
  );
}
