'use strict';
// Contact sheets of captured evidence, rendered as an HTML gallery.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../../..');
const {chromium}=require(root+'/node_modules/playwright');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'captures/evidence.json'))),groups={};
for(const width of[320,390,740]){
 groups['angles-'+width]=data.records.filter(r=>r.width===width&&r.axis).map(r=>({file:'captures/'+r.file,label:`${r.region} ${r.cell?'gate':'door'} ${r.axis} side ${r.side}`}));
 groups['native-'+width]=data.records.filter(r=>r.width===width&&r.kind).flatMap(r=>['before',...['door','battered','gate-key'].includes(r.kind)?['action-3','close-3']:r.kind==='burn'?['fall-3']:r.kind==='levers'?['choices']:['action-3'],'after'].map(s=>({file:`captures/${width}-${r.kind}-${s}.png`,label:r.kind+' '+s})));
 if(fs.existsSync(path.join(__dirname,'traps/evidence.json')))groups['traps-'+width]=JSON.parse(fs.readFileSync(path.join(__dirname,'traps/evidence.json'))).filter(r=>r.width===width).flatMap(r=>r.rows.filter(f=>f.file).map(f=>({file:'traps/'+f.file,label:r.kind+' '+f.index+' '+f.kind})));
}
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{for(const[name,rows]of Object.entries(groups)){
 const page=await browser.newPage({viewport:{width:1020,height:800}});await page.setContent('<style>body{margin:0;background:#20242c;color:white;font:12px sans-serif;display:grid;grid-template-columns:repeat(6,170px)}figure{margin:0;border:1px solid #666}figcaption{height:28px;padding:3px}img{width:168px;height:218px;object-fit:contain}</style>'+rows.map(r=>`<figure><figcaption>${r.label}</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(__dirname,r.file)).toString('base64')}"></figure>`).join(''));await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(__dirname,name+'.png'),fullPage:true});await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
