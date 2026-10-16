import { notFound } from "next/navigation";
import { pageActor } from "@/server/auth/page-actor";
import { ownReceipt } from "@/server/services/customer-records";
import { HttpError } from "@/server/security/http";
import { ReceiptPanel } from "@/components/customer/receipt-panel";
export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  const actor = await pageActor(), { reference } = await params;
  try { return <ReceiptPanel initial={await ownReceipt(actor.id, reference)} />; }
  catch (e) { if (e instanceof HttpError && e.status === 404) notFound(); throw e; }
}
