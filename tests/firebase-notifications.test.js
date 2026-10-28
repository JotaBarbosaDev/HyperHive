import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { getDocumentAsync } from "expo-document-picker";
import { File } from "expo-file-system";
import { setAuthToken } from "../services/api-client";
import { setApiBaseUrl } from "../config/apiConfig";
const mockStatus = { packageName: "com.anonymous.hyperhive", projectId: "example-project", enabled: true, restartRequired: false, permissionGranted: true, channelEnabled: true, lastMessageId: null };
const mockNative = { getStatus: jest.fn(() => ({ ...mockStatus })), getConfiguration: jest.fn(() => ({projectId:"example-project",appId:"1:123:android:abc",senderId:"123",apiKey:"client-key"})), getToken: jest.fn(async () => "device-one"), saveConfiguration: jest.fn(), activate: jest.fn(), disable: jest.fn() };
jest.mock("../services/firebase-notifications.android", () => ({ firebaseNotifications: mockNative }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove() {} }) }, Linking: { openSettings: jest.fn() }, Platform: { Version: 33 }, PermissionsAndroid: { request: jest.fn(), PERMISSIONS: { POST_NOTIFICATIONS: "permission" } } }));
const mockElement = ({ children }) => <div>{children}</div>;
for (const [name, exportName] of [["box", "Box"], ["text", "Text"]]) jest.doMock(`../components/ui/${name}`, () => ({ [exportName]: mockElement }));
jest.doMock("../components/ui/button", () => ({ Button: ({ children, onPress, isDisabled }) => <button disabled={isDisabled} onClick={onPress}>{children}</button>, ButtonText: mockElement }));
jest.doMock("../components/ui/input",()=>({Input:({children,isDisabled})=><fieldset disabled={isDisabled}>{children}</fieldset>,InputField:({value,onChangeText,accessibilityLabel})=><input aria-label={accessibilityLabel} value={value} onChange={e=>onChangeText(e.target.value)}/>}));
const Settings = require("../components/navigation/FirebaseNotificationSettings.android").default;
const WebSettings = require("../components/navigation/FirebaseNotificationSettings").default;
let container, root;
const button = label => [...container.querySelectorAll("button")].find(b => b.textContent === label);
const callsTo = path => fetch.mock.calls.filter(([url])=>url.endsWith(path));
const render = async () => act(async()=>root.render(<Settings/>));
const check = async () => act(async()=>button("Check Firebase connection").click());
beforeEach(()=>{
 jest.useFakeTimers();global.IS_REACT_ACT_ENVIRONMENT=true;
 Object.assign(mockStatus,{projectId:"example-project",enabled:true,restartRequired:false,permissionGranted:true,channelEnabled:true,lastMessageId:null});
 mockNative.getToken.mockReset().mockResolvedValue("device-one"); mockNative.saveConfiguration.mockReset();
 setAuthToken("session-one");setApiBaseUrl("https://hyperhive.test/api");
 global.fetch=jest.fn(async(url)=>({ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>url.endsWith("/status")?{configured:true,message:"File loaded; check connection."}:url.endsWith("/check")?{result:"working"}:{result:"accepted by Firebase",messageId:"projects/example-project/messages/id"}}));
 container=document.createElement("div");root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());jest.useRealTimers();});
it("requires a real Firebase check before enabling test sends",async()=>{
 await render();expect(button("Send test notification").disabled).toBe(true);
 await check();expect(container.textContent).toContain("Android client: Working");expect(container.textContent).toContain("Backend credentials: Working");expect(callsTo("/test")).toHaveLength(0);expect(button("Send test notification").disabled).toBe(false);
 expect(JSON.parse(callsTo("/check")[0][1].body)).toEqual({token:"device-one",projectId:"example-project"});
});
it.each(["enabled","permissionGranted","channelEnabled"])("blocks testing when %s is false",async key=>{mockStatus[key]=false;await render();expect(button("Send test notification").disabled).toBe(true);expect(button("Check Firebase connection").disabled).toBe(true);});
it("sends once and confirms the actual native receipt separately",async()=>{
 await render();await check();let resolve;mockNative.getToken.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 await act(async()=>{button("Send test notification").click();button("Send test notification").click();});
 await act(async()=>resolve("device-now"));expect(callsTo("/test")).toHaveLength(1);expect(JSON.parse(callsTo("/test")[0][1].body)).toEqual({token:"device-now",projectId:"example-project"});expect(container.textContent).toContain("Waiting for this device");
 mockStatus.lastMessageId="id";await act(async()=>jest.advanceTimersByTime(1000));expect(container.textContent).toContain("Device receipt: Working");
});
it("shows backend errors in red without claiming working",async()=>{
 await render();fetch.mockImplementationOnce(async()=>({ok:false,status:503,headers:{get:()=>"text/plain"},text:async()=>"Backend needs a service-account JSON, not google-services.json"}));
 await check();expect(container.textContent).toContain("Backend credentials: Not working");expect(container.textContent).toContain("service-account JSON");expect(button("Send test notification").disabled).toBe(true);
});
it.each(["logout","backend"])("cancels pending checks after %s",async change=>{
 await render();let resolve;mockNative.getToken.mockImplementation(()=>new Promise(r=>{resolve=r;}));await act(async()=>button("Check Firebase connection").click());await act(async()=>change==="logout"?setAuthToken(null):setApiBaseUrl("https://another.test"));await act(async()=>resolve("old-token"));expect(callsTo("/check")).toHaveLength(0);
});
it("saves manual client fields through the same native validation",async()=>{
 mockStatus.enabled=false;mockNative.saveConfiguration.mockReturnValue({...mockStatus});await render();await act(async()=>button("Save manual configuration").click());
 const data=JSON.parse(mockNative.saveConfiguration.mock.calls[0][0]);expect(data.project_info).toEqual({project_id:"example-project",project_number:"123"});expect(data.client[0].client_info.android_client_info.package_name).toBe("com.anonymous.hyperhive");expect(data.client[0].api_key[0].current_key).toBe("client-key");expect(callsTo("/test")).toHaveLength(0);
});
it("reports import failures and deletes the picker copy",async()=>{
 mockStatus.enabled=false;getDocumentAsync.mockResolvedValue({canceled:false,assets:[{uri:"file:///cache/config.json"}]});const remove=jest.fn();File.mockImplementation(()=>({size:100,text:async()=>"bad-client-config",exists:true,delete:remove}));mockNative.saveConfiguration.mockImplementation(()=>{throw new Error("Invalid Android client configuration");});
 await render();await act(async()=>button("Import google-services.json").click());expect(container.textContent).toContain("Invalid Android client configuration");expect(remove).toHaveBeenCalledTimes(1);
});
it("enables without sending a push",async()=>{
 mockStatus.enabled=false;mockNative.activate.mockImplementation(()=>{mockStatus.enabled=true;return {...mockStatus};});await render();await act(async()=>button("Enable notifications").click());expect(callsTo("/test")).toHaveLength(0);expect(mockNative.getToken).not.toHaveBeenCalled();
});
it("keeps non-Android empty",async()=>{await act(async()=>root.render(<WebSettings/>));expect(container.textContent).toBe("");});
