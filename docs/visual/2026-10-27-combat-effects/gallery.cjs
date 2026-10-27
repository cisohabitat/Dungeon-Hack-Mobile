// Browser contact sheets of captured pixels; no painting edits.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('../../../node_modules/playwright');
(async()=>{const dir=__dirname,b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),p=await b.newPage({viewport:{width:820,height:900}});
const data=file=>'data:image/png;base64,'+fs.readFileSync(path.join(dir,file)).toString('base64');
const style='<style>body{background:#17141b;color:#eee;font:15px system-ui;margin:16px}h1{font-size:22px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{width:100%;image-rendering:pixelated}figcaption{padding:8px 0}small{color:#b9afb9}</style>';
await p.setContent(style+'<h1>Close frost impact</h1><p>Frozen native-cast fitting views. Native rolls and hero stats differ.</p><main style="grid-template-columns:1fr 1fr">'+['before/close-frost.png','close-frost.png'].map((f,i)=>'<figure><img src="'+data(f)+'"><figcaption>'+(i?'Bounded burst; damage above spells':'Original full-projection burst')+'</figcaption></figure>').join('')+'</main>');await p.screenshot({path:path.join(dir,'comparison.png'),fullPage:true});
const evidence=JSON.parse(fs.readFileSync(path.join(dir,'native/evidence.json')));
for(const [width,calm]of [[320,false],[390,false],[390,true],[740,false]]){
const rows=evidence.records.filter(r=>r.width===width&&r.calm===calm);
const cells=rows.map(r=>{const frames=r.rows.filter(q=>q.file);const effect=r.rows.flatMap(q=>q.effects).at(0);let time=effect?effect.born+(effect.until-effect.born)*Math.min(.9,effect.impact+.12):r.rows[0].now+(r.action==='death'?300:35);const selected=frames.reduce((a,q)=>Math.abs(a.now-time)<Math.abs(q.now-time)?a:q);return'<figure><img src="'+data('native/'+selected.file)+'"><figcaption>'+r.cls+' · '+r.action+'<br><small>'+Math.round(selected.now-r.rows[0].now)+'ms after first record</small></figcaption></figure>';});
await p.setContent(style+'<h1>Native combat · '+width+'px · '+(calm?'Calm':'normal')+'</h1><p>Supplied level10 hero/resources/stationary enemies. Real inputs, casts, dice and running animation.</p><main>'+cells.join('')+'</main>');await p.screenshot({path:path.join(dir,'native-'+width+(calm?'-calm':'')+'.png'),fullPage:true});
}await b.close();})().catch(e=>{console.error(e);process.exitCode=1;});
