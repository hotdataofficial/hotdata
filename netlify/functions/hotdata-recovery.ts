import { netlifyWorkerConfigured, wakeNetlifyWorker } from "../../src/server/jobs/netlify-trigger";
export default async () => {
  if (!netlifyWorkerConfigured()) return;
  const { hasNetlifyWork } = await import("../../src/server/jobs/netlify-runner");
  if (new Date().getUTCMinutes() === 0 || await hasNetlifyWork()) {
    if (!await wakeNetlifyWorker()) throw new Error("Background recovery wake-up failed.");
  }
};
export const config = { schedule: "*/5 * * * *" };
