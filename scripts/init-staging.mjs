import { readFile,writeFile } from "node:fs/promises";
import { createStagingEnv } from "./staging-config.mjs";
try {
 const input=process.argv[2];if(!input||process.argv.length!==3)throw Error("Usage: npm run staging:init -- https://YOUR_STAGING_DOMAIN");
 const template=await readFile(new URL("../.env.example",import.meta.url),"utf8");
 await writeFile(new URL("../.env.staging",import.meta.url),createStagingEnv(template,input),{flag:"wx",mode:0o600});
 console.log("Created .env.staging with fresh private secrets. Existing files are never overwritten. Set sandbox/email/seed details on the staging host; secrets were not printed.");
} catch(error){console.error(error?.code==="EEXIST"?".env.staging already exists. Preserve it; do not regenerate active encryption secrets.":"Staging setup failed: "+error.message);process.exitCode=1;}
