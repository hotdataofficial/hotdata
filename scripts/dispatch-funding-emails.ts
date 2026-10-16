import "dotenv/config";
import { db } from "../src/server/db";
import { dispatchFundingEmails } from "../src/server/notifications/funding-outbox";
dispatchFundingEmails().then(delivered => console.log(JSON.stringify({ delivered }))).catch(() => { console.error("Notification dispatch failed."); process.exitCode = 1; }).finally(() => db.$disconnect());
