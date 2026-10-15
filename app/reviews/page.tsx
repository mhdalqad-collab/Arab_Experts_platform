import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import ReviewQueue from "./review-queue";
import "./reviews.css";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const user = await requireChatGPTUser("/reviews");
  return (
    <main className="reviews-shell">
      <header>
        <div>
          <span>شبكة الخبراء العرب</span>
          <h1>مراجعة طلبات العضوية</h1>
        </div>
        <nav>
          <Link href="/operations/workflow">مركز التشغيل</Link>
          <Link href="/account">حسابي</Link>
          <Link href="/eim/index.html#/60">الموقع العام</Link>
          <a href={chatGPTSignOutPath("/")}>خروج</a>
        </nav>
      </header>
      <ReviewQueue reviewerEmail={user.email} />
    </main>
  );
}
