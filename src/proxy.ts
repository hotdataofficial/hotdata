import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  // Always overwrite the client header; retain the page and payment callback query.
  headers.set("x-hotdata-return-to", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
