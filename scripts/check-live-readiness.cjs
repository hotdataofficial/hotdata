// Read-only readiness checks. Never prints credentials or account balances.
const services=["mtn_sme","mtn_gifting","airtel_sme","airtel_gifting","glo_sme","glo_data","etisalat_data"];
function kobo(value){const text=String(value);if(!/^\d{1,12}(?:\.\d{1,2})?$/.test(text))throw Error("Invalid amount");const [whole,fraction=""]=text.split(".");return BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0"));}
async function request(url,options={}){const r=await fetch(url,{...options,redirect:"error",signal:AbortSignal.timeout(15000)});const body=await r.json();return {ok:r.ok,http:r.status,body};}
(async()=>{
 const result={korapay:{liveKeyConfigured:false,authenticated:false},gsubz:{authenticated:false,funded:false,affordablePlans:0,totalPlans:0}};
 const key=(process.env.KORAPAY_SECRET_KEY||"").trim();
 if(/^sk_live_[A-Za-z0-9_-]+$/.test(key)){
  result.korapay.liveKeyConfigured=true;
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
