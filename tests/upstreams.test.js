/** @jest-environment jsdom */
import React, {act} from "react";
import {createRoot} from "react-dom/client";
import {deleteUpstream, upstreamErrorMessage} from "../services/upstreams";
jest.mock("../config/apiConfig", () => ({getApiBaseUrl: () => "https://hyperhive.test/api"}));
jest.mock("../services/auth-storage", () => ({loadAuthToken: async () => "test-token"}));
jest.mock("expo-router", () => ({useFocusEffect: cb => require("react").useEffect(cb, [cb]), Link: ({children}) => children}));
// Exercise the screen's form and API flow with minimal DOM UI primitives.
const mockToast = { show: jest.fn() };
const mockElement = ({ children }) => <div>{children}</div>;
for (const name of ["box", "text", "heading", "vstack", "hstack"]) {
  const exportName = { box: "Box", text: "Text", heading: "Heading", vstack: "VStack", hstack: "HStack" }[name];
  jest.doMock(`../components/ui/${name}`, () => ({ [exportName]: mockElement }));
}
jest.doMock("react-native", () => ({ Platform: { OS: "web" }, ScrollView: mockElement, RefreshControl: () => null, FlatList: ({ data, renderItem, ListEmptyComponent }) => <div>{data.length ? data.map(item => <div key={item.id}>{renderItem({item})}</div>) : ListEmptyComponent}</div> }));
jest.doMock("../components/ui/button", () => ({
  Button: ({ onPress, isDisabled, accessibilityLabel, children }) => <button onClick={onPress} disabled={isDisabled} aria-label={accessibilityLabel}>{children}</button>,
  ButtonText: mockElement, ButtonIcon: () => null, ButtonSpinner: () => null,
}));
jest.doMock("../components/ui/input", () => ({
  Input: ({ children, isDisabled }) => <fieldset disabled={isDisabled}>{children}</fieldset>,
  InputField: ({ onChangeText, ...props }) => <input value={props.value} placeholder={props.placeholder} aria-label={props.accessibilityLabel} onChange={(event) => onChangeText(event.target.value)} />,
}));
jest.doMock("../components/ui/modal", () => ({
  Modal: ({ isOpen, children }) => isOpen ? <div role="dialog">{children}</div> : null,
  ...Object.fromEntries(["Backdrop", "Content", "Header", "Body", "Footer", "CloseButton"].map((name) => [`Modal${name}`, mockElement])),
}));
jest.doMock("../components/ui/alert-dialog", () => ({
  AlertDialog: () => null,
  ...Object.fromEntries(["Backdrop", "Content", "Header", "Body", "Footer", "CloseButton"].map((name) => [`AlertDialog${name}`, mockElement])),
}));
jest.doMock("../components/ui/toast", () => ({ Toast: mockElement, ToastDescription: mockElement, ToastTitle: mockElement, useToast: () => mockToast }));
jest.doMock("../components/ui/select", () => ({
  Select: ({ selectedValue, onValueChange, isDisabled, children }) => <div><select aria-label="Select option" value={selectedValue} disabled={isDisabled} onChange={(event) => onValueChange(event.target.value)}>{children}</select></div>,
  SelectItem: ({ label, value, isDisabled }) => <option value={value} disabled={isDisabled}>{label}</option>,
  SelectPortal: ({ children }) => children,
  SelectContent: ({ children }) => children,
  SelectScrollView: ({ children }) => children,
  SelectBackdrop: () => null, SelectTrigger: () => null, SelectInput: () => null, SelectIcon: () => null,
}));
jest.mock("lucide-react-native", () => ({ ChevronDown: () => null, Pencil: () => null, Plus: () => null, Trash2: () => null }));
const UpstreamsScreen = require("../app/upstreams").default;
const {UpstreamPoolsProvider, UpstreamSelector} = require("../components/UpstreamSelector");


