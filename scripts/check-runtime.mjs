import "dotenv/config";
const failures=[];const requireValue=name=>{if(!process.env[name])failures.push(name+" is missing");};for(const name of ["DATABASE_URL","REDIS_URL","APP_URL","JWT_ACCESS_SECRET","JWT_REFRESH_SECRET","AUTH_CODE_SECRET","IP_HASH_SECRET","PROVIDER_ENCRYPTION_KEY"])requireValue(name);
for(const name of ["JWT_ACCESS_SECRET","JWT_REFRESH_SECRET","AUTH_CODE_SECRET","IP_HASH_SECRET"])if((process.env[name]||"").length<43)failures.push(name+" must have at least 43 characters");
const secrets=["JWT_ACCESS_SECRET","JWT_REFRESH_SECRET","AUTH_CODE_SECRET","IP_HASH_SECRET"].map(name=>process.env[name]);if(new Set(secrets).size!==secrets.length)failures.push("Authentication secrets must be distinct");
try{if(new URL(process.env.APP_URL).protocol!=="https:")failures.push("APP_URL must use HTTPS for deployment");}catch{failures.push("APP_URL is invalid");}
const keyText=process.env.PROVIDER_ENCRYPTION_KEY||"", key=Buffer.from(keyText,"base64");if(key.length!==32||key.toString("base64")!==keyText)failures.push("PROVIDER_ENCRYPTION_KEY must be canonical base64 for 32 bytes");
if(failures.length){console.error(JSON.stringify({status:"blocked",failures}));process.exitCode=1;}else console.log(JSON.stringify({status:"configuration-shape-valid",note:"Does not verify live credentials, providers, database, Redis or financial safety"}));
