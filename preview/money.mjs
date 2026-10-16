export function parseNaira(input        )         {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(input.trim())) throw new Error("Enter an amount with up to two decimal places.");
  const [whole, fraction = ""] = input.trim().split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function formatKobo(input                 )         {
  const value = BigInt(input); const absolute = value < 0n ? -value : value;
  return (value < 0n ? "−" : "") + "₦" + (absolute / 100n).toLocaleString("en-NG") + "." + (absolute % 100n).toString().padStart(2, "0");
}
export function fundingFee(amount        , flat        , basisPoints        )         {
  if (amount <= 0n || flat < 0n || !Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) throw new Error("Invalid funding fee settings.");
  const fee = flat + (amount * BigInt(basisPoints) + 9999n) / 10000n;
  if (fee >= amount) throw new Error("Funding amount must exceed the fee.");
  return fee;
}
