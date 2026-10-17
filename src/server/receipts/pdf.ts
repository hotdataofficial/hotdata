import type { Receipt } from "@/lib/customer";
// Small, dependency-free PDF 1.4 writer. All export text is deliberately ASCII;
// the web/PNG receipt retains full Unicode plan and customer names.
const literal = (value: string) => value.replace(/[^\x20-\x7e]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
function amount(value: string) {
  const n = BigInt(value);
  return "NGN " + (n / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + (n % 100n).toString().padStart(2, "0");
}
export function receiptPdf(receipt: Receipt): Uint8Array {
  const status = receipt.status === "SUCCESSFUL" ? "Successful" : receipt.status === "FAILED" ? receipt.refundedAt ? "Failed, refunded" : "Failed" : "Processing";
  const airtime = receipt.purchaseType === "AIRTIME";
  const rows = [
    ["Reference", receipt.reference], ["Status", status], ["Recipient", receipt.phone],
    ["Network", receipt.plan?.networkCode || "Unavailable"],
    [airtime ? "Airtime value" : "Bundle", airtime ? amount(receipt.amountKobo) : receipt.plan ? receipt.plan.sizeMb + " MB / " + receipt.plan.validityDays + " days" : "Unavailable"],
    ["Service", airtime ? "Airtime top-up" : receipt.plan?.type.replaceAll("_", " ") || "Unavailable"],
    ["Amount", amount(receipt.amountKobo)], ["Created", new Date(receipt.createdAt).toISOString()],
    ["Completed", receipt.completedAt ? new Date(receipt.completedAt).toISOString() : "Awaiting confirmation"],
  ];
  const text = (x: number, y: number, size: number, content: string, bold = false) => "BT /" + (bold ? "F2" : "F1") + " " + size + " Tf 1 0 0 1 " + x + " " + y + " Tm (" + literal(content) + ") Tj ET";
  let stream = "0.078 0.325 0.176 rg 0 714 595 128 re f\n1 1 1 rg\n" + text(48, 786, 28, "Hotdata", true) + "\n" + text(48, 754, 13, airtime ? "Airtime purchase receipt" : "Data purchase receipt") + "\n0.059 0.090 0.165 rg\n";
  rows.forEach(([label, value], i) => { const y = 675 - i * 48; stream += text(48, y, 10, label) + "\n" + text(48, y - 19, 13, value, label === "Amount") + "\n"; });
  stream += text(48, 165, 10, receipt.status === "PENDING" ? "Processing: delivery has not yet been confirmed." : receipt.refundedAt ? "The wallet debit was refunded after confirmed failure." : receipt.status === "SUCCESSFUL" ? "Delivery confirmed by the provider." : "Check your account for the latest status.") + "\n";
  stream += text(48, 140, 9, "This receipt is a snapshot. Sign in to check the current status.") + "\n";
  if (!receipt.historicalSnapshot) stream += text(48, 119, 9, "Legacy record: plan details reflect the current catalog.") + "\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Length " + Buffer.byteLength(stream, "ascii") + " >>\nstream\n" + stream + "endstream",
  ];
  let result = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(result, "ascii")); result += (i + 1) + " 0 obj\n" + obj + "\nendobj\n"; });
  const xref = Buffer.byteLength(result, "ascii");
  result += "xref\n0 " + offsets.length + "\n0000000000 65535 f \n" + offsets.slice(1).map(n => n.toString().padStart(10, "0") + " 00000 n \n").join("") + "trailer\n<< /Size " + offsets.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return new Uint8Array(Buffer.from(result, "ascii"));
}
