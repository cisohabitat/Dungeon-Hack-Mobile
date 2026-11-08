'use strict';
// A controlled source comparison, not an untouched historical deployment or
// unassisted play: v0.9.76's renderer shares the candidate's unchanged art code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(path.join(root,'node_modules/@playwright/test'));
const {startGame,watchForErrors}=require(path.join(root,'test/browser/helpers'));
const {start}=require(path.join(root,'test/server.js'));
const BASE='3e822369e3923c2a0254f69eaab6245a956aeb46';
const sha=body=>crypto.createHash('sha256').update(body).digest('hex');
const out=process.env.REFACTOR_OUT||'/workspace/refactor77-parity';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const baseline=execFileSync('git',['show',BASE+':js/renderer.js'],{cwd:root});
 const server=await start(0);let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const url='http://127.0.0.1:'+server.address().port;
  const page=await browser.newPage({baseURL:url,viewport:{width:390,height:844},serviceWorkers:'block'}),errors=watchForErrors(page);
  await page.route('**/js/renderer-baseline.js',r=>r.fulfill({body:baseline,contentType:'text/javascript'}));
  await page.addInitScript(()=>{for(const k of ['sound','samples','prelude'])localStorage.setItem('deepdelve.'+k,'off');});
  await startGame(page,{seed:'held-extraction-parity'});
  const proof=await page.evaluate(async()=>{
   Game.update=()=>{};Game.recordRuns(false);Game.level().monsters=[];
   const {Renderer:old}=await import('/js/renderer-baseline.js'),{Renderer:current}=await import('/js/renderer.js?held-parity');
   const {PAINTED}=await import('/js/paintedcatalog.js'),{CLASSES}=await import('/js/data.js'),{Rng,Dice,Odds}=await import('/js/rng.js');
   const canvases=[old,current].map(()=>{const c=document.createElement('canvas');c.width=320;return c;});
   const contexts=canvases.map(c=>c.getContext('2d',{willReadFrequently:true}));
   old.init(canvases[0],160);current.init(canvases[1],160);
   const rs=Game.renderState(10000),level={...rs.level,monsters:[],npcs:[],dressing:[],items:{},fields:{},remains:[]};
   const now=12000,off=-1e9,base={...rs.fx,swingAt:off,offAt:off,castAt:off,readAt:off,useAt:off,throwAt:off,bashAt:off,arriveAt:off,damageUntil:0,heartAt:-1,boss:null,dust:0,hpFrac:1};
   const loadouts=[
    {id:'fist',weapon:null},{id:'sword-shield',weapon:'longsword',shield:'shield'},
    {id:'greatsword',weapon:'greatsword',two:true},{id:'dual',weapon:'longsword',offhand:'dagger'},
    {id:'bow',weapon:'longbow',drawn:true},{id:'named-bow',weapon:'mythic_horizon',drawn:true},
    {id:'sling',weapon:'sling'},{id:'crossbow',weapon:'handxbow'},
    {id:'knife',weapon:'throwknife'},{id:'named-knife',weapon:'relic_vashti'},
    {id:'spear',weapon:'spear',two:true},{id:'named-staff',weapon:'relic_emberwood',two:true,cls:'mage'},
    {id:'focus',weapon:null,shield:'crystal_orb',cls:'mage'},
    {id:'silver-lantern',weapon:'longsword',shield:'wayfarer_lantern',cls:'spellblade'},
    {id:'amber-lantern',weapon:'longsword',lantern:true},
   ];
   const actions=[{id:'rest'},...['.08','.16','.24','.32','.52','.84'].map(u=>({id:'swing'+u,swingAt:now-Number(u)*300,swingMs:300})),
    {id:'offhand',offAt:now-140},{id:'cast',castAt:now-260,castColor:'#a0ceff'},
    {id:'read',readAt:now-330,readSpell:'fireball',readColor:'#ff8833'},
    {id:'drink',useAt:now-330,useKind:'drink',useSprite:'potion_red',useColor:'#e04040'},
    {id:'eat',useAt:now-330,useKind:'eat',useSprite:'food',useColor:'#c8aa78'},
    {id:'bash-shield',bashAt:now-170,bashKind:'shield'},{id:'bash-pommel',bashAt:now-170,bashKind:'pommel'},
    {id:'throw',throwAt:now-170},{id:'hurt',damageUntil:now+130},{id:'arrival',arriveAt:now-100}];
   const cases=loadouts.flatMap(l=>actions.map(a=>({loadout:l,action:a})));
   for(const cls of Object.keys(CLASSES))for(const action of actions.filter(a=>['rest','cast','read','drink'].includes(a.id)))cases.push({loadout:{id:'class-'+cls,cls,weapon:null,shield:null},action});
   function fxFor(c){const {id:li,...l}=c.loadout,{id:ai,...a}=c.action;return{...base,...a,view:{weapon:null,shield:null,offhand:null,two:false,drawn:false,lantern:false,cls:'fighter',walk:.45,steps:3,...l}};}
   // Ambient dust has its own unsaved Math.random initialization in each
   // renderer. Give those two presentation streams matching seeds/call order;
   // restore Math.random immediately, without touching Dice or Odds.
   const randoms=new Map([[old,new Rng('held-parity-dust')],[current,new Rng('held-parity-dust')]]);
   function render(r,c){const original=Math.random;Math.random=()=>randoms.get(r).next();try{r.render({...level,explored:level.explored.slice()},rs.cam,[],fxFor(c),now);}finally{Math.random=original;}}
   // Start demand loading using genuine current draw calls, then allow those
   // exact picture requests to settle before comparing fixed-time frames.
   for(const c of cases){render(old,c);render(current,c);}
   const ids=new Set(loadouts.flatMap(l=>[l.weapon,l.shield,l.offhand]).filter(Boolean));
   const urls=[...new Set([...Object.values(PAINTED.held),...Object.values(PAINTED.carried)].filter(m=>ids.has(m.id)).map(m=>m.path))];
   await Promise.all(urls.map(url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=()=>reject(Error('Art failed: '+url));im.src='/'+url;})));
   await new Promise(resolve=>setTimeout(resolve,0));
   const before=JSON.stringify(Game.state()),dice=[Dice.s,Odds.s],rows=[];
   for(const height of [160,304,464])for(const calm of [false,true]){
    old.setHeight(height);current.setHeight(height);old.setCalm(calm);current.setCalm(calm);
    for(const c of cases){
     // Warm each instance's presentation-only memory, including lantern state.
     render(old,c);render(current,c);render(old,c);render(current,c);
     const a=contexts[0].getImageData(0,0,320,height).data,b=contexts[1].getImageData(0,0,320,height).data;
     let different=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])different++;
     const handsEqual=JSON.stringify(old.hands)===JSON.stringify(current.hands);
     const row={height,calm,loadout:c.loadout.id,action:c.action.id,differentBytes:different,handsEqual};rows.push(row);
     if(different||!handsEqual)throw Error('Pixel/hand mismatch: '+JSON.stringify(row));
    }
   }
   if(JSON.stringify(Game.state())!==before||Dice.s!==dice[0]||Odds.s!==dice[1])throw Error('Comparison changed game state or dice');
   return{cases:rows.length,rows,heights:[160,304,464],settings:['Normal','Calm'],loadedSelectedArt:urls.length,stateAndDiceUnchanged:true,scope:'Controlled supplied action snapshots on one generated floor, no actors. Actual old/new renderer code, shared current unchanged dependencies/art, matching seeded unsaved dust initialization. Math.random restored after each render; gameplay Dice/Odds untouched. Not an untouched historical deployment, native input or physical-device approval.'};
  });
  if(errors.length)throw Error(JSON.stringify(errors));
  const files=['js/renderer.js','js/heldrenderer.js','js/heldview.js','js/spellfx.js','js/overlay.js','js/assets.js','js/release.js'];
  const record={baseline:BASE,baselineRendererSha256:sha(baseline),sourceHashes:Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))])),...proof,errors};
  fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({...record,rows:undefined}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
