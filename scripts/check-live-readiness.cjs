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

