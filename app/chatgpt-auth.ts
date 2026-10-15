// Legacy names preserve page imports; identity now comes from verified OIDC sessions.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { findSession, safeReturnPath, sessionCookieName } from '../server/auth.mjs';
export type ChatGPTUser = { displayName: string; email: string; fullName: string | null };
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  if (process.env.DEPLOYMENT_MODE === 'preview') return null;
  const token = (await cookies()).get(sessionCookieName())?.value;
  return await findSession(token) as ChatGPTUser | null;
}
export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo: string): string {
  return `/auth/signin?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
export function chatGPTSignOutPath(): string { return '/auth/signout'; }
