// Read-only readiness checks. Never prints credentials or account balances.
const services=["mtn_sme","mtn_gifting","airtel_sme","airtel_gifting","glo_sme","glo_data","etisalat_data"];
function kobo(value){const text=String(value);if(!/^\d{1,12}(?:\.\d{1,2})?$/.test(text))throw Error("Invalid amount");const [whole,fraction=""]=text.split(".");return BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0"));}
async function inspectFunding(key){
 const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();
 try{
  const rows=await db.fundingTransaction.findMany({where:{gateway:"korapay",status:"PENDING",checkoutUrl:{not:null}},take:5,orderBy:{createdAt:"desc"},select:{reference:true,gatewayReference:true,amountKobo:true,payerEmail:true}});
  const checks=[];
  for(const row of rows){
   try{const r=await request("https://api.korapay.com/merchant/api/v1/charges/"+encodeURIComponent(row.gatewayReference||row.reference),{headers:{Authorization:"Bearer "+key}});const d=r.body.data||{};const amountMatches=v=>{try{return kobo(v)===row.amountKobo}catch{return false}};checks.push({http:r.http,apiAccepted:r.body.status===true,chargeStatus:["success","failed","pending","processing"].includes(d.status)?d.status:"OTHER",transactionStatus:["success","underpaid","overpaid"].includes(d.transaction_status)?d.transaction_status:"OTHER",referenceMatches:d.reference===row.reference,merchantReferenceMatches:d.payment_reference===row.reference,amountMatches:amountMatches(d.amount),paidAmountMatches:amountMatches(d.amount_paid),hasAmountPaid:d.amount_paid!==undefined,emailMatches:typeof d.customer?.email==="string"&&d.customer.email.toLowerCase()===row.payerEmail?.toLowerCase(),fieldNames:Object.keys(d).filter(k=>/^[a-z_]{1,40}$/.test(k))});}catch{checks.push({verificationUnavailable:true})}
  }
  console.log("HOTDATA_PENDING_FUNDING_CHECK "+JSON.stringify(checks));
 }finally{await db.$disconnect()}
}
async function request(url,options={}){const r=await fetch(url,{...options,redirect:"error",signal:AbortSignal.timeout(15000)});const body=await r.json();return {ok:r.ok,http:r.status,body};}
async function inspectDelivery(key){
 const {PrismaClient}=require("@prisma/client");const db=new PrismaClient();
 try{const attempts=await db.providerAttempt.findMany({where:{status:"PENDING",provider:{code:"GSUBZ"}},take:5,orderBy:{createdAt:"desc"},select:{reference:true}});const checks=[];
 for(const attempt of attempts){try{const r=await request("https://api.gsubz.com/api/verify/",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({api:key,requestID:attempt.reference})});const d=r.body;checks.push({http:r.http,code:/^\d{3}$/.test(String(d.code))?String(d.code):"OTHER",status:["success","successful","failed","pending","processing"].includes(d.status)?d.status:"OTHER",description:/^[A-Z_]{1,80}$/.test(d.description||"")?d.description:"OTHER",hasTransactionId:!!d.transactionID,fieldNames:Object.keys(d).filter(k=>/^[a-zA-Z_]{1,40}$/.test(k))})}catch{checks.push({verificationUnavailable:true})}}
 console.log("HOTDATA_PENDING_DELIVERY_CHECK "+JSON.stringify(checks));
 }finally{await db.$disconnect()}
}
(async()=>{
 const result={korapay:{liveKeyConfigured:false,authenticated:false},gsubz:{authenticated:false,funded:false,affordablePlans:0,totalPlans:0}};
 const key=(process.env.KORAPAY_SECRET_KEY||"").trim();
 if(/^sk_live_[A-Za-z0-9_-]+$/.test(key)){
  result.korapay.liveKeyConfigured=true;
  try{await inspectFunding(key)}catch{console.log("HOTDATA_PENDING_FUNDING_CHECK unavailable")}
  try{const r=await request("https://api.korapay.com/merchant/api/v1/balances",{headers:{Authorization:"Bearer "+key}});result.korapay.authenticated=r.ok&&r.body.status===true&&!!r.body.data;result.korapay.http=r.http;}catch{result.korapay.connectionUnavailable=true;}
 }
 const providerKey=process.env.GSUBZ_API_KEY;
 if(providerKey){
  // Authentication/validation probe only: no service, plan, recipient or amount.
  // The required purchase fields are deliberately absent, so this cannot deliver or charge an order.
  try{const p=await request("https://api.gsubz.com/api/pay/",{method:"POST",headers:{Authorization:"Bearer "+providerKey,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({api:providerKey})});const d=p.body;console.log("HOTDATA_DATA_API_VALIDATION "+JSON.stringify({http:p.http,code:/^\d{3}$/.test(String(d.code))?String(d.code):"OTHER",status:typeof d.status==="string"&&/^[a-z_]{1,30}$/i.test(d.status)?d.status:"OTHER",description:/^[A-Z_]{1,80}$/.test(d.description||"")?d.description:"OTHER",apiUpgradeRequired:Number(d.code)===407||/get upgraded before using.*api/i.test(String(d.description||"")),noPurchaseFieldsSent:true}));}catch{console.log("HOTDATA_DATA_API_VALIDATION unavailable")}
  try{await inspectDelivery(providerKey)}catch{console.log("HOTDATA_PENDING_DELIVERY_CHECK unavailable")}
  try{
   const r=await request("https://api.gsubz.com/api/balance/",{method:"POST",headers:{Authorization:"Bearer "+providerKey,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({api:providerKey})});
   if(r.ok&&r.body.balance!==undefined){
    const balance=kobo(r.body.balance);result.gsubz.authenticated=true;result.gsubz.funded=balance>0n;
    const groups=await Promise.all(services.map(async service=>{const p=await request("https://api.gsubz.com/api/plans/?service="+service);if(!p.ok||!Array.isArray(p.body.plans))throw Error("Catalog unavailable");return p.body.plans;}));
    for(const p of groups.flat()){const cost=kobo(p.api_price);if(cost>0n){result.gsubz.totalPlans++;if(balance>=cost)result.gsubz.affordablePlans++;}}
   }
  }catch{result.gsubz.connectionUnavailable=true;}
 }
 console.log("HOTDATA_LIVE_READINESS "+JSON.stringify(result));
})();
