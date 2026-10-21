'use strict';
const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const {watchForErrors,startGame}=require('./helpers');

async function unlock(page,keyboard=false,navigate=true){
  if(navigate) await page.goto('/');
  const release=page.locator('#release-info');
  await release.scrollIntoViewIfNeeded();
  if(keyboard){await release.focus();for(let i=0;i<5;i++)await page.keyboard.press('Enter');}
  else for(let i=0;i<5;i++)await release.click();
  await expect(page.locator('#wayfarer-unlocked')).toBeVisible();
}

test('five title taps reveal the Wayfarer, persist on this device, and leave the six public classes unchanged @mobile',async({page})=>{
 const errors=watchForErrors(page);
 await page.goto('/');await page.click('#btn-new');await expect(page.locator('.class-card')).toHaveCount(6);await page.click('#c-back');
 for(let i=0;i<4;i++)await page.click('#release-info');
 await expect(page.locator('#wayfarer-unlocked')).toBeHidden();
 await page.click('#release-info');await expect(page.locator('#wayfarer-unlocked')).toBeVisible();
 await page.click('#btn-new');await expect(page.locator('.class-card')).toHaveCount(7);await page.click('[data-cls="spellblade"]');
 await expect(page.locator('#c-class-title')).toHaveText('Spellblade');
 await expect(page.locator('#c-name')).toHaveValue('The Wayfarer');
 await expect(page.locator('.class-backstory')).toContainText('The oldest kneel.');
 await expect(page.locator('#c-portrait')).toHaveAttribute('src','img/portraits/spellblade.webp');
 await expect.poll(()=>page.locator('#c-portrait').evaluate(i=>i.complete&&i.naturalWidth===512)).toBe(true);
 await expect(page.locator('#c-class-more .create-mastery')).toHaveCount(0);
 await page.locator('#c-customise > summary').click();
 await expect(page.locator('#c-start')).not.toContainText('last stage');
 await page.reload();await page.click('#btn-new');await expect(page.locator('[data-cls="spellblade"]')).toBeVisible();
 await page.click('[data-cls="spellblade"]');await page.click('#c-begin');
 await expect(page.locator('#pro-who')).toHaveText('Bearer of the Last Flame');
 await expect(page.locator('#pro-story')).toContainText('keeper of the western gate');
 await expect(page.locator('#pro-motive')).toContainText('souls in your lantern');
 await expect(page.locator('#screen-prologue [data-voice-background]')).toBeHidden();
 expect(errors).toEqual([]);
});

test('keyboard unlock is accessible with double text and never replaces an existing save @mobile',async({page})=>{
 const errors=watchForErrors(page);
 await startGame(page,{seed:'wayfarer-save-guard'});await page.evaluate(()=>Game.save());
 await page.addInitScript(()=>localStorage.setItem('deepdelve.textSize','4'));
 await page.goto('/');
 const saved=await page.evaluate(()=>localStorage.getItem('deepdelve.save'));
 await unlock(page,true,false);
 expect(await page.evaluate(()=>localStorage.getItem('deepdelve.save'))).toBe(saved);
 await expect(page.locator('#btn-continue')).toBeVisible();
 // Read the final colours, as the existing title accessibility suite does.
 await expect(page.locator('#screen-title')).not.toHaveClass(/opening/);
 expect(await page.evaluate(()=>document.querySelector('#screen-title').scrollWidth<=innerWidth)).toBe(true);
 const axe=await new AxeBuilder({page}).include('#screen-title').analyze();
 expect(axe.violations.filter(v=>['serious','critical'].includes(v.impact))).toEqual([]);
 expect(errors).toEqual([]);
});

test('the hidden hero descends with a sword and lantern, casts runes, and resumes its own saved class @mobile',async({page})=>{
 const errors=watchForErrors(page);
 await page.addInitScript(()=>{localStorage.setItem('deepdelve.tipsOff','1');localStorage.setItem('deepdelve.firstSeen','1');});
 await unlock(page);
 await startGame(page,{cls:'Spellblade',name:'The Wayfarer',seed:'wayfarer-live',permadeath:false});
 await page.evaluate(()=>{Game.skipPrelude();Game.level().monsters=[];});
 expect(await page.evaluate(()=>({cls:Game.player().cls,weapon:Game.player().eq.weapon.t,lantern:Game.player().eq.shield.t}))).toEqual({cls:'spellblade',weapon:'longsword',lantern:'wayfarer_lantern'});
 await page.click('[data-open="inv"]');
 await expect(page.locator('[data-hand="left"]')).toHaveAccessibleName(/Left hand: Silver Lantern, Lantern/);
 await page.click('#ov-inv [data-close]');
 await page.click('[data-open="spells"]');
 await expect(page.locator('#spell-list .spell')).toHaveCount(5);
 await expect(page.locator('#spell-list .spell').filter({hasText:'Runic Edge: Lightning'})).toBeDisabled();
 await page.locator('#spell-list .spell').filter({hasText:'Runic Edge: Fire'}).click();
 expect(await page.evaluate(()=>Game.player().effects.runicEdge.src)).toBe('runic_fire');
 await page.click('[data-open="journal"]');await page.click('[data-jtab="effects"]');
 await expect(page.locator('#journal-list')).toContainText('Runic Edge: Fire');
 await page.click('#ov-journal [data-close]');
 await page.evaluate(()=>Game.save());await page.reload();await page.click('#btn-continue');
 expect(await page.evaluate(()=>[Game.player().cls,Game.player().effects.runicEdge.src])).toEqual(['spellblade','runic_fire']);
 expect(errors).toEqual([]);
});

