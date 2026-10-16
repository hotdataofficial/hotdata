import type { Metadata } from "next";
import { pageActor } from "@/server/auth/page-actor";
import { SiteNotices } from "@/components/public/site-notices";
import { CustomerShell } from "@/components/customer/customer-shell";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const actor = await pageActor();
  return <CustomerShell user={{ fullName: actor.fullName, email: actor.email, phone: actor.phone, role: actor.role, emailVerified: !!actor.emailVerifiedAt, hasPin: !!actor.pinHash }}><SiteNotices />{children}</CustomerShell>;
}
