import { writeFileSync } from "node:fs";
const production = process.env.NETLIFY === "true" && process.env.CONTEXT === "production";
writeFileSync(new URL("../src/server/jobs/netlify-context.ts", import.meta.url), "// Generated deployment context; contains no secrets.\nexport const netlifyProductionBuild: boolean = " + production + ";\n");
