import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({upsert:vi.fn(),updateMany:vi.fn(),update:vi.fn(),findMany:vi.fn(),claim:vi.fn(),process:vi.fn()}));
vi.mock("../../src/server/db",()=>({db:{
 outboxEvent:{upsert:mocks.upsert,updateMany:mocks.updateMany,update:mocks.update},
 transaction:{findMany:mocks.findMany},
 $transaction:async(fn:Function)=>fn({$queryRawUnsafe:mocks.claim,outboxEvent:{update:mocks.update}})
}}));
vi.mock("../../src/server/services/purchases",()=>({processPurchase:mocks.process}));
vi.mock("../../src/server/notifications/funding-outbox",()=>({dispatchFundingEmails:vi.fn()}));
vi.mock("../../src/server/notifications/purchase-outbox",()=>({dispatchPurchaseEmails:vi.fn()}));
vi.mock("../../src/server/notifications/agent-callback-outbox",()=>({dispatchAgentCallbacks:vi.fn()}));
vi.mock("../../src/server/notifications/broadcast-outbox",()=>({dispatchBroadcasts:vi.fn()}));
vi.mock("../../src/server/services/referrals",()=>({dispatchReferralRewards:vi.fn()}));
vi.mock("../../src/server/providers/balance-alerts",()=>({checkProviderBalances:vi.fn()}));
import {runNetlifyJobs} from "../../src/server/jobs/netlify-runner";
beforeEach(()=>{vi.resetAllMocks();mocks.upsert.mockResolvedValue({deliveredAt:new Date()});mocks.updateMany.mockResolvedValue({count:1});mocks.claim.mockResolvedValue([]);mocks.findMany.mockResolvedValue([]);mocks.process.mockResolvedValue(undefined);});
describe("Netlify durable runner",()=>{
 it("does no purchase work if another invocation holds the lease",async()=>{
  mocks.updateMany.mockResolvedValue({count:0});await runNetlifyJobs();
  expect(mocks.process).not.toHaveBeenCalled();expect(mocks.claim).not.toHaveBeenCalled();
 });
 it("acknowledges an outbox event only after processing and excludes it from the same reconciliation pass",async()=>{
  mocks.claim.mockResolvedValueOnce([{id:"event1"}]).mockResolvedValue([]);
  mocks.update.mockResolvedValue({id:"event1",payload:{transactionId:"order1"}});
  await runNetlifyJobs();
  expect(mocks.process).toHaveBeenCalledWith("order1");
  expect(mocks.update.mock.calls[1][0]).toMatchObject({where:{id:"event1"},data:{deliveredAt:expect.any(Date)}});
  expect(mocks.findMany.mock.calls[0][0].where.id.notIn).toEqual(["order1"]);
 });
 it("leaves a failed event unacknowledged and releases its worker lease",async()=>{
  mocks.claim.mockResolvedValueOnce([{id:"event1"}]);mocks.update.mockResolvedValue({id:"event1",payload:{transactionId:"order1"}});
  mocks.process.mockRejectedValue(new Error("database interrupted"));
  await expect(runNetlifyJobs()).rejects.toThrow("database interrupted");
  expect(mocks.update).toHaveBeenCalledTimes(1);
  expect(mocks.updateMany.mock.calls.at(-1)?.[0]).toMatchObject({where:{dedupeKey:"netlify-worker:lease",availableAt:expect.any(Date)},data:{availableAt:expect.any(Date)}});
 });
 it("recovers pending orders even when their original outbox was already delivered",async()=>{
  mocks.findMany.mockResolvedValue([{id:"pending-order"}]);await runNetlifyJobs();
  expect(mocks.process).toHaveBeenCalledExactlyOnceWith("pending-order");
 });
});
