import "dotenv/config";
import { fileURLToPath } from "node:url";
export default {root:fileURLToPath(new URL(".",import.meta.url)).replaceAll("\\","/"),resolve:{alias:{"@":fileURLToPath(new URL("./src",import.meta.url)).replaceAll("\\","/")}},test:{environment:"node",include:["tests/**/*.test.ts"],fileParallelism:false}};
