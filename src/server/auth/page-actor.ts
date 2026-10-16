import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { requireActor } from "./sessions";
import { config } from "../config";
import { HttpError } from "../security/http";
import { sessionReturn } from "@/lib/session-return";
export async function pageActor() {
  try { return await requireActor(new NextRequest(config().APP_URL, { headers: { cookie: (await cookies()).toString() } })); }
  catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      const requestHeaders = await headers();
      // Strict cookies are withheld on the first navigation back from checkout.
      if ((await cookies()).get("hotdata_refresh")?.value || requestHeaders.get("sec-fetch-site") === "cross-site") {
        const next = sessionReturn(requestHeaders.get("x-hotdata-return-to"));
        redirect("/session-refresh?next=" + encodeURIComponent(next));
      }
      redirect("/login");
    }
    throw error;
  }
}
