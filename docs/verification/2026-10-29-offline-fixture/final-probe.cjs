const fs=require('fs'),http=require('http'),path=require('path');
const root='/workspace/Dungeon-Hack-Mobile',out='/workspace/offline-recovery/final-probe';
const {chromium,devices}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server'),{artReady}=require(root+'/test/browser/helpers');
const original=fs.readFileSync(root+'/sw.js','utf8');
const install="e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));";
const sizes=(process.env.SIZES||'0,8,24,64').split(',').map(Number),records=[];
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{for(const size of sizes){
 const source=size>0?original.replace(install,`e.waitUntil((async()=>{const c=await caches.open(CACHE);for(let i=0;i<ASSETS.length;i+=${size})await c.addAll(ASSETS.slice(i,i+${size}));await self.skipWaiting();})());`):original;
 if(size>0&&source===original)throw Error('Install source did not match');
 let child,server,port;if(size<0){child=await require(root+'/test/offline-server.cjs').startOfflineServer();port=new URL(child.url).port;}else{server=http.createServer((req,res)=>{if(size>0&&req.url==='/sw.js'){res.setHeader('Content-Type','application/javascript');res.end(source);}else serve(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));port=server.address().port;}
 const ctx=await browser.newContext({...devices['Pixel 5']});await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});const page=await ctx.newPage();
 await page.addInitScript(()=>{for(const[k,v]of Object.entries({firstSeen:'1',tipsOff:'1',sound:'off',samples:'off',prelude:'off'}))localStorage.setItem('deepdelve.'+k,v);window.__offlineProbe=[];navigator.serviceWorker.addEventListener('controllerchange',()=>window.__offlineProbe.push({event:'controller',at:performance.now()}));navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='offline-state')window.__offlineProbe.push({event:'message',at:performance.now(),data:e.data,own:e.source===navigator.serviceWorker.controller});});});
 let result;
 try{await page.goto(`http://127.0.0.1:${port}`);await artReady(page);const start=await page.evaluate(()=>performance.now());await page.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await require(root+'/node_modules/@playwright/test').expect(page.locator('#offline-status')).toHaveAttribute('data-core','true',{timeout:10000});result=await page.evaluate(start=>({ms:performance.now()-start,events:window.__offlineProbe.map(e=>({...e,at:e.at-start})),status:document.querySelector('#offline-status').outerHTML}),start);}
 catch(e){result={error:String(e),...await page.evaluate(()=>({events:window.__offlineProbe,status:document.querySelector('#offline-status').outerHTML}))};}
 await ctx.tracing.stop({path:path.join(out,`probe-${size}-${records.length}.zip`)});await ctx.close();if(child){await child.close();}else{server.closeAllConnections();await new Promise(r=>server.close(r));}records.push({size,...result});fs.writeFileSync(path.join(out,'probe-results.json'),JSON.stringify(records,null,2)+'\n');console.log(JSON.stringify(records.at(-1)));
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
