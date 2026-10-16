import { randomUUID } from "node:crypto";
export type SafeIncident = { eventId: string; event: string; type: string; timestamp: string };
export function incident(event: string, error: unknown): SafeIncident {
 const record = { eventId: randomUUID(), event, type: error instanceof Error ? error.name : "Unknown", timestamp: new Date().toISOString() };
 // Strict allowlist: no bodies, URLs, SQL, stacks, user details, PINs or tokens.
 console.error(JSON.stringify(record));
 return record;
}
// Sentry bridge: forward these safe JSON records from the logging collector.
// Do not enable SDK default request/stack capture for financial endpoints.
