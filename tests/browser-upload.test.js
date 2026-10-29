/** @jest-environment jsdom */
jest.mock("../config/apiConfig", () => ({getApiBaseUrl:() => "http://fixture"}));
const {uploadBrowserFile,onUnauthorized}=require("../services/api-client");
let request;
const originalXHR=global.XMLHttpRequest;
beforeEach(() => {global.XMLHttpRequest=class {
  constructor(){request=this;this.upload={};this.headers={};this.status=200;this.responseText='{"id":1}';}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(key,value){this.headers[key]=value;}
  send(file){this.file=file;}
  abort(){this.onabort();}
};});
afterAll(() => {global.XMLHttpRequest=originalXHR;});
it("sends the Blob with authentication and reports upload progress",async () => {
 const onProgress=jest.fn();const blob=new Blob(["disk"]);const promise=uploadBrowserFile("http://fixture/import","token",blob,{onProgress});
 request.upload.onprogress({lengthComputable:true,loaded:2,total:4});expect(onProgress).toHaveBeenCalledWith(50);
 expect(request.file).toBe(blob);expect(request.headers.Authorization).toBe("token");request.onload();await expect(promise).resolves.toBe('{"id":1}');
});
it("supports cancellation and already aborted signals",async () => {
 const controller=new AbortController();const promise=uploadBrowserFile("/import","token",new Blob(["x"]),{signal:controller.signal});controller.abort();await expect(promise).rejects.toThrow("cancelled");
 await expect(uploadBrowserFile("/import","token",new Blob(["x"]),{signal:controller.signal})).rejects.toThrow("cancelled");
});
it("reports server errors and expired authentication",async () => {
 const unauthorized=jest.fn();const unsubscribe=onUnauthorized(unauthorized);const promise=uploadBrowserFile("/import","expired",new Blob(["x"]));request.status=401;request.responseText="session expired";request.onload();await expect(promise).rejects.toThrow("session expired");expect(unauthorized).toHaveBeenCalledTimes(1);unsubscribe();
});
