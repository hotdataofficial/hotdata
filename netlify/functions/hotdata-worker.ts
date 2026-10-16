import { workerAuthorized } from "../../src/server/jobs/netlify-trigger";
export default async (request: Request) => {
  if (!workerAuthorized(request)) return;
  const { runNetlifyJobs } = await import("../../src/server/jobs/netlify-runner");
  await runNetlifyJobs();
};
export const config = { background: true };