test('the Silver Lantern is carried visibly on ordinary and dark floors and disappears when put away @mobile',async({page})=>{
 await unlock(page);await startGame(page,{cls:'Spellblade',seed:'wayfarer-lantern-view'});
 await page.evaluate(()=>{Game.skipPrelude();Game.level().monsters=[];});
 const inspect=()=>page.evaluate(()=>{
   const rs=Game.renderState(performance.now()),f=Assets.carried(rs.fx.view.shield,'spellblade');
   const pixels=f?.img.getContext('2d').getImageData(0,0,f.img.width,f.img.height).data||[];
   let blue=0,silver=0;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]){if(pixels[i+2]>pixels[i]+35&&pixels[i+1]>100)blue++;if(pixels[i]>130&&pixels[i+1]>140&&pixels[i+2]>150)silver++;}
   Renderer.render(rs.level,rs.cam,rs.sprites,rs.fx,performance.now());
   return {shield:rs.fx.view.shield,amber:Renderer.lantern,blue,silver,hands:Renderer.hands.length};
 });
 let held=await inspect();expect(held.shield).toBe('wayfarer_lantern');expect(held.blue).toBeGreaterThan(0);expect(held.silver).toBeGreaterThan(0);expect(held.hands).toBeGreaterThanOrEqual(2);
 await page.evaluate(()=>Game.level().twist='dark');held=await inspect();expect(held.amber).toBe(0);
 const rims=await page.evaluate(()=>{
   const height=Renderer.H,calm=Renderer.calm,rows=[],f=Assets.carried('wayfarer_lantern','spellblade');
   try{
     Renderer.setCalm(false);
     for(const h of [Renderer.H_MIN,164,200,Renderer.H_MAX])for(const walk of [0,0.5,1]){
       Renderer.setHeight(h);
       const now=700*Math.PI/2,rs=Game.renderState(now);
       const fx={...rs.fx,view:{...rs.fx.view,walk},arriveAt:-1e9,damageUntil:-1e9,castAt:-1e9,readAt:-1e9,useAt:-1e9};
       Renderer.render(rs.level,rs.cam,rs.sprites,fx,now);
       const box=Renderer.hands[0];
       rows.push({height:Renderer.H,walk,bottom:box[1]+f.at.base[1]*box[3]/f.img.height});
       fx.castAt=now-260;Renderer.render(rs.level,rs.cam,rs.sprites,fx,now);
       const lowered=Renderer.hands[0];rows[rows.length-1].castGrip=lowered[1]+f.ay*lowered[3]/f.img.height;
     }
   }finally{Renderer.setHeight(height);Renderer.setCalm(calm);}
   return rows;
 });
 for(const rim of rims){
   expect(rim.bottom,`lantern rim stays in the ${rim.height}-row view at walking phase ${rim.walk}`).toBeLessThanOrEqual(rim.height);
   expect(rim.castGrip,`the lantern grip lowers out of the ${rim.height}-row view while the hand casts`).toBeGreaterThanOrEqual(rim.height);
 }
 await page.evaluate(()=>{Game.level().twist=null;Game.player().eq.shield=null;});
 expect(await page.evaluate(()=>Game.renderState(performance.now()).fx.view.shield)).toBeNull();
});

test('Wayfarer level-up cards teach exclusive talents and lantern memories @mobile',async({page})=>{
 await unlock(page);await startGame(page,{cls:'Spellblade',seed:'wayfarer-level-cards'});
 await page.evaluate(()=>{Game.skipPrelude();Game.level().monsters=[];});
 async function levelUp(level){await page.evaluate(async level=>{
   const {XP_TABLE}=await import('/js/data.js');const p=Game.player();p.xp=XP_TABLE[level-1];
   const m={id:'rat',uid:9000+level,x:p.x+1,y:p.y,hp:1,maxHp:1,nextAct:1e12};Game.level().monsters.push(m);Game.hurtMonster(m,999);
 },level);}
 await levelUp(2);await expect(page.locator('#boon-title')).toContainText("Spellblade's talent");
 await expect(page.locator('#boon-list .boon')).toHaveCount(3);
 expect(await page.evaluate(()=>Game.pendingBoons().every(id=>id.startsWith('wf_')))).toBe(true);
 const before=await page.evaluate(()=>({hp:Game.player().maxHp,sp:Game.player().maxSp}));
 await expect(page.locator('#boon-list')).toContainText('5 maximum hit points and 2 maximum spell points');
 await page.locator('#boon-list .boon').first().click();
 expect(await page.evaluate(()=>({hp:Game.player().maxHp,sp:Game.player().maxSp}))).toEqual({hp:before.hp+5,sp:before.sp+2});
 await levelUp(3);await expect(page.locator('#boon-title')).toContainText('what the delve taught you');
 expect(await page.evaluate(()=>Game.pendingBoons().every(id=>id.startsWith('wf_')))).toBe(true);
 await expect(page.locator('#boon-list')).toContainText('Memories return through the blue flame');
});
