// Disposable local fixture: synthetic data only; mutations are rejected.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Server: WebSocketServer } = require('ws');
const root = path.resolve('dist');
const port = Number(process.env.PORT || 8099);
const bootstrap = `<script>localStorage.setItem('hyperhive.authToken','synthetic-session');localStorage.setItem('hyperhive.apiBaseUrl','http://127.0.0.1:${port}/fixture-api');</script>`;
const cpu = { cores: Array.from({ length: 16 }, (_, i) => ({ usage: 12 + i * 2, temp: 44 + i })) };
const mem = { usedPercent: 25, freePercent: 75, usedMb: 8000, totalMb: 32000, freeMb: 24000 };
const disk = { disks: [{ device: '/dev/fixture', mountPoint: '/', fstype: 'ext4', total: '536870912000', used: '128849018880', free: '408021893120', usedPercent: 24 }] };
const net = { interfaces: [], stats: [{ name: 'eth0', bytesSent: '1048576', bytesRecv: '2097152', packetsSent: '90', packetsRecv: '180' }] };
const samples = { cpu, mem, disk, network: net };
const server = http.createServer(async (req, res) => {
 const url = new URL(req.url, 'http://127.0.0.1');
 const reply = (value, status = 200) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(value)); };
 if (/^\/(fixture-api|api)\//.test(url.pathname)) {
  const route = url.pathname.replace(/^\/(fixture-api|api)/, '');
  if (req.method !== 'GET') return reply({ message: 'Synthetic preview rejects mutations' }, 403);
  if (route === '/notes/') return reply([{ id: 1, titulo: 'Ver is part of this title', nota: 'Keep Ver in user-authored content.' }]);
  if (route === '/notes/1') return reply({ id: 1, titulo: 'Ver is part of this title', nota: 'Keep Ver in user-authored content.' });
  if (route === '/protocol/list') return reply([{ MachineName:'fixture-host', EntryTime: new Date().toISOString(), LastSeen:new Date().toISOString() }]);
  if (route === '/virsh/getallvms') return reply([
   { name:'fixture-running', machineName:'fixture-host', state:1, DefinedCPUS:4, DefinedRam:8192, memoryMB:8192, diskSizeGB:80, AllocatedGb:35, network:'default', ip:['192.0.2.7'], currentCpuUsage:24, currentMemoryUsageMB:4096, realHostMemUsageMB:4096, autoStart:false, diskPath:'/fixture/guest.qcow2' },
   { name:'fixture-stopped', machineName:'fixture-host', state:5, DefinedCPUS:2, DefinedRam:4096, memoryMB:4096, diskSizeGB:40, AllocatedGb:16, network:'default', ip:[], currentCpuUsage:0, currentMemoryUsageMB:0, autoStart:false, diskPath:'/fixture/stopped.qcow2' },
   { name:'fixture-paused', machineName:'fixture-host', state:3, DefinedCPUS:2, DefinedRam:4096, memoryMB:4096, diskSizeGB:40, AllocatedGb:16, network:'default', ip:[], currentCpuUsage:0, currentMemoryUsageMB:0, autoStart:false, diskPath:'/fixture/paused.qcow2' }
  ]);

  if (route.startsWith('/info/time-since/')) return reply({ uptime:'72h16m4s' });
  if (route.startsWith('/info/history/')) return reply(Array.from({length:12},(_,i)=>({id:i, captured_at:new Date(Date.now()-(12-i)*300000).toISOString(), info:samples[route.split('/')[3]]})));
  if (route.startsWith('/info/')) return reply(samples[route.split('/')[2]] ?? []);
  if (route.startsWith('/virsh/irqbalance/')) return reply({enabled:true,active:true,unitName:'irqbalance.service'});
  if (route.startsWith('/virsh/hosthugepages/')) return reply({enabled:false,pageCount:0,activePageCount:0,activePageSize:'2M'});
  return reply([]);
 }
 if (process.env.PREVIEW_DEV === '1') {
  const upstream = await fetch('http://127.0.0.1:8081' + req.url);
  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  res.writeHead(upstream.status, {'Content-Type': contentType});
  if (contentType.includes('text/html')) return res.end((await upstream.text()).replace('<head>', '<head>' + bootstrap));
  return res.end(Buffer.from(await upstream.arrayBuffer()));
 }
 const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
 if (!filename.startsWith(root + path.sep) && filename !== root) return reply({},403);
 const target = fs.existsSync(filename) && fs.statSync(filename).isFile() ? filename : path.join(root,'index.html');
 if (!fs.existsSync(target)) { res.writeHead(503); res.end('Preview build in progress'); return; }
 const ext=path.extname(target); res.setHeader('Content-Type', {'.js':'application/javascript','.css':'text/css','.html':'text/html','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg'}[ext] || 'application/octet-stream');
 if (ext === '.html') {
  return res.end(fs.readFileSync(target,'utf8').replace('<head>','<head>'+ (url.searchParams.get('banner') === 'off' ? bootstrap.replace('/fixture-api', '/api') : bootstrap)));
 }
 fs.createReadStream(target).pipe(res);
});
const sockets = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => sockets.handleUpgrade(req, socket, head, client => { sockets.emit('connection', client, req); }));
server.listen(port, '127.0.0.1', () => console.log('Synthetic preview port ' + port));
