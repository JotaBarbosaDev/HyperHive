import { vmAllocation } from "../utils/vm-capacity";

test("host allocation handles empty, unavailable and incomplete inventories", () => {
  const vms = [{machineName:"a", DefinedCPUS:2, DefinedRam:4096}, {machineName:"a", DefinedCPUS:4, DefinedRam:2048}, {machineName:"b", DefinedCPUS:10, DefinedRam:100}];
  expect(vmAllocation(vms, "a")).toEqual({cpu:6, ram:6144});
  expect(vmAllocation(vms, "c")).toEqual({cpu:0, ram:0});
  expect(vmAllocation(null, "a")).toEqual({cpu:null, ram:null});
  expect(vmAllocation([{machineName:"a", DefinedCPUS:2}], "a")).toEqual({cpu:2, ram:null});
});
