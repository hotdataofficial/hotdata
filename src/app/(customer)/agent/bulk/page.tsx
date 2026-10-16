import { redirect } from "next/navigation";
import { pageActor } from "@/server/auth/page-actor";
import { BulkPanel } from "@/components/agent/bulk-panel";
export default async function Page(){const actor=await pageActor();if(actor.role!=="AGENT")redirect("/agent");return <BulkPanel/>;}
