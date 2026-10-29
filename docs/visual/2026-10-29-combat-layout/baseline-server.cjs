'use strict';
// Diagnostic only: replay the pre-fix presentation with unchanged current rules.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),{serve}=require(root+'/test/server');
const base=process.env.CLARITY_ORIGINAL||'c14f127be273d01b26649f8375a7e3c3a0890ee5';
const files=new Map([['/','index.html'],['/css/style.css','css/style.css'],['/js/ui.js','js/ui.js'],['/js/renderer.js','js/renderer.js'],['/js/titlemenu.js','js/titlemenu.js'],['/js/release.js','js/release.js']].map(([url,file])=>[url,{body:execFileSync('git',['show',base+':'+file],{cwd:root}),type:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html'}]));
const csp=JSON.parse(fs.readFileSync(root+'/vercel.json')).headers.find(h=>h.source==='/(.*)').headers.find(h=>h.key==='Content-Security-Policy').value;
const server=http.createServer((req,res)=>{
 const old=files.get(req.url);
 if(old&&['GET','HEAD'].includes(req.method)){res.writeHead(200,{'Content-Type':old.type,'Content-Length':old.body.length,'Cache-Control':'no-store','Content-Security-Policy':csp});res.end(req.method==='HEAD'?undefined:old.body);}else serve(req,res);
});
server.listen(Number(process.argv[2]||4195),'127.0.0.1');
