import { celldSummary } from "../utils/celld-summary";
const empty = {fleets:[],reset_pending:false,storage:{healthy:true,bucket_count:0}};
test("separates service availability from fleet runtime state", () => {
  expect(celldSummary(empty,null)).toEqual({service:"connected",runtime:"no running fleets"});
  expect(celldSummary(null,"offline")).toEqual({service:"unavailable",runtime:"unknown"});
  expect(celldSummary(empty,"offline")).toEqual({service:"unavailable",runtime:"unknown"});
  const fleet = {desired_state:"running",status:"running",servers:[{connected:true,running:true,healthy:true}]};
  expect(celldSummary({...empty,fleets:[fleet]},null).runtime).toBe("running");
  expect(celldSummary({...empty,fleets:[{...fleet,servers:[]}]},null).runtime).toBe("unknown");
  expect(celldSummary({...empty,fleets:[{...fleet,status:"degraded"}]},null).runtime).toBe("degraded");
});
