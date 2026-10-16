import { PurchasePanel } from "@/components/customer/purchase-panel";
import { Suspense } from "react";
import { CustomerLoading } from "@/components/customer/shared";
export default function Page() { return <Suspense fallback={<CustomerLoading />}><PurchasePanel /></Suspense>; }
