import { refreshSession } from "./auth-client";
export async function walletRequest(action: string, data?: unknown, method = "POST") {
  const send = async () => {
    const headers: Record<string, string> = {};
    if (method !== "GET") {
      const csrfResponse = await fetch("/api/auth/csrf", { cache: "no-store", credentials: "same-origin" });
      const csrf = await csrfResponse.json(); if (!csrfResponse.ok) throw new Error(csrf.error);
      headers["x-csrf-token"] = csrf.csrfToken;
      if (!(data instanceof FormData)) headers["Content-Type"] = "application/json";
    }
    return fetch("/api/wallet/" + action, { method, credentials: "same-origin", cache: "no-store", headers, body: method === "GET" ? undefined : data instanceof FormData ? data : JSON.stringify(data || {}) });
  };
  let response = await send();
  if (response.status === 401) { await refreshSession(); response = await send(); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to complete the wallet request.");
  return result;
}
