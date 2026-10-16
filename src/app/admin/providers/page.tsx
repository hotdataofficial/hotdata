import Panel from "@/components/admin/providers-panel";
import { pageActor } from "@/server/auth/page-actor";
import { redirect } from "next/navigation";
export default async function Page(){const actor=await pageActor();if(actor.role!=="SUPER_ADMIN")redirect("/admin");return <Panel/>;}
