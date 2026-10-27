'use strict';
// Contact sheets of evidence; original source paintings are never edited.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../../..');
const {chromium}=require(root+'/node_modules/playwright');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'captures/evidence.json'))),groups={};
for(const width of[320,390,740]){
 groups['native-'+width]=data.records.filter(r=>r.width===width&&r.kind).flatMap(r=>[
  {file:`captures/${width}-${r.kind}-before.png`,label:r.kind+' before'},
  ...r.stages.map(s=>({file:'captures/'+s.frames.find(f=>f.index===4).file,label:r.kind+' '+s.kind})),
  ...r.actions.slice(0,3).map(a=>({file:'captures/'+a.frames.find(f=>f.index===4).file,label:r.kind+' '+a.act})),
  {file:`captures/${width}-${r.kind}-after.png`,label:r.kind+' after'}
 ]);
 if(width!==740)groups['regions-'+width]=data.records.filter(r=>r.width===width&&r.region!==undefined).map(r=>({file:'captures/'+r.file,label:`Region ${r.region} ${r.twist||'normal'}`}));
}
groups.comparison=[{file:'before/torch-on.png',label:'Before: one torch value per tile'},{file:'after/torch-on.png',label:'After: blended field and preserved foot light'}];
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{for(const[name,rows]of Object.entries(groups)){
 const compare=name==='comparison',width=compare?680:1020,columns=compare?2:6,tile=compare?340:170,height=compare?430:218;
 const page=await browser.newPage({viewport:{width,height:compare?470:800}});await page.setContent(`<style>body{margin:0;background:#20242c;color:white;font:12px sans-serif;display:grid;grid-template-columns:repeat(${columns},${tile}px)}figure{margin:0;border:1px solid #666}figcaption{height:28px;padding:3px}img{width:${tile-2}px;height:${height}px;object-fit:contain}</style>`+rows.map(r=>`<figure><figcaption>${r.label}</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(__dirname,r.file)).toString('base64')}"></figure>`).join(''));await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(__dirname,name+'.png'),fullPage:true});await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
