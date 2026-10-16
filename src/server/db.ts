import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { hotdataDb?: PrismaClient };
export const db = globalDb.hotdataDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.hotdataDb = db;
