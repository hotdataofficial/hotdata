import { Suspense } from "react";
import { AirtimePanel } from "@/components/customer/airtime-panel";
import { CustomerLoading } from "@/components/customer/shared";
export default function Page() { return <Suspense fallback={<CustomerLoading />}><AirtimePanel /></Suspense>; }
