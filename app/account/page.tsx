import Image from "next/image";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import AccountSetup from "./account-setup";
import "./account.css";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireChatGPTUser("/account");

  return (
    <main className="account-shell">
      <header className="account-topbar">
        <Link className="account-brand" href="/eim/index.html#/60">
          <Image
            src="/eim/assets/nae-logo.svg"
            alt="شعار شبكة الخبراء العرب"
            width={56}
            height={56}
            priority
          />
          <span>
            <strong>شبكة الخبراء العرب</strong>
            <small>إدارة الحساب والعضويات</small>
          </span>
        </Link>
        <div className="account-user">
          <span>
            <strong>{user.displayName}</strong>
            <small>{user.email}</small>
          </span>
          <a href={chatGPTSignOutPath()}>تسجيل الخروج</a>
        </div>
      </header>

      <AccountSetup
        identity={{
          displayName: user.displayName,
          email: user.email,
          fullName: user.fullName,
        }}
      />
    </main>
  );
}
