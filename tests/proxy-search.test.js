import { matchesProxySearch } from "../utils/proxy-search";
test("search matches domains, destinations and upstream IDs case-insensitively", () => {
 const host = {domain_names:["Web.Example.test", "alias.test"],forward_scheme:"http",forward_host:"10.0.0.8",forward_port:8080};
 expect(matchesProxySearch(host," ALIAS ")).toBe(true);
 expect(matchesProxySearch(host,"0.0.8:8080")).toBe(true);
 expect(matchesProxySearch({...host,upstream_id:12},"upstream #12")).toBe(true);
 expect(matchesProxySearch(host,"missing")).toBe(false);
 expect(matchesProxySearch(host," ")).toBe(true);
});
