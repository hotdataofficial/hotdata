import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { validateStaging } from "./staging-config.mjs";
try{const values=parse(await readFile(new URL("../.env.staging",import.meta.url),"utf8")),failures=validateStaging(values);console.log(JSON.stringify({status:failures.length?"blocked":"staging-configuration-shape-valid",failures,note:"No connectivity, credentials, payment or provider verification was performed"}));if(failures.length)process.exitCode=1;}catch{console.error("Cannot validate .env.staging. Generate it on the host and keep it private.");process.exitCode=1;}
