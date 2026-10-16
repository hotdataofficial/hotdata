export function lagosDay(value: string): Date {
  const milliseconds = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) throw new Error("Enter a valid calendar date.");
  return new Date(milliseconds - 3600000);
}
export function historyDates(from?: string, to?: string) {
  return { ...(from ? { gte: lagosDay(from) } : {}), ...(to ? { lt: new Date(lagosDay(to).getTime() + 86400000) } : {}) };
}
