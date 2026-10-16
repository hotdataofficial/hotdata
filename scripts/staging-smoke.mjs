import { stagingOrigin } from "./staging-config.mjs";
const checks=[{path:"/health",status:200},{path:"/health?ready=1",status:200},{path:"/manifest.webmanifest",status:200},{path:"/sw.js",status:200},{path:"/offline.html",status:200},{path:"/api/agent/keys",status:401}];
try {
 const origin=stagingOrigin(process.argv[2]);const results=[];
 for(const check of checks){try{const response=await fetch(origin+check.path,{redirect:"manual",signal:AbortSignal.timeout(10000),cache:"no-store"});const privateHeader=check.path.startsWith("/health")||check.path.startsWith("/api/")||check.path==="/sw.js";const passed=response.status===check.status&&Boolean(response.headers.get("content-security-policy"))&&(!privateHeader||/no-store/i.test(response.headers.get("cache-control")||""));results.push({path:check.path,status:response.status,passed});await response.body?.cancel();}catch{results.push({path:check.path,status:"unreachable",passed:false});}}
 const passed=results.every(result=>result.passed);console.log(JSON.stringify({passed,checks:results,note:"Read-only smoke checks; no payments or provider requests were made"},null,2));if(!passed)process.exitCode=1;
}catch{console.error("Usage: npm run staging:smoke -- https://YOUR_STAGING_DOMAIN");process.exitCode=1;}
