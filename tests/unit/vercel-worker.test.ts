import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ after: vi.fn(), work: vi.fn(), run: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("../../src/server/jobs/netlify-runner", () => ({ hasNetlifyWork: mocks.work, runNetlifyJobs: mocks.run }));
import { scheduleVercelWork, vercelWorkerConfigured } from "../../src/server/jobs/netlify-trigger";
const production = { VERCEL: "1", VERCEL_ENV: "production", HOTDATA_WORKER_MODE: "vercel" };
beforeEach(() => vi.resetAllMocks());
describe("Vercel durable processing", () => {
  it("never starts work from previews, unrelated hosts, or disabled configurations", async () => {
    for (const patch of [{ VERCEL_ENV: "preview" }, { VERCEL: "0" }, { HOTDATA_WORKER_MODE: "disabled" }]) {
      const env = { ...production, ...patch };
      expect(vercelWorkerConfigured(env)).toBe(false);
      expect(await scheduleVercelWork(env)).toBe(false);
    }
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("runs durable jobs after the response with a bounded Vercel budget", async () => {
    mocks.work.mockResolvedValue(true);
    expect(await scheduleVercelWork(production)).toBe(true);
    expect(mocks.run).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.run).toHaveBeenCalledWith({ budgetMs: 120000, maxEvents: 10 });
  });
  it("does not acquire a processing lease for an empty queue", async () => {
    mocks.work.mockResolvedValue(false);
    await scheduleVercelWork(production);
    await mocks.after.mock.calls[0][0]();
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("keeps errors recoverable without exposing provider or credential details", async () => {
    mocks.work.mockRejectedValue(new Error("private provider details"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await scheduleVercelWork(production);
    await expect(mocks.after.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(warn.mock.calls.flat().join(" ")).not.toContain("private provider");
    warn.mockRestore();
  });
});
