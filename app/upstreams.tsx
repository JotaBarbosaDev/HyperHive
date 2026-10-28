import React from "react";
import {FlatList, ScrollView, RefreshControl} from "react-native";
import {useFocusEffect, Link} from "expo-router";
import {Box} from "@/components/ui/box";
import {Text} from "@/components/ui/text";
import {Heading} from "@/components/ui/heading";
import {HStack} from "@/components/ui/hstack";
import {VStack} from "@/components/ui/vstack";
import {Button, ButtonIcon, ButtonText} from "@/components/ui/button";
import {Input, InputField} from "@/components/ui/input";
import {Select, SelectTrigger, SelectPortal, SelectBackdrop, SelectContent, SelectItem, SelectIcon} from "@/components/ui/select";
import {Modal, ModalBackdrop, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton} from "@/components/ui/modal";
import {createUpstream, deleteUpstream, getUpstreamCapabilities, listUpstreams, updateUpstream, upstreamErrorMessage} from "@/services/upstreams";
import {Upstream, UpstreamCapabilities, UpstreamContext, UpstreamPayload} from "@/types/upstream";

import {ChevronDown, Pencil, Plus, Trash2} from "lucide-react-native";

const blank = (): UpstreamPayload => ({name: "", context: "http", loadbalancer_type: "round_robin", server_arr: [{ip: "", port: 8080, settings_string: ""}]});
const names: Record<string, string> = {round_robin: "Round robin", least_conn: "Least connections", random: "Random", random_two: "Random two · least connections", hash: "Hash", hash_consistent: "Consistent hash", ip_hash: "Client IP hash"};

