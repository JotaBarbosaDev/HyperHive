import { createSpaPort } from "../services/spa";
jest.mock("../services/api-client", () => ({apiFetch:jest.fn(), setAuthToken:jest.fn(), triggerUnauthorized:jest.fn()}));
jest.mock("../services/auth-storage", () => ({loadAuthToken:jest.fn(async()=>"sample"), loadApiBaseUrl:jest.fn(async()=>"http://localhost")}));
jest.mock("../config/apiConfig", () => ({getApiBaseUrl:()=>"http://localhost", setApiBaseUrl:jest.fn()}));
const api = require("../services/api-client");
test.each([0, -1, 65536, 1.5, NaN])("rejects invalid port %s before sending", async port => {
  api.apiFetch.mockClear();
  await expect(createSpaPort({port, password:"example", description:""})).rejects.toThrow("Port must be between 1 and 65535");
  expect(api.apiFetch).not.toHaveBeenCalled();
});
test.each([1, 65535])("sends valid port %s after invalid input", async port => {
  await createSpaPort({port, password:"example", description:""});
  expect(api.apiFetch).toHaveBeenLastCalledWith("/spa", expect.objectContaining({body:expect.objectContaining({port})}));
});
