import { randomBytes } from "node:crypto";
export function stagingOrigin(input) {
 const url=new URL(input);
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/"||url.port)throw Error("Use a plain HTTPS staging origin with no credentials, path, query or custom port.");
 return url.origin;
}
export function createStagingEnv(template, input) {
 const origin=stagingOrigin(input), token=()=>randomBytes(36).toString("base64url");
 const values={APP_URL:origin,CORS_ALLOWED_ORIGINS:origin,POSTGRES_PASSWORD:token(),REDIS_PASSWORD:token(),JWT_ACCESS_SECRET:token(),JWT_REFRESH_SECRET:token(),AUTH_CODE_SECRET:token(),IP_HASH_SECRET:token(),PROVIDER_ENCRYPTION_KEY:randomBytes(32).toString("base64"),PUBLIC_SITE_LIVE:"false",PUBLIC_INDEXABLE:"false",LEGAL_PUBLISHED:"false",TRUST_PROXY:"false",RUN_DB_TESTS:"false",ADMIN_SEED_EMAIL:"",ADMIN_SEED_PASSWORD:"",TEST_CUSTOMER_SEED_EMAIL:"",TEST_CUSTOMER_SEED_PASSWORD:"",TEST_AGENT_SEED_EMAIL:"",TEST_AGENT_SEED_PASSWORD:"",EMAIL_FROM:"",SUPPORT_EMAIL:"",SUPPORT_WHATSAPP:"",STAGING:"true"};
 values.DATABASE_URL="postgresql://hotdata:"+values.POSTGRES_PASSWORD+"@postgres:5432/hotdata_staging?schema=public";
 values.REDIS_URL="redis://:"+values.REDIS_PASSWORD+"@redis:6379";
 const text=template.replace(/^([A-Z_]+)=.*$/gm,(line,key)=>Object.hasOwn(values,key)?key+"="+values[key]:line);
 return "# Generated for staging only. Keep private; do not commit or share.\nSTAGING=true\n"+text;
}
export function validateStaging(env) {
 const failures=[];
 if(env.STAGING!=="true")failures.push("STAGING must be true");
 try{stagingOrigin(env.APP_URL);}catch{failures.push("APP_URL must be a plain HTTPS staging origin");}
 for(const name of ["PUBLIC_SITE_LIVE","PUBLIC_INDEXABLE","LEGAL_PUBLISHED"])if(env[name]!=="false")failures.push(name+" must be false for staging");
 for(const name of ["POSTGRES_PASSWORD","REDIS_PASSWORD","JWT_ACCESS_SECRET","JWT_REFRESH_SECRET","AUTH_CODE_SECRET","IP_HASH_SECRET"])if(!/^[A-Za-z0-9_-]{43,}$/.test(env[name]||""))failures.push(name+" requires a long URL-safe random secret");
 const auth=["JWT_ACCESS_SECRET","JWT_REFRESH_SECRET","AUTH_CODE_SECRET","IP_HASH_SECRET"].map(name=>env[name]);if(new Set(auth).size!==auth.length)failures.push("Authentication secrets must be independent");
 const encoded=env.PROVIDER_ENCRYPTION_KEY||"",key=Buffer.from(encoded,"base64");if(key.length!==32||key.toString("base64")!==encoded)failures.push("Encryption key must be canonical 32-byte base64");
 try{const db=new URL(env.DATABASE_URL);if(db.protocol!=="postgresql:"||db.hostname!=="postgres"||db.username!=="hotdata"||db.pathname!=="/hotdata_staging"||decodeURIComponent(db.password)!==env.POSTGRES_PASSWORD)throw Error();}catch{failures.push("DATABASE_URL must use the isolated staging database and matching password");}
 try{const redis=new URL(env.REDIS_URL);if(redis.protocol!=="redis:"||redis.hostname!=="redis"||decodeURIComponent(redis.password)!==env.REDIS_PASSWORD)throw Error();}catch{failures.push("REDIS_URL must use isolated staging Redis and matching password");}
 if(env.PAYSTACK_SECRET_KEY&&!env.PAYSTACK_SECRET_KEY.startsWith("sk_test_"))failures.push("Paystack staging requires a test secret key");
 if(env.PAYSTACK_PUBLIC_KEY&&!env.PAYSTACK_PUBLIC_KEY.startsWith("pk_test_"))failures.push("Paystack staging requires a test public key");
 if(env.MONNIFY_API_KEY||env.FLUTTERWAVE_SECRET_KEY)failures.push("Unimplemented gateway credentials must remain blank");
 if(env.RUN_DB_TESTS!=="false")failures.push("Never run financial integration tests against the staging database");
 if(!["true","false"].includes(env.TRUST_PROXY))failures.push("TRUST_PROXY must be explicitly configured");
 return failures;
}