export default function UpstreamsScreen() {
  const [filter, setFilter] = React.useState<"all" | UpstreamContext>("all");
  const [items, setItems] = React.useState<Upstream[]>([]);
  const [capabilities, setCapabilities] = React.useState<UpstreamCapabilities | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [formError, setFormError] = React.useState("");
  const [editing, setEditing] = React.useState<Upstream | null>(null);
  const [form, setForm] = React.useState<UpstreamPayload>(blank);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Upstream | null>(null);
  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [pools, caps] = await Promise.all([listUpstreams(signal), getUpstreamCapabilities(signal)]);
      if (!signal?.aborted) {setItems(pools); setCapabilities(caps); setError("");}
    } catch (e) {if (!signal?.aborted) setError(upstreamErrorMessage(e));}
    finally {if (!signal?.aborted) setLoading(false);}
  }, []);
  useFocusEffect(React.useCallback(() => {const controller = new AbortController(); void load(controller.signal); return () => controller.abort();}, [load]));
  const methods = capabilities?.contexts[form.context] ?? [];
  const selectedMethod = methods.find(m => m.name === form.loadbalancer_type);
  const canApply = capabilities?.status === "verified";
  const edit = (pool?: Upstream, context: UpstreamContext = "http") => {
    setEditing(pool ?? null);
    setForm(pool ? {name: pool.name, context: pool.context, loadbalancer_type: pool.loadbalancer_type, loadbalancer_options: pool.loadbalancer_options ? {...pool.loadbalancer_options} : undefined, server_arr: pool.server_arr.map(m => ({...m})), revision: pool.revision} : {...blank(), context});
    setFormError(""); setOpen(true);
  };
  const save = async () => {
    if (!form.name.trim() || form.server_arr.some(m => !m.ip.trim() || m.port < 1 || m.port > 65535)) {setFormError("Enter a pool name, member IP literals, and ports from 1 to 65535."); return;}
    if (!selectedMethod || selectedMethod.status !== "verified") {setFormError("Choose a method verified for the installed NPM image."); return;}
    if (selectedMethod.requires_hash_key && !form.loadbalancer_options?.hash_key) {setFormError("Choose a hash key."); return;}
    setSaving(true); setFormError("");
    try {
      const payload = {...form, loadbalancer_options: selectedMethod.requires_hash_key ? form.loadbalancer_options : undefined};
      if (editing) await updateUpstream(editing.id, payload); else await createUpstream(payload);
      setOpen(false); await load();
    } catch (e) {setFormError(upstreamErrorMessage(e));}
    finally {setSaving(false);}
  };
  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {await deleteUpstream(deleting.id, deleting.revision); setDeleting(null); await load();}
    catch (e) {setError(upstreamErrorMessage(e)); setDeleting(null);}
    finally {setSaving(false);}
  };
  const visibleItems = items.filter(pool => filter === "all" || pool.context === filter);
  return <Box className="flex-1 bg-background-0 dark:bg-[#070D19] web:bg-background-0">
    <Box className="flex-1 p-4 pt-16 web:p-20 web:max-w-6xl web:mx-auto web:w-full">
    <Heading size="2xl" className="text-typography-900 dark:text-[#E8EBF0] mb-3 web:text-4xl" style={{fontFamily: "Inter_700Bold"}}>Upstreams</Heading>
    <Text className="text-typography-600 dark:text-[#8A94A8] text-sm web:text-base max-w-3xl">Reuse backend pools across proxy hosts, custom locations, and TCP/UDP streams.</Text>
    <HStack className="mt-6 mb-6 items-center justify-between flex-wrap gap-3">
      <HStack className="gap-2 flex-wrap">
        {([{key: "all", label: "All"}, {key: "http", label: "HTTP"}, {key: "stream", label: "Streams"}] as const).map(tab => <Button key={tab.key} size="sm" variant="outline" accessibilityLabel={`${tab.label} pools`} onPress={() => setFilter(tab.key)} className={`rounded-full px-4 border ${filter === tab.key ? "bg-typography-900 border-typography-900 dark:bg-[#2DD4BF] dark:border-[#2DD4BF]" : "bg-background-0 border-outline-200 dark:bg-[#0F1A2E] dark:border-[#243247]"}`}><ButtonText className={filter === tab.key ? "text-background-0 dark:text-[#0A1628]" : "text-typography-700 dark:text-[#8A94A8]"}>{tab.label} ({items.filter(pool => tab.key === "all" || pool.context === tab.key).length})</ButtonText></Button>)}
      </HStack>
      <HStack className="gap-2 flex-wrap"><Button variant="outline" className="rounded-xl border-outline-200 dark:border-[#243247] bg-background-0 dark:bg-[#0F1A2E]" onPress={() => void load()} isDisabled={loading}><ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Refresh</ButtonText></Button><Button className="rounded-xl px-5 bg-typography-900 dark:bg-[#2DD4BF] dark:hover:bg-[#5EEAD4]" onPress={() => edit()} isDisabled={!canApply || loading}><ButtonIcon as={Plus} size="sm" className="text-background-0 dark:text-[#0A1628]"/><ButtonText className="text-background-0 dark:text-[#0A1628]">Add pool</ButtonText></Button></HStack>
    </HStack>
    {error ? <Text accessibilityRole="alert" className="text-error-700 dark:text-error-400">{error}</Text> : null}
    {capabilities && !canApply ? <Text className="text-error-700 dark:text-error-400">Pool application is {capabilities.status}. Check NPM image compatibility and recovery status before making changes.</Text> : null}
    <FlatList showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 32}} data={visibleItems} keyExtractor={p => String(p.id)} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()}/>}
      ListEmptyComponent={<Box className="p-6 border border-dashed border-outline-200 dark:border-[#2A3B52] rounded-2xl bg-background-0 dark:bg-[#0A1628] items-start gap-3">
        <Text className="text-typography-900 dark:text-[#E8EBF0] font-semibold">{loading ? "Loading pools…" : error ? "Unable to load pools" : filter === "http" ? "No HTTP pools" : filter === "stream" ? "No TCP/UDP pools" : "No upstream pools"}</Text>
        {!loading && !error ? <>
          <Text className="text-typography-600 dark:text-[#8A94A8] text-sm">{filter === "http" ? "HTTP pools provide destinations for proxy hosts and locations." : filter === "stream" ? "TCP/UDP pools provide destinations for streams." : "HTTP pools serve proxy hosts and locations. TCP/UDP pools serve streams."}</Text>
          <HStack className="gap-2 flex-wrap">
            {filter !== "stream" ? <Button className="rounded-xl bg-typography-900 dark:bg-[#2DD4BF]" isDisabled={!canApply} onPress={() => edit(undefined, "http")}><ButtonText className="text-background-0 dark:text-[#0A1628]">Create HTTP pool</ButtonText></Button> : null}
            {filter !== "http" ? <Button variant="outline" className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0F1A2E]" isDisabled={!canApply} onPress={() => edit(undefined, "stream")}><ButtonText className="text-typography-900 dark:text-[#E8EBF0]">Create TCP/UDP pool</ButtonText></Button> : null}
          </HStack>
        </> : null}
      </Box>}
      renderItem={({item}) => <Box className="rounded-2xl p-5 mb-4 gap-3 border border-outline-100 dark:border-[#2A3B52] shadow-soft-1 bg-background-0 dark:bg-[#0F1A2E]">
        <HStack className="justify-between flex-wrap gap-2"><Heading size="md" className="text-typography-900 dark:text-[#E8EBF0]">{item.name}</Heading><HStack className="gap-2 items-center flex-wrap"><Box className={`h-2.5 w-2.5 rounded-full ${item.apply_status === "applied" ? "bg-success-500" : "bg-warning-500"}`}/><Text className="text-sm text-typography-600 dark:text-[#8A94A8]">{item.context.toUpperCase()} · {item.apply_status}</Text></HStack></HStack>
        <Text className="text-sm text-typography-700 dark:text-[#8A94A8]">{names[item.loadbalancer_type] ?? item.loadbalancer_type} · {item.server_arr.length} members · revision {item.revision} · generation {item.applied_generation}</Text>
        <Text className="text-typography-600 dark:text-[#8A94A8]">{item.server_arr.map(m => `${m.ip.includes(":") ? `[${m.ip}]` : m.ip}:${m.port}${m.settings_string ? ` (${m.settings_string})` : ""}`).join("\n")}</Text>
        {item.warnings?.map(w => <Text key={w} className="text-sm text-typography-600 dark:text-[#8A94A8]">{w}</Text>)}
        {item.last_error ? <Text className="text-error-700 dark:text-error-400">{item.last_error}</Text> : null}
        <Text className="font-semibold">References · {item.references.length}</Text>
        {item.references.map(r => <Link key={`${r.consumer_type}:${r.npm_id}:${r.location_path ?? ""}`} href={r.consumer_type === "stream" ? "/streams" : "/proxy"} asChild><Text className="text-primary-700">{r.consumer_type} #{r.npm_id}{r.location_path ? ` · ${r.location_path}` : ""}</Text></Link>)}
        <HStack className="gap-3"><Button variant="outline" className="rounded-xl border-outline-200 dark:border-[#243247]" onPress={() => edit(item)} isDisabled={!canApply}><ButtonIcon as={Pencil} size="sm"/><ButtonText>Edit</ButtonText></Button><Button action="negative" variant="outline" className="rounded-xl" onPress={() => setDeleting(item)} isDisabled={!canApply || item.references.length > 0}><ButtonIcon as={Trash2} size="sm"/><ButtonText>Delete</ButtonText></Button></HStack>
        {item.references.length > 0 ? <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">Detach every reference, including disabled consumers, before deleting this pool.</Text> : null}
      </Box>}/>
    </Box>
    <Modal isOpen={open} onClose={() => {if (!saving) setOpen(false);}} size="lg"><ModalBackdrop className="bg-black/60"/><ModalContent className="max-h-[90%] rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628] shadow-2xl">
      <ModalHeader className="items-start px-6 pt-6 pb-4 border-b border-outline-100 dark:border-[#2A3B52]"><VStack className="flex-1 gap-1"><Heading className="text-typography-900 dark:text-[#E8EBF0]">{editing ? `Edit ${editing.name}` : "Add upstream pool"}</Heading><Text className="text-sm text-typography-600 dark:text-[#8A94A8]">Configure load balancing and backend members.</Text></VStack>{saving ? null : <ModalCloseButton/>}</ModalHeader>
      <ModalBody className="px-6 pt-4"><ScrollView keyboardShouldPersistTaps="handled"><VStack className="gap-4 pb-5">
        {formError ? <Text accessibilityRole="alert" className="text-error-700 dark:text-error-400">{formError}</Text> : null}
        <Text className="font-semibold">Name</Text><Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]"><InputField accessibilityLabel="Pool name" value={form.name} onChangeText={name => setForm(f => ({...f, name}))} autoCapitalize="none" placeholder="app_pool"/></Input>
        <Text className="font-semibold">Context</Text><Select selectedValue={form.context} onValueChange={context => setForm(f => ({...f, context: context as UpstreamContext, loadbalancer_type: "round_robin", loadbalancer_options: undefined}))}>
          <SelectTrigger accessibilityLabel="Pool context" className="px-3 h-11 rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] justify-between"><Text>{form.context === "http" ? "HTTP / HTTPS" : "TCP / UDP stream"}</Text><SelectIcon as={ChevronDown}/></SelectTrigger>
          <SelectPortal><SelectBackdrop/><SelectContent><SelectItem label="HTTP / HTTPS" value="http"/><SelectItem label="TCP / UDP stream" value="stream"/></SelectContent></SelectPortal>
        </Select>
        <Text className="font-semibold">Load balancing</Text><Select selectedValue={form.loadbalancer_type} onValueChange={loadbalancer_type => setForm(f => ({...f, loadbalancer_type, loadbalancer_options: undefined}))}>
          <SelectTrigger accessibilityLabel="Load balancing method" className="px-3 h-11 rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] justify-between"><Text>{names[form.loadbalancer_type] ?? form.loadbalancer_type}</Text><SelectIcon as={ChevronDown}/></SelectTrigger>
          <SelectPortal><SelectBackdrop/><SelectContent>{methods.map(m => <SelectItem key={m.name} label={names[m.name] ?? m.name} value={m.name} isDisabled={m.status !== "verified"}/>)}</SelectContent></SelectPortal>
        </Select>
        {selectedMethod?.requires_hash_key ? <><Text className="font-semibold">Hash key</Text><Select selectedValue={form.loadbalancer_options?.hash_key ?? ""} onValueChange={hash_key => setForm(f => ({...f, loadbalancer_options: {hash_key}}))}>
          <SelectTrigger accessibilityLabel="Hash key" className="px-3 h-11 rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] justify-between"><Text>{form.loadbalancer_options?.hash_key ?? "Choose a hash key"}</Text><SelectIcon as={ChevronDown}/></SelectTrigger><SelectPortal><SelectBackdrop/><SelectContent>{selectedMethod.hash_keys?.map(key => <SelectItem key={key} label={key} value={key}/>)}</SelectContent></SelectPortal>
        </Select></> : null}
        <Heading size="sm">Members</Heading><Text className="text-sm text-typography-600 dark:text-[#8A94A8]">IP literals only. Parameters: {capabilities?.server_parameters.join(", ")}. Health checks are passive.</Text>
        {form.server_arr.map((member, index) => <VStack key={index} className="gap-2 border border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524] rounded-xl p-4">
          <Text>Member {index + 1}</Text><Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]"><InputField accessibilityLabel={`Member ${index + 1} IP`} value={member.ip} autoCapitalize="none" placeholder="10.0.0.11 or 2001:db8::11" onChangeText={ip => setForm(f => ({...f, server_arr: f.server_arr.map((m, i) => i === index ? {...m, ip} : m)}))}/></Input>
          <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]"><InputField accessibilityLabel={`Member ${index + 1} port`} value={member.port ? String(member.port) : ""} keyboardType="number-pad" placeholder="8080" onChangeText={port => setForm(f => ({...f, server_arr: f.server_arr.map((m, i) => i === index ? {...m, port: Number(port) || 0} : m)}))}/></Input>
          <Input className="rounded-xl border-outline-200 dark:border-[#2A3B52] bg-background-50 dark:bg-[#0E1524]"><InputField accessibilityLabel={`Member ${index + 1} settings`} value={member.settings_string} autoCapitalize="none" placeholder="weight=2 max_fails=3 fail_timeout=10s" onChangeText={settings_string => setForm(f => ({...f, server_arr: f.server_arr.map((m, i) => i === index ? {...m, settings_string} : m)}))}/></Input>
          <Button variant="link" action="negative" isDisabled={form.server_arr.length === 1} onPress={() => setForm(f => ({...f, server_arr: f.server_arr.filter((_, i) => i !== index)}))}><ButtonText>Remove member</ButtonText></Button>
        </VStack>)}
        <Button variant="outline" isDisabled={form.server_arr.length >= (capabilities?.max_members ?? 128)} onPress={() => setForm(f => ({...f, server_arr: [...f.server_arr, {ip: "", port: 8080, settings_string: ""}]}))}><ButtonText>Add member</ButtonText></Button>
        {form.server_arr.length === 1 ? <Text className="text-sm text-typography-600 dark:text-[#8A94A8]">One member cannot provide failover. NGINX ignores max_fails and fail_timeout for a single-server group.</Text> : null}
      </VStack></ScrollView></ModalBody>
      <ModalFooter className="px-6 pb-6 pt-4 gap-3 flex-wrap border-t border-outline-100 dark:border-[#2A3B52]"><Button variant="outline" isDisabled={saving} onPress={() => setOpen(false)}><ButtonText>Cancel</ButtonText></Button><Button className="rounded-xl bg-typography-900 dark:bg-[#2DD4BF]" isDisabled={saving || !canApply} onPress={() => void save()}><ButtonText className="text-background-0 dark:text-[#0A1628]">{saving ? "Applying…" : "Save and apply"}</ButtonText></Button></ModalFooter>
    </ModalContent></Modal>
    <Modal isOpen={Boolean(deleting)} onClose={() => {if (!saving) setDeleting(null);}}><ModalBackdrop className="bg-black/60"/><ModalContent className="rounded-2xl border border-outline-100 dark:border-[#2A3B52] bg-background-0 dark:bg-[#0A1628]"><ModalHeader><Heading>Delete {deleting?.name}?</Heading></ModalHeader><ModalBody><Text>This unused pool will be removed after the configuration change succeeds.</Text></ModalBody><ModalFooter className="px-6 pb-6 pt-4 gap-3 flex-wrap border-t border-outline-100 dark:border-[#2A3B52]"><Button variant="outline" isDisabled={saving} onPress={() => setDeleting(null)}><ButtonText>Cancel</ButtonText></Button><Button action="negative" isDisabled={saving} onPress={() => void remove()}><ButtonText>{saving ? "Deleting…" : "Delete pool"}</ButtonText></Button></ModalFooter></ModalContent></Modal>
  </Box>;
}
