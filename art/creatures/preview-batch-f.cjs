'use strict';
// Review-only painted substitutions into actual companion render-state draws.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { serve } = require('../../test/server');
const { startGame, faceOpenGround, artReady, watchForErrors } = require('../../test/browser/helpers');
const folder = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(folder,'generation-batch-f.json')));
const kinds = Object.keys(manifest.creatures);
const livePoses = kind => ['idle','stepA','stepB','windup','sit','hurt','blink',...(kind==='mender'?['heal']:[])];
const output = path.join(folder,'batch-f-preview','dungeon');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const server=http.createServer(serve);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  const results=[];
  try {
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
    for(const width of [390,320]) {
      const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',baseURL:`http://127.0.0.1:${server.address().port}`});
      const page=await context.newPage();
      const errors=watchForErrors(page);
      await page.addInitScript(()=>{for(const[k,v]of Object.entries({sound:'off',samples:'off',prelude:'off'}))localStorage.setItem(`deepdelve.${k}`,v);});
      await startGame(page,{seed:'combat-clarity',name:'Companion art review'});
      await page.evaluate(()=>{Game.level().monsters.length=0;Game.state().companion=null;});
      if(await faceOpenGround(page,3)<3)throw new Error('No clear review corridor');
      await artReady(page,Object.fromEntries(kinds.map(k=>[k,livePoses(k).filter(p=>p!=='idle')])));
      await page.locator('#floor-card').evaluate(el=>el.style.display='none');
      for(const kind of kinds) {
        await page.evaluate(async({kind,poses})=>{
          const image=new Image();image.src=`/art/creatures/batch-f-preview/${kind}.webp`;await image.decode();
          if(image.naturalWidth!==768||image.naturalHeight!==768)throw new Error('Invalid atlas');
          window.__batchFFrames={};
          const makeFrame=(img,sx,sy)=>{
            const cell=document.createElement('canvas');cell.width=cell.height=256;
            cell.getContext('2d').drawImage(img,sx,sy,256,256,0,0,256,256);
            const levels=[0,.25,.45,.62,.78].map(alpha=>{
              const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.drawImage(cell,0,0);
              if(alpha){ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=alpha;ctx.fillStyle='#000';ctx.fillRect(0,0,256,256);}return c;
            });
            const data=cell.getContext('2d').getImageData(0,0,256,256).data;let top=256;
            for(let i=3;i<data.length;i+=4)if(data[i]>32){top=Math.floor((i-3)/4/256);break;}
            return {w:256,h:256,top:top/256,levels,flash:cell,near:null};
          };
          poses.forEach((pose,i)=>{window.__batchFFrames[pose]=makeFrame(image,i%3*256,Math.floor(i/3)*256);});
          if(kind==='mender'){
            const heal=new Image();heal.src='/art/creatures/batch-f-preview/mender-heal.webp';await heal.decode();
            if(heal.naturalWidth!==256||heal.naturalHeight!==256)throw new Error('Invalid heal frame');
            window.__batchFFrames.heal=makeFrame(heal,0,0);
          }
          const p=Game.player(),[dx,dy]=Dungeon.DIRS[p.dir];
          Game.state().companion={kind:({dog:'hound',scrag:'goblin'})[kind]||kind,name:'Reviewed '+kind,x:p.x+dx,y:p.y+dy,depth:Game.state().depth,hp:20,maxHp:20,mode:'follow',nextAct:1e12,kills:0,joined:1};
        },{kind,poses:manifest.poses});
        for(const pose of livePoses(kind)) {
          const metrics=await page.evaluate(({kind,pose})=>{
            // Fixed review clock makes idle/blink and exact gait halves reproducible.
            const now=pose==='blink'?110689:111189,c=Game.state().companion;
            Object.assign(c,{mode:pose==='sit'?'stay':'follow',moveT0:0,moveT1:0,lungeAt:-1e9,flashUntil:-1e9,dressAt:-1e9,tending:pose==='heal',flareAt:-1e9});
            if(pose==='windup')c.lungeAt=now-100;
            if(pose==='hurt')c.flashUntil=now-100;
            if(pose==='stepA'||pose==='stepB'){
              const even=(c.x+c.y)%2===0,first=(pose==='stepA')===even;
              c.moveT0=now-(first?100:300);c.moveT1=c.moveT0+400;c.fromX=c.x;c.fromY=c.y;
            }
            const rs=Game.renderState(now),base=Assets.sprites[kind],expected=pose==='idle'?base:base[pose];
            if(!expected)throw new Error(`Unsupported companion pose ${kind}:${pose}`);
            const sprite=rs.sprites.find(s=>s.img===expected&&Math.abs(s.x-(c.x+.5))<.01&&Math.abs(s.y-(c.y+.5))<.01);
            if(!sprite)throw new Error(`Live companion did not select ${kind}:${pose}`);
            const scale=sprite.scale;
            sprite.img=window.__batchFFrames[pose];sprite.procedural=true;
            rs.fx={...rs.fx,arriveAt:-1e9};
            if(!window.__batchFOriginalRender)window.__batchFOriginalRender=Renderer.render;
            Renderer.render=()=>window.__batchFOriginalRender(rs.level,rs.cam,rs.sprites,rs.fx,now);
            Renderer.render();UI.refreshHud(true);
            return {kind,pose,scale,selected_live_pose:true,drawn:Renderer.shown};
          },{kind,pose});
          if(metrics.scale!==.62)throw new Error('Companion scale changed');
          await page.screenshot({path:path.join(output,`${width}-${kind}-${pose}.png`)});
          results.push({width,...metrics});
        }
      }
      if(errors.length)throw new Error(errors.join('\n'));
      await context.close();
      const overview=await browser.newPage({viewport:{width:1260,height:844}}),origin=`http://127.0.0.1:${server.address().port}`;
      await overview.setContent('<style>body{margin:0;background:#20242c;color:white;font:11px monospace;display:grid;grid-template-columns:repeat(7,180px)}figure{margin:0}img{width:180px}figcaption{height:28px;padding:3px}</style>'+kinds.flatMap(kind=>livePoses(kind).map(pose=>`<figure><figcaption>${kind} / ${pose}</figcaption><img src="${origin}/art/creatures/batch-f-preview/dungeon/${width}-${kind}-${pose}.png"></figure>`)).join(''));
      await overview.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
      await overview.screenshot({path:path.join(output,`${width}-overview.png`),fullPage:true});await overview.close();
      console.log(`Captured ${kinds.length} companions at ${width}px`);
    }
    fs.writeFileSync(path.join(output,'review.json'),JSON.stringify({mode:'review-only frame substitutions; real companion pose selection and dungeon renderer; no runtime bindings',console_errors:[],results},null,2)+'\n');
  }finally{if(browser)await browser.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
})().catch(error=>{console.error(error);process.exitCode=1;});
