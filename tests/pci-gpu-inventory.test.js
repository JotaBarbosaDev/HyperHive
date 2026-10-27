jest.mock("../services/api-client", () => ({apiFetch: jest.fn()}));
jest.mock("../services/vms-client", () => ({resolveToken: jest.fn(async () => "token")}));
const {apiFetch} = require("../services/api-client");
const {listHostGpus} = require("../services/pci");
it.each([[], {gpus: []}, [{address: "1"}], {gpus: [{address: "1"}]}])("accepts supported inventory %j", async payload => {
  apiFetch.mockResolvedValueOnce(payload);
  expect(await listHostGpus("host one")).toEqual(Array.isArray(payload) ? payload : payload.gpus);
  expect(apiFetch).toHaveBeenLastCalledWith("/pci/host/host%20one", {token: "token"});
});
it.each([null, {}, {gpus: null}, {gpus: "invalid"}])("rejects malformed inventory %j", async payload => {
  apiFetch.mockResolvedValueOnce(payload);
  await expect(listHostGpus("host")).rejects.toThrow("Invalid GPU inventory response");
});
