import { gsubzServices, normalizeGsubzPlans } from "@/lib/gsubz-catalog";
export async function fetchGsubzCatalog(){
 const results=await Promise.all(gsubzServices.map(async service=>{const r=await fetch("https://api.gsubz.com/api/plans/?service="+encodeURIComponent(service.serviceID),{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error("Gsubz catalog unavailable.");return normalizeGsubzPlans(service.serviceID,await r.json());}));
 const plans=results.flat();if(!plans.length||results.some(rows=>!rows.length))throw new Error("Incomplete provider catalog; no import performed.");return {plans,fetchedAt:new Date().toISOString()};
}
