export function apiInput(data: unknown, method: string) {
  if (method === "GET" && data && typeof data === "object" && "method" in data && "body" in data) {
    const options = data as { method: unknown; body: unknown };
    if (typeof options.method !== "string" || !["POST", "PUT", "PATCH", "DELETE"].includes(options.method) || typeof options.body !== "string") throw new Error("Invalid API request options.");
    return { method: options.method, data: JSON.parse(options.body) as unknown };
  }
  return { method, data };
}
