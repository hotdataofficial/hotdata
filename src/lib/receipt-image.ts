import type { Receipt } from "./customer";
import { lagosDate, transactionLabel, displayPlanType } from "./customer";
import { formatKobo } from "./money";
import { tokens } from "./design-tokens";
export async function receiptImage(receipt: Receipt): Promise<Blob> {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1440;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image export is unavailable.");
  const colors = tokens.colors; ctx.fillStyle = colors.white; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.deep; ctx.fillRect(0, 0, 1080, 235);
  ctx.fillStyle = colors.accent; [28, 45, 65].forEach((height, index) => ctx.fillRect(70 + index * 22, 116 - height, 14, height));
  ctx.fillStyle = colors.white; ctx.font = "700 54px system-ui"; ctx.fillText("Hotdata", 160, 113);
  ctx.font = "26px system-ui"; ctx.fillText("Data purchase receipt", 70, 177);
  function wrap(text: string, x: number, y: number, width: number, lineHeight: number) {
    let line = "", row = 0;
    // Wrap long references and phone text without clipping.
    for (const char of text) { if (ctx!.measureText(line + char).width > width) { ctx!.fillText(line, x, y + row++ * lineHeight); line = char; } else line += char; }
    ctx!.fillText(line, x, y + row * lineHeight); return (row + 1) * lineHeight;
  }
  let y = 300;
  const rows = [
    ["Status", transactionLabel(receipt.status, receipt.refundedAt)], ["Bundle", receipt.plan ? receipt.plan.networkCode + " · " + receipt.plan.name : "Data purchase"],
    ["Plan type", receipt.plan ? displayPlanType(receipt.plan.type) : "Unavailable"], ["Recipient", receipt.phone],
    ["Amount", formatKobo(receipt.amountKobo)], ["Reference", receipt.reference], ["Created", lagosDate(receipt.createdAt)],
  ];
  for (const [label, value] of rows) {
    ctx.fillStyle = colors.muted; ctx.font = "24px system-ui"; ctx.fillText(label, 70, y);
    ctx.fillStyle = colors.text; ctx.font = label === "Amount" ? "700 42px system-ui" : "600 28px system-ui";
    y += 39 + wrap(value, 70, y + 42, 940, 35) + 37;
  }
  ctx.fillStyle = colors.tint; ctx.fillRect(50, 1260, 980, 120); ctx.fillStyle = colors.deep; ctx.font = "22px system-ui";
  wrap(receipt.status === "PENDING" ? "Processing. Delivery is awaiting confirmation." : receipt.refundedAt ? "Confirmed failure. The wallet debit has been refunded." : "Receipt snapshot. Sign in to check the latest status.", 75, 1301, 930, 30);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Unable to create receipt image.")), "image/png"));
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
