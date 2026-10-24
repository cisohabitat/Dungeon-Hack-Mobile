'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const {serve}=require('../../test/server');
const {startGame,artReady}=require('../../test/browser/helpers');
(async()=>{
 const output=path.join(__dirname,'batch-i-preview');fs.mkdirSync(output,{recursive:true});
 const server=http.createServer(serve);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'trader-reference'});await artReady(page,{merchant:[],wick:[],pedlar:[]});
  const refs=await page.evaluate(()=>Object.fromEntries(['merchant','wick','pedlar'].map(kind=>{
   const c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').drawImage(Assets.sprites[kind].levels[0],0,0,256,256);return[kind,c.toDataURL('image/png').split(',')[1]];
  })));
  for(const[kind,data]of Object.entries(refs))fs.writeFileSync(path.join(output,`${kind}-reference.png`),Buffer.from(data,'base64'));
  console.log('Captured three active trader references');
 }finally{if(browser)await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})().catch(e=>{console.error(e);process.exitCode=1;});
