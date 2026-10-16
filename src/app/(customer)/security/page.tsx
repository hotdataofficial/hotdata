import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { SecurityPanel } from "@/components/auth/security-panel";
import { requireActor } from "@/server/auth/sessions";
import { config } from "@/server/config";
import { HttpError } from "@/server/security/http";
export const dynamic = "force-dynamic";
export default async function Page() {
  let actor;
  try { actor = await requireActor(new NextRequest(config().APP_URL, { headers: { cookie: (await cookies()).toString() } })); }
  catch (error) { if (error instanceof HttpError && error.status === 401) redirect("/login"); throw error; }
  return <SecurityPanel user={{ fullName: actor.fullName, email: actor.email, phone: actor.phone, role: actor.role, emailVerified: !!actor.emailVerifiedAt, phoneVerified: !!actor.phoneVerifiedAt, hasPin: !!actor.pinHash }} />;
}
