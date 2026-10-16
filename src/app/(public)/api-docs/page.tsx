import type { Metadata } from "next";
import Link from "next/link";
export const metadata:Metadata={title:"Agent API documentation",description:"Integrate Hotdata agent pricing, wallet balances, data purchases and signed status callbacks."};
const curl="# Set these only in your server environment. Never expose them in a browser.\ncurl \"$HOTDATA_BASE_URL/api/v1/balance\" \\\n  -H \"Authorization: Bearer $HOTDATA_API_KEY\"\n\n# Persist one UUID per intended purchase and reuse it for retries.\ncurl \"$HOTDATA_BASE_URL/api/v1/buy-data\" \\\n  -H \"Authorization: Bearer $HOTDATA_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  --data-binary @- <<JSON\n{\n  \"planId\": \"$PLAN_ID\",\n  \"phone\": \"08030000001\",\n  \"pin\": \"$HOTDATA_PIN\",\n  \"expectedPriceKobo\": \"$PRICE_KOBO\",\n  \"idempotencyKey\": \"$PURCHASE_UUID\"\n}\nJSON";
const javascript=`// Server-side JavaScript. Keep requestKey in your durable order record.
export async function buyData({ planId, phone, priceKobo, requestKey }) {
  const response = await fetch(process.env.HOTDATA_BASE_URL + '/api/v1/buy-data', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.HOTDATA_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ planId, phone, expectedPriceKobo: priceKobo,
      pin: process.env.HOTDATA_PIN, idempotencyKey: requestKey }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Purchase unavailable');
  return result;
}
// A timeout is uncertain. Retry with the SAME requestKey and payload.`;
const php=`<?php
function buyData(string $planId, string $phone, string $priceKobo, string $requestKey): array {
    $payload = json_encode([
        'planId' => $planId, 'phone' => $phone,
        'expectedPriceKobo' => $priceKobo,
        'pin' => getenv('HOTDATA_PIN'), 'idempotencyKey' => $requestKey
    ], JSON_THROW_ON_ERROR);
    $curl = curl_init(rtrim(getenv('HOTDATA_BASE_URL'), '/') . '/api/v1/buy-data');
    curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15, CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . getenv('HOTDATA_API_KEY'),
            'Content-Type: application/json']]);
    $raw = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($raw === false) throw new RuntimeException('Uncertain response; retain the same request key.');
    $result = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if ($status < 200 || $status >= 300) throw new RuntimeException($result['error'] ?? 'Purchase unavailable');
    return $result;
}
// Persist requestKey before calling and reuse it after a timeout.
?>`;
const verify=`import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyHotdataCallback(rawBody, timestamp, signature, secret, now = Date.now()) {
  if (!/^\\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(timestamp + '.' + rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
// Verify the exact raw bytes BEFORE parsing JSON.
// Atomically deduplicate eventId in your database, then return HTTP 2xx.`;
function Code({children}:{children:string}){return <pre className="mt-4 overflow-auto rounded-card border border-line bg-slate-50 p-5 text-xs leading-6"><code>{children}</code></pre>;}
export default function Page(){return <main className="mx-auto max-w-5xl px-5 py-12"><p className="text-sm font-semibold text-brand-dark">HOTDATA · DEVELOPER GUIDE</p><h1 className="mt-3 text-4xl font-bold">Build your next connection.</h1><p className="mt-5 max-w-3xl leading-7 text-muted">Use an active, verified agent account and a server-side bearer key. Money values are decimal strings in integer kobo: 30000 means ₦300.00. The transaction PIN is required for every new purchase.</p><Link href="/agent/keys" className="mt-5 inline-flex min-h-11 items-center rounded-button bg-brand-dark px-5 font-semibold text-white">Manage your API keys →</Link><section className="mt-10 rounded-card border border-line bg-white p-6"><h2 className="text-2xl font-bold">Endpoints</h2><div className="mt-5 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Method</th><th className="p-3">Path</th><th className="p-3">Response</th></tr></thead><tbody>{[["GET","/api/v1/balance","currency and balanceKobo"],["GET","/api/v1/plans","Agent prices and availability; up to 1,000 enabled plans"],["POST","/api/v1/buy-data","202: queued purchase reference and current status"],["GET","/api/v1/transactions?reference=HD-D-…","Your account’s purchase status"]].map(([method,path,description])=><tr key={path} className="border-t border-line"><td className="p-3 font-semibold">{method}</td><td className="p-3 font-mono text-xs">{path}</td><td className="p-3">{description}</td></tr>)}</tbody></table></div><p className="mt-5 text-sm leading-7 text-muted">Send Authorization: Bearer YOUR_KEY. Requests are limited per agent account, across all its keys: 120 reads and 20 purchases per minute. Authentication is additionally limited to 300 requests per client IP per minute. Browser cookie authentication does not authorise this API. Use server-side requests; CORS access is not enabled for arbitrary browser origins.</p></section><section className="mt-10"><h2 className="text-2xl font-bold">Purchase request and retries</h2><p className="mt-4 leading-7 text-muted">Use planId from the live plan response, a Nigerian phone number, your four-digit pin, expectedPriceKobo and a UUID idempotencyKey. Persist the UUID before submitting. A retry with the same key, plan and normalised phone returns the existing purchase; it does not debit or deliver twice. The same key through another API credential conflicts. Changing the payload requires a new intentional purchase. expectedPriceKobo checks the live price before a new debit.</p><Code>{`{
  "planId": "LIVE_PLAN_ID",
  "phone": "08030000001",
  "pin": "YOUR_FOUR_DIGIT_PIN",
  "expectedPriceKobo": "LIVE_PRICE_KOBO",
  "idempotencyKey": "d2e44353-5f80-47d9-bc9c-7be069b42edf"
}`}</Code><p className="mt-4 leading-7 text-muted">PENDING means the outcome is uncertain. Poll status or wait for a signed callback. SUCCESSFUL means confirmed delivery. FAILED with refundedAt means the wallet was refunded. A timeout, HTTP 503 or missing response does not prove failure. Do not start a new purchase to retry that same order.</p></section><section className="mt-10"><h2 className="text-2xl font-bold">cURL</h2><Code>{curl}</Code></section><section className="mt-10"><h2 className="text-2xl font-bold">JavaScript</h2><Code>{javascript}</Code></section><section className="mt-10"><h2 className="text-2xl font-bold">PHP</h2><Code>{php}</Code></section><section className="mt-10"><h2 className="text-2xl font-bold">Signed final-status callbacks</h2><p className="mt-4 leading-7 text-muted">Configure an approved HTTPS callback URL when creating a key. Save the separate signing secret shown once. Hotdata sends JSON containing eventId, event (data.final), transactionId, reference, status, amountKobo, phone, refunded and completedAt. Headers are X-Hotdata-Timestamp, X-Hotdata-Signature and X-Hotdata-Event-Id. The signature is lowercase HMAC-SHA256 over timestamp + a full stop + the exact raw JSON body.</p><Code>{verify}</Code><p className="mt-4 leading-7 text-muted">Return HTTP 2xx only after processing or safely recognising an already processed eventId. Delivery is at least once, with up to eight attempts and exponential retry delays; timestamps/signatures refresh but eventId remains stable. Redirects are not followed. Revoked keys and unavailable agent accounts cancel delivery. After exhaustion, your notifications direct you to poll status. Callback hosts must be explicitly approved by the operator and resolve exclusively to public addresses on every attempt.</p></section><section className="mt-10"><h2 className="text-2xl font-bold">Errors and availability</h2><p className="mt-4 leading-7 text-muted">400: invalid input, PIN or purchase limit. 401: invalid/revoked key or account. 403: IP/tier restriction. 404: unknown resource. 409: request-key conflict or changed price. 429: rate limit. 503: maintenance or unavailable service/plan. Provider templates remain disabled until verified; documentation does not imply live plan availability.</p></section></main>;}
