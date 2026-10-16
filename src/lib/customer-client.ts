import { refreshSession } from "./auth-client";
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function apiResponse(url: string, data?: unknown, method = "GET") {
  if (!url.startsWith("/api/")) throw new Error("Invalid API URL.");
  const send = async () => {
    const headers: Record<string, string> = {};
    if (method !== "GET") {
      const response = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
      const value = await response.json();
      if (!response.ok) throw new ApiError(value.error || "Unable to prepare your request.", response.status);
      headers["x-csrf-token"] = value.csrfToken; headers["content-type"] = "application/json";
    }
    return fetch(url, { method, headers, body: method === "GET" ? undefined : JSON.stringify(data || {}), credentials: "same-origin", cache: "no-store" });
  };
  let response = await send();
  if (response.status === 401) { await refreshSession(); response = await send(); }
  return response;
}
export async function apiRequest<T>(url: string, data?: unknown, method = "GET"): Promise<T> {
  const response = await apiResponse(url, data, method);
  let value: any; try { value = await response.json(); } catch { throw new ApiError("The response could not be read. Retry the same request.", response.status); }
  if (!response.ok) throw new ApiError(value.error || "We could not complete your request.", response.status);
  return value as T;
}
