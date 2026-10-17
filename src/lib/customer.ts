export const networkCodes = ["MTN", "AIRTEL", "GLO", "9MOBILE"] as const;
export function guessNetwork(phone: string): string | null {
  const value = phone.replace(/[\s()-]/g, "").replace(/^\+?234/, "0");
  const prefix = value.slice(0, 4);
  if (["0803", "0806", "0703", "0706", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916"].includes(prefix)) return "MTN";
  if (["0802", "0808", "0708", "0812", "0701", "0902", "0907", "0901", "0912"].includes(prefix)) return "AIRTEL";
  if (["0805", "0807", "0705", "0811", "0815", "0905", "0915"].includes(prefix)) return "GLO";
  if (["0809", "0817", "0818", "0909", "0908"].includes(prefix)) return "9MOBILE";
  return null;
}
export function transactionLabel(status: string, refundedAt?: string | Date | null) {
  if (status === "SUCCESSFUL") return "Successful";
  if (status === "FAILED") return refundedAt ? "Failed, refunded" : "Failed";
  return "Processing";
}
export function lagosDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(value));
}
export function displayPlanType(value: string) {
  return ({ SME: "SME", GIFTING: "Gifting", CORPORATE_GIFTING: "Corporate gifting", DIRECT: "Direct" } as Record<string, string>)[value] || value;
}
export type Receipt = {
  purchaseType?: "DATA" | "AIRTIME";
  reference: string; status: "PENDING" | "SUCCESSFUL" | "FAILED"; phone: string; amountKobo: string;
  refundedAt: string | null; createdAt: string; completedAt: string | null;
  plan: { name: string; networkCode: string; type: string; sizeMb: number; validityDays: number } | null;
  historicalSnapshot: boolean; customerName: string; planId: string | null;
};

// Keep a saved retry unchanged; fresh purchases must use a type offered by the network.
export function selectedPlanType(types: string[], requested: string, locked = false): string {
  return locked || types.includes(requested) ? requested : (types[0] || requested);
}
