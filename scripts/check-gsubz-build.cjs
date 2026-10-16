const paymentKey=(process.env.KORAPAY_SECRET_KEY||" ").trim();
console.log("Korapay configuration: "+(!paymentKey?"MISSING":paymentKey.startsWith("pk_")?"PUBLIC_KEY_IN_SECRET_FIELD":/^sk_test_[A-Za-z0-9_-]+$/.test(paymentKey)?"TEST_SECRET_FORMAT_VALID":/^sk_live_[A-Za-z0-9_-]+$/.test(paymentKey)?"LIVE_SECRET_BLOCKED_UNLESS_ENABLED":"INVALID_SECRET_FORMAT"));
// Non-spending provider check. Never prints the key, request body or raw response.
(async()=>{
 const key=process.env.GSUBZ_API_KEY;
 if(!key||key==="[SENSITIVE]"){console.log("Gsubz authentication check: not configured.");return;}
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetch("https://api.gsubz.com/api/balance/",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({api:key}),redirect:"error",signal:AbortSignal.timeout(20000)});
   const result=await response.json();
   const valid=response.ok&&/^[0-9]+(?:[.][0-9]{1,2})?$/.test(String(result.balance));
   console.log(valid?"Gsubz authentication check: VERIFIED (no purchase sent).":"Gsubz authentication check: FAILED (HTTP "+response.status+").");
   return;
  }catch{if(attempt===1)console.log("Gsubz authentication check: connection unavailable; not verified.");}
 }
})();