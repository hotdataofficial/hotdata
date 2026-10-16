import { safeCsvCell } from "@/lib/admin";
export function markedUp(cost: bigint, mode: "FIXED" | "PERCENT", value: bigint): bigint {
  if (cost <= 0n || value < 0n) throw new Error("Invalid markup.");
  return cost + (mode === "FIXED" ? value : (cost * value + 9999n) / 10000n);
}
// Percent input uses basis points: 1250 = 12.5%. Round up to whole kobo.
export const csvCell = safeCsvCell;
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (ch === "," || ch === "\n")) { row.push(cell.replace(/\r$/, "")); cell = ""; if (ch === "\n") { rows.push(row); row = []; } }
    else cell += ch;
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ""));
}
