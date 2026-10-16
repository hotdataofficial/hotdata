# Hotdata bundle pricing and profit

Snapshot: 2026-10-14. Imported 94 Gsubz data bundles and their exact serviceID:plan mappings into the production database. Supplier prices use api_price, not the public retail price. All provider delivery is disabled during sandbox testing.

## Selling prices
Customer: supplier cost plus the greater of 10% or ₦20. Agent: supplier cost plus the greater of 5% or ₦10. Round the total up to the next ₦5. This is a starting pricing policy chosen for this catalog, not a guarantee of market competitiveness or net earnings. Admins can change prices; sync preserves prices that still cover current cost. Review fees before live launch.

## Actual examples
| Bundle | Supplier cost | Customer price | Customer gross profit | Agent price | Agent gross profit |
|---|---:|---:|---:|---:|---:|
| MTN SME 1GB / 30 days | ₦380.58 | ₦420 | ₦39.42 | ₦400 | ₦19.42 |
| MTN Gifting 1GB / 30 days | ₦394.89 | ₦435 | ₦40.11 | ₦415 | ₦20.11 |
| Glo Corporate 1GB / 30 days | ₦395 | ₦435 | ₦40 | ₦415 | ₦20 |
| 9mobile/T2 1GB / 30 days | ₦475 | ₦525 | ₦50 | ₦500 | ₦25 |

## Money flow
A customer funds the Hotdata wallet through Korapay. The wallet credit is money owed to the customer, not sales revenue. When they buy data, Hotdata debits its selling price, Gsubz deducts the supplier cost from the separate funded Gsubz merchant wallet, and delivery must be confirmed. Gross profit is recognized on successful delivery. Supplier amountPaid updates actual cost where returned. Refunds do not count as profitable sales. Korapay settlement and Gsubz wallet replenishment are separate cash flows; neither automatically transfers a per-order profit payment to you.

Net profit = successful sales − actual supplier costs − payment/settlement charges − referral rewards − hosting/email/support and other expenses − applicable taxes. Actual Korapay fees and referral configuration must be reviewed; admin Gross profit does not deduct these. Never treat unused customer wallet balances as profit.

For scale only: 100 successful MTN SME 1GB retail sales at this snapshot produce ₦3,942 gross margin; 1,000 produce ₦39,420 before expenses. These are arithmetic examples, not sales forecasts.

## Current connection status
Postgres and Redis readiness passed. Production GSUBZ_API_KEY authentication verified inside Vercel with a non-spending balance check; sensitive values were not exported. A protected super-admin balance check is implemented on /api/admin/gsubz. Catalog normalization, safe synchronization and pricing/fulfilment tests pass. Full sandbox payment, owner administrator setup, persistent worker hosting, email sender setup and public business/legal configuration remain pending. Korapay currently has a public key stored as KORAPAY_SECRET_KEY; replace it privately with the Test Secret Key beginning sk_test_. The GitHub integration rejects repository writes (403), so source publication requires corrected integration permissions or a manual upload. Dependency audit identified six high-severity production dependency findings; review before public launch. Purchases are not live.

## Automatic fulfilment
The existing BullMQ worker requires a persistent host. Vercel Hobby daily cron is too infrequent for instant delivery and reconciliation. A Render/Railway worker account must be connected before launch. Populate its private environment with DATABASE_URL, REDIS_URL, GSUBZ_API_KEY and the other application secrets; do not paste keys into chat. Deploy Dockerfile.worker with the same source release. Keep GSUBZ_ALLOW_LIVE=false and KORAPAY_ALLOW_LIVE=false during sandbox testing. Confirm sandbox balance cleanup/isolation before switching to live mode.

Official provider contract: https://app.gsubz.com/api_doc/