const pool = {id: 17, name: "app_pool", context: "http", loadbalancer_type: "round_robin", server_arr: [{ip: "192.0.2.1", port: 8080, settings_string: "weight=2"}], revision: 4, applied_generation: 8, apply_status: "applied", references: []};
const caps = {status: "verified", contexts: {http: [{name: "round_robin", status: "verified"}], stream: [{name: "round_robin", status: "verified"}]}, server_parameters: ["weight"], max_members: 128};
const reply = (data, status = 200) => ({ok: status < 400, status, headers: {get: () => "application/json"}, text: async () => data === undefined ? "" : JSON.stringify(data), json: async () => data});
let root, container, fetchMock;
const originalFetch = global.fetch;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  fetchMock = jest.fn(async url => reply(url.endsWith("/capabilities") ? caps : [pool]));
  global.fetch = fetchMock;
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {if(root) await act(async () => root.unmount()); root = null; global.fetch = originalFetch; jest.restoreAllMocks();});
const mount = async element => {container = document.createElement("div"); root = createRoot(container); await act(async () => root.render(element));};
const button = name => [...container.querySelectorAll("button")].find(e => e.textContent === name);
const click = async e => act(async () => e.click());
const change = async (e, value) => act(async () => {Object.getOwnPropertyDescriptor(e.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value").set.call(e, value);e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", {bubbles:true}));});
it("saves an edited pool with its revision and preserves member settings", async () => {
  await mount(<UpstreamsScreen/>); await click(button("Edit"));
  await change(container.querySelector('[aria-label="Pool name"]'), "renamed_pool");
  await click(button("Save and apply"));
  const [, options] = fetchMock.mock.calls.find(([, o]) => o.method === "PUT");
  expect(JSON.parse(options.body)).toEqual({name:"renamed_pool",context:"http",loadbalancer_type:"round_robin",server_arr:pool.server_arr,revision:4});
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});
it("keeps the form open on a revision conflict without retrying the write", async () => {
  const normal = fetchMock.getMockImplementation();fetchMock.mockImplementation((u,o) => o.method === "PUT" ? reply({error:"revision_conflict"},409) : normal(u,o));
  await mount(<UpstreamsScreen/>); await click(button("Edit")); await click(button("Save and apply"));
  expect(container.querySelector('[role="dialog"]').textContent).toContain("revision conflict");
  expect(fetchMock.mock.calls.filter(([,o]) => o.method === "PUT")).toHaveLength(1);
});
it("blocks deletion of a pool referenced by a disabled consumer", async () => {
  fetchMock.mockImplementation(async u => reply(u.endsWith("/capabilities") ? caps : [{...pool,references:[{consumer_type:"proxy",npm_id:3,enabled:false}]}]));
  await mount(<UpstreamsScreen/>);expect(button("Delete").disabled).toBe(true);expect(container.textContent).toContain("including disabled consumers");
});
it("requires a confirmation and sends the deletion revision", async () => {
  let removed = false;
  const parseEmptyJSON = jest.fn(async () => {throw new SyntaxError("Unexpected end of JSON input");});
  fetchMock.mockImplementation(async (url, options) => {
    if (options.method === "DELETE") {removed = true; return {...reply(undefined, 204), json: parseEmptyJSON};}
    return reply(url.endsWith("/capabilities") ? caps : removed ? [] : [pool]);
  });
  await mount(<UpstreamsScreen/>);await click(button("Delete"));expect(fetchMock.mock.calls.some(([,o]) => o.method === "DELETE")).toBe(false);
  await click(button("Delete pool"));const [,o]=fetchMock.mock.calls.find(([,o])=>o.method==="DELETE");expect(o.headers["If-Match"]).toBe('"4"');
  expect(parseEmptyJSON).not.toHaveBeenCalled();
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(container.textContent).toContain("No pools found");
});
it("filters target contexts, shares reads, and emits null for direct mode", async () => {
  fetchMock.mockImplementation(async u => reply(u.endsWith("/capabilities") ? caps : [pool,{...pool,id:18,name:"tcp_pool",context:"stream"}]));
  const onChange=jest.fn();await mount(<UpstreamPoolsProvider><UpstreamSelector context="http" value={17} onChange={onChange}/><UpstreamSelector context="stream" onChange={()=>{}}/></UpstreamPoolsProvider>);
  const selects=container.querySelectorAll("select");expect(selects[0].textContent).toContain("app_pool");expect(selects[0].textContent).not.toContain("tcp_pool");expect(selects[1].textContent).toContain("tcp_pool");
  await change(selects[0],"direct");expect(onChange).toHaveBeenCalledWith(null);expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("disables pool mutations for an unverified image", async () => {
  fetchMock.mockImplementation(async u => reply(u.endsWith("/capabilities") ? {...caps,status:"unsupported"} : [pool]));await mount(<UpstreamsScreen/>);expect(button("Add pool").disabled).toBe(true);expect(button("Edit").disabled).toBe(true);
});
it("retains structured recovery information", async () => {
  fetchMock.mockResolvedValue(reply({error:"recovery_required",recovery_id:32},503));try {await deleteUpstream(17,4);throw Error("expected rejection");} catch(e) {expect(upstreamErrorMessage(e)).toBe("recovery required. Recovery operation: 32.");}
});

it("keeps pool data and refresh working when a modal reparents the selector", async () => {
  const {useUpstreamPools} = require("../components/UpstreamSelector");
  const OverlayContext = React.createContext(null);
  function ReparentedSelector() {
    const poolsState = useUpstreamPools();
    const setOverlay = React.useContext(OverlayContext);
    React.useEffect(() => {
      setOverlay(<UpstreamSelector poolsState={poolsState} context="http" value={17} onChange={() => {}}/>);
    }, [poolsState, setOverlay]);
    return null;
  }
  function OverlayHost() {
    const [overlay, setOverlay] = React.useState(null);
    return <OverlayContext.Provider value={setOverlay}><UpstreamPoolsProvider><ReparentedSelector/></UpstreamPoolsProvider>{overlay}</OverlayContext.Provider>;
  }
  await mount(<OverlayHost/>);
  expect(container.textContent).toContain("Refresh pools");
  expect(container.querySelector("select").textContent).toContain("app_pool");
  expect(container.textContent).not.toContain("Loading pools");
  await click(button("Refresh pools"));
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it("stops loading and permits retry when the capability request never responds", async () => {
  jest.useFakeTimers();
  try {
    fetchMock.mockImplementation(url => url.endsWith("/capabilities") ? new Promise(() => {}) : Promise.resolve(reply([pool])));
    await mount(<UpstreamPoolsProvider><UpstreamSelector context="http" onChange={() => {}}/></UpstreamPoolsProvider>);
    expect(container.textContent).toContain("Loading pools");
    await act(async () => jest.advanceTimersByTimeAsync(20000));
    expect(container.textContent).toContain("Pool loading timed out");
    expect(button("Refresh pools").disabled).toBe(false);
    fetchMock.mockImplementation(async url => reply(url.endsWith("/capabilities") ? caps : [pool]));
    await click(button("Refresh pools"));
    expect(container.querySelector("select").textContent).toContain("app_pool");
    expect(container.textContent).not.toContain("timed out");
  } finally {jest.useRealTimers();}
});
