import { afterEach, expect, it, vi } from "vitest";
import { GsubzProvider, gsubzResult, gsubzStatusResult } from "../../src/server/providers/gsubz";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("preserves an explicit API-access rejection on HTTP 403 without spending again",async()=>{
 vi.stubEnv("GSUBZ_API_KEY"," fixture ");vi.stubEnv("GSUBZ_ALLOW_LIVE","true");vi.stubEnv("KORAPAY_ALLOW_LIVE","true");
 const send=vi.fn().mockResolvedValue(new Response(JSON.stringify({code:407,status:"failed",description:"Chat Admin to get upgraded before using our API, Thank you!"}),{status:403}));vi.stubGlobal("fetch",send);
 expect(await new GsubzProvider().buyData({reference:"one-reference",phone:"08031234567",networkCode:"MTN",providerPlanCode:"mtn_sme:260"})).toEqual({status:"FAILED",code:"API_ACCESS_NOT_ENABLED"});
 expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][1].body.get("api")).toBe("fixture");
});
it("recognizes the documented verification response without weakening purchase validation",()=>{
 const response={code:"200",status:"success",description:"TRANSACTION_SUCCESSFUL",api_response:"private delivery details"};
 expect(gsubzStatusResult(response)).toEqual({status:"SUCCESSFUL",code:"GSUBZ_DELIVERED"});
 expect(gsubzResult(response).status).toBe("UNKNOWN");
 for(const patch of [{status:"pending"},{code:502},{description:"CONTENT_NOT_FOUND"}])expect(gsubzStatusResult({...response,...patch}).status).toBe("UNKNOWN");
});
it("queries the original reference and never calls the purchase endpoint during reconciliation",async()=>{
 vi.stubEnv("GSUBZ_API_KEY","fixture");const send=vi.fn().mockResolvedValue(new Response(JSON.stringify({code:"200",status:"success",description:"TRANSACTION_SUCCESSFUL"})));vi.stubGlobal("fetch",send);
 expect((await new GsubzProvider().checkStatus("original-reference")).status).toBe("SUCCESSFUL");
 expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][0]).toBe("https://api.gsubz.com/api/verify/");expect(send.mock.calls[0][1].body.get("requestID")).toBe("original-reference");
});
it("blocks real purchases in payment sandbox",async()=>{vi.stubEnv("GSUBZ_API_KEY","fixture");vi.stubEnv("GSUBZ_ALLOW_LIVE","true");vi.stubEnv("KORAPAY_ALLOW_LIVE","false");var call=vi.fn();vi.stubGlobal("fetch",call);await expect(new GsubzProvider().buyData({reference:"HD-test",phone:"+2348031234567",networkCode:"MTN",providerPlanCode:"mtn_sme:260"})).rejects.toMatchObject({status:503});expect(call).not.toHaveBeenCalled();});
it("preserves uncertain outcomes for reconciliation",()=>{for(var value of [{code:502,status:"failed",description:"GATEWAY_ERROR"},{code:404,status:"failed",description:"CONTENT_NOT_FOUND"},{code:200,status:"pending"},{code:200,status:"successful"}])expect(gsubzResult(value).status).toBe("UNKNOWN");expect(gsubzResult({code:406,status:"successful",transactionID:123}).status).toBe("SUCCESSFUL");expect(gsubzResult({code:402,status:"failed",description:"INSUFFICIENT_BALANCE"}).status).toBe("FAILED");});
it("never sends the API key to a configurable foreign host",()=>{expect(()=>new GsubzProvider("https://example.com")).toThrow();});
it("uses a stable request reference and converts Nigerian phones",async()=>{vi.stubEnv("GSUBZ_API_KEY","fixture");vi.stubEnv("GSUBZ_ALLOW_LIVE","true");vi.stubEnv("KORAPAY_ALLOW_LIVE","true");var call=vi.fn().mockResolvedValue(new Response(JSON.stringify({code:200,status:"successful",transactionID:123})));vi.stubGlobal("fetch",call);expect((await new GsubzProvider().buyData({reference:"HD-test",phone:"+2348031234567",networkCode:"MTN",providerPlanCode:"mtn_sme:260"})).status).toBe("SUCCESSFUL");expect(call.mock.calls[0][0]).toBe("https://api.gsubz.com/api/pay/");var body=call.mock.calls[0][1].body;expect(body.get("requestID")).toBe("HD-test");expect(body.get("phone")).toBe("08031234567");expect(body.get("plan")).toBe("260");});

it("checks supplier price before spending and rejects increases",async()=>{
 vi.stubEnv("GSUBZ_API_KEY","fixture");vi.stubEnv("GSUBZ_ALLOW_LIVE","true");vi.stubEnv("KORAPAY_ALLOW_LIVE","true");
 const call=vi.fn().mockResolvedValue(new Response(JSON.stringify({plans:[{value:"260",api_price:"200.01"}]})));vi.stubGlobal("fetch",call);
 expect(await new GsubzProvider().buyData({reference:"HD-test",phone:"+2348031234567",networkCode:"MTN",providerPlanCode:"mtn_sme:260",expectedCostKobo:"20000"})).toMatchObject({status:"FAILED",code:"GSUBZ_PRICE_INCREASED"});
 expect(call).toHaveBeenCalledTimes(1);expect(call.mock.calls[0][0]).toContain("/api/plans/");
});
it("treats a failed preflight as uncharged, and transport failure after sending as uncertain",async()=>{
 vi.stubEnv("GSUBZ_API_KEY","fixture");vi.stubEnv("GSUBZ_ALLOW_LIVE","true");vi.stubEnv("KORAPAY_ALLOW_LIVE","true");
 const call=vi.fn().mockRejectedValue(new Error("network unavailable"));vi.stubGlobal("fetch",call);
 const order={reference:"HD-test",phone:"+2348031234567",networkCode:"MTN",providerPlanCode:"mtn_sme:260"};
 expect((await new GsubzProvider().buyData({...order,expectedCostKobo:"20000"})).status).toBe("FAILED");
 expect((await new GsubzProvider().buyData(order)).status).toBe("UNKNOWN");
});
it("records the exact supplier deduction and rejects malformed cost",()=>{
 expect(gsubzResult({code:200,status:"successful",transactionID:123,amountPaid:"2284.56"})).toMatchObject({status:"SUCCESSFUL",costKobo:"228456"});
 expect(gsubzResult({code:200,status:"successful",transactionID:123,amountPaid:"1.001"}).status).toBe("UNKNOWN");
});
