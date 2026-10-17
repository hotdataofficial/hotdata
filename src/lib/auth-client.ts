let csrfPromise: Promise<string> | undefined;
let refreshPromise: Promise<unknown> | undefined;
async function csrfToken() {
  if (!csrfPromise) csrfPromise = fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" }).then(async response => {
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "Unable to prepare request.");
    return value.csrfToken as string;
  }).catch(error => { csrfPromise = undefined; throw error; });
  return csrfPromise;
}
async function send(action: string, data: unknown, method: string) {
  return fetch("/api/auth/" + action, { method, credentials: "same-origin", cache: "no-store", headers: method === "GET" ? {} : { "content-type": "application/json", "x-csrf-token": await csrfToken() }, body: method === "GET" ? undefined : JSON.stringify(data || {}) });
}
export function refreshSession(): Promise<unknown> {
  if (!refreshPromise) {
    // Single flight inside this tab plus an origin-wide browser lock. Otherwise
    // two tabs can rotate the same cookie and revoke a legitimate session as replay.
    const refresh = () => authRequest("refresh");
    refreshPromise = (typeof navigator !== "undefined" && navigator.locks?.request
      ? navigator.locks.request("hotdata-session-refresh", refresh)
      : refresh()).finally(() => { refreshPromise = undefined; });
  }
  return refreshPromise;
}
export async function authRequest(action: string, data?: unknown, method = "POST"): Promise<any> {
  let response = await send(action, data, method);
  if (response.status === 403 && method !== "GET") {
    csrfPromise = undefined; response = await send(action, data, method);
  }
  if (response.status === 401 && !["login", "refresh", "reset-password"].includes(action)) {
    await refreshSession(); response = await send(action, data, method);
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to complete request.");
  return result;
}
