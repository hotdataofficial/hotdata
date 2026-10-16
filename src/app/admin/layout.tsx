import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageActor } from "@/server/auth/page-actor";
import { AdminShell } from "@/components/admin/admin-shell";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Admin",robots:{index:false,follow:false}};
export default async function AdminLayout({children}:{children:React.ReactNode}){const actor=await pageActor();if(!["ADMIN","SUPER_ADMIN"].includes(actor.role))redirect("/dashboard");return <AdminShell name={actor.fullName} role={actor.role}>{children}</AdminShell>;}
