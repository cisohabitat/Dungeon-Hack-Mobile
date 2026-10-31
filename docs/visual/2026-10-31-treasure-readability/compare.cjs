// Controlled source comparison, separate from native running-play evidence.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..'),{chromium}=require(root+'/node_modules/playwright'),{serve}=require(root+'/test/server'),{startGame}=require(root+'/test/browser/helpers');
const baseline='a39229f09708dc820ca9bf8ba9cee6fc033e2137';
const original=require('child_process').execFileSync('git',['show',baseline+':js/renderer.js'],{cwd:root,encoding:'utf8'});
(async()=>{const server=http.createServer((req,res)=>{if(req.url==='/js/treasure-before.js'){res.setHeader('Content-Type','application/javascript');res.end(original);}else serve(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({baseURL:`http://127.0.0.1:${server.address().port}`});await startGame(page,{seed:'aaa3-generated-rooms',levels:'8'});
 await page.evaluate(async()=>{Game.testFloor(3);Game.update=()=>{};Game.recordRuns(false);window.__world=await import('/js/paintedworld.js');window.__world.paintedHeartPlinth();window.__world.paintedShrineAltar();for(const k of ['artifact','relic_grimtooth','gold'])void Assets.sprites[k];});
 await page.waitForFunction(()=>window.__world.paintedHeartPlinth()&&window.__world.paintedShrineAltar()&&['artifact','relic_grimtooth','gold'].every(k=>Assets.sprites[k]?.w===256));
 const proof=await page.evaluate(async()=>{
  const renderers=[(await import('/js/treasure-before.js')).Renderer,(await import('/js/renderer.js?treasure-compare')).Renderer],canvases=renderers.map(()=>document.createElement('canvas'));renderers.forEach((r,i)=>r.init(canvases[i],304));
  const L=Game.level(),room=L.rooms[L.piece.room],x=room.x+3,y=room.y+3,piece=L.piece,{Dice,Odds}=await import('/js/rng.js');L.monsters=[];L.npcs=[];L.dressing=[];L.fields={};L.lights=[];
  const rows=[];let normal=0,ordinaryCalm=0,floatCalmChanged=0;
  for(const subject of ['Heart','altar relic','gold']){
   L.piece=subject==='altar relic'?piece:null;L.items={[`${x},${y}`]:[subject==='Heart'?{t:'artifact',q:1}:subject==='altar relic'?{t:'dagger',u:'grimtooth',e:2,q:1}:{t:'gold',q:7}]};
   const before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s];
   for(const height of [160,304,464])for(const calm of [false,true])for(const now of [235.5,471,942,1413])for(const angle of [0,Math.PI/2]){
    renderers.forEach(r=>{r.setHeight(height);r.setCalm(calm);});const rs=Game.renderState(now),cam={x:x+.5-Math.cos(angle)*2,y:y+.5-Math.sin(angle)*2,angle},fx={...rs.fx,arriveAt:-1e9,view:{...rs.fx.view,weapon:null,shield:null,offhand:null,lantern:false}},random=Math.random;let seed;
    try{Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};for(const r of renderers){seed=12345;r.render({...L,explored:L.explored.slice()},cam,rs.sprites,fx,now);}}finally{Math.random=random;}
    const pixels=canvases.map(c=>new Uint32Array(c.getContext('2d').getImageData(0,0,c.width,c.height).data.buffer));let changed=0;for(let i=0;i<pixels[0].length;i++)if(pixels[0][i]!==pixels[1][i])changed++;
    if(!calm||subject==='gold'){if(changed)throw Error('Unchanged control differs: '+JSON.stringify({subject,height,calm,now,angle,changed}));if(calm)ordinaryCalm++;else normal++;}else if(changed)floatCalmChanged++;
    rows.push({subject,height,calm,now,angle,changed});
   }
   if(before!==JSON.stringify(Game.state())||dice[0]!==Dice.s||dice[1]!==Odds.s)throw Error('Fixture changed state or dice');
  }
  if(!floatCalmChanged)throw Error('Calm comparison did not exercise the fix');return{normalIdentical:normal,ordinaryCalmIdentical:ordinaryCalm,floatCalmChanged,unchangedGameAndDice:true,rows};
 });
 proof.baseline=baseline;proof.scope='Matched frozen-state source comparison with supplied clear shrine fixture and copied exploration arrays; normal animation and ordinary Calm pixels must match; not native play or balance evidence.';proof.sources=Object.fromEntries(['renderer.js','motion.js','release.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(root+'/js/'+f)).digest('hex')]));
 fs.writeFileSync(process.env.TREASURE_COMPARE_OUT||path.join(__dirname,'comparison.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({normalIdentical:proof.normalIdentical,ordinaryCalmIdentical:proof.ordinaryCalmIdentical,floatCalmChanged:proof.floatCalmChanged}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
