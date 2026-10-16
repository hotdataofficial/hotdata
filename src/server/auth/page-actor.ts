import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { requireActor } from "./sessions";
import { config } from "../config";
import { HttpError } from "../security/http";
export async function pageActor() {
  try { return await requireActor(new NextRequest(config().APP_URL, { headers: { cookie: (await cookies()).toString() } })); }
  catch (error) { if (error instanceof HttpError && error.status === 401) redirect("/login"); throw error; }
}
