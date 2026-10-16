import "dotenv/config";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
try {
 const direct=process.env.MIGRATION_DATABASE_URL,runtime=process.env.DATABASE_URL;if(!direct||!runtime)throw Error();
 const a=new URL(direct),b=new URL(runtime);if(!["postgres:","postgresql:"].includes(a.protocol)||a.pathname!==b.pathname||a.searchParams.get("sslmode")!=="require")throw Error();
 const child=spawn(process.execPath,[fileURLToPath(new URL("../node_modules/prisma/build/index.js",import.meta.url)),"migrate","deploy"],{stdio:"inherit",env:{...process.env,DATABASE_URL:direct},windowsHide:true});child.on("error",()=>{console.error("Migration process could not start.");process.exitCode=1;});child.on("exit",code=>process.exitCode=code??1);
}catch{console.error("Configure a private TLS MIGRATION_DATABASE_URL for the same database as DATABASE_URL before running migrations.");process.exitCode=1;}
